/**
 * §1 race: backend tek kod. Aynı-saniye tie-break HOST, sonra ilk-yazan.
 * PENDING host masayı açmış sayılmaz — opener kredisi alamaz.
 */
export function pickFirstSealOpenerId(ritual, actorUserId, hostAttendance, actorAttemptAt) {
  const hostId = ritual?.host_id;
  if (!hostId || String(hostId) === String(actorUserId)) return actorUserId;

  const hostPhase = hostAttendance?.checkin_phase || null;
  if (hostPhase === 'pending_witness') return actorUserId;

  const hostAttemptAt = hostAttendance?.checkin_attempt_at
    ? new Date(hostAttendance.checkin_attempt_at)
    : null;
  const actorAt = actorAttemptAt ? new Date(actorAttemptAt) : null;
  if (
    hostAttemptAt &&
    actorAt &&
    !Number.isNaN(hostAttemptAt.getTime()) &&
    !Number.isNaN(actorAt.getTime()) &&
    Math.floor(hostAttemptAt.getTime() / 1000) === Math.floor(actorAt.getTime() / 1000)
  ) {
    return hostId;
  }
  return actorUserId;
}
