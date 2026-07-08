import { useEffect, useState } from 'react';

// On mobile Safari/Chrome the on-screen keyboard shrinks `window.visualViewport`'s height
// while `window.innerHeight` (the layout viewport) stays put — comparing the two is the
// standard way to detect "the keyboard currently covers part of the screen" with no permission
// prompt or native bridge. The threshold filters out the small viewport deltas browser chrome
// (URL bar show/hide) can also cause, which are far shorter than a real keyboard. Degrades to
// `false` (never hidden) on desktop or browsers without `visualViewport` support — the safe
// default, since nothing should get hidden that isn't actually being obscured.
const KEYBOARD_HEIGHT_THRESHOLD = 150;

export function useVirtualKeyboardVisible(): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      setIsVisible(window.innerHeight - viewport.height > KEYBOARD_HEIGHT_THRESHOLD);
    };

    handleResize();
    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  return isVisible;
}
