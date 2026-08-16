export function buildAvatarStoragePath(userId, timestampMs = Date.now(), ext = '.jpg') {
  return `/uploads/avatars/${userId}/${timestampMs}${ext}`;
}

export function buildMemoryStoragePath(userId, memoryId, timestampMs = Date.now(), ext = '.jpg') {
  return `/uploads/memories/${userId}/${memoryId}/${timestampMs}${ext}`;
}

export function buildVoiceStoragePath(userId, memoryId, timestampMs = Date.now(), ext = '.m4a') {
  return `/uploads/voice/${userId}/${memoryId}/${timestampMs}${ext}`;
}

export function buildChatMediaStoragePath(ritualId, messageId, timestampMs = Date.now(), ext = '.jpg') {
  return `/uploads/chat-media/${ritualId}/${messageId}/${timestampMs}${ext}`;
}
