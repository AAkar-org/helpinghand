import { Request, Response } from 'express';
import { matchingService } from '../services/matchingService.js';
import { sessionService } from '../services/sessionService.js';
import { wageBenchmarkService, WAGE_BENCHMARKS } from '../services/wageBenchmarkService.js';
import { ivrCallService } from '../services/ivrCallService.js';

export class ApiController {
  public getWorkers = (req: Request, res: Response): void => {
    const { category, area } = req.query;
    let list = matchingService.getAllWorkers();

    if (category) {
      list = list.filter((w) => w.category === String(category).toUpperCase());
    }
    if (area) {
      list = list.filter((w) => w.location.area.toLowerCase().includes(String(area).toLowerCase()));
    }

    res.status(200).json({ count: list.length, workers: list });
  };

  public getJobs = (_req: Request, res: Response): void => {
    const jobs = sessionService.getAllJobs();
    res.status(200).json({ count: jobs.length, jobs });
  };

  public getSessions = (_req: Request, res: Response): void => {
    const sessions = sessionService.getAllSessions();
    res.status(200).json({ count: sessions.length, sessions });
  };

  public getWageBenchmarks = (_req: Request, res: Response): void => {
    res.status(200).json({ benchmarks: WAGE_BENCHMARKS });
  };

  public triggerMorningConfirmation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const id = Array.isArray(jobId) ? jobId[0] : jobId;
      if (!id) {
        res.status(400).json({ success: false, error: 'Job ID is required' });
        return;
      }
      const result = await ivrCallService.dispatchMorningConfirmation(id);
      res.status(200).json({ success: true, result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  };
}

export const apiController = new ApiController();
