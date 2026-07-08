import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn/ui utility: clsx resolves conditional/array class input down to a string,
// twMerge then resolves Tailwind class *conflicts* in that string (e.g. a caller passing
// `className="p-4"` into a component whose own root already has `p-2` — plain clsx would emit
// both and let CSS source order decide the winner; twMerge keeps only the last one per
// property group) so `className` overrides always behave predictably regardless of import order.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
