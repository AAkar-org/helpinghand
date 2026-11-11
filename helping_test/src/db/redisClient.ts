import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisManager {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly fallbackCache = new Map<string, { value: string; expiresAt: number }>();

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
        // Log once or on state change to avoid console flood
        if (this.isConnected) {
          console.warn(`[Redis Warning] Redis connection issue: ${err.message}`);
        }
        this.isConnected = false;
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });

      // Non-blocking auto-connect
      this.client.connect().catch((err) => {
        // Will fallback gracefully to in-memory cache
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

  /**
   * Sets key with TTL (seconds)
   */
  public async setEx(key: string, seconds: number, value: string): Promise<void> {
    if (this.isReady && this.client) {
      try {
        await this.client.setEx(key, seconds, value);
        return;
      } catch (err) {
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
      } catch (err) {
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
      } catch (err) {
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
      } catch (err) {
        this.isConnected = false;
      }
    }
    this.fallbackCache.delete(key);
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

