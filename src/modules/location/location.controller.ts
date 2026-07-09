import { Request, Response } from 'express';
import { LocationService } from './location.service.js';

export type LocationController = {
  me: (req: Request, res: Response) => Promise<void>;
};

export const createLocationController = (locationService: LocationService): LocationController => {
  const me = async (req: Request, res: Response): Promise<void> => {
    const result = locationService.resolveLocationForIp(req.ip);
    res.status(200).json(result);
  };

  return { me };
};
