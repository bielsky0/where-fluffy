import type { Pet } from '../types/pet.types';

interface PetCardProps {
  pet: Pet;
}

export function PetCard({ pet }: PetCardProps) {
  return (
    <article className="pet-card">
      <h3>{pet.name}</h3>
      <p>{pet.species}</p>
      <span data-status={pet.status}>{pet.status === 'missing' ? 'Missing' : 'Found'}</span>
      {pet.reward > 0 && <p>Reward: {pet.reward}</p>}
    </article>
  );
}
