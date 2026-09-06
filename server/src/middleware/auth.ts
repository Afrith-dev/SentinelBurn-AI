import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    // For seamless local testing, allow demo requests with default mock user if no auth header passed
    req.user = {
      id: 'u-rel-01',
      name: 'Dr. Afrith (Reliability Lead)',
      email: 'engineer@sentinelburn.aero',
      role: 'reliability_engineer'
    };
    return next();
  }

  // Handle demo / offline mock tokens (format: "mock-token-<role>" or "google-oauth-mock-token")
  if (token.startsWith('mock-token-') || token === 'google-oauth-mock-token') {
    const roleStr = token === 'google-oauth-mock-token'
      ? 'reliability_engineer'
      : token.replace('mock-token-', '');

    const allowedRoles: UserRole[] = ['admin', 'qa_manager', 'reliability_engineer', 'operator', 'fa_engineer'];
    const role: UserRole = allowedRoles.includes(roleStr as UserRole)
      ? (roleStr as UserRole)
      : 'reliability_engineer';

    const demoNames: Record<UserRole, { id: string; name: string; email: string }> = {
      admin:                 { id: 'u-admin-01', name: 'Dr. Mohamed',              email: 'admin@sentinelburn.aero' },
      reliability_engineer:  { id: 'u-rel-01',   name: 'Dr. Afrith',               email: 'engineer@sentinelburn.aero' },
      qa_manager:            { id: 'u-qa-01',    name: 'Dr. Selvi',                email: 'qa@sentinelburn.aero' },
      operator:              { id: 'u-op-01',    name: 'Floor Operator',           email: 'operator@sentinelburn.aero' },
      fa_engineer:           { id: 'u-fa-01',    name: 'Dr. Balaji',               email: 'fa@sentinelburn.aero' },
    };

    const demo = demoNames[role];
    req.user = { ...demo, role };
    return next();
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient privileges for this aerospace action',
        requiredRoles: allowedRoles,
        currentRole: req.user?.role
      });
    }
    next();
  };
};
