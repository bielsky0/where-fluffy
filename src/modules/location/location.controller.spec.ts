import express, { Express } from 'express';
import request from 'supertest';
import { createLocationController } from './location.controller.js';
import { LocationService } from './location.service.js';
import { LocationResponseDTO } from './dto/location-response.dto.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { locationMeQuerySchema } from './location.schema.js';

const buildResult = (overrides: Partial<LocationResponseDTO> = {}): LocationResponseDTO => ({
  lat: 52.2297,
  lng: 21.0122,
  city: 'Warszawa',
  source: 'fallback',
  ...overrides,
});

// Minimal throwaway app — only location's own route mounted, real controller wired to a mocked
// service, same pattern as geocode.controller.spec.ts's buildTestApp.
const buildTestApp = (locationService: LocationService): Express => {
  const controller = createLocationController(locationService);

  const app = express();
  app.get('/location/me', validateQuery(locationMeQuerySchema), asyncHandler(controller.me));
  app.use(errorHandler);
  return app;
};

describe('location controller (via supertest)', () => {
  let mockLocationService: jest.Mocked<LocationService>;
  let app: Express;

  beforeEach(() => {
    mockLocationService = { resolveLocation: jest.fn() };
    app = buildTestApp(mockLocationService);
  });

  it('returns 200 with the service result when no lat/lng is given (IP path)', async () => {
    mockLocationService.resolveLocation.mockResolvedValue(buildResult({ source: 'geoip', city: 'Krakow' }));

    const response = await request(app).get('/location/me');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(buildResult({ source: 'geoip', city: 'Krakow' }));
    expect(mockLocationService.resolveLocation).toHaveBeenCalledWith({
      ip: expect.any(String),
      lat: undefined,
      lng: undefined,
    });
  });

  it('forwards lat/lng to the service when both are given (GPS path)', async () => {
    mockLocationService.resolveLocation.mockResolvedValue(
      buildResult({ source: 'gps', lat: 51.08, lng: 17.02, city: 'Krzyki, Wrocław' }),
    );

    const response = await request(app).get('/location/me').query({ lat: '51.08', lng: '17.02' });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('gps');
    expect(mockLocationService.resolveLocation).toHaveBeenCalledWith({
      ip: expect.any(String),
      lat: 51.08,
      lng: 17.02,
    });
  });

  it('returns 400 when only lat is given without lng', async () => {
    const response = await request(app).get('/location/me').query({ lat: '51.08' });

    expect(response.status).toBe(400);
    expect(mockLocationService.resolveLocation).not.toHaveBeenCalled();
  });
});
