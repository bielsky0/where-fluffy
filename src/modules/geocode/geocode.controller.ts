import { Request, Response } from 'express';
import { ValidatedQueryRequest } from '../../shared/middleware/validate-query.js';
import { GeocodeSearchQuery } from './geocode.schema.js';
import { GeocodeService } from './geocode.service.js';

export type GeocodeController = {
  search: (req: Request, res: Response) => Promise<void>;
};

export const createGeocodeController = (geocodeService: GeocodeService): GeocodeController => {
  // req.query jest już zwalidowany przez middleware validateQuery(...) w geocode.routes.ts.
  const search = async (req: Request, res: Response): Promise<void> => {
    const { q } = (req as ValidatedQueryRequest<GeocodeSearchQuery>).validatedQuery;
    const results = await geocodeService.search(q);
    res.status(200).json(results);
  };

  return { search };
};
