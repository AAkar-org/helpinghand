import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DbEmployer {
  employer_id: string;
  phone_number: string;
  full_name: string | null;
  trust_rating: string | number;
  created_at: Date;
}

export interface DbWorker {
  worker_id: string;
  phone_number: string;
  worker_category: string;
  worker_sub_category: string | null;
  is_available: boolean;
  last_known_lat: number | null;
  last_known_lng: number | null;
  trust_score: string | number;
  total_completed_shifts: number;
  average_rating: string | number;
  is_verified_id: boolean;
}

export interface DbShift {
  shift_id: string;
  employer_id: string;
  worker_id: string;
  status: string;
  agreed_daily_wage: string | number;
  created_at: Date;
}

class DatabaseManager {
  private pool: pg.Pool | null = null;
  private isConnected = false;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL || 'postgres://postgres:password123@localhost:5433/helping_hand';

    try {
      this.pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        max: 10
      });

      this.pool.on('error', (err) => {
        if (this.isConnected) {
          console.warn(`[Database Warning] PostgreSQL pool error: ${err.message}`);
        }
        this.isConnected = false;
      });

      // Quick test probe
      this.pool
        .query('SELECT current_database(), count(*)::int as tbl_count FROM information_schema.tables WHERE table_schema = $1', ['public'])
        .then(async (res) => {
          this.isConnected = true;
          console.log(`[Database] Connected to PostgreSQL '${res.rows[0].current_database}' on port 5433 (Tables: ${res.rows[0].tbl_count})`);
          await this.syncWorkersSeed();
        })
        .catch((err) => {
          // Graceful fallback for offline mode or unit tests
          this.isConnected = false;
        });
    } catch (err: any) {
      console.warn(`[Database Init] Running in offline fallback mode: ${err.message}`);
      this.isConnected = false;
    }
  }

  public get isReady(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Syncs 23 verified workers from workers.json into PostgreSQL workers table
   */
  public async syncWorkersSeed(): Promise<void> {
    if (!this.isReady || !this.pool) return;

    try {
      const countRes = await this.pool.query('SELECT count(*)::int as count FROM workers');
      const currentCount = countRes.rows[0]?.count || 0;

      // Seed if empty or only 1 test worker
      if (currentCount <= 1) {
        const workersFilePath = path.join(__dirname, '../data/workers.json');
        if (fs.existsSync(workersFilePath)) {
          const rawWorkers = JSON.parse(fs.readFileSync(workersFilePath, 'utf-8'));
          console.log(`[Database] Seeding ${rawWorkers.length} verified workers into PostgreSQL 'workers' table...`);

          for (const w of rawWorkers) {
            await this.pool.query(
              `INSERT INTO workers (
                phone_number,
                worker_category,
                worker_sub_category,
                is_available,
                last_known_lat,
                last_known_lng,
                trust_score,
                total_completed_shifts,
                total_ratings_count,
                average_rating,
                is_verified_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (phone_number) 
              DO UPDATE SET 
                is_available = EXCLUDED.is_available,
                last_known_lat = EXCLUDED.last_known_lat,
                last_known_lng = EXCLUDED.last_known_lng,
                average_rating = EXCLUDED.average_rating;`,
              [
                w.phone,
                w.category,
                w.subCategories?.[0] || 'General',
                w.isAvailable ?? true,
                w.location?.lat || 28.6255,
                w.location?.lng || 77.3690,
                5.0,
                w.completedShifts || 0,
                w.ratingsCount || 0,
                w.rating || 4.8,
                w.isVerified ?? true
              ]
            );
          }
          console.log(`[Database] Successfully seeded worker catalog in PostgreSQL.`);
        }
      }
    } catch (err: any) {
      console.warn(`[Database Seed Warning] Worker seeding skipped: ${err.message}`);
    }
  }

  /**
   * Finds or creates an employer record by WhatsApp phone number
   */
  public async getOrCreateEmployer(phone: string, fullName = 'WhatsApp Contractor'): Promise<DbEmployer | null> {
    if (!this.isReady || !this.pool) return null;

    try {
      const res = await this.pool.query(
        `INSERT INTO employers (phone_number, full_name, trust_rating)
         VALUES ($1, $2, 5.00)
         ON CONFLICT (phone_number) 
         DO UPDATE SET full_name = COALESCE(employers.full_name, EXCLUDED.full_name)
         RETURNING employer_id, phone_number, full_name, trust_rating, created_at;`,
        [phone, fullName]
      );
      return res.rows[0];
    } catch (err: any) {
      console.warn(`[Database Error] getOrCreateEmployer failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Finds a worker by phone number
   */
  public async getWorkerByPhone(phone: string): Promise<DbWorker | null> {
    if (!this.isReady || !this.pool) return null;

    try {
      const res = await this.pool.query(
        `SELECT worker_id, phone_number, worker_category, worker_sub_category, 
                is_available, last_known_lat, last_known_lng, trust_score, 
                total_completed_shifts, average_rating, is_verified_id
         FROM workers 
         WHERE phone_number = $1
         LIMIT 1;`,
        [phone]
      );
      return res.rows[0] || null;
    } catch (err: any) {
      console.warn(`[Database Error] getWorkerByPhone failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Records a confirmed shift into PostgreSQL shifts table
   */
  public async recordConfirmedShift(data: {
    employerPhone: string;
    workerPhone: string;
    agreedDailyWage: number;
    shiftDate?: string;
  }): Promise<DbShift | null> {
    if (!this.isReady || !this.pool) return null;

    try {
      // 1. Ensure employer exists
      const employer = await this.getOrCreateEmployer(data.employerPhone);
      if (!employer) return null;

      // 2. Ensure worker exists
      let worker = await this.getWorkerByPhone(data.workerPhone);
      if (!worker) {
        // Create worker record if not present
        const insertWorker = await this.pool.query(
          `INSERT INTO workers (phone_number, worker_category, is_available)
           VALUES ($1, 'GENERAL_LABOR', true)
           ON CONFLICT (phone_number) DO UPDATE SET is_available = true
           RETURNING worker_id, phone_number, worker_category;`,
          [data.workerPhone]
        );
        worker = insertWorker.rows[0];
      }

      // 3. Insert Shift Record
      const shiftRes = await this.pool.query(
        `INSERT INTO shifts (
          employer_id,
          worker_id,
          status,
          agreed_daily_wage,
          platform_fee_paid,
          start_time,
          verification_call_status,
          worker_call_confirmed,
          worked_hours
        ) VALUES ($1, $2, 'CONFIRMED', $3, false, NOW(), 'VERIFIED', true, 8.0)
        RETURNING shift_id, employer_id, worker_id, status, agreed_daily_wage, created_at;`,
        [employer.employer_id, worker?.worker_id, data.agreedDailyWage]
      );

      const shift = shiftRes.rows[0];
      console.log(`[PostgreSQL] Shift #${shift.shift_id} recorded in PostgreSQL (Wage: Rs. ${data.agreedDailyWage})`);
      return shift;
    } catch (err: any) {
      console.warn(`[Database Error] recordConfirmedShift failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Updates shift status in database (e.g. CANCELLED, COMPLETED)
   */
  public async updateShiftStatus(shiftId: string, status: string): Promise<boolean> {
    if (!this.isReady || !this.pool) return false;

    try {
      await this.pool.query(`UPDATE shifts SET status = $1 WHERE shift_id = $2`, [status, shiftId]);
      return true;
    } catch (err: any) {
      console.warn(`[Database Error] updateShiftStatus failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Clean disconnect
   */
  public async end(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export const dbClient = new DatabaseManager();

