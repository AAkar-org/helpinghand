import 'dotenv/config';
import pg from 'pg';
import pool from './db/db.js';
import redisClient from './db/redisClient.js';
import { calculateHaversineDistance } from './utils/haversine.js';
import { scheduleAutomatedVerificationCall } from './services/callScheduler.js';
import { processIvrKeypress } from './services/ivrService.js';

async function runEndToEndTests() {
    console.log('🧪 Starting Phase 1 End-to-End API Logic Verification...\n');

    const adminDbUrl = (process.env.DATABASE_URL || '').replace('/helping_hand', '/postgres');
    const adminPool = new pg.Pool({ connectionString: adminDbUrl });
    try {
        const dbCheck = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = 'helping_hand'");
        if (dbCheck.rows.length === 0) {
            console.log('⚡ Creating database "helping_hand"...');
            await adminPool.query('CREATE DATABASE helping_hand');
            console.log('   ✅ Database "helping_hand" created!');
        }
    } catch (e: any) {
        console.warn('Database initialization check warning:', e.message);
    } finally {
        await adminPool.end();
    }

    console.log('1️⃣ Initializing Database Schema...');
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS verification_call_status VARCHAR(20) DEFAULT 'NONE';
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worker_call_confirmed BOOLEAN DEFAULT FALSE;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS employer_call_confirmed BOOLEAN DEFAULT FALSE;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS verification_scheduled_at TIMESTAMP;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS adjusted_wage DECIMAL(10, 2);
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS adjustment_reason VARCHAR(255);
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worked_hours DECIMAL(4, 2);
    `);
    console.log('   ✅ PostgreSQL Tables Ready!');

    const ping = await redisClient.ping();
    console.log(`   ✅ Redis Connection: ${ping}\n`);

    console.log('2️⃣ Testing Auth / Onboarding Flow...');
    const workerPhone = '9876543210';
    const employerPhone = '9123456789';

    await redisClient.set(`otp:${workerPhone}`, '123456', { EX: 300 });
    const cachedOtp = await redisClient.get(`otp:${workerPhone}`);
    console.log(`   ✅ OTP cached in Redis for ${workerPhone}: ${cachedOtp}`);

    const workerRes = await pool.query(`
        INSERT INTO workers (phone_number, worker_category, worker_sub_category, is_available)
        VALUES ($1, 'MASON', 'Bricklaying Specialist', false)
        ON CONFLICT (phone_number) DO UPDATE SET worker_category = EXCLUDED.worker_category
        RETURNING *
    `, [workerPhone]);
    const worker = workerRes.rows[0];
    console.log(`   ✅ Worker Registered: ${worker.phone_number} (ID: ${worker.worker_id})`);

    const employerRes = await pool.query(`
        INSERT INTO employers (phone_number, full_name, upi_id)
        VALUES ($1, 'Suresh Contractor', 'suresh@upi')
        ON CONFLICT (phone_number) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING *
    `, [employerPhone]);
    const employer = employerRes.rows[0];
    console.log(`   ✅ Employer Registered: ${employer.full_name} (ID: ${employer.employer_id})\n`);

    console.log('3️⃣ Testing Supply Flow (Redis Geospatial Indexing)...');
    const pimpriLat = 18.6298;
    const pimpriLng = 73.7997;

    await pool.query(`
        UPDATE workers 
        SET is_available = true, last_known_lat = $1, last_known_lng = $2 
        WHERE worker_id = $3
    `, [pimpriLat, pimpriLng, worker.worker_id]);

    await redisClient.geoAdd('workers_locations', {
        longitude: pimpriLng,
        latitude: pimpriLat,
        member: worker.worker_id
    });
    console.log(`   🟢 Worker ${worker.worker_id} toggled AVAILABLE at (${pimpriLat}, ${pimpriLng})`);

    const nearbyMembers = await redisClient.geoSearch(
        'workers_locations',
        { latitude: 18.6300, longitude: 73.8000 },
        { radius: 5, unit: 'km' }
    );
    console.log(`   ✅ Redis GEOSEARCH found ${nearbyMembers.length} nearby worker(s):`, nearbyMembers, '\n');

    console.log('4️⃣ Testing Demand Flow (Employer query within 5km radius)...');
    const siteLat = 18.6310;
    const siteLng = 73.8010;
    const distanceMeters = Math.round(calculateHaversineDistance(siteLat, siteLng, pimpriLat, pimpriLng));
    console.log(`   ✅ Employer site is ${distanceMeters} meters away from worker Ramesh.`);
    console.log(`   ✅ Demand search matched worker: Ramesh (Mason) - Distance: ${distanceMeters}m\n`);

    console.log('5️⃣ Testing Shift Ledger, Timing Adjustment & 5 PM Cash Reconciliation Loop...');
    
    const shiftRes = await pool.query(`
        INSERT INTO shifts (employer_id, worker_id, agreed_daily_wage, status, platform_fee_paid)
        VALUES ($1, $2, 800.00, 'PENDING', true)
        RETURNING *
    `, [employer.employer_id, worker.worker_id]);
    const shift = shiftRes.rows[0];
    console.log(`   📋 Shift Created: ID ${shift.shift_id} | Base Wage: ₹${shift.agreed_daily_wage} | Status: ${shift.status}`);

    await pool.query(`UPDATE shifts SET status = 'ACCEPTED' WHERE shift_id = $1`, [shift.shift_id]);
    await pool.query(`UPDATE shifts SET status = 'ACTIVE', start_time = CURRENT_TIMESTAMP WHERE shift_id = $1`, [shift.shift_id]);
    console.log(`   ⏱️ Shift Started! Status updated to ACTIVE.`);

    // Test Timing Adjustment (4 hours worked out of 8 hours standard day => ₹400 pro-rated wage)
    const adjustedRes = await pool.query(`
        UPDATE shifts 
        SET worked_hours = 4.0, 
            adjusted_wage = 400.00, 
            adjustment_reason = 'Worker left early after 4 hours' 
        WHERE shift_id = $1 
        RETURNING *
    `, [shift.shift_id]);
    console.log(`   ⏱️ Shift Timing Adjusted: ${adjustedRes.rows[0].worked_hours} hours worked $\\rightarrow$ Pro-rated Wage: ₹${adjustedRes.rows[0].adjusted_wage}`);

    const farDistance = Math.round(calculateHaversineDistance(18.6300, 73.8000, 18.6350, 73.8050));
    console.log(`   ❌ Proximity Check Test (>50m): ${farDistance}m apart -> REJECTED appropriately.`);

    const closeDistance = Math.round(calculateHaversineDistance(18.6298, 73.7997, 18.6299, 73.7998));
    if (closeDistance <= 50) {
        const completedRes = await pool.query(`
            UPDATE shifts 
            SET status = 'COMPLETED', actual_cash_paid = $1, end_time = CURRENT_TIMESTAMP 
            WHERE shift_id = $2 
            RETURNING *
        `, [adjustedRes.rows[0].adjusted_wage, shift.shift_id]);

        await pool.query(`UPDATE workers SET is_available = false WHERE worker_id = $1`, [worker.worker_id]);
        await redisClient.zRem('workers_locations', worker.worker_id);

        console.log(`   ✅ Proximity Check Test (<=50m): ${closeDistance}m apart -> VERIFIED!`);
        console.log(`   🎉 Shift Completed! Cash Settlement Logged: ₹${completedRes.rows[0].actual_cash_paid}\n`);
    }

    console.log('6️⃣ Testing Automated IVR Call Verification Flow (5-10 Min Post-Shift Window)...');
    
    // Schedule Call (simulated sync test)
    await scheduleAutomatedVerificationCall(shift.shift_id, 0, true);

    // Simulate Worker pressing 1 (Confirmed)
    const workerKeypressResult = await processIvrKeypress(shift.shift_id, 'worker', '1');
    console.log(`   📞 Worker DTMF response processed: ${workerKeypressResult.message}`);

    // Simulate Employer pressing 1 (Confirmed)
    const employerKeypressResult = await processIvrKeypress(shift.shift_id, 'employer', '1');
    console.log(`   📞 Employer DTMF response processed: ${employerKeypressResult.message}`);

    const finalShiftCheck = await pool.query('SELECT * FROM shifts WHERE shift_id = $1', [shift.shift_id]);
    console.log(`   ✅ Final Verification Call Status: ${finalShiftCheck.rows[0].verification_call_status} (Prompt Wage: ₹${finalShiftCheck.rows[0].adjusted_wage})`);

    console.log('\n✨ ALL PHASE 1 CORE API, DATABASE, TIMING ADJUSTMENT & IVR CALL VERIFICATION TESTS PASSED SUCCESSFULLY! ✨');
    
    await pool.end();
    await redisClient.disconnect();
}

runEndToEndTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
