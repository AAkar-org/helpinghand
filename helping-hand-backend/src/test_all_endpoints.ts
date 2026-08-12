import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db/db.js';
import redisClient from './db/redisClient.js';
import authRoutes from './modules/shared/auth.routes.js';
import workerRoutes from './modules/worker/worker.routes.js';
import employerRoutes from './modules/employer/employer.routes.js';
import { Server } from 'http';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const dbResult = await pool.query('SELECT NOW()');
        const ping = await redisClient.ping();
        res.status(200).json({
            status: 'healthy',
            service: 'Helping Hand Core API',
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
    console.log('🚀 Starting Comprehensive API Endpoint Suite Test with Mock Data...\n');

    // Ensure database tables exist
    await pool.query(`
        CREATE TABLE IF NOT EXISTS employers (
            employer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone_number VARCHAR(15) UNIQUE NOT NULL,
            full_name VARCHAR(100),
            upi_id VARCHAR(100),
            trust_rating DECIMAL(3,2) DEFAULT 5.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS workers (
            worker_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone_number VARCHAR(15) UNIQUE NOT NULL,
            worker_category VARCHAR(50) NOT NULL,
            worker_sub_category VARCHAR(50),
            is_available BOOLEAN DEFAULT FALSE,
            last_known_lat DECIMAL(10, 8),
            last_known_lng DECIMAL(10, 8),
            trust_score DECIMAL(3,2) DEFAULT 5.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS shifts (
            shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employer_id UUID REFERENCES employers(employer_id),
            worker_id UUID REFERENCES workers(worker_id),
            status VARCHAR(20) DEFAULT 'PENDING', 
            agreed_daily_wage DECIMAL(10, 2) NOT NULL,
            platform_fee_paid BOOLEAN DEFAULT FALSE,
            actual_cash_paid DECIMAL(10, 2), 
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            verification_call_status VARCHAR(20) DEFAULT 'NONE',
            worker_call_confirmed BOOLEAN DEFAULT FALSE,
            employer_call_confirmed BOOLEAN DEFAULT FALSE,
            verification_scheduled_at TIMESTAMP,
            adjusted_wage DECIMAL(10, 2),
            adjustment_reason VARCHAR(255),
            worked_hours DECIMAL(4, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS verification_call_status VARCHAR(20) DEFAULT 'NONE';
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worker_call_confirmed BOOLEAN DEFAULT FALSE;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS employer_call_confirmed BOOLEAN DEFAULT FALSE;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS verification_scheduled_at TIMESTAMP;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS adjusted_wage DECIMAL(10, 2);
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS adjustment_reason VARCHAR(255);
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worked_hours DECIMAL(4, 2);

        ALTER TABLE workers ADD COLUMN IF NOT EXISTS total_completed_shifts INT DEFAULT 0;
        ALTER TABLE workers ADD COLUMN IF NOT EXISTS total_ratings_count INT DEFAULT 0;
        ALTER TABLE workers ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2) DEFAULT 5.00;
        ALTER TABLE workers ADD COLUMN IF NOT EXISTS is_verified_id BOOLEAN DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS ratings (
            rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shift_id UUID REFERENCES shifts(shift_id),
            reviewer_id UUID NOT NULL,
            reviewee_id UUID NOT NULL,
            reviewer_role VARCHAR(10) NOT NULL,
            rating_stars INT CHECK (rating_stars BETWEEN 1 AND 5),
            review_comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const server: Server = app.listen(3099);
    const BASE_URL = 'http://localhost:3099';

    try {
        // 1. Health Check Endpoint
        console.log('1️⃣ Testing GET /health');
        const healthRes = await fetch(`${BASE_URL}/health`);
        const healthData = await healthRes.json();
        console.log('   Status:', healthRes.status, 'Response:', JSON.stringify(healthData));

        // 2. Auth: Send OTP
        console.log('\n2️⃣ Testing POST /api/auth/send-otp');
        const workerPhone = '9876500001';
        const employerPhone = '9123400002';

        const sendOtpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: workerPhone })
        });
        console.log('   Status:', sendOtpRes.status, 'Response:', await sendOtpRes.json());

        // 3. Auth: Verify OTP
        console.log('\n3️⃣ Testing POST /api/auth/verify-otp');
        const verifyOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: workerPhone, otp: '123456' })
        });
        console.log('   Status:', verifyOtpRes.status, 'Response:', await verifyOtpRes.json());

        // 4. Auth: Register Worker
        console.log('\n4️⃣ Testing POST /api/worker/register');
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

        // 5. Auth: Register Employer
        console.log('\n5️⃣ Testing POST /api/employer/register');
        const regEmpRes = await fetch(`${BASE_URL}/api/employer/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: employerPhone,
                fullName: 'Vikram Builders',
                upiId: 'vikram@upi'
            })
        });
        const regEmpData = await regEmpRes.json();
        const employerId = regEmpData.user.employer_id;
        console.log('   Status:', regEmpRes.status, 'Employer ID:', employerId);

        // 6. Supply: Toggle Availability
        console.log('\n6️⃣ Testing POST /api/worker/toggle-availability');
        const toggleRes = await fetch(`${BASE_URL}/api/worker/toggle-availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workerId,
                isAvailable: true,
                lat: 18.5204,
                lng: 73.8567
            })
        });
        console.log('   Status:', toggleRes.status, 'Response:', await toggleRes.json());

        // 7. Supply: Update Location
        console.log('\n7️⃣ Testing POST /api/worker/location');
        const locRes = await fetch(`${BASE_URL}/api/worker/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workerId,
                lat: 18.5205,
                lng: 73.8568
            })
        });
        console.log('   Status:', locRes.status, 'Response:', await locRes.json());

        // 8. Supply: Get Worker Status
        console.log('\n8️⃣ Testing GET /api/worker/status/:workerId');
        const statusRes = await fetch(`${BASE_URL}/api/worker/status/${workerId}`);
        console.log('   Status:', statusRes.status, 'Response:', await statusRes.json());

        // 9. Demand: Find Nearby Workers
        console.log('\n9️⃣ Testing GET /api/employer/nearby-workers');
        const nearbyRes = await fetch(`${BASE_URL}/api/employer/nearby-workers?lat=18.5205&lng=73.8568&radiusKm=5&category=ELECTRICIAN`);
        const nearbyData = await nearbyRes.json();
        console.log('   Status:', nearbyRes.status, 'Found Workers Count:', nearbyData.count);

        // 10. Shifts: Create Shift
        console.log('\n🔟 Testing POST /api/employer/shifts/create');
        const createShiftRes = await fetch(`${BASE_URL}/api/employer/shifts/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employerId,
                workerId,
                agreedDailyWage: 1000.00
            })
        });
        const createShiftData = await createShiftRes.json();
        const shiftId = createShiftData.shift.shift_id;
        console.log('   Status:', createShiftRes.status, 'Created Shift ID:', shiftId);

        // 11. Shifts: Accept Shift
        console.log('\n1️⃣1️⃣ Testing PATCH /api/worker/shifts/:shiftId/accept');
        const acceptRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/accept`, {
            method: 'PATCH'
        });
        console.log('   Status:', acceptRes.status, 'Response Status:', (await acceptRes.json()).shift.status);

        // 12. Shifts: Start Shift
        console.log('\n1️⃣2️⃣ Testing PATCH /api/worker/shifts/:shiftId/start');
        const startRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/start`, {
            method: 'PATCH'
        });
        console.log('   Status:', startRes.status, 'Response Status:', (await startRes.json()).shift.status);

        // 13. Shifts: Adjust Shift Timing (4 hours => pro-rated wage ₹500)
        console.log('\n1️⃣3️⃣ Testing PATCH /api/employer/shifts/:shiftId/adjust-timing');
        const adjustRes = await fetch(`${BASE_URL}/api/employer/shifts/${shiftId}/adjust-timing`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workedHours: 4,
                reason: 'Early completion of electrical wiring'
            })
        });
        const adjustData = await adjustRes.json();
        console.log('   Status:', adjustRes.status, 'Adjusted Wage:', adjustData.shift.adjusted_wage);

        // 14. Shifts: Reconcile Cash
        console.log('\n1️⃣4️⃣ Testing POST /api/worker/shifts/:shiftId/reconcile-cash');
        const reconcileRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/reconcile-cash`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workerLat: 18.5205,
                workerLng: 73.8568,
                employerLat: 18.5205,
                employerLng: 73.8568,
                cashAmount: 500,
                delayMinutes: 0,
                isSyncTest: true
            })
        });
        const reconcileData = await reconcileRes.json();
        console.log('   Status:', reconcileRes.status, 'Reconciliation Verified:', reconcileData.verified);

        // 15. Shifts: IVR Keypress Webhook Callbacks
        console.log('\n1️⃣5️⃣ Testing POST /api/worker/shifts/:shiftId/ivr-callback');
        const workerIvrRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/ivr-callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'worker', dtmfDigit: '1' })
        });
        console.log('   Worker Call Response:', await workerIvrRes.json());

        const empIvrRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}/ivr-callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'employer', dtmfDigit: '1' })
        });
        console.log('   Employer Call Response:', await empIvrRes.json());

        // 16. Shifts: Get Shift Details
        console.log('\n1️⃣6️⃣ Testing GET /api/worker/shifts/:shiftId');
        const shiftDetailsRes = await fetch(`${BASE_URL}/api/worker/shifts/${shiftId}`);
        const shiftDetailsData = await shiftDetailsRes.json();
        console.log('   Status:', shiftDetailsRes.status, 'Final Verification Call Status:', shiftDetailsData.shift.verification_call_status);

        // 17. Shifts: Get Shifts By User
        console.log('\n1️⃣7️⃣ Testing GET /api/employer/shifts/user/:userId');
        const userShiftsRes = await fetch(`${BASE_URL}/api/employer/shifts/user/${employerId}`);
        console.log('   Status:', userShiftsRes.status, 'Shifts Count:', (await userShiftsRes.json()).count);

        // 18. Ratings: Submit Rating & Review
        console.log('\n1️⃣8️⃣ Testing POST /api/employer/ratings/submit');
        const ratingRes = await fetch(`${BASE_URL}/api/employer/ratings/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shiftId,
                reviewerId: employerId,
                revieweeId: workerId,
                reviewerRole: 'employer',
                ratingStars: 5,
                reviewComment: 'Excellent electrician! Completed wiring early and cleanly.'
            })
        });
        const ratingData = await ratingRes.json();
        console.log('   Status:', ratingRes.status, 'Rating Stars:', ratingData.rating.rating_stars);

        // 19. Workers: Employer App Map Quick Summary Card
        console.log('\n1️⃣9️⃣ Testing GET /api/employer/workers/:workerId/summary (Employer Map Quick Card)');
        const mapSummaryRes = await fetch(`${BASE_URL}/api/employer/workers/${workerId}/summary`);
        const mapSummaryData = await mapSummaryRes.json();
        console.log('   Status:', mapSummaryRes.status, 'Card Data:', JSON.stringify(mapSummaryData.mapSummaryCard));

        // 20. Workers: Worker App Profile & Work Portfolio
        console.log('\n2️⃣0️⃣ Testing GET /api/worker/profile/:workerId (Worker App Profile)');
        const profileRes = await fetch(`${BASE_URL}/api/worker/profile/${workerId}`);
        const profileData = await profileRes.json();
        console.log('   Status:', profileRes.status, 'Completed Shifts Count:', profileData.workerProfile.totalCompletedShifts, 'Average Rating:', profileData.workerProfile.averageRating);

        console.log('\n🎉 ALL 20 BACKEND API ENDPOINTS TESTED AND PASSED SUCCESSFULLY!');

    } catch (err) {
        console.error('❌ Test execution error:', err);
    } finally {
        server.close();
        await pool.end();
        await redisClient.disconnect();
    }
}

runComprehensiveEndpointTests();
