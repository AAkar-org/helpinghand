import { z } from 'zod';

export const sendOtpSchema = z.object({
    phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number too long')
});

export const verifyOtpSchema = z.object({
    phoneNumber: z.string().min(10).max(15),
    otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

export const googleAuthSchema = z.object({
    idToken: z.string().min(1, 'Google ID Token is required'),
    role: z.enum(['employer', 'worker']).default('employer')
});

export const registerEmployerSchema = z.object({
    phoneNumber: z.string().min(10).max(15).optional(),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    upiId: z.string().optional().nullable(),
    email: z.string().email().optional().nullable()
});

export const registerWorkerSchema = z.object({
    phoneNumber: z.string().min(10).max(15).optional(),
    workerCategory: z.string().min(2, 'Worker category is required'),
    workerSubCategory: z.string().optional().nullable(),
    email: z.string().email().optional().nullable()
});

export const createShiftSchema = z.object({
    employerId: z.string().uuid().optional(),
    workerId: z.string().uuid('Invalid worker UUID'),
    agreedDailyWage: z.number().positive('Daily wage must be greater than zero')
});

export const reconcileCashSchema = z.object({
    workerLat: z.number(),
    workerLng: z.number(),
    employerLat: z.number(),
    employerLng: z.number(),
    cashAmount: z.number().positive().optional(),
    delayMinutes: z.number().optional(),
    isSyncTest: z.boolean().optional()
});

export const handshakeCodeSchema = z.object({
    lat: z.number(),
    lng: z.number()
});

export const confirmHandshakeSchema = z.object({
    handshakeCode: z.string().length(4, 'Handshake code must be 4 digits'),
    employerLat: z.number(),
    employerLng: z.number(),
    cashAmount: z.number().positive().optional()
});

export const submitRatingSchema = z.object({
    shiftId: z.string().uuid('Invalid shift UUID'),
    reviewerId: z.string().uuid().optional(),
    revieweeId: z.string().uuid('Invalid reviewee UUID'),
    reviewerRole: z.enum(['employer', 'worker']),
    ratingStars: z.number().min(1).max(5),
    reviewComment: z.string().max(1000).optional().nullable()
});
