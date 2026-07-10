import { Request, Response, NextFunction } from 'express';
import { isKnownCrawler } from './seo.bot-detector.js';
import { SeoController } from './seo.controller.js';

// Not wired into app.ts yet — this repo has no static-file bridge into the actual SPA (`web/`
// is a standalone Vite build with no documented production hosting), so there's nothing for a
// non-crawler request to fall through to here. Once that's decided, mount this ahead of
// whichever route serves the real pet-detail page (e.g. a reverse-proxy/CDN rule, or
// `express.static` + SPA fallback) so crawler requests short-circuit into `seoController.preview`
// while everyone else reaches the SPA unchanged.
export const createBotGateMiddleware = (seoController: SeoController) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isKnownCrawler(req.headers['user-agent'])) {
      next();
      return;
    }

    await seoController.preview(req, res);
  };
};
