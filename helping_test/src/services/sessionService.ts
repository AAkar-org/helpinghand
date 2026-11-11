import { ConversationSession, ConversationStep, JobRequest } from '../types/index.js';
import { redisClient } from '../db/redisClient.js';

class SessionService {
  private sessions: Map<string, ConversationSession> = new Map();
  private jobs: Map<string, JobRequest> = new Map();
  private readonly SESSION_TTL_MS = 45 * 60 * 1000; // 45 minutes
  private readonly SESSION_TTL_SECONDS = 45 * 60; // 2700 seconds

  /**
   * Normalizes phone number to clean standard string
   */
  public normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`;
  }

  /**
   * Checks if session has been inactive for more than 45 minutes
   */
  public isSessionStale(rawPhone: string): boolean {
    const session = this.getSession(rawPhone);
    if (!session || session.step === 'IDLE' || session.step === 'CONFIRMED') {
      return false;
    }
    const elapsed = Date.now() - new Date(session.lastInteraction).getTime();
    return elapsed > this.SESSION_TTL_MS;
  }

  /**
   * Retrieves or initializes session for contractor
   */
  public getOrCreateSession(rawPhone: string): ConversationSession {
    const phone = this.normalizePhone(rawPhone);
    let session = this.sessions.get(phone);

    if (!session) {
      session = {
        phone,
        step: 'IDLE',
        language: 'hinglish',
        jobDraft: {},
        lastInteraction: new Date().toISOString()
      };
      this.sessions.set(phone, session);
      // Asynchronously sync to Redis
      redisClient
        .setEx(`whatsapp:session:${phone}`, this.SESSION_TTL_SECONDS, JSON.stringify(session))
        .catch(() => {});
    }

    return session;
  }

  public getSession(rawPhone: string): ConversationSession | undefined {
    return this.sessions.get(this.normalizePhone(rawPhone));
  }

  public updateSessionStep(rawPhone: string, step: ConversationStep): void {
    const session = this.getOrCreateSession(rawPhone);
    session.step = step;
    session.lastInteraction = new Date().toISOString();
    redisClient
      .setEx(`whatsapp:session:${session.phone}`, this.SESSION_TTL_SECONDS, JSON.stringify(session))
      .catch(() => {});
  }

  public updateJobDraft(rawPhone: string, draft: Partial<JobRequest>): void {
    const session = this.getOrCreateSession(rawPhone);
    session.jobDraft = { ...session.jobDraft, ...draft };
    session.lastInteraction = new Date().toISOString();
    redisClient
      .setEx(`whatsapp:session:${session.phone}`, this.SESSION_TTL_SECONDS, JSON.stringify(session))
      .catch(() => {});
  }

  public resetSession(rawPhone: string): void {
    const session = this.getOrCreateSession(rawPhone);
    session.step = 'IDLE';
    session.jobDraft = {};
    session.lastInteraction = new Date().toISOString();
    redisClient.del(`whatsapp:session:${session.phone}`).catch(() => {});
  }

  public saveJob(job: JobRequest): void {
    this.jobs.set(job.id, job);
    redisClient.setEx(`whatsapp:job:${job.id}`, 86400, JSON.stringify(job)).catch(() => {});
  }

  public getJob(jobId: string): JobRequest | undefined {
    return this.jobs.get(jobId);
  }

  public getAllJobs(): JobRequest[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getAllSessions(): ConversationSession[] {
    return Array.from(this.sessions.values());
  }
}

export const sessionService = new SessionService();


