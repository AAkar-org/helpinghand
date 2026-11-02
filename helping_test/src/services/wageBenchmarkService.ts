import { WorkerCategory } from '../types/index.js';

export interface WageBenchmark {
  category: WorkerCategory;
  categoryDisplayName: string;
  categoryHindi: string;
  minAcceptableWage: number;
  standardMarketMin: number;
  standardMarketMax: number;
}

export const WAGE_BENCHMARKS: Record<WorkerCategory, WageBenchmark> = {
  MASON: {
    category: 'MASON',
    categoryDisplayName: 'Master Mason (Rajmistri)',
    categoryHindi: 'राजमिस्त्री',
    minAcceptableWage: 750,
    standardMarketMin: 850,
    standardMarketMax: 1000
  },
  LABOUR: {
    category: 'LABOUR',
    categoryDisplayName: 'Labour / Helper (Beldar)',
    categoryHindi: 'मजदूर / बेलदार',
    minAcceptableWage: 500,
    standardMarketMin: 550,
    standardMarketMax: 650
  },
  CARPENTER: {
    category: 'CARPENTER',
    categoryDisplayName: 'Carpenter (Badhai)',
    categoryHindi: 'बढ़ई / शटरिंग',
    minAcceptableWage: 850,
    standardMarketMin: 900,
    standardMarketMax: 1100
  },
  PLUMBER: {
    category: 'PLUMBER',
    categoryDisplayName: 'Plumber (Nal Mistri)',
    categoryHindi: 'नल मिस्त्री',
    minAcceptableWage: 750,
    standardMarketMin: 800,
    standardMarketMax: 1000
  },
  ELECTRICIAN: {
    category: 'ELECTRICIAN',
    categoryDisplayName: 'Electrician (Bijli Mistri)',
    categoryHindi: 'बिजली मिस्त्री',
    minAcceptableWage: 750,
    standardMarketMin: 800,
    standardMarketMax: 1000
  },
  PAINTER: {
    category: 'PAINTER',
    categoryDisplayName: 'Painter (Rangai Mistri)',
    categoryHindi: 'रंगाई मिस्त्री',
    minAcceptableWage: 700,
    standardMarketMin: 750,
    standardMarketMax: 900
  },
  TILE_MISTRI: {
    category: 'TILE_MISTRI',
    categoryDisplayName: 'Tile & Marble Mistri',
    categoryHindi: 'फर्श / टाइल मिस्त्री',
    minAcceptableWage: 850,
    standardMarketMin: 900,
    standardMarketMax: 1100
  },
  WELDER: {
    category: 'WELDER',
    categoryDisplayName: 'Welder / Rebar Mistri (Sariya)',
    categoryHindi: 'सरिया / वेल्डर',
    minAcceptableWage: 800,
    standardMarketMin: 850,
    standardMarketMax: 1000
  }
};

export class WageBenchmarkService {
  public getBenchmark(category: WorkerCategory): WageBenchmark {
    return WAGE_BENCHMARKS[category] || WAGE_BENCHMARKS.LABOUR;
  }

  /**
   * Evaluates offered wage against current market standards in Delhi-NCR
   */
  public evaluateWage(
    category: WorkerCategory,
    offeredWage: number
  ): {
    isLowball: boolean;
    isSeverelyUnderpaid: boolean;
    benchmark: WageBenchmark;
    recommendedWage: number;
    advisoryMessage?: string;
  } {
    const benchmark = this.getBenchmark(category);
    const isSeverelyUnderpaid = offeredWage < benchmark.minAcceptableWage;
    const isLowball = offeredWage < benchmark.standardMarketMin;

    if (isSeverelyUnderpaid) {
      return {
        isLowball: true,
        isSeverelyUnderpaid: true,
        benchmark,
        recommendedWage: benchmark.standardMarketMin,
        advisoryMessage:
          `⚠️ *Dihadi Alert (Wage too low):*\n` +
          `${benchmark.categoryHindi} ki market me standard dihadi ₹${benchmark.standardMarketMin} se ₹${benchmark.standardMarketMax}/din chal rahi hai.\n\n` +
          `Aapki offer ₹${offeredWage} bahut kam hai. Is rate par workers kaam reject kar sakte hain.\n` +
          `👉 Kripya kam se kam *₹${benchmark.standardMarketMin}* offer karein.`
      };
    }

    if (isLowball) {
      return {
        isLowball: true,
        isSeverelyUnderpaid: false,
        benchmark,
        recommendedWage: benchmark.standardMarketMin,
        advisoryMessage:
          `ℹ️ *Market Suggestion:*\n` +
          `Is area me ${benchmark.categoryHindi} ki standard dihadi ₹${benchmark.standardMarketMin}–₹${benchmark.standardMarketMax}/din hai.\n` +
          `₹${offeredWage} par call shuru ki ja rahi hai, par agar turant acceptance chahiye toh ₹${benchmark.standardMarketMin} behtar rahega.`
      };
    }

    return {
      isLowball: false,
      isSeverelyUnderpaid: false,
      benchmark,
      recommendedWage: offeredWage
    };
  }
}

export const wageBenchmarkService = new WageBenchmarkService();

