import { Request, Response } from 'express';
import { SeoService } from './seo.service.js';

export type SeoController = {
  preview: (req: Request, res: Response) => Promise<void>;
};

export const createSeoController = (seoService: SeoService): SeoController => {
  const preview = async (req: Request, res: Response): Promise<void> => {
    const html = await seoService.buildPreviewHtml(req.params.petId as string);

    if (!html) {
      res.status(404).type('html').send('<!doctype html><title>Nie znaleziono</title>');
      return;
    }

    res.status(200).type('html').send(html);
  };

  return { preview };
};
