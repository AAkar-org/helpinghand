export type WorkerCategory =
  | 'MASON'           // Rajmistri / Chunai mistri
  | 'LABOUR'          // General Mazdoor / Beldar / Helper / Coolie
  | 'CARPENTER'       // Badhai / Woodworker
  | 'PLUMBER'         // Nal Mistri / Sanitary
  | 'ELECTRICIAN'     // Bijli Mistri
  | 'PAINTER'         // Rangai Mistri / Putty
  | 'TILE_MISTRI'     // Farsh Mistri / Marble
  | 'WELDER';         // Sariya / Loha Mistri

export interface WorkerProfile {
  id: string;
  name: string;
  phone: string;
  category: WorkerCategory;
  categoryDisplayName: string;
  categoryHindi: string;
  subCategories: string[];
  skills: string[];
  experienceYears: number;
  dailyWageMin: number;
  dailyWageStandard: number;
  rating: number;
  ratingsCount: number;
  completedShifts: number;
  languages: string[];
  location: {
    area: string;
    city: string;
    lat: number;
    lng: number;
  };
  isAvailable: boolean;
  isVerified: boolean;
}

export type ConversationStep =
  | 'IDLE'
  | 'AWAITING_WORK_DESCRIPTION'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_WORKER_COUNT'
  | 'AWAITING_LOCATION'
  | 'AWAITING_WAGE'
  | 'AWAITING_TIMING'
  | 'AWAITING_CONFIRMATION'
  | 'DISPATCHING'
  | 'CONFIRMED';

export interface JobRequest {
  id: string;
  contractorPhone: string;
  contractorName?: string;
  workDescription: string;
  category: WorkerCategory;
  workersNeeded: number;
  locationName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  offeredDailyWage: number;
  shiftDate: string; // e.g. "Kal subah 8 baje" or specified by contractor
  status: 'COLLECTING' | 'MATCHING' | 'CALLING' | 'CONFIRMED' | 'UNFULFILLED' | 'CANCELLED';
  matchedCandidates: CandidateMatch[];
  assignedWorker?: WorkerProfile;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateMatch {
  worker: WorkerProfile;
  distanceKm: number;
  score: number;
  scoreBreakdown: {
    skillMatch: number;
    distanceScore: number;
    ratingScore: number;
    wageScore: number;
    shiftsScore: number;
  };
  callStatus: 'QUEUED' | 'CALLING' | 'ACCEPTED' | 'REJECTED' | 'NO_ANSWER' | 'EXPIRED';
  callAttemptCount: number;
  lastCallTimestamp?: string;
}

export interface ConversationSession {
  phone: string;
  step: ConversationStep;
  language: 'hi' | 'en' | 'hinglish';
  jobDraft: Partial<JobRequest>;
  activeJobId?: string;
  lastInteraction: string;
}
