'use client';

import { useEffect } from 'react';
import { useThemeToggle } from './theme-toggle';

export function GlobalThemeToggle() {
  const { toggleTheme } = useThemeToggle();

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [toggleTheme]);

  return null; // This component doesn't render anything
} 