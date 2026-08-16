/**
 * LOCAL v2 §1 — identity gate middleware
 * Rule: no unverified accounts; Track A (uni email) OR Track B (KYC).
 */
import pool from '../config/database.js';
import { isIdentityGateSatisfied } from '../utils/identityPresentation.js';

export async function requireIdentityVerified(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const r = await pool.query(
      `SELECT email_verified, identity_verified, age_ok, identity_track FROM users WHERE id = $1`,
      [userId]
    );
    const u = r.rows[0];
    if (!u) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    if (!isIdentityGateSatisfied(u)) {
      return res.status(403).json({
        success: false,
        error: 'identity_verification_required',
        code: 'IDENTITY_GATE',
      });
    }
    // Track B: age_ok must be true. Track A (uni): age implied by adult campus policy / not forced false.
    if (u.identity_verified && u.age_ok === false) {
      return res.status(403).json({
        success: false,
        error: 'age_requirement_not_met',
        code: 'AGE_GATE',
      });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Identity gate failed' });
  }
}

export default requireIdentityVerified;
