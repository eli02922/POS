import { verifyToken } from './auth.js';
import { User } from './db.js';

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is required.' });
  }

  try {
    const payload = verifyToken(header.slice(7));
    const user = await User.findByPk(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'User session is no longer valid.' });
    }

    req.user = user.toJSON();
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You are not allowed to perform this action.' });
  }

  return next();
};