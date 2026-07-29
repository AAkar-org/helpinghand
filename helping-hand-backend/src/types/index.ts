export type UserRole = 'worker' | 'employer';

export interface Employer {
    employer_id: string;
    phone_number: string;
    full_name: string;
    upi_id?: string;
    trust_rating: number;
    created_at: Date;
}

export interface Worker {
    worker_id: string;
    phone_number: string;
    worker_category: string;
    worker_sub_category?: string;
    is_available: boolean;
    last_known_lat?: number;
    last_known_lng?: number;
    trust_score: number;
    created_at: Date;
}

export type ShiftStatus = 'PENDING' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Shift {
    shift_id: string;
    employer_id: string;
    worker_id: string;
    status: ShiftStatus;
    agreed_daily_wage: number;
    platform_fee_paid: boolean;
    actual_cash_paid?: number;
    start_time?: Date;
    end_time?: Date;
    created_at: Date;
}

export interface SendOtpPayload {
    phoneNumber: string;
}

export interface VerifyOtpPayload {
    phoneNumber: string;
    otp: string;
}

export interface RegisterWorkerPayload {
    phoneNumber: string;
    workerCategory: string;
    workerSubCategory?: string;
}

export interface RegisterEmployerPayload {
    phoneNumber: string;
    fullName: string;
    upiId?: string;
}

export interface ToggleAvailabilityPayload {
    workerId: string;
    isAvailable: boolean;
    lat?: number;
    lng?: number;
}

export interface UpdateLocationPayload {
    workerId: string;
    lat: number;
    lng: number;
}

export interface DemandQueryParams {
    lat: number;
    lng: number;
    radiusKm?: number;
    category?: string;
}

export interface CreateShiftPayload {
    employerId: string;
    workerId: string;
    agreedDailyWage: number;
}

export interface ReconcileCashPayload {
    shiftId: string;
    workerLat: number;
    workerLng: number;
    employerLat: number;
    employerLng: number;
    cashAmount: number;
}

export interface MatchedWorker {
    workerId: string;
    phoneNumber: string;
    workerCategory: string;
    workerSubCategory?: string;
    trustScore: number;
    lat: number;
    lng: number;
    distanceMeters: number;
}
