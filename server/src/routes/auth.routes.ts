import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/store';
import { ENV } from '../config/env';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.users.get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  user.lastLogin = new Date().toISOString();

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    ENV.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin
    }
  });
});

authRouter.post('/register', (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }

  if (db.users.has(email.toLowerCase())) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const allowedRoles: UserRole[] = ['admin', 'qa_manager', 'reliability_engineer', 'operator', 'fa_engineer'];
  const userRole: UserRole = allowedRoles.includes(role) ? role : 'reliability_engineer';

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: userRole,
    createdAt: new Date().toISOString()
  };

  db.users.set(newUser.email, newUser);

  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    ENV.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt
    }
  });
});

authRouter.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});
