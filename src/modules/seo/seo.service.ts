import { PetsService } from '../pets/pets.service.js';
import { buildOgPreviewHtml } from './seo.template.js';

export type SeoService = {
  buildPreviewHtml: (petId: string) => Promise<string | null>;
};

// Reuses pets.service.ts's getPetById (built for the real GET /pets/:id endpoint) rather than
// a second repository call — the preview needs exactly the same fields (name, photo, city).
export const createSeoService = (petsService: PetsService, frontendBaseUrl: string): SeoService => {
  const buildPreviewHtml: SeoService['buildPreviewHtml'] = async (petId) => {
    let pet;
    try {
      pet = await petsService.getPetById(petId);
    } catch {
      return null;
    }

    const statusPhrase = pet.status === 'missing' ? 'Zaginął' : 'Widziany';
    const cityPhrase = pet.city ? ` w ${pet.city}` : '';

    return buildOgPreviewHtml({
      title: `${statusPhrase}: ${pet.name}${cityPhrase} — Where's Fluffy`,
      description: `${pet.species}. Pomóż w poszukiwaniach — zobacz zgłoszenie i zgłoś zaobserwowanie.`,
      // TODO: pageUrl currently points at the in-app route (behind app-shell chrome), not a
      // dedicated public share URL — see the open assumption in the pet-detail-page plan about
      // minting an unauthenticated /p/:petId route once production hosting is decided.
      pageUrl: `${frontendBaseUrl}/app/pets/${pet.id}`,
      imageUrl: pet.photoUrls[0] ?? pet.photoUrl ?? null,
    });
  };

  return { buildPreviewHtml };
};
