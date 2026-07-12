import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

// `soft` shadow lives in the base string (both variants get it) since it's the one property
// the design spec calls universal across the landing page's card surfaces.
const cardVariants = cva('rounded-2xl p-6 shadow-soft', {
  variants: {
    variant: {
      default: 'border border-gray-200 bg-white',
      dark: 'bg-ink text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, className }))} {...props} />
  ),
);
Card.displayName = 'Card';
