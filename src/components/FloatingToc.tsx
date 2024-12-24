import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FloatingTocProps {
  sections: {
    id: string;
    title: string;
    icon?: React.ReactNode;
  }[];
}

export const FloatingToc = ({ sections }: FloatingTocProps) => {
  const [activeSection, setActiveSection] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -80% 0px', // Adjust these values to change when sections become "active"
      }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div 
      className="fixed right-4 top-[120px] z-50 hidden xl:block"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-1.5 border border-slate-200 dark:border-slate-800 shadow-lg">
        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'flex items-center px-2 py-1 rounded-sm text-sm transition-colors w-full text-left',
                  activeSection === section.id
                    ? 'text-purple-900 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-purple-900 dark:hover:text-purple-300'
                )}
              >
                {!isExpanded && (
                  <div className={cn(
                    'w-3 h-0.5 rounded-full',
                    activeSection === section.id
                      ? 'bg-purple-900 dark:bg-purple-300'
                      : 'bg-slate-600 dark:bg-slate-400'
                  )} />
                )}
                {isExpanded && (
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span>{section.title}</span>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};