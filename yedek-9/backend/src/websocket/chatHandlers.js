// WebSocket handlers for chat functionality

let io;

export function initializeChatHandlers(socketIOServer) {
  io = socketIOServer;
}

// Emit chat message to all users subscribed to a ritual
export function emitChatMessage(ritualId, messageData) {
  if (!io) {
    console.warn('Socket.io not initialized for chat');
    return;
  }

  io.to(`ritual:${ritualId}`).emit('chat:message', {
    ritual_id: ritualId,
    message: messageData,
  });
}

// Emit host announcement to all users subscribed to a ritual
export function emitHostAnnouncement(ritualId, announcementData) {
  if (!io) {
    console.warn('Socket.io not initialized for chat');
    return;
  }

  io.to(`ritual:${ritualId}`).emit('chat:announcement', {
    ritual_id: ritualId,
    announcement: announcementData,
  });
}
