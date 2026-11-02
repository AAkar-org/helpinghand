import { WorkerCategory } from '../types/index.js';
import { matchingService } from './matchingService.js';

export interface ParsedJobIntent {
  category: WorkerCategory | null;
  workersNeeded: number | null;
  helperCategory?: WorkerCategory | null;
  helpersNeeded?: number | null;
  locationName: string | null;
  offeredDailyWage: number | null;
  shiftDate: string | null;
  workDescription: string;
  isComprehensive: boolean;
  missingFields: Array<'category' | 'workersNeeded' | 'locationName' | 'offeredDailyWage' | 'shiftDate'>;
}

export class NlpParser {
  /**
   * Intelligently parses natural multi-field Hinglish booking instructions in one shot.
   * e.g.: "Kal subah 8 baje Sector 62 Noida me 2 Rajmistri chahiye 900 dihadi"
   */
  public parseOneShotMessage(text: string): ParsedJobIntent {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Detect Category
    let category: WorkerCategory | null = matchingService.detectCategoryFromText(raw);

    // 2. Detect Primary Worker Count & Jodi/Combo Count (e.g. "2 mistri aur 4 beldar")
    let workersNeeded: number | null = null;
    let helperCategory: WorkerCategory | null = null;
    let helpersNeeded: number | null = null;

    // Check combo: "2 mistri ... 4 beldar" or "1 rajmistri ... 2 helper"
    const comboMatch = lower.match(/(\d+)\s*(?:mistri|rajmistri|mason).*?(?:aur|and|with|\+)\s*(\d+)\s*(?:beldar|helper|mazdoor|labour)/);
    if (comboMatch) {
      category = 'MASON';
      workersNeeded = parseInt(comboMatch[1], 10);
      helperCategory = 'LABOUR';
      helpersNeeded = parseInt(comboMatch[2], 10);
    } else {
      // General worker count: "2 mistri", "4 workers", "5 log", "2 bande", "1 plumber", or standalone "2"
      const countMatch = lower.match(/(\d+)\s*(?:worker|workers|mistri|rajmistri|mazdoor|beldar|helper|plumber|badhai|carpenter|painter|sariya|welder|log|aadmi|bande|jan)?/);
      // Ensure the digit is not a wage (e.g. 800) or sector (e.g. 62) or time (e.g. 8 baje)
      const specificWorkerMatches = lower.match(/(?:chahiye|require|need|for)?\s*(\d{1,2})\s*(?:worker|workers|mistri|rajmistri|mazdoor|beldar|helper|plumber|badhai|carpenter|painter|sariya|welder|log|aadmi|bande|jan)/);
      if (specificWorkerMatches) {
        workersNeeded = parseInt(specificWorkerMatches[1], 10);
      } else if (countMatch && parseInt(countMatch[1], 10) <= 50 && !lower.includes(`sector ${countMatch[1]}`)) {
        const val = parseInt(countMatch[1], 10);
        // Avoid misinterpreting wage (which is usually >= 400) or hours (8 baje) as count
        if (val < 50 && !lower.includes(`${val} baje`) && !lower.includes(`${val} pm`) && !lower.includes(`${val} am`)) {
          workersNeeded = val;
        }
      }

      // Word-based numbers in Hindi/English: "ek" = 1, "do" = 2, "teen" = 3, "chaar" = 4, "paanch" = 5
      if (!workersNeeded) {
        if (/\b(ek|one)\s+(?:mistri|worker|mazdoor|plumber|badhai|painter|beldar|helper)\b/.test(lower)) workersNeeded = 1;
        else if (/\b(do|two)\s+(?:mistri|workers|mazdoor|plumber|badhai|painter|beldar|helpers)\b/.test(lower)) workersNeeded = 2;
        else if (/\b(teen|three)\s+(?:mistri|workers|mazdoor|plumber|badhai|painter|beldar|helpers)\b/.test(lower)) workersNeeded = 3;
        else if (/\b(chaar|four)\s+(?:mistri|workers|mazdoor|plumber|badhai|painter|beldar|helpers)\b/.test(lower)) workersNeeded = 4;
        else if (/\b(paanch|five)\s+(?:mistri|workers|mazdoor|plumber|badhai|painter|beldar|helpers)\b/.test(lower)) workersNeeded = 5;
      }
    }

    // 3. Detect Daily Wage (Dihadi): e.g. "900 dihadi", "₹850", "800 rs", "dihadi 850"
    let offeredDailyWage: number | null = null;
    const wageRegex = /(?:₹|rs\.?|inr)?\s*([4-9]\d{2}|[1-4]\d{3})\s*(?:₹|rs\.?|rupaye|rupee|rupees|dihadi|per\s*day|wage)?(?:\b|$)/;
    const wagePrefixed = /(?:dihadi|wage|rate|offered|offer|rupaye)\s*(?:₹|rs\.?|inr|of|hai)?\s*([4-9]\d{2}|[1-4]\d{3})/i;

    const prefixMatch = raw.match(wagePrefixed);
    if (prefixMatch) {
      offeredDailyWage = parseInt(prefixMatch[1], 10);
    } else {
      const directWageMatch = raw.match(wageRegex);
      if (directWageMatch) {
        // Ensure not confused with 4-digit years like 2026 or sector numbers
        const potentialWage = parseInt(directWageMatch[1], 10);
        if (potentialWage !== 2026 && potentialWage >= 400 && potentialWage <= 5000) {
          offeredDailyWage = potentialWage;
        }
      }
    }

    // 4. Detect Shift Timing: e.g. "kal subah 8 baje", "aaj 2:00 PM", "kal morning 9 AM", "3 nov subah"
    let shiftDate: string | null = null;
    const timingRegex = /\b(kal|aaj|parso|somwar|mangalwar|budhwar|guruwar|shukrawar|shanivar|ravivar|tomorrow|today|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\s*(?:subah|dopahar|shaam|raat|morning|afternoon|evening)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)?)?/i;
    const timingMatch = raw.match(timingRegex);
    if (timingMatch && (timingMatch[1] || timingMatch[2])) {
      const fullTiming = timingMatch[0].trim();
      if (fullTiming.length >= 3) {
        shiftDate = fullTiming.charAt(0).toUpperCase() + fullTiming.slice(1);
      }
    }

