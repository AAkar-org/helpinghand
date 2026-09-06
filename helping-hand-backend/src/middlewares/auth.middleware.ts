import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';

// Extend Express Request interface to include user
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

/**
 * Authenticate JWT Bearer token from Authorization header.
 * Supports backward-compatibility in non-production environments during transition.
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        // Enforce strict authentication in production
        if (process.env.NODE_ENV === 'production') {
            res.status(401).json({
                success: false,
                error: 'Authentication required: Missing Authorization header with Bearer token'
            });
            return;
        }

        // In development/test mode: allow legacy client transition
        // Extract workerId/employerId from params/body if available as a soft session fallback
        const devUserId = (req.params.workerId || req.params.employerId || req.params.userId || req.body.workerId || req.body.employerId || req.headers['x-user-id']) as string | undefined;
        if (devUserId) {
            req.user = {
                userId: devUserId,
                role: req.baseUrl.includes('worker') ? 'worker' : 'employer'
            };
        }
        next();
        return;
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (err: any) {
        res.status(401).json({
            success: false,
            error: 'Invalid or expired access token',
            message: err.message
        });
    }
};

/**
 * Role-Based Access Control (RBAC) middleware.
 * Ensures caller possesses one of the required roles.
 */
export const requireRole = (...allowedRoles: ('employer' | 'worker')[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            // In dev transition mode, if no user is set, allow
            if (process.env.NODE_ENV !== 'production') {
                return next();
            }
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Caller role: ${req.user.role}`
            });
            return;
        }

        next();
    };
};
