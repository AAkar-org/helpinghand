import { WorkerProfile, WorkerCategory, CandidateMatch, JobRequest } from '../types/index.js';
import { calculateHaversineDistanceKm } from '../data/locations.js';
import workersData from '../data/workers.json' with { type: 'json' };

const WORKERS_DB: WorkerProfile[] = workersData as WorkerProfile[];

export class MatchingService {
  private workers: WorkerProfile[] = [...WORKERS_DB];

  public getAllWorkers(): WorkerProfile[] {
    return this.workers;
  }

  /**
   * Identifies worker trade category from free text
   */
  public detectCategoryFromText(text: string): WorkerCategory | null {
    const lower = text.toLowerCase();

    // 1. MASON
    if (
      lower.includes('mason') ||
      lower.includes('rajmistri') ||
      lower.includes('raj mistri') ||
      lower.includes('chunai') ||
      lower.includes('plaster') ||
      lower.includes('chunaai') ||
      (lower.includes('mistri') && !lower.includes('bijli') && !lower.includes('nal') && !lower.includes('tile'))
    ) {
      return 'MASON';
    }

    // 2. LABOUR / HELPER
    if (
      lower.includes('labour') ||
      lower.includes('labor') ||
      lower.includes('beldar') ||
      lower.includes('helper') ||
      lower.includes('mazdoor') ||
      lower.includes('coolie') ||
      lower.includes('debris') ||
      lower.includes('malba') ||
      lower.includes('loading') ||
      lower.includes('unloading')
    ) {
      return 'LABOUR';
    }

    // 3. CARPENTER
    if (
      lower.includes('carpenter') ||
      lower.includes('badhai') ||
      lower.includes('barhai') ||
      lower.includes('wood') ||
      lower.includes('shuttering') ||
      lower.includes('plywood') ||
      lower.includes('door') ||
      lower.includes('furniture')
    ) {
      return 'CARPENTER';
    }

    // 4. PLUMBER
    if (
      lower.includes('plumber') ||
      lower.includes('nal') ||
      lower.includes('pipe') ||
      lower.includes('leakage') ||
      lower.includes('sanitary') ||
      lower.includes('tap') ||
      lower.includes('tank')
    ) {
      return 'PLUMBER';
    }

    // 5. ELECTRICIAN
    if (
      lower.includes('electric') ||
      lower.includes('bijli') ||
      lower.includes('wire') ||
      lower.includes('wiring') ||
      lower.includes('mcb') ||
      lower.includes('switch') ||
      lower.includes('light')
    ) {
      return 'ELECTRICIAN';
    }

    // 6. PAINTER
    if (
      lower.includes('paint') ||
      lower.includes('painter') ||
      lower.includes('rangai') ||
      lower.includes('putty') ||
      lower.includes('primer') ||
      lower.includes('distemper') ||
      lower.includes('color')
    ) {
      return 'PAINTER';
    }

    // 7. TILE MISTRI
    if (
      lower.includes('tile') ||
      lower.includes('tiles') ||
      lower.includes('marble') ||
      lower.includes('granite') ||
      lower.includes('farsh') ||
      lower.includes('pathar')
    ) {
      return 'TILE_MISTRI';
    }

    // 8. WELDER
    if (
      lower.includes('welder') ||
      lower.includes('welding') ||
      lower.includes('sariya') ||
      lower.includes('rebar') ||
      lower.includes('loha') ||
      lower.includes('iron') ||
      lower.includes('grill') ||
      lower.includes('grille')
    ) {
      return 'WELDER';
    }

    return null;
  }

  public parseCategoryChoice(choice: string): WorkerCategory | null {
    const trimmed = choice.trim();
    const map: Record<string, WorkerCategory> = {
      '1': 'MASON',
      '2': 'LABOUR',
      '3': 'CARPENTER',
      '4': 'PLUMBER',
      '5': 'ELECTRICIAN',
      '6': 'PAINTER',
      '7': 'TILE_MISTRI',
      '8': 'WELDER'
    };

    if (map[trimmed]) {
      return map[trimmed];
    }

    return this.detectCategoryFromText(choice);
  }

  /**
   * Matches and prioritizes available workers for a given job request
   */
  public rankWorkersForJob(job: Partial<JobRequest>): CandidateMatch[] {
    const targetCategory = job.category;
    if (!targetCategory) return [];

    const siteCoords = job.coordinates;
    if (!siteCoords) {
      throw new Error('Valid GPS coordinates required to rank candidates');
    }

    const offeredWage = job.offeredDailyWage || 0;

    // Filter available workers in matching category
    const pool = this.workers.filter(
      (w) => w.category === targetCategory && w.isAvailable
    );

    const matches: CandidateMatch[] = pool.map((worker) => {
      // 1. Distance Calculation (Haversine Formula)
      const distanceKm = calculateHaversineDistanceKm(
        siteCoords.lat,
        siteCoords.lng,
        worker.location.lat,
        worker.location.lng
      );

      // Distance score: 100 at 0km, decays with distance (drops by 4 pts per km)
      const distanceScore = Math.max(0, Math.min(100, Math.round(100 - distanceKm * 4)));

      // 2. Rating Score: 4.0 to 5.0 normalized to 0-100
      const ratingScore = Math.round((worker.rating / 5.0) * 100);

      // 3. Wage Alignment Score
      let wageScore = 100;
      if (offeredWage > 0) {
        if (offeredWage < worker.dailyWageMin) {
          wageScore = Math.max(20, Math.round((offeredWage / worker.dailyWageMin) * 60));
        } else if (offeredWage < worker.dailyWageStandard) {
          const span = worker.dailyWageStandard - worker.dailyWageMin;
          const diff = offeredWage - worker.dailyWageMin;
          wageScore = Math.round(75 + (span > 0 ? (diff / span) * 25 : 25));
        } else {
          wageScore = 100;
        }
      }

      // 4. Reliability Score based on completed shifts
      const shiftsScore = Math.min(100, Math.round(40 + worker.completedShifts * 0.3));

      // 5. Skill Sub-Category Match Score
      let skillMatch = 70;
      if (job.workDescription) {
        const descLower = job.workDescription.toLowerCase();
        const matchesSkill = worker.skills.some((s) => descLower.includes(s.toLowerCase()));
        const matchesSub = worker.subCategories.some((sc) => descLower.includes(sc.toLowerCase()));
        if (matchesSkill || matchesSub) {
          skillMatch = 100;
        }
      }

      // Composite Priority Weighted Formula:
      // Distance (35%) + Rating (25%) + Wage Alignment (20%) + Reliability (10%) + Skill Affinity (10%)
      const finalScore = Math.round(
        distanceScore * 0.35 +
        ratingScore * 0.25 +
        wageScore * 0.20 +
        shiftsScore * 0.10 +
        skillMatch * 0.10
      );

      return {
        worker,
        distanceKm,
        score: finalScore,
        scoreBreakdown: {
          skillMatch,
          distanceScore,
          ratingScore,
          wageScore,
          shiftsScore
        },
        callStatus: 'QUEUED',
        callAttemptCount: 0
      };
    });

    // Sort descending by priority score
    return matches.sort((a, b) => b.score - a.score);
  }

  public setWorkerAvailability(workerId: string, isAvailable: boolean): void {
    const worker = this.workers.find((w) => w.id === workerId);
    if (worker) {
      worker.isAvailable = isAvailable;
    }
  }
}

export const matchingService = new MatchingService();