    // 5. Detect Location (Common Delhi-NCR clusters and generic addresses)
    let locationName: string | null = null;
    const locationKeywords = [
      'sector\\s*\\d+',
      'indirapuram',
      'noida',
      'greater\\s*noida',
      'ghaziabad',
      'okhla',
      'gurgaon',
      'gurugram',
      'delhi',
      'faridabad',
      'gaur\\s*city',
      'vaishali',
      'vasundhara',
      'crossings\\s*republik',
      'nehru\\s*place',
      'lajpat\\s*nagar',
      'laxmi\\s*nagar',
      'rohini',
      'dwarka'
    ];

    const locPattern = new RegExp(`(?:at|in|near|site|me|pe)?\\s*(${locationKeywords.join('|')}[^,.;\\n]*)`, 'i');
    const locMatch = raw.match(locPattern);
    if (locMatch) {
      locationName = locMatch[1].trim();
    }

    // 6. Check Completeness
    const missingFields: Array<'category' | 'workersNeeded' | 'locationName' | 'offeredDailyWage' | 'shiftDate'> = [];
    if (!category) missingFields.push('category');
    if (!workersNeeded) missingFields.push('workersNeeded');
    if (!locationName) missingFields.push('locationName');
    if (!offeredDailyWage) missingFields.push('offeredDailyWage');
    if (!shiftDate) missingFields.push('shiftDate');

    const isComprehensive = missingFields.length === 0;

    return {
      category,
      workersNeeded: workersNeeded ? Math.max(1, Math.min(workersNeeded, 50)) : null,
      helperCategory,
      helpersNeeded,
      locationName,
      offeredDailyWage,
      shiftDate,
      workDescription: raw,
      isComprehensive,
      missingFields
    };
  }
}

export const nlpParser = new NlpParser();

