import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisManager {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly fallbackCache = new Map<string, { value: string; expiresAt: number }>();
  private readonly workerLocks = new Map<string, { jobId: string; expiresAt: number }>();
  private readonly rateLimits = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.client = createClient({
        url,
        socket: {
          connectTimeout: 3000,
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              return new Error('Redis max reconnection attempts exceeded');
            }
            return Math.min(retries * 500, 3000);
          }
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log(`[Redis] Connected to Redis instance at ${url}`);
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn(`[Redis Warning] Redis connection issue: ${err.message}`);
        }
        this.isConnected = false;
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });

      // Non-blocking auto-connect
      this.client.connect().catch(() => {
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn(`[Redis Init] Running in memory fallback mode: ${err.message}`);
      this.isConnected = false;
    }
  }

  public get isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  public getRawClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Sets key with TTL (seconds)
   */
  public async setEx(key: string, seconds: number, value: string): Promise<void> {
    if (this.isReady && this.client) {
      try {
        await this.client.setEx(key, seconds, value);
        return;
      } catch {
        this.isConnected = false;
      }
    }
    // Fallback in-memory
    this.fallbackCache.set(key, {
      value,
      expiresAt: Date.now() + seconds * 1000
    });
  }

  /**
   * Gets value by key
   */
  public async get(key: string): Promise<string | null> {
    if (this.isReady && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        this.isConnected = false;
      }
    }
    // Fallback in-memory
    const entry = this.fallbackCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.fallbackCache.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Atomic check-and-set for deduplication (SET key 1 EX ttl NX)
   * Returns true if key was set (i.e. message is NEW), false if key already existed (DUPLICATE)
   */
  public async setNx(key: string, seconds: number): Promise<boolean> {
    if (this.isReady && this.client) {
      try {
        const result = await this.client.set(key, '1', {
          EX: seconds,
          NX: true
        });
        return result === 'OK';
      } catch {
        this.isConnected = false;
      }
    }
    // Fallback in-memory
    const entry = this.fallbackCache.get(key);
    if (entry && Date.now() <= entry.expiresAt) {
      return false; // Already seen
    }
    this.fallbackCache.set(key, {
      value: '1',
      expiresAt: Date.now() + seconds * 1000
    });
    return true;
  }

  /**
   * Deletes key
   */
  public async del(key: string): Promise<void> {
    if (this.isReady && this.client) {
      try {
        await this.client.del(key);
      } catch {
        this.isConnected = false;
      }
    }
    this.fallbackCache.delete(key);
  }

  // ----------------------------------------------------------------------
  // HIGH CONCURRENCY: DISTRIBUTED WORKER DISPATCH LOCKING
  // Prevents two contractors during traffic surge from calling the same worker
  // ----------------------------------------------------------------------
  public async acquireWorkerLock(workerId: string, jobId: string, ttlSeconds = 180): Promise<boolean> {
    const lockKey = `lock:worker:${workerId}`;
    if (this.isReady && this.client) {
      try {
        const result = await this.client.set(lockKey, jobId, {
          EX: ttlSeconds,
          NX: true
        });
        return result === 'OK';
      } catch {
        this.isConnected = false;
      }
    }

    // In-memory fallback
    const existing = this.workerLocks.get(workerId);
    if (existing && Date.now() < existing.expiresAt) {
      return false;
    }
    this.workerLocks.set(workerId, {
      jobId,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    return true;
  }

  public async releaseWorkerLock(workerId: string): Promise<void> {
    const lockKey = `lock:worker:${workerId}`;
    if (this.isReady && this.client) {
      try {
        await this.client.del(lockKey);
      } catch {
        this.isConnected = false;
      }
    }
    this.workerLocks.delete(workerId);
  }

  public async isWorkerLocked(workerId: string): Promise<boolean> {
    const lockKey = `lock:worker:${workerId}`;
    if (this.isReady && this.client) {
      try {
        const val = await this.client.get(lockKey);
        return val !== null;
      } catch {
        this.isConnected = false;
      }
    }

    const existing = this.workerLocks.get(workerId);
    if (!existing) return false;
    if (Date.now() > existing.expiresAt) {
      this.workerLocks.delete(workerId);
      return false;
    }
    return true;
  }

  // ----------------------------------------------------------------------
  // HIGH CONCURRENCY: SLIDING WINDOW RATE LIMITER PER CONTRACTOR PHONE
  // ----------------------------------------------------------------------
  public async checkRateLimit(
    phone: string,
    maxRequests = 20,
    windowSeconds = 60
  ): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
    const key = `ratelimit:phone:${phone}`;
    const now = Math.floor(Date.now() / 1000);

    if (this.isReady && this.client) {
      try {
        const current = await this.client.incr(key);
        if (current === 1) {
          await this.client.expire(key, windowSeconds);
        }
        const ttl = await this.client.ttl(key);
        return {
          allowed: current <= maxRequests,
          remaining: Math.max(0, maxRequests - current),
          resetSeconds: Math.max(0, ttl)
        };
      } catch {
        this.isConnected = false;
      }
    }

    // Fallback in-memory
    const existing = this.rateLimits.get(phone);
    if (!existing || Date.now() > existing.resetAt) {
      this.rateLimits.set(phone, {
        count: 1,
        resetAt: Date.now() + windowSeconds * 1000
      });
      return { allowed: true, remaining: maxRequests - 1, resetSeconds: windowSeconds };
    }

    existing.count += 1;
    const resetSeconds = Math.ceil((existing.resetAt - Date.now()) / 1000);
    return {
      allowed: existing.count <= maxRequests,
      remaining: Math.max(0, maxRequests - existing.count),
      resetSeconds
    };
  }

  /**
   * Clean disconnect for shutdowns
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
    }
  }
}

export const redisClient = new RedisManager();
