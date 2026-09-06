-- 1. Employers (Demand Side)
CREATE TABLE IF NOT EXISTS employers (
    employer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE,
    email VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    full_name VARCHAR(100),
    upi_id VARCHAR(100),
    trust_rating DECIMAL(3,2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Workers (Supply Side)
CREATE TABLE IF NOT EXISTS workers (
    worker_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE,
    email VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    worker_category VARCHAR(50) DEFAULT 'GENERAL_LABOR',
    worker_sub_category VARCHAR(50),
    is_available BOOLEAN DEFAULT FALSE,
    last_known_lat DECIMAL(10, 8),
    last_known_lng DECIMAL(10, 8),
    trust_score DECIMAL(3,2) DEFAULT 5.00,
    total_completed_shifts INT DEFAULT 0,
    total_ratings_count INT DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 5.00,
    is_verified_id BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. The Digital Ledger (Shifts & Payments)
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
    verification_call_status VARCHAR(20) DEFAULT 'NONE', -- 'NONE', 'SCHEDULED', 'DISPATCHED', 'VERIFIED', 'DISPUTED'
    worker_call_confirmed BOOLEAN DEFAULT FALSE,
    employer_call_confirmed BOOLEAN DEFAULT FALSE,
    verification_scheduled_at TIMESTAMP,
    adjusted_wage DECIMAL(10, 2),
    adjustment_reason VARCHAR(255),
    worked_hours DECIMAL(4, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Ratings & Reviews
CREATE TABLE IF NOT EXISTS ratings (
    rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(shift_id),
    reviewer_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    reviewer_role VARCHAR(10) NOT NULL, -- 'employer' or 'worker'
    rating_stars INT CHECK (rating_stars BETWEEN 1 AND 5),
    review_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration safety for existing deployments
ALTER TABLE employers ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE employers ALTER COLUMN phone_number DROP NOT NULL;

ALTER TABLE workers ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE workers ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE workers ALTER COLUMN worker_category SET DEFAULT 'GENERAL_LABOR';

CREATE INDEX IF NOT EXISTS idx_workers_available ON workers(is_available);
CREATE INDEX IF NOT EXISTS idx_workers_category ON workers(worker_category);
CREATE INDEX IF NOT EXISTS idx_ratings_reviewee ON ratings(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_employers_google_id ON employers(google_id);
CREATE INDEX IF NOT EXISTS idx_workers_google_id ON workers(google_id);
CREATE INDEX IF NOT EXISTS idx_employers_email ON employers(email);
CREATE INDEX IF NOT EXISTS idx_workers_email ON workers(email);