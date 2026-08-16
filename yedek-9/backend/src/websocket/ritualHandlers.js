import pool from '../config/database.js';

// Emit ritual updates to all subscribers
export function emitRitualUpdate(io, ritualId, updateType, data) {
  io.to(`ritual:${ritualId}`).emit('ritual:update', {
    ritualId,
    updateType, // 'status_change', 'attendance_update', 'new_ritual'
    data,
    timestamp: new Date().toISOString()
  });
}

// Emit city updates to scoped room subscribers
export function emitPulseUpdate(io, cityId) {
  io.to(`city:${cityId}`).emit('pulse:update', {
    city: cityId,
    city_id: cityId,
    timestamp: new Date().toISOString()
  });
  // Backward-compatible alias room
  io.to(`pulse:${cityId}`).emit('pulse:update', {
    city: cityId,
    city_id: cityId,
    timestamp: new Date().toISOString()
  });
}

// Handle ritual subscription
export function handleRitualSubscribe(socket, ritualId) {
  socket.join(`ritual:${ritualId}`);
  console.log(`Client ${socket.id} subscribed to ritual ${ritualId}`);
  
  // Send current ritual state
  getRitualState(ritualId).then(state => {
    socket.emit('ritual:state', {
      ritualId,
      state,
      timestamp: new Date().toISOString()
    });
  }).catch(err => {
    console.error('Error fetching ritual state:', err);
  });
}

// Handle ritual unsubscribe
export function handleRitualUnsubscribe(socket, ritualId) {
  socket.leave(`ritual:${ritualId}`);
  console.log(`Client ${socket.id} unsubscribed from ritual ${ritualId}`);
}

// Get current ritual state
async function getRitualState(ritualId) {
  try {
    const query = `
      SELECT 
        r.*,
        u.name as host_name,
        COUNT(DISTINCT ra.user_id) as current_attendees
      FROM rituals r
      LEFT JOIN users u ON r.host_id = u.id
      LEFT JOIN ritual_attendance ra ON r.id = ra.ritual_id AND ra.status != 'no_show'
      WHERE r.id = $1
      GROUP BY r.id, u.name
    `;

    const result = await pool.query(query, [ritualId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const ritual = result.rows[0];
    const currentTime = new Date();
    
    return {
      id: ritual.id,
      title: ritual.title,
      status: ritual.status,
      current_attendees: parseInt(ritual.current_attendees) || 0,
      capacity: ritual.capacity,
      time_state: calculateTimeState(ritual, currentTime)
    };
  } catch (error) {
    console.error('Error getting ritual state:', error);
    throw error;
  }
}

// Calculate time state
function calculateTimeState(ritual, currentTime) {
  const startTime = new Date(ritual.start_time);
  const endTime = new Date(startTime.getTime() + ritual.duration * 60000);
  const minutesUntilStart = (startTime - currentTime) / 60000;
  const currentAttendees = parseInt(ritual.current_attendees) || 0;
  const capacity = ritual.capacity;

  if (ritual.status === 'live') {
    return 'live_now';
  }
  if (minutesUntilStart >= 0 && minutesUntilStart <= 90) {
    return 'starting_soon';
  }
  if (capacity - currentAttendees <= 3 && capacity - currentAttendees > 0) {
    return 'almost_full';
  }
  if (ritual.status === 'ended' && (currentTime - endTime) / 60000 <= 60) {
    return 'reopened';
  }
  return null;
}

// Handle pulse subscription (city-based)
export function handlePulseSubscribe(socket, city) {
  socket.join(`city:${city}`);
  socket.join(`pulse:${city}`); // compatibility alias
  console.log(`Client ${socket.id} subscribed to pulse for ${city}`);
}

// Handle pulse unsubscribe
export function handlePulseUnsubscribe(socket, city) {
  socket.leave(`city:${city}`);
  socket.leave(`pulse:${city}`); // compatibility alias
  console.log(`Client ${socket.id} unsubscribed from pulse for ${city}`);
}
