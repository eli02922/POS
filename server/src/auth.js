import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'pos-demo-secret';

export const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

export const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

export const comparePassword = (plainText, passwordHash) => bcrypt.compare(plainText, passwordHash);