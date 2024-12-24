import {
  Menu,
  Moon,
  Heart,
  Footprints,
  Weight,
  CheckSquare,
  DumbbellIcon,
} from 'lucide-react';
import { DisplaySection } from '@/types/display-section';

interface NavigationTabsProps {
  activeSection: DisplaySection;
  setActiveSection: (section: DisplaySection) => void;
  entries: any[];
}

export const NavigationTabs = ({
  activeSection,
  setActiveSection,
  entries,
}: NavigationTabsProps) => {
  const tabs = [
    { name: 'All', icon: <Menu className="w-4 h-4" /> },
    { name: 'Sleep', icon: <Moon className="w-4 h-4" /> },
    { name: 'RHR', icon: <Heart className="w-4 h-4" /> },
    { name: 'Steps', icon: <Footprints className="w-4 h-4" /> },
    { name: 'Weight', icon: <Weight className="w-4 h-4" /> },
    {
      name: 'Checklist',
      icon: <CheckSquare className="w-4 h-4" />,
      showNotification: Boolean(
        (() => {
          const checklistItems = [
            {
              name: 'Daily Sleep',
              done: entries.some(
                (entry) => entry.date === new Date().toISOString().split('T')[0]
              ),
            },
            {
              name: 'Daily Weight',
              done: entries.some((entry) => entry.weight !== null),
            },
            {
              name: 'RHR for Previous Day',
              done: entries.some(
                (entry) =>
                  entry.date ===
                    new Date(Date.now() - 86400000)
                      .toISOString()
                      .split('T')[0] && entry.restingHeartRate !== null
              ),
            },
            {
              name: 'Steps for Previous Day',
              done: entries.some(
                (entry) =>
                  entry.date ===
                    new Date(Date.now() - 86400000)
                      .toISOString()
                      .split('T')[0] && entry.steps !== null
              ),
            },
          ];

          const showNotification = checklistItems.some((item) => !item.done);
          return showNotification;
        })()
      ),
    },
    { name: 'Gym', icon: <DumbbellIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() =>
                setActiveSection(
                  tab.name.toLowerCase().replace(' ', '') as DisplaySection
                )
              }
              className={`py-4 px-2 text-sm font-medium transition-colors flex items-center gap-2 relative ${
                activeSection === tab.name.toLowerCase().replace(' ', '')
                  ? 'text-purple-600 dark:text-white border-b-2 border-purple-600 dark:border-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.name}
              {tab.showNotification && (
                <span className="absolute top-3 right-0 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
