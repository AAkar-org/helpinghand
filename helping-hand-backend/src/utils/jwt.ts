import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'helping_hand_dev_jwt_secret_change_me_in_prod';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '1d') as any;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'helping_hand_dev_refresh_secret_change_me_in_prod';
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any;

export interface TokenPayload {
    userId: string;
    role: 'employer' | 'worker';
    phoneNumber?: string;
    email?: string;
}

export const signAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const signRefreshToken = (payload: { userId: string; role: 'employer' | 'worker' }): string => {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { userId: string; role: 'employer' | 'worker' } => {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; role: 'employer' | 'worker' };
};
