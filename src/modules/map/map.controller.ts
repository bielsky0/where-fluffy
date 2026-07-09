import { Request, Response } from 'express';
import { ValidatedQueryRequest } from '../../shared/middleware/validate-query.js';
import { MapPinsQuery } from './map.schema.js';
import { MapService } from './map.service.js';

export type MapController = {
  pins: (req: Request, res: Response) => Promise<void>;
};

export const createMapController = (mapService: MapService): MapController => {
  // req.query jest już zwalidowany przez middleware validateQuery(...) w map.routes.ts.
  const pins = async (req: Request, res: Response): Promise<void> => {
    const { bbox, category } = (req as ValidatedQueryRequest<MapPinsQuery>).validatedQuery;
    const items = await mapService.getPins({ ...bbox, category });
    res.status(200).json(items);
  };

  return { pins };
};
