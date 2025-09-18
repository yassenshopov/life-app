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
  Settings,
  Menu as MenuIcon,
  ListChecks,
  Calendar,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { DisplaySection } from '@/types/display-section';
import { useRouter } from 'next/navigation';

interface NavigationTabsProps {
  activeSection: DisplaySection;
  setActiveSection: (section: DisplaySection) => void;
  entries: any[];
}

export function NavigationTabs({ activeSection, setActiveSection, entries }: NavigationTabsProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();

  const hasEntriesForToday =
    Array.isArray(entries) &&
    entries.some((entry) => entry.date === new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    setShowUserDropdown(false);
  };

  const handleSettingsClick = () => {
    setShowUserDropdown(false);
    router.push('/settings');
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
              done:
                Array.isArray(entries) &&
                entries.some(
                  (entry) =>
                    entry.date === new Date(Date.now() - 86400000).toISOString().split('T')[0] &&
                    entry.restingHeartRate !== null
                ),
            },
            {
              name: 'Steps for Previous Day',
              done:
                Array.isArray(entries) &&
                entries.some(
                  (entry) =>
                    entry.date === new Date(Date.now() - 86400000).toISOString().split('T')[0] &&
                    entry.steps !== null
                ),
            },
          ];

          const showNotification = checklistItems.some((item) => !item.done);
          return showNotification;
        })()
      ),
    },
    { name: 'Gym', icon: <DumbbellIcon className="w-4 h-4" /> },
    { name: 'Finances', icon: <DollarSign className="w-4 h-4" /> },
    { name: 'Habits', icon: <ListChecks className="w-4 h-4" /> },
    { name: 'Daily Tracking', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/85 z-40 sm:hidden min-h-screen"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="border-b border-slate-200 dark:border-slate-800 relative">
        <div className="max-w-7xl mx-auto px-4">
          {/* Desktop Navigation */}
          <div className="flex justify-between items-center">
            <nav className="hidden sm:flex">
              {tabs.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() =>
                    setActiveSection(tab.name.toLowerCase().replace(' ', '') as DisplaySection)
                  }
                  className={`py-4 px-4 text-sm font-medium transition-colors flex items-center gap-2 relative ${
                    activeSection === tab.name.toLowerCase().replace(' ', '')
                      ? 'text-purple-600 dark:text-white border-b-2 border-purple-600 dark:border-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.icon}
                  {tab.name}
                </button>
              ))}
            </nav>

            {/* Mobile Header - Always Visible */}
            <div className="flex items-center justify-between w-full sm:hidden">
              <div className="flex items-center gap-2 text-purple-600 dark:text-white font-medium">
                {
                  tabs.find((tab) => tab.name.toLowerCase().replace(' ', '') === activeSection)
                    ?.icon
                }
                {
                  tabs.find((tab) => tab.name.toLowerCase().replace(' ', '') === activeSection)
                    ?.name
                }
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Toggle menu"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Section */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 py-4 text-sm text-slate-600 dark:text-slate-400">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="Profile"
                    className="w-6 h-6 rounded-full cursor-pointer"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full font-bold bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white cursor-pointer"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                  >
                    {user.primaryEmailAddress?.emailAddress[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline">{user.primaryEmailAddress?.emailAddress}</span>
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-50">
                      <button
                        onClick={handleSettingsClick}
                        className="w-full px-4 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
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

          {/* Mobile Menu Dropdown - ensure it's above the overlay */}
          {isMobileMenuOpen && (
            <div className="sm:hidden absolute left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => {
                    setActiveSection(tab.name.toLowerCase().replace(' ', '') as DisplaySection);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-2 ${
                    activeSection === tab.name.toLowerCase().replace(' ', '')
                      ? 'bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  {tab.name}
                </button>
              ))}

              {/* Mobile User Options */}
              {user && (
                <>
                  <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                  <button
                    onClick={handleSettingsClick}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
