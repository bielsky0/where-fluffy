import express, { Express } from 'express';
import request from 'supertest';
import { createMapController } from './map.controller.js';
import { MapService } from './map.service.js';
import { IMapPin, MapStatsResult } from './interfaces/map.interface.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { mapPinsQuerySchema, mapStatsQuerySchema } from './map.schema.js';

const buildPin = (overrides: Partial<IMapPin> = {}): IMapPin => ({
  id: 'pet-1',
  lat: 52.2297,
  lng: 21.0122,
  status: 'missing',
  category: 'dog',
  ...overrides,
});

// Minimal throwaway app — only map's own routes mounted, real controller wired to a mocked
// service, same pattern as geocode.controller.spec.ts's buildTestApp.
const buildTestApp = (mapService: MapService): Express => {
  const controller = createMapController(mapService);

  const app = express();
  app.get('/map/pins', validateQuery(mapPinsQuerySchema), asyncHandler(controller.pins));
  app.get('/map/stats', validateQuery(mapStatsQuerySchema), asyncHandler(controller.stats));
  app.use(errorHandler);
  return app;
};

describe('map controller (via supertest)', () => {
  let mockMapService: jest.Mocked<MapService>;
  let app: Express;

  beforeEach(() => {
    mockMapService = { getPins: jest.fn(), getStats: jest.fn() };
    app = buildTestApp(mockMapService);
  });

  describe('GET /map/pins', () => {
    it('returns 200 with pins for bbox mode', async () => {
      mockMapService.getPins.mockResolvedValue([buildPin()]);

      const response = await request(app).get('/map/pins').query({ bbox: '20.9,52.15,21.15,52.3' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([buildPin()]);
      expect(mockMapService.getPins).toHaveBeenCalledWith({
        bbox: { minLng: 20.9, minLat: 52.15, maxLng: 21.15, maxLat: 52.3 },
        category: undefined,
      });
    });

    it('returns 200 with pins for radius mode', async () => {
      mockMapService.getPins.mockResolvedValue([buildPin()]);

      const response = await request(app)
        .get('/map/pins')
        .query({ lat: '52.2297', lng: '21.0122', radius: '5000' });

      expect(response.status).toBe(200);
      expect(mockMapService.getPins).toHaveBeenCalledWith({
        lat: 52.2297,
        lng: 21.0122,
        radiusInMeters: 5000,
        category: undefined,
      });
    });

    it('returns 400 when neither bbox nor lat/lng/radius is given', async () => {
      const response = await request(app).get('/map/pins');

      expect(response.status).toBe(400);
      expect(mockMapService.getPins).not.toHaveBeenCalled();
    });
  });

  describe('GET /map/stats', () => {
    it('returns 200 with the stats result', async () => {
      const stats: MapStatsResult = { total: 24, missing: 18, found: 6 };
      mockMapService.getStats.mockResolvedValue(stats);

      const response = await request(app)
        .get('/map/stats')
        .query({ lat: '52.2297', lng: '21.0122', radius: '5000' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(stats);
      expect(mockMapService.getStats).toHaveBeenCalledWith({
        lat: 52.2297,
        lng: 21.0122,
        radiusInMeters: 5000,
        category: undefined,
      });
    });

    it('returns 400 when radius is missing', async () => {
      const response = await request(app).get('/map/stats').query({ lat: '52.2297', lng: '21.0122' });

      expect(response.status).toBe(400);
      expect(mockMapService.getStats).not.toHaveBeenCalled();
    });
  });
});
