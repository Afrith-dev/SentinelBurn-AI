import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { db } from '../database/store';
import { ENV } from '../config/env';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

// --------------------------------------------------------------------------
// Email & Password Login
// --------------------------------------------------------------------------
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.users.get(normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
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

// --------------------------------------------------------------------------
// User Registration (Sign Up)
// --------------------------------------------------------------------------
authRouter.post('/register', (req: Request, res: Response) => {
  const { name, email, password, confirmPassword, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (db.users.has(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const allowedRoles: UserRole[] = ['admin', 'qa_manager', 'reliability_engineer', 'operator', 'fa_engineer'];
  const userRole: UserRole = allowedRoles.includes(role) ? role : 'reliability_engineer';

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser = {
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: userRole,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
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
      createdAt: newUser.createdAt,
      lastLogin: newUser.lastLogin
    }
  });
});

// --------------------------------------------------------------------------
// Continue with Google (OAuth / ID Token / Demo Flow)
// --------------------------------------------------------------------------
authRouter.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const { credential, email: directEmail, name: directName } = req.body;

    let googleEmail = directEmail;
    let googleName = directName;

    // If a Google ID token was passed
    if (credential && typeof credential === 'string') {
      try {
        // Attempt verifying with Google TokenInfo endpoint
        const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`, { timeout: 3000 });
        if (response.data && response.data.email) {
          googleEmail = response.data.email;
          googleName = response.data.name || response.data.email.split('@')[0];
        }
      } catch (verifyErr) {
        // If Google verification fails (e.g. offline/mock token), try decoding base64 JWT payload
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            googleEmail = payload.email || googleEmail;
            googleName = payload.name || googleName;
          }
        } catch (_) {}
      }
    }

    if (!googleEmail) {
      return res.status(400).json({ error: 'Valid Google identity information is required' });
    }

    const normalizedEmail = String(googleEmail).trim().toLowerCase();
    const finalName = String(googleName || normalizedEmail.split('@')[0]).trim();

    let user = db.users.get(normalizedEmail);

    if (!user) {
      // Auto-provision user account from Google OAuth
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(uuidv4(), salt);

      user = {
        id: `u-g-${Date.now().toString(36)}`,
        name: finalName,
        email: normalizedEmail,
        passwordHash,
        role: 'reliability_engineer',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      db.users.set(normalizedEmail, user);
    } else {
      user.lastLogin = new Date().toISOString();
      if (!user.name && finalName) {
        user.name = finalName;
      }
    }

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
  } catch (err: any) {
    console.error('Google authentication error:', err);
    res.status(500).json({ error: 'Google authentication failed', detail: err.message });
  }
});

// --------------------------------------------------------------------------
// Public OAuth Client Config Endpoint
// --------------------------------------------------------------------------
authRouter.get('/auth/google/config', (_req: Request, res: Response) => {
  res.json({
    googleClientId: ENV.GOOGLE_CLIENT_ID || '',
    enabled: Boolean(ENV.GOOGLE_CLIENT_ID)
  });
});

// --------------------------------------------------------------------------
// Current Authenticated User Profile
// --------------------------------------------------------------------------
authRouter.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});
