import {
  Menu,
  Moon,
  Heart,
  Footprints,
  Weight,
  CheckSquare,
  DumbbellIcon,
  DollarSign,
  User,
  MoreVertical,
  LogOut,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DisplaySection } from '@/types/display-section';

interface NavigationTabsProps {
  activeSection: DisplaySection;
  setActiveSection: (section: DisplaySection) => void;
  entries: any[];
  user?: any;
}

export function NavigationTabs({
  activeSection,
  setActiveSection,
  entries,
  user,
}: NavigationTabsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();

  const hasEntriesForToday = Array.isArray(entries) && entries.some(
    (entry) => entry.date === new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowDropdown(false);
  };

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
              done: hasEntriesForToday,
            },
            {
              name: 'Daily Weight',
              done: Array.isArray(entries) && entries.some((entry) => entry.weight !== null),
            },
            {
              name: 'RHR for Previous Day',
              done: Array.isArray(entries) && entries.some(
                (entry) =>
                  entry.date ===
                    new Date(Date.now() - 86400000)
                      .toISOString()
                      .split('T')[0] && entry.restingHeartRate !== null
              ),
            },
            {
              name: 'Steps for Previous Day',
              done: Array.isArray(entries) && entries.some(
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
    { name: 'Money', icon: <DollarSign className="w-4 h-4" /> },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
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

        {user && (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-600 dark:text-slate-400">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-6 h-6 rounded-full cursor-pointer"
                onClick={() => setShowDropdown(!showDropdown)}
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full font-bold bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white cursor-pointer"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {user.email[0].toUpperCase()}
              </div>
            )}
            <span className="hidden sm:inline">{user.email}</span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
