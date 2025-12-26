import { useEffect, RefObject } from 'react';

/**
 * Hook to enable smooth scrolling on an element
 * Uses CSS scroll-behavior and enhances with JavaScript for better browser compatibility
 */
export function useSmoothScroll<T extends HTMLElement = HTMLDivElement>(
  ref: RefObject<T>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!ref.current || !enabled) return;

    const element = ref.current;
    
    // Apply smooth scrolling via inline styles
    element.style.scrollBehavior = 'smooth';
    element.style.setProperty('-webkit-overflow-scrolling', 'touch');
    
    // Add smooth scroll class
    element.classList.add('smooth-scroll');

    // For browsers that don't fully support CSS scroll-behavior on wheel events,
    // we can enhance with JavaScript, but we'll keep it simple and let CSS handle it
    // Modern browsers (Chrome, Firefox, Safari) support scroll-behavior on wheel events

    return () => {
      element.style.scrollBehavior = '';
      element.style.removeProperty('-webkit-overflow-scrolling');
      element.classList.remove('smooth-scroll');
    };
  }, [ref, enabled]);
}


