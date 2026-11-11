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
          `*Helping Hand | Dihadi Advisory*\n` +
          `─────────────────────────────────────────\n` +
          `Category: ${benchmark.categoryDisplayName}\n` +
          `Offered Wage: Rs. ${offeredWage} / day\n\n` +
          `Notice: Is area me ${benchmark.categoryHindi} ki standard dihadi Rs. ${benchmark.standardMarketMin} se Rs. ${benchmark.standardMarketMax}/din chal rahi hai.\n` +
          `Rs. ${offeredWage} par workers dispatch accept karne se mana kar sakte hain.\n\n` +
          `- Reply '1' to upgrade wage to standard Rs. ${benchmark.standardMarketMin} / day\n` +
          `- Reply '2' to continue with your offer Rs. ${offeredWage}\n` +
          `─────────────────────────────────────────`
      };
    }

    if (isLowball) {
      return {
        isLowball: true,
        isSeverelyUnderpaid: false,
        benchmark,
        recommendedWage: benchmark.standardMarketMin,
        advisoryMessage:
          `*Helping Hand | Market Rate Notice*\n` +
          `─────────────────────────────────────────\n` +
          `Is area me ${benchmark.categoryHindi} ki standard dihadi Rs. ${benchmark.standardMarketMin} se Rs. ${benchmark.standardMarketMax}/din hai.\n` +
          `Rs. ${offeredWage} par call shuru ki ja rahi hai. Turant acceptance ke liye Rs. ${benchmark.standardMarketMin} anukul rahega.\n` +
          `─────────────────────────────────────────`
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

