import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload; // { id, role, username }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: 'Acceso denegado' });
    next();
  };
}
