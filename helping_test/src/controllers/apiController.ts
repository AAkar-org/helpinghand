import { Request, Response } from 'express';
import { matchingService } from '../services/matchingService.js';
import { sessionService } from '../services/sessionService.js';

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
}

export const apiController = new ApiController();
