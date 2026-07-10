import express, { Express } from 'express';
import request from 'supertest';
import { createGeocodeController } from './geocode.controller.js';
import { GeocodeService } from './geocode.service.js';
import { IGeocodeResult } from './interfaces/geocode.interface.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { geocodeSearchQuerySchema } from './geocode.schema.js';
import { createAppError } from '../../shared/errors/app-error.js';

const buildResult = (overrides: Partial<IGeocodeResult> = {}): IGeocodeResult => ({
  label: 'Wrocław, Polska',
  lat: 51.1079,
  lng: 17.0385,
  bbox: null,
  ...overrides,
});

// Minimal throwaway app — only geocode's own route mounted, same pattern as
// auth.controller.spec.ts's buildTestApp: real controller wired to a mocked service.
const buildTestApp = (geocodeService: GeocodeService): Express => {
  const controller = createGeocodeController(geocodeService);

  const app = express();
  app.get('/geocode/search', validateQuery(geocodeSearchQuerySchema), asyncHandler(controller.search));
  app.use(errorHandler);
  return app;
};

describe('geocode controller (via supertest)', () => {
  let mockGeocodeService: jest.Mocked<GeocodeService>;
  let app: Express;

  beforeEach(() => {
    mockGeocodeService = { search: jest.fn() };
    app = buildTestApp(mockGeocodeService);
  });

  it('returns 200 with the service results for a valid query', async () => {
    mockGeocodeService.search.mockResolvedValue([buildResult()]);

    const response = await request(app).get('/geocode/search').query({ q: 'Wrocław' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([buildResult()]);
    expect(mockGeocodeService.search).toHaveBeenCalledWith('Wrocław');
  });

  it('returns 400 when the query is shorter than 2 characters', async () => {
    const response = await request(app).get('/geocode/search').query({ q: 'a' });

    expect(response.status).toBe(400);
    expect(mockGeocodeService.search).not.toHaveBeenCalled();
  });

  it('surfaces the statusCode of an AppError thrown by the service', async () => {
    mockGeocodeService.search.mockRejectedValue(createAppError(502, 'Wyszukiwarka lokalizacji zwróciła błąd.'));

    const response = await request(app).get('/geocode/search').query({ q: 'Wrocław' });

    expect(response.status).toBe(502);
  });
});
