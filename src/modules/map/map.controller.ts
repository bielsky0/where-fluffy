import { Request, Response } from 'express';
import { ValidatedQueryRequest } from '../../shared/middleware/validate-query.js';
import { MapPinsQuery, MapStatsQuery } from './map.schema.js';
import { MapService } from './map.service.js';

export type MapController = {
  pins: (req: Request, res: Response) => Promise<void>;
  stats: (req: Request, res: Response) => Promise<void>;
};

export const createMapController = (mapService: MapService): MapController => {
  // req.query jest już zwalidowany przez middleware validateQuery(...) w map.routes.ts.
  const pins = async (req: Request, res: Response): Promise<void> => {
    const { bbox, lat, lng, radius, category } = (req as ValidatedQueryRequest<MapPinsQuery>).validatedQuery;
    const items = await mapService.getPins(bbox ? { bbox, category } : { lat, lng, radiusInMeters: radius, category });
    res.status(200).json(items);
  };

  const stats = async (req: Request, res: Response): Promise<void> => {
    const { lat, lng, radius, category } = (req as ValidatedQueryRequest<MapStatsQuery>).validatedQuery;
    const result = await mapService.getStats({ lat, lng, radiusInMeters: radius, category });
    res.status(200).json(result);
  };

  return { pins, stats };
};
