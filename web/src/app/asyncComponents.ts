import { createElement, lazy, Suspense, type ComponentType, type ReactNode } from 'react';

type AsyncComponentLoader<P extends object> = () => Promise<{ default: ComponentType<P> }>;

// Wraps React.lazy + Suspense into a single drop-in component so route definitions
// (routes/index.tsx) stay declarative — each module's `pages/` entry point is registered as
// one `asyncComponent(() => import('...'))` call, and the code-splitting boundary + loading
// fallback are handled here, once, instead of every route re-wrapping itself in <Suspense>.
export function asyncComponent<P extends object>(
  loader: AsyncComponentLoader<P>,
  fallback: ReactNode = null,
): ComponentType<P> {
  const LazyComponent = lazy(loader);

  return function AsyncComponent(props: P) {
    // `createElement`'s overloads can't prove a generic `P` satisfies `LazyComponent`'s prop
    // type (a known TS limitation with generic component props) — safe because `props: P` is
    // exactly what `loader`'s resolved component expects.
    return createElement(Suspense, { fallback }, createElement(LazyComponent as ComponentType<any>, props));
  };
}
