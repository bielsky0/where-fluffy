import { Request, Response } from 'express';
import { ValidatedQueryRequest } from '../../shared/middleware/validate-query.js';
import { SearchPetsQuery } from './search.schema.js';
import { SearchService } from './search.service.js';

export type SearchController = {
  searchPets: (req: Request, res: Response) => Promise<void>;
};

export const createSearchController = (searchService: SearchService): SearchController => {
  // req.query jest już zwalidowany przez middleware validateQuery(...) w search.routes.ts.
  const searchPets = async (req: Request, res: Response): Promise<void> => {
    const { q, limit } = (req as ValidatedQueryRequest<SearchPetsQuery>).validatedQuery;
    const results = await searchService.searchPets(q, limit);
    res.status(200).json(results);
  };

  return { searchPets };
};
