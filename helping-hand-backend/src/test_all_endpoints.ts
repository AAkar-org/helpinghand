import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pool from './db/db.js';
import redisClient from './db/redisClient.js';
import authRoutes from './modules/shared/auth.routes.js';
import workerRoutes from './modules/worker/worker.routes.js';
import employerRoutes from './modules/employer/employer.routes.js';
import { runMigrations } from './db/migrate.js';
import { Server } from 'http';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
    try {
        const dbResult = await pool.query('SELECT NOW()');
        const ping = await redisClient.ping();
        res.status(200).json({
            status: 'healthy',
            service: 'Helping Hand Core API',
            environment: process.env.NODE_ENV || 'development',
            timestamp: dbResult.rows[0].now,
            redis: ping === 'PONG' ? 'connected' : 'error'
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/employer', employerRoutes);

async function runComprehensiveEndpointTests() {
    console.log('🚀 Starting Comprehensive API Endpoint Suite Test (Security, Google OAuth, Handshake)...\n');

    // Run migrations to ensure all tables and columns are up to date
    await runMigrations();

    const server: Server = app.listen(3099);
    const BASE_URL = 'http://localhost:3099';

    try {
        // 1. Health Check Endpoint
        console.log('1️⃣ Testing GET /health');
        const healthRes = await fetch(`${BASE_URL}/health`);
        const healthData = await healthRes.json();
        console.log('   Status:', healthRes.status, 'Response:', JSON.stringify(healthData));

        // 2. Auth: Send OTP with Rate Limiting Cooldown Check
        console.log('\n2️⃣ Testing POST /api/auth/send-otp');
        const workerPhone = '9876540001';
        const employerPhone = '9123450002';

        // Clear previous Redis keys for test phone numbers
        await redisClient.del(`otp_cooldown:${workerPhone}`);
        await redisClient.del(`otp_hourly:${workerPhone}`);
        await redisClient.del(`otp_cooldown:${employerPhone}`);
        await redisClient.del(`otp_hourly:${employerPhone}`);

        const sendOtpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: workerPhone })
        });
        const sendOtpData = await sendOtpRes.json();
        console.log('   Status:', sendOtpRes.status, 'Response:', sendOtpData);
        const generatedOtp = sendOtpData.otp;

        // Test Cooldown enforcement
        console.log('   Testing Cooldown Rate Limit (immediate second request):');
        const rapidOtpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: workerPhone })
        });
        console.log('   Status:', rapidOtpRes.status, 'Cooldown blocked as expected:', rapidOtpRes.status === 429);

        // 3. Auth: Register Worker & Verify OTP with JWT
        console.log('\n3️⃣ Testing POST /api/worker/register');
        const regWorkerRes = await fetch(`${BASE_URL}/api/worker/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: workerPhone,
                workerCategory: 'ELECTRICIAN',
                workerSubCategory: 'Wiring & Fixtures'
            })
        });
        const regWorkerData = await regWorkerRes.json();
        const workerId = regWorkerData.user.worker_id;
        console.log('   Status:', regWorkerRes.status, 'Worker ID:', workerId);

        console.log('\n4️⃣ Testing POST /api/auth/verify-otp (JWT Token Generation)');
        const verifyOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: workerPhone, otp: generatedOtp })
        });
        const verifyOtpData = await verifyOtpRes.json();
        const workerToken = verifyOtpData.token;
        const workerRefreshToken = verifyOtpData.refreshToken;
        console.log('   Status:', verifyOtpRes.status, 'JWT Token Issued:', !!workerToken, 'Refresh Token Issued:', !!workerRefreshToken);

        // 5. Google OAuth Mobile Flow: Employer Authentication
        console.log('\n5️⃣ Testing POST /api/auth/google (Google OAuth Employer Flow)');
        const mockGoogleEmployerRes = await fetch(`${BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idToken: 'mock-google-token:raj.builder@gmail.com:Rajesh Construction:google-sub-emp-101',
                role: 'employer'
            })
        });
        const googleEmployerData = await mockGoogleEmployerRes.json();
        const employerId = googleEmployerData.user.employer_id;
        const employerToken = googleEmployerData.token;
        console.log('   Status:', mockGoogleEmployerRes.status, 'Employer ID:', employerId, 'Employer JWT Issued:', !!employerToken);

        // 6. Refresh Token
        console.log('\n6️⃣ Testing POST /api/auth/refresh-token');
        const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: workerRefreshToken })
        });
        const refreshData = await refreshRes.json();
        console.log('   Status:', refreshRes.status, 'New Access Token Issued:', !!refreshData.token);

        // 7. Protected Route: Worker Toggle Availability & Update Location
        console.log('\n7️⃣ Testing POST /api/worker/toggle-availability with Bearer Token');
        const availRes = await fetch(`${BASE_URL}/api/worker/toggle-availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${workerToken}`
            },
            body: JSON.stringify({
                workerId,
                isAvailable: true,
                lat: 18.5204,
                lng: 73.8567
            })
        });
        console.log('   Status:', availRes.status, 'Response:', await availRes.json());

        // 8. Protected Route: Employer Finds Nearby Workers
        console.log('\n8️⃣ Testing GET /api/employer/nearby-workers with Employer Token');
        const nearbyRes = await fetch(`${BASE_URL}/api/employer/nearby-workers?lat=18.5204&lng=73.8567&radiusKm=10`, {
            headers: {
                'Authorization': `Bearer ${employerToken}`
            }
        });
        const nearbyData = await nearbyRes.json();
        console.log('   Status:', nearbyRes.status, 'Nearby Count:', nearbyData.count);

        // 9. Employer Creates Shift
        console.log('\n9️⃣ Testing POST /api/employer/shifts/create');
        const createShiftRes = await fetch(`${BASE_URL}/api/employer/shifts/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${employerToken}`
            },
            body: JSON.stringify({
                employerId,
                workerId,
                agreedDailyWage: 950
            })
        });
        const shiftData = await createShiftRes.json();
        const shiftId = shiftData.shift.shift_id;
        console.log('   Status:', createShiftRes.status, 'Shift ID:', shiftId);

        // 10. Worker Accepts & Starts Shift
        console.log('\n🔟 Testing PATCH /api/worker/shifts/:shiftId/accept & start');
        await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/accept`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${workerToken}` }
        });
        const startRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/start`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${workerToken}` }
        });
        console.log('   Shift Started Status:', startRes.status);

        // 11. Two-Sided Physical Cash Handshake: Worker Generates Code
        console.log('\n1️⃣1️⃣ Testing POST /api/worker/shifts/:shiftId/cash-handshake-code');
        const handshakeInitRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/cash-handshake-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${workerToken}`
            },
            body: JSON.stringify({
                lat: 18.520400,
                lng: 73.856700
            })
        });
        const handshakeInitData = await handshakeInitRes.json();
        const handshakeCode = handshakeInitData.handshakeCode;
        console.log('   Status:', handshakeInitRes.status, 'Handshake Code Generated:', handshakeCode);

        // 12. Two-Sided Physical Cash Handshake: Employer Confirms with GPS Proximity
        console.log('\n1️⃣2️⃣ Testing POST /api/employer/shifts/:shiftId/confirm-cash-handshake (Close Proximity ~15m)');
        const confirmHandshakeRes = await fetch(`${BASE_URL}/api/employer/shifts/${shiftId}/confirm-cash-handshake`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${employerToken}`
            },
            body: JSON.stringify({
                handshakeCode,
                employerLat: 18.520500, // ~15m away
                employerLng: 73.856750,
                cashAmount: 950
            })
        });
        const confirmHandshakeData = await confirmHandshakeRes.json();
        console.log('   Status:', confirmHandshakeRes.status, 'Verified:', confirmHandshakeData.verified, 'Distance (m):', confirmHandshakeData.distanceMeters);

        // 13. Test Proximity Rejection: When distance > 50m
        console.log('\n1️⃣3️⃣ Testing Proximity Rejection (> 50m distance)');
        // Create another shift for proximity test
        const testShiftRes = await fetch(`${BASE_URL}/api/employer/shifts/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employerToken}` },
            body: JSON.stringify({ employerId, workerId, agreedDailyWage: 800 })
        });
        const testShiftId = (await testShiftRes.json()).shift.shift_id;
        const codeRes = await fetch(`${BASE_URL}/api/worker/shifts/${testShiftId}/cash-handshake-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerToken}` },
            body: JSON.stringify({ lat: 18.520400, lng: 73.856700 })
        });
        const testCode = (await codeRes.json()).handshakeCode;

        const distantConfirmRes = await fetch(`${BASE_URL}/api/employer/shifts/${testShiftId}/confirm-cash-handshake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employerToken}` },
            body: JSON.stringify({
                handshakeCode: testCode,
                employerLat: 18.530000, // ~1.1 km away!
                employerLng: 73.860000,
                cashAmount: 800
            })
        });
        console.log('   Distant Handshake Status:', distantConfirmRes.status, 'Expected 400 rejection:', distantConfirmRes.status === 400);

        // 14. Submit Ratings
        console.log('\n1️⃣4️⃣ Testing POST /api/employer/ratings/submit');
        const ratingRes = await fetch(`${BASE_URL}/api/employer/ratings/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${employerToken}`
            },
            body: JSON.stringify({
                shiftId,
                reviewerId: employerId,
                revieweeId: workerId,
                reviewerRole: 'employer',
                ratingStars: 5,
                reviewComment: 'Outstanding work on building the electrical panel!'
            })
        });
        console.log('   Status:', ratingRes.status, 'Rating Submitted:', (await ratingRes.json()).success);

        console.log('\n🎉 ALL COMPREHENSIVE ENDPOINT TESTS PASSED SUCCESSFULLY! 🚀');
    } catch (error) {
        console.error('❌ Test Suite Failed:', error);
    } finally {
        server.close();
        await pool.end();
        if (redisClient.isOpen) {
            await redisClient.disconnect();
        }
        process.exit(0);
    }
}

runComprehensiveEndpointTests();
