import { Router, Response } from 'express';
import { db } from '../database/store';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

export const adminRouter = Router();

// GET /api/admin/users - List all users (admin only)
adminRouter.get('/admin/users', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const userList: any[] = [];
  db.users.forEach((user) => {
    userList.push({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      deactivated: !!user.deactivated,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    });
  });
  res.json(userList);
});

// PATCH /api/admin/users/:id/deactivate - Toggle or set deactivated
adminRouter.patch('/admin/users/:id/deactivate', authenticateToken, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = db.users.get(id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Toggle or deactivate
  user.deactivated = !user.deactivated;
  db.users.set(id, user);

  res.json({
    message: `User ${user.email} ${user.deactivated ? 'deactivated' : 'reactivated'} successfully`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      deactivated: user.deactivated,
    }
  });
});
