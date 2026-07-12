import { Request, Response } from 'express';
import { ValidatedQueryRequest } from '../../shared/middleware/validate-query.js';
import { LocationMeQuery } from './location.schema.js';
import { LocationService } from './location.service.js';

export type LocationController = {
  me: (req: Request, res: Response) => Promise<void>;
};

export const createLocationController = (locationService: LocationService): LocationController => {
  // req.query jest już zwalidowany przez middleware validateQuery(...) w location.routes.ts.
  const me = async (req: Request, res: Response): Promise<void> => {
    const { lat, lng } = (req as ValidatedQueryRequest<LocationMeQuery>).validatedQuery;
    const result = await locationService.resolveLocation({ ip: req.ip, lat, lng });
    res.status(200).json(result);
  };

  return { me };
};
