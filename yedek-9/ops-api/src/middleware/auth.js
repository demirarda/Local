import jwt from 'jsonwebtoken';

const OPS_JWT_SECRET = process.env.OPS_JWT_SECRET || 'ops-dev-secret-change-me';
const OPS_JWT_EXPIRES_IN = process.env.OPS_JWT_EXPIRES_IN || '8h';

export function signOpsToken(user) {
  return jwt.sign(
    { opsUserId: user.id, email: user.email, role: user.role },
    OPS_JWT_SECRET,
    { expiresIn: OPS_JWT_EXPIRES_IN }
  );
}

export function requireOpsAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, OPS_JWT_SECRET);
    req.opsUser = {
      id: payload.opsUserId,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.opsUser || !roles.includes(req.opsUser.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}
