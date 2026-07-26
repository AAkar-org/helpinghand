-- 1. Employers (Demand Side)
CREATE TABLE employers (
    employer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    upi_id VARCHAR(100),
    trust_rating DECIMAL(3,2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Workers (Supply Side)
CREATE TABLE workers (
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

-- 3. The Digital Ledger (Shifts & Payments)
CREATE TABLE shifts (
    shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID REFERENCES employers(employer_id),
    worker_id UUID REFERENCES workers(worker_id),
    status VARCHAR(20) DEFAULT 'PENDING', 
    agreed_daily_wage DECIMAL(10, 2) NOT NULL,
    platform_fee_paid BOOLEAN DEFAULT FALSE,
    actual_cash_paid DECIMAL(10, 2), 
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);