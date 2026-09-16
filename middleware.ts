import type { NextFunction, Request, Response } from 'express';
import { extractBearerToken, verifyAdminToken, type UserPayload } from './lib/auth';

export type AdminRequest = Request & { adminUser?: UserPayload };

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    const user = await verifyAdminToken(token);
    if (!user) return res.status(403).json({ error: 'Administrator access required.' });

    req.adminUser = user;
    return next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(401).json({ error: 'Invalid or expired administrative session.' });
  }
}
