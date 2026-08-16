export function sendError(res, status, code, message, details = undefined) {
  const payload = {
    error: {
      code,
      message,
    },
  };
  if (details !== undefined) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
}
