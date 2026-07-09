import { Request, Response } from 'express';
import { ValidatedQueryRequest } from '../../shared/middleware/validate-query.js';
import { FeedQuery, UrgentFeedQuery } from './feed.schema.js';
import { FeedService } from './feed.service.js';

export type FeedController = {
  urgent: (req: Request, res: Response) => Promise<void>;
  list: (req: Request, res: Response) => Promise<void>;
};

export const createFeedController = (feedService: FeedService): FeedController => {
  // req.query jest już zwalidowany przez middleware validateQuery(...) w pets.routes.ts —
  // przypięty pod req.validatedQuery, bo req.query w Express 5 to getter bez settera.
  const urgent = async (req: Request, res: Response): Promise<void> => {
    const { lat, lng, radius, category } = (req as ValidatedQueryRequest<UrgentFeedQuery>).validatedQuery;
    const items = await feedService.getUrgentNearby({ lat, lng, radiusInMeters: radius ?? 5000, category });
    res.status(200).json(items);
  };

  const list = async (req: Request, res: Response): Promise<void> => {
    const { lat, lng, radius, category, cursor, limit } = (req as ValidatedQueryRequest<FeedQuery>).validatedQuery;
    const page = await feedService.getFeedPage({
      lat,
      lng,
      radiusInMeters: radius ?? 5000,
      category,
      cursor: cursor ?? null,
      limit: limit ?? 20,
    });
    res.status(200).json(page);
  };

  return { urgent, list };
};
