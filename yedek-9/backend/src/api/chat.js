import express from 'express';
import crypto from 'crypto';
import sharp from 'sharp';
import pool from '../config/database.js';
import { emitChatMessage, emitHostAnnouncement } from '../websocket/chatHandlers.js';
import { authenticateToken } from './auth.js';
import {
  createPresignedUploadUrl,
  deleteS3Object,
  getS3ObjectBuffer,
  isS3MediaConfigured,
  putS3ObjectBuffer,
  toS3Uri,
  verifyS3ObjectExists,
} from '../utils/s3Media.js';
import { RITUAL_STATUS, getLifecyclePhase } from '../services/ritualState.js';
import LOCAL_CONFIG, { freeCancelThresholdMinutes } from '../config/localConfig.js';
import { assertCameraCaptureSource } from '../services/memoryStamp.js';
import { excludeBlockedUsersSql } from '../services/blockVisibility.js';

const router = express.Router();
const MB = 1024 * 1024;
const CHAT_PHOTO_MAX_BYTES = 10 * MB;
const CHAT_VOICE_MAX_BYTES = 25 * MB;
const CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CHAT_VOICE_TYPES = new Set(['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']);

async function getRitualMessagesHandler(req, res) {
  try {
    const ritualId = req.params.ritualId || req.params.ritual_id;
    const { limit = 50, before, user_id } = req.query;
    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Determine effective user id: prefer explicit query param but enforce it matches auth user
    const effectiveUserId = user_id ? String(user_id) : authUserId;

    if (user_id && String(user_id) !== String(authUserId)) {
      return res.status(403).json({
        success: false,
        error: 'user_id does not match authenticated user'
      });
    }

    // Check if user is attending the ritual
    const attendanceCheck = await pool.query(
      'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2 AND status != $3',
      [ritualId, effectiveUserId, 'no_show']
    );

    if (attendanceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'User is not attending this ritual'
      });
    }

    // Check ritual exists (and basic status)
    const ritualCheck = await pool.query(
      'SELECT start_time, duration, status FROM rituals WHERE id = $1',
      [ritualId]
    );

    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found'
      });
    }

    const ritual = ritualCheck.rows[0];
    const phase = getLifecyclePhase(ritual);

    if (phase === RITUAL_STATUS.ARCHIVED || phase === RITUAL_STATUS.CANCELLED) {
      return res.status(403).json({
        success: false,
        error: 'Chat is not available for this ritual',
      });
    }

    let query = `
      SELECT 
        cm.*,
        u.name as user_name,
        u.rs_score as user_rs_score
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.ritual_id = $1
    `;

    const params = [ritualId];
    let paramIndex = 2;

    {
      const blockEx = excludeBlockedUsersSql('cm.user_id', req.user?.userId, paramIndex);
      query += blockEx.sql;
      params.push(...blockEx.params);
      paramIndex = blockEx.nextIndex;
    }

    if (before) {
      query += ` AND cm.created_at < $${paramIndex}`;
      params.push(before);
      paramIndex++;
    }

    query += ` ORDER BY cm.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Reverse to show oldest first
    const messages = result.rows.reverse().map(msg => ({
      id: msg.id,
      ritual_id: msg.ritual_id,
      user_id: msg.user_id,
      user_name: msg.user_name,
      user_rs_score: parseFloat(msg.user_rs_score) || 6.0,
      message: msg.message,
      content: msg.content || msg.message,
      type: msg.type || 'text',
      media_url: msg.media_url || null,
      external_url: msg.external_url || null,
      message_type: msg.message_type,
      created_at: msg.created_at,
    }));

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat messages'
    });
  }
}

// GET /api/chat/:ritualId/messages - Get chat messages for a ritual
// Protected: access tied to authenticated user (attendee)
router.get('/:ritualId/messages', authenticateToken, getRitualMessagesHandler);

// GET /api/chat/:ritual_id/messages - backend-yeni.md path alias
router.get('/:ritual_id/messages', authenticateToken, getRitualMessagesHandler);

// POST /api/chat/:ritualId/messages - Send a chat message
// Protected: user_id must match authenticated user
router.post('/:ritualId/messages', authenticateToken, async (req, res) => {
  try {
    const { ritualId } = req.params;
    const { user_id, message, mode } = req.body;
    // §2: spec adı host_broadcast — DB enum host_announcement (tek yönlü, kilit öncesi açık)
    let message_type = req.body.message_type || 'user';
    if (message_type === 'host_broadcast') message_type = 'host_announcement';

    const authUserId = req.user?.userId;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!user_id || !message) {
      if (mode !== 'init_upload' && mode !== 'finalize_upload') {
        return res.status(400).json({
          success: false,
          error: 'user_id and message are required'
        });
      }
    }

    if (user_id && user_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'user_id does not match authenticated user'
      });
    }

    // Validate message type
    const validTypes = ['user', 'host_announcement', 'system'];
    if (!validTypes.includes(message_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message_type'
      });
    }

    // Check if user is attending the ritual
    const attendanceCheck = await pool.query(
      'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2',
      [ritualId, authUserId]
    );

    if (attendanceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'User is not attending this ritual',
        code: 'LIVE_TABLE_WRITE_FORBIDDEN',
        detail: 'Window readers cannot write to the live table',
      });
    }

    const ritualCheck = await pool.query(
      'SELECT start_time, duration, status FROM rituals WHERE id = $1',
      [ritualId]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found',
      });
    }
    const phase = getLifecyclePhase(ritualCheck.rows[0]);
    if (phase === RITUAL_STATUS.ARCHIVED || phase === RITUAL_STATUS.CANCELLED) {
      return res.status(403).json({
        success: false,
        error: 'Chat is not available for this ritual',
      });
    }

    // sonMD §2: kilit öncesi konuşma kapalı — yalnız host anonsu
    if (message_type !== 'host_announcement' && message_type !== 'system') {
      const ritualRow = ritualCheck.rows[0];
      const start = new Date(ritualRow.start_time);
      const lockMin = freeCancelThresholdMinutes(ritualRow);
      const lockAt = new Date(start.getTime() - lockMin * 60000);
      if (Date.now() < lockAt.getTime()) {
        return res.status(403).json({
          success: false,
          error: 'Table chat opens at lock moment',
          code: 'CHAT_LOCKED_UNTIL_LOCK',
          lock_moment_at: lockAt.toISOString(),
        });
      }
    }

    // For host announcements, verify user is host OR collaborator with announce
    if (message_type === 'host_announcement') {
      const { canAnnounce } = await import('../services/waveBSocial.js');
      const allowed = await canAnnounce({ ritualId, userId: authUserId });
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: 'Only the host or collaborator can send announcements',
        });
      }
    }

    // 9.2 upload flow for chat media
    if (mode === 'init_upload') {
      if (!isS3MediaConfigured()) {
        return res.status(503).json({ success: false, error: 'S3 media storage is not configured' });
      }
      const msgId = req.body.message_id || crypto.randomUUID();
      const uploadType = String(req.body.upload_type || 'photo');
      const contentType = String(req.body.content_type || (uploadType === 'voice' ? 'audio/m4a' : 'image/jpeg'));
      const fileSizeBytes = Number(req.body.file_size_bytes || 0);
      if (!['photo', 'voice'].includes(uploadType)) {
        return res.status(400).json({ success: false, error: 'upload_type must be photo or voice' });
      }
      if (uploadType === 'photo') {
        const galleryErr = assertCameraCaptureSource(req.body, LOCAL_CONFIG.visual || {});
        if (galleryErr) {
          return res.status(400).json({
            success: false,
            error: galleryErr,
            message: 'Prelobby/window fotolari yalniz in-app kamera ile',
          });
        }
        if (!CHAT_IMAGE_TYPES.has(contentType)) {
          return res.status(400).json({ success: false, error: 'Sohbet fotoğrafı formatı JPG/PNG/WebP olmalı' });
        }
        if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > CHAT_PHOTO_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Sohbet fotoğrafı en fazla 10MB olmalı' });
        }
      } else if (uploadType === 'voice') {
        if (!CHAT_VOICE_TYPES.has(contentType)) {
          return res.status(400).json({ success: false, error: 'Sesli not formatı M4A/MP3/WAV olmalı' });
        }
        if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > CHAT_VOICE_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Sesli not en fazla 25MB olmalı' });
        }
      }
      const ext = uploadType === 'voice' ? '.m4a' : '.jpg';
      const key = `local-app/chat-media/${ritualId}/${msgId}/${Date.now()}${ext}`;
      const uploadUrl = await createPresignedUploadUrl(key, contentType, 300);
      return res.json({
        success: true,
        data: {
          upload_url: uploadUrl,
          method: 'PUT',
          expires_in_seconds: 300,
          message_id: msgId,
          storage_key: key,
          content_type: contentType,
        }
      });
    }

    if (mode === 'finalize_upload') {
      if (!isS3MediaConfigured()) {
        return res.status(503).json({ success: false, error: 'S3 media storage is not configured' });
      }
      const msgId = req.body.message_id || crypto.randomUUID();
      const uploadType = String(req.body.upload_type || 'photo');
      const storageKey = String(req.body.storage_key || '');
      if (!storageKey) {
        return res.status(400).json({ success: false, error: 'storage_key is required for finalize_upload' });
      }
      const head = await verifyS3ObjectExists(storageKey);
      let finalKey = storageKey;
      let finalType = req.body.type || (uploadType === 'voice' ? 'voice' : 'photo');
      if (uploadType === 'photo') {
        const galleryErr = assertCameraCaptureSource(req.body, LOCAL_CONFIG.visual || {});
        if (galleryErr) {
          return res.status(400).json({
            success: false,
            error: galleryErr,
            message: 'Prelobby/window fotolari yalniz in-app kamera ile',
          });
        }
        if (!CHAT_IMAGE_TYPES.has(String(head.contentType || '').toLowerCase())) {
          return res.status(400).json({ success: false, error: 'Sohbet fotoğrafı formatı JPG/PNG/WebP olmalı' });
        }
        if (!Number.isFinite(head.contentLength) || head.contentLength <= 0 || head.contentLength > CHAT_PHOTO_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Sohbet fotoğrafı en fazla 10MB olmalı' });
        }
        const original = await getS3ObjectBuffer(storageKey);
        const webp = await sharp(original.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        finalKey = storageKey.replace(/\.[^/.]+$/, '.webp');
        await putS3ObjectBuffer(finalKey, webp, 'image/webp');
        if (finalKey !== storageKey) {
          await deleteS3Object(storageKey);
        }
      } else if (uploadType === 'voice') {
        if (!CHAT_VOICE_TYPES.has(String(head.contentType || '').toLowerCase())) {
          return res.status(400).json({ success: false, error: 'Sesli not formatı M4A/MP3/WAV olmalı' });
        }
        if (!Number.isFinite(head.contentLength) || head.contentLength <= 0 || head.contentLength > CHAT_VOICE_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Sesli not en fazla 25MB olmalı' });
        }
      } else {
        return res.status(400).json({ success: false, error: 'upload_type must be photo or voice' });
      }
      const text = String(req.body.caption || message || '').trim() || '[media]';
      const chatType = finalType;
      const result = await pool.query(
        `INSERT INTO chat_messages (id, ritual_id, user_id, message, message_type, content, type, media_url, external_url)
         VALUES ($1, $2, $3, $4, 'user', $4, $5::chat_message_type, $6, $7)
         RETURNING *`,
        [msgId, ritualId, authUserId, text, chatType, toS3Uri(finalKey), req.body.external_url || null]
      );
      return res.status(201).json({ success: true, data: result.rows[0] });
    }

    // Insert message
    const chatType = req.body.type || (message_type === 'host_announcement' || message_type === 'system' ? 'quote' : 'text');
    const externalUrl = req.body.external_url || null;
    const mediaUrl = req.body.media_url || null;
    const result = await pool.query(
      `INSERT INTO chat_messages (ritual_id, user_id, message, message_type, content, type, media_url, external_url)
       VALUES ($1, $2, $3, $4, $3, $5::chat_message_type, $6, $7)
       RETURNING *`,
      [ritualId, authUserId, message.trim(), message_type, chatType, mediaUrl, externalUrl]
    );

    const newMessage = result.rows[0];

    let mentions = [];
    try {
      const { resolveMentionTargets, persistMentions } = await import('../services/mentionService.js');
      const maxM = LOCAL_CONFIG.mention?.MAX_PER_MESSAGE ?? 5;
      const resolved = await resolveMentionTargets({
        text: newMessage.message || message,
        actorId: authUserId,
        ritualId,
      });
      mentions = (resolved.mentions || []).slice(0, maxM);
      await persistMentions({
        sourceType: 'chat_message',
        sourceId: newMessage.id,
        ritualId,
        actorId: authUserId,
        mentions,
      });
    } catch (_e) {
      /* non-fatal */
    }

    // Get user info for WebSocket
    const userResult = await pool.query(
      'SELECT name, rs_score FROM users WHERE id = $1',
      [authUserId]
    );

    const messageData = {
      id: newMessage.id,
      ritual_id: newMessage.ritual_id,
      user_id: newMessage.user_id,
      user_name: userResult.rows[0].name,
      user_rs_score: parseFloat(userResult.rows[0].rs_score) || 6.0,
      message: newMessage.message,
      content: newMessage.content || newMessage.message,
      type: newMessage.type || chatType,
      media_url: newMessage.media_url || mediaUrl,
      external_url: newMessage.external_url || externalUrl,
      message_type: newMessage.message_type,
      created_at: newMessage.created_at,
      mentions,
    };

    // Emit via WebSocket
    if (message_type === 'host_announcement') {
      emitHostAnnouncement(ritualId, messageData);
    } else {
      emitChatMessage(ritualId, messageData);
    }

    res.json({
      success: true,
      data: messageData
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send chat message'
    });
  }
});

// PATCH /api/chat/messages/:messageId — 5dk edit window
router.patch('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { editChatMessage } = await import('../services/waveBSocial.js');
    const result = await editChatMessage({
      messageId: req.params.messageId,
      userId: req.user.userId,
      content: req.body?.content,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error, code: result.code });
    }
    return res.json({ success: true, data: result.message });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to edit message' });
  }
});

// DELETE /api/chat/messages/:messageId — soft delete (silindi izi)
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { softDeleteChatMessage } = await import('../services/waveBSocial.js');
    const result = await softDeleteChatMessage({
      messageId: req.params.messageId,
      userId: req.user.userId,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.message });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// POST /api/chat/messages/:messageId/react — 🤝😂🙌👀💡❓
router.post('/messages/:messageId/react', authenticateToken, async (req, res) => {
  try {
    const { setChatReaction } = await import('../services/waveBSocial.js');
    const result = await setChatReaction({
      messageId: req.params.messageId,
      userId: req.user.userId,
      emoji: req.body?.emoji,
    });
    if (!result.ok) {
      return res
        .status(result.status || 400)
        .json({ success: false, error: result.error, allowed: result.allowed });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to react' });
  }
});

export default router;
