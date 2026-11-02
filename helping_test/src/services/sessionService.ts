import { ConversationSession, ConversationStep, JobRequest } from '../types/index.js';

class SessionService {
  private sessions: Map<string, ConversationSession> = new Map();
  private jobs: Map<string, JobRequest> = new Map();

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
  }

  public updateJobDraft(rawPhone: string, draft: Partial<JobRequest>): void {
    const session = this.getOrCreateSession(rawPhone);
    session.jobDraft = { ...session.jobDraft, ...draft };
    session.lastInteraction = new Date().toISOString();
  }

  public resetSession(rawPhone: string): void {
    const session = this.getOrCreateSession(rawPhone);
    session.step = 'IDLE';
    session.jobDraft = {};
    session.lastInteraction = new Date().toISOString();
  }

  public saveJob(job: JobRequest): void {
    this.jobs.set(job.id, job);
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

