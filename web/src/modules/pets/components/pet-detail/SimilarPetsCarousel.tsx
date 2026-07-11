import { useNavigate } from 'react-router-dom';
import { useSimilarPets } from '../../api/useSimilarPets';
import { PetCard } from '../PetCard';
import type { Pet } from '../../types/pet.types';

// Same fixed light "product detail" tokens as PetDetailPage.tsx (not exported from there —
// duplicated here rather than threaded through as props, same call PetCard.tsx already makes for
// its own tokens).
const ANTHRACITE = '#222222';
const HAIRLINE_BORDER = '#E5E5E5';

const CARD_CLASS_NAME = 'w-[62%] max-w-[220px] shrink-0 snap-start';

function SimilarPetsSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex w-[62%] max-w-[220px] shrink-0 flex-col gap-2.5">
          <div className="aspect-[16/9] w-full animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

interface SimilarPetsCarouselProps {
  pet: Pet;
}

// "Podobne zwierzęta w okolicy" — self-contained section (owns its own fetch via
// useSimilarPets), placed on PetDetailPage.tsx between the description and the sighting timeline.
// Never shows a visible error or empty state: per spec, a failed/slow AI-similarity lookup or a
// genuinely empty result set must not degrade the main pet detail view, so both cases just render
// nothing.
export function SimilarPetsCarousel({ pet }: SimilarPetsCarouselProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useSimilarPets(pet.id);

  if (isError || (data && data.length === 0)) return null;

  return (
    <div className="border-t px-5 py-5" style={{ borderColor: HAIRLINE_BORDER }}>
      <h2 className="mb-2 text-lg font-bold" style={{ color: ANTHRACITE }}>
        Podobne zwierzęta w okolicy
      </h2>
      {isLoading || !data ? (
        <SimilarPetsSkeleton />
      ) : (
        <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-pl-5 px-5 pb-1">
          {data.map((candidate) => (
            <PetCard
              key={candidate.id}
              pet={candidate}
              origin={pet.location}
              onClick={() => navigate(`/app/pets/${candidate.id}`)}
              className={CARD_CLASS_NAME}
            />
          ))}
        </div>
      )}
    </div>
  );
}
