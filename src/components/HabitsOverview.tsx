import { useEffect, useState, useCallback } from 'react';
import { CircleDot, History, Ban, PencilIcon, LayoutGrid, List } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { StatusFilter } from './StatusFilter';
import { StatusBadge } from './StatusBadge';
import { HabitLoadingOverlay } from './HabitLoadingOverlay';
import { Checkbox } from "@/components/ui/checkbox";
import ReactCanvasConfetti from 'react-canvas-confetti';

interface Habit {
  id: string;
  name: string;
  status: 'Active' | 'Unplanned' | 'Discontinued';
  colorCode: string;
  days: { id: string; date: string }[];
}

interface HeatmapDay {
  date: string;
  isCompleted: boolean;
}

interface Props {
  dateRange: { from: Date; to: Date };
  activeTab: string | null;
  handleDateRangeFilter: (days: number | string) => void;
}

const confetti = ReactCanvasConfetti as unknown as (options: any) => void;

export function HabitsOverview({ dateRange, activeTab, handleDateRangeFilter }: Props) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Active', 'Unplanned', 'Discontinued']);
  const [showNewHabitModal, setShowNewHabitModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitStatus, setNewHabitStatus] = useState<'Active' | 'Unplanned' | 'Discontinued'>('Active');
  const [newHabitColor, setNewHabitColor] = useState('#22c55e'); // Default green color
  const [showEditHabitModal, setShowEditHabitModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<{id: string, name: string, status: string, colorCode: string} | null>(null);
  const [loadingHabits, setLoadingHabits] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'checklist'>('grid');
  const checkboxSound = new Audio('/sounds/long-pop.wav'); // Using the actual filename you added
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  useEffect(() => {
    fetchHabits();
  }, []);

  const fetchHabits = async () => {
    try {
      const response = await fetch('/api/notion/habits');
      const data = await response.json();
      setHabits(data);
    } catch (error) {
      console.error('Error fetching habits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setHabitLoading = (habitId: string, loading: boolean) => {
    setLoadingHabits(current => {
      const newSet = new Set(current);
      if (loading) {
        newSet.add(habitId);
      } else {
        newSet.delete(habitId);
      }
      return newSet;
    });
  };

  const updateHabitColor = async (habitId: string, color: string) => {
    setHabitLoading(habitId, true);
    try {
      // Optimistically update the UI
      setHabits(currentHabits => 
        currentHabits.map(habit => 
          habit.id === habitId 
            ? { ...habit, colorCode: color }
            : habit
        )
      );

      await fetch('/api/notion/habits/color', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          habitId,
          color,
        }),
      });
      // No need to fetchHabits() here since we already updated the UI
    } catch (error) {
      console.error('Error updating habit color:', error);
      // Revert the change if the API call fails
      fetchHabits();
    } finally {
      setHabitLoading(habitId, false);
    }
  };

  const updateHabitStatus = async (habitId: string, status: 'Active' | 'Unplanned' | 'Discontinued') => {
    setHabitLoading(habitId, true);
    try {
      const response = await fetch('/api/notion/habits/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ habitId, status }),
      });

      if (response.ok) {
        fetchHabits();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setHabitLoading(habitId, false);
    }
  };

  const getStatusIcon = (status: string, colorCode: string) => {
    switch (status) {
      case 'Active':
        return <CircleDot className="w-4 h-4" style={{ color: colorCode }} />;
      case 'Discontinued':
        return <Ban className="w-4 h-4 text-slate-500" />;
      default:
        return <History className="w-4 h-4 text-purple-500" />;
    }
  };

  const getDaysBetweenDates = (startDate: Date, endDate: Date) => {
    const days = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      days.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  };

  const renderHeatmap = (habit: Habit) => {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Ensure the date range includes today
    const startDate = new Date(Math.min(dateRange.from.getTime(), today.getTime()));
    const endDate = new Date(Math.max(dateRange.to.getTime(), today.getTime()));
    
    // Get all days using the adjusted date range
    const allDays = getDaysBetweenDates(startDate, endDate);
    const weeks: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Create color variations
    const baseColor = habit.colorCode;
    const darkColor = `${baseColor}CC`;  // 80% opacity

    allDays.forEach((date) => {
      const isCompleted = habit.days.some(day => day.date === date);
      currentWeek.push({ date, isCompleted });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const toggleHabitForDate = async (habitId: string, date: string, isCompleted: boolean) => {
      if (!isCompleted) {
        playCheckSound();
      }
      
      setHabitLoading(habitId, true);
      try {
        const response = await fetch('/api/notion/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            habitId,
            date,
            completed: !isCompleted,
          }),
        });

        if (response.ok) {
          fetchHabits();
        }
      } catch (error) {
        console.error('Error toggling habit:', error);
      } finally {
        setHabitLoading(habitId, false);
      }
    };

    return (
      <div className="mt-2 flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 pr-2">
          {weekDays.map((day) => (
            <div key={day} className="w-3 h-3 text-xs text-slate-400/50 flex items-center justify-center">
              {day[0]}
            </div>
          ))}
        </div>

        {/* Heatmap squares */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                style={{
                  backgroundColor: day.isCompleted ? darkColor : undefined
                }}
                className="w-3 h-3 rounded-sm dark:bg-slate-800 bg-slate-100 hover:ring-2 hover:ring-slate-400/20 transition-all cursor-pointer"
                title={`${new Date(day.date).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}${day.isCompleted ? ' - Completed' : ''}`}
                onClick={() => toggleHabitForDate(habit.id, day.date, day.isCompleted)}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const createNewHabit = async () => {
    try {
      const response = await fetch('/api/notion/habits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHabitName,
          status: newHabitStatus,
          colorCode: newHabitColor,
        }),
      });

      if (response.ok) {
        setShowNewHabitModal(false);
        setNewHabitName('');
        fetchHabits();
      }
    } catch (error) {
      console.error('Error creating habit:', error);
    }
  };

  const editHabit = async () => {
    if (!editingHabit) return;
    
    setHabitLoading(editingHabit.id, true);
    try {
      const response = await fetch('/api/notion/habits/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: editingHabit.id,
          name: editingHabit.name,
          status: editingHabit.status,
          colorCode: editingHabit.colorCode,
        }),
      });

      if (response.ok) {
        setShowEditHabitModal(false);
        setEditingHabit(null);
        fetchHabits();
      }
    } catch (error) {
      console.error('Error updating habit:', error);
    } finally {
      setHabitLoading(editingHabit.id, false);
    }
  };

  const handleNewHabitClick = () => {
    if (selectedStatuses.length === 1) {
      setNewHabitStatus(selectedStatuses[0] as 'Active' | 'Unplanned' | 'Discontinued');
    } else {
      setNewHabitStatus('Active');
    }
    setShowNewHabitModal(true);
  };

  const isHabitCompletedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.days.some(day => day.date === today);
  };

  const calculateStreak = (habit: Habit) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Sort days by date in descending order
    const sortedDays = [...habit.days]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let streak = 0;
    let currentDate = today;

    // Check each day starting from today going backwards
    while (true) {
      const dateString = currentDate.toISOString().split('T')[0];
      const isCompleted = sortedDays.some(day => day.date === dateString);
      
      if (!isCompleted) break;
      streak++;
      
      // Move to previous day
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  };

  const renderListView = (habits: Habit[]) => {
    const today = new Date().toISOString().split('T')[0];
    
    return (
      <div className="space-y-2">
        {habits
          .filter(habit => selectedStatuses.includes(habit.status))
          .sort((a, b) => {
            const aCompleted = isHabitCompletedToday(a);
            const bCompleted = isHabitCompletedToday(b);
            if (aCompleted === bCompleted) return 0;
            return aCompleted ? 1 : -1;
          })
          .map((habit) => {
            const isCompleted = isHabitCompletedToday(habit);
            const streak = calculateStreak(habit);
            return (
              <div 
                key={habit.id} 
                style={{ 
                  backgroundColor: isCompleted ? undefined : `${habit.colorCode}10`
                }}
                className={`relative rounded-lg p-4 border transition-all ${
                  isCompleted 
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-50' 
                    : 'border-slate-200 dark:border-slate-800 dark:bg-opacity-[0.06]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() => handleToggleHabit(habit.id, today, isCompleted)}
                      className="w-5 h-5 transition-all data-[state=checked]:bg-slate-900 dark:data-[state=checked]:bg-slate-50 data-[state=checked]:text-slate-50 dark:data-[state=checked]:text-slate-900"
                    />
                    <div className="flex items-center gap-2">
                      {getStatusIcon(habit.status, habit.colorCode)}
                      <h3 className={`font-medium transition-all ${
                        isCompleted 
                          ? 'text-slate-900 dark:text-white line-through decoration-2 decoration-slate-200 dark:decoration-slate-700' 
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        {habit.name}
                      </h3>
                      <StatusBadge
                        currentStatus={habit.status}
                        onStatusChange={(status) => updateHabitStatus(habit.id, status)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {isCompleted 
                        ? 'Completed today!' 
                        : streak > 0 
                          ? `${streak} day streak!` 
                          : 'Start your streak today!'
                      }
                    </div>
                    <button
                      onClick={() => {
                        setEditingHabit({
                          id: habit.id,
                          name: habit.name,
                          status: habit.status,
                          colorCode: habit.colorCode
                        });
                        setShowEditHabitModal(true);
                      }}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <PencilIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  const playCheckSound = () => {
    checkboxSound.currentTime = 0; // Reset sound to start
    checkboxSound.play().catch(e => console.log('Error playing sound:', e));
  };

  const checkAllHabitsCompleted = (updatedHabits: Habit[]) => {
    const activeHabits = updatedHabits.filter(h => h.status === 'Active');
    const allCompleted = activeHabits.every(habit => isHabitCompletedToday(habit));
    
    if (allCompleted && activeHabits.length > 0) {
      setShowCompletionMessage(true);
      fire();
      setTimeout(() => setShowCompletionMessage(false), 5000); // Hide after 5 seconds
    }
  };

  const handleToggleHabit = async (habitId: string, date: string, isCompleted: boolean) => {
    if (!isCompleted) {
      playCheckSound();
    }
    
    // Optimistically update UI
    const updatedHabits = habits.map(habit => 
      habit.id === habitId
        ? {
            ...habit,
            days: !isCompleted 
              ? [...habit.days, { id: 'temp', date }]
              : habit.days.filter(d => d.date !== date)
          }
        : habit
    );
    setHabits(updatedHabits);
    
    // Check completion after update
    checkAllHabitsCompleted(updatedHabits);

    try {
      const response = await fetch('/api/notion/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId, date, completed: !isCompleted }),
      });
      if (!response.ok) {
        fetchHabits();
      }
    } catch (error) {
      console.error('Error toggling habit:', error);
      fetchHabits();
    }
  };

  // Move fire inside component
  const fire = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <Spinner size="lg" />
          <span className="text-sm text-gray-700 dark:text-white/80">Loading habits...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showCompletionMessage && (
        <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 text-green-700 dark:text-green-300 p-4 rounded-lg text-center animate-fade-in">
          🎉 Amazing! All habits completed for today! 🎉
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <StatusFilter 
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
        />
        
        <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors ${
              viewMode === 'grid' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
        </div>
      </div>

      {/* Conditional rendering based on view mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits
            .filter(habit => selectedStatuses.includes(habit.status))
            .map((habit) => (
              <div key={habit.id} className="relative bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(habit.status, habit.colorCode)}
                    <h3 className="font-medium text-slate-900 dark:text-white">
                      {habit.name}
                    </h3>
                    <StatusBadge
                      currentStatus={habit.status}
                      onStatusChange={(status) => updateHabitStatus(habit.id, status)}
                    />
                  </div>
                  
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingHabit({
                          id: habit.id,
                          name: habit.name,
                          status: habit.status,
                          colorCode: habit.colorCode
                        });
                        setShowEditHabitModal(true);
                      }}
                      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <PencilIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Heatmap */}
                {renderHeatmap(habit)}

                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Completed {habit.days.length} times
                </div>

                {loadingHabits.has(habit.id) && <HabitLoadingOverlay />}
              </div>
            ))}
          
          {/* New Habit Button Card */}
          <div
            onClick={handleNewHabitClick}
            className="bg-white/5 dark:bg-slate-900/20 rounded-lg p-4 border border-slate-200/10 dark:border-slate-800/50 flex items-center justify-center cursor-pointer hover:bg-slate-50/10 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="text-slate-500/75 dark:text-slate-400/75 flex items-center gap-2">
              <span className="text-2xl">+</span>
              <span>New Habit</span>
            </div>
          </div>
        </div>
      ) : (
        renderListView(habits)
      )}

      {/* Edit Habit Modal */}
      {showEditHabitModal && editingHabit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Habit</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editingHabit.name}
                  onChange={(e) => setEditingHabit({...editingHabit, name: e.target.value})}
                  className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <StatusBadge
                  currentStatus={editingHabit.status as 'Active' | 'Unplanned' | 'Discontinued'}
                  onStatusChange={(status) => setEditingHabit({...editingHabit, status})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    '#22c55e', // green
                    '#ef4444', // red
                    '#3b82f6', // blue
                    '#f97316', // orange
                    '#8b5cf6', // purple
                    '#f59e0b', // amber
                    '#ec4899', // pink
                    '#14b8a6', // teal
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingHabit({...editingHabit, colorCode: color})}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                        editingHabit.colorCode === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {/* Custom color picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={editingHabit.colorCode}
                      onChange={(e) => setEditingHabit({...editingHabit, colorCode: e.target.value})}
                      className="opacity-0 absolute inset-0 w-6 h-6 cursor-pointer"
                    />
                    <div 
                      className={`w-6 h-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center transition-transform hover:scale-110 ${
                        !['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].includes(editingHabit.colorCode) 
                          ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' 
                          : ''
                      }`}
                      style={{ 
                        backgroundColor: !['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].includes(editingHabit.colorCode) 
                          ? editingHabit.colorCode 
                          : 'transparent' 
                      }}
                    >
                      {['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].includes(editingHabit.colorCode) && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">+</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowEditHabitModal(false);
                    setEditingHabit(null);
                  }}
                  className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={editHabit}
                  disabled={!editingHabit.name}
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Habit Modal */}
      {showNewHabitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Habit</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <StatusBadge
                  currentStatus={newHabitStatus}
                  onStatusChange={setNewHabitStatus}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    '#22c55e', // green
                    '#ef4444', // red
                    '#3b82f6', // blue
                    '#f97316', // orange
                    '#8b5cf6', // purple
                    '#f59e0b', // amber
                    '#ec4899', // pink
                    '#14b8a6', // teal
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewHabitColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                        newHabitColor === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {/* Custom color picker */}
                  <div className="relative">
                    <input
                      type="color"
                      value={newHabitColor}
                      onChange={(e) => setNewHabitColor(e.target.value)}
                      className="opacity-0 absolute inset-0 w-6 h-6 cursor-pointer"
                    />
                    <div 
                      className={`w-6 h-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center transition-transform hover:scale-110 ${
                        !['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].includes(newHabitColor) 
                          ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' 
                          : ''
                      }`}
                      style={{ 
                        backgroundColor: !['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].includes(newHabitColor) 
                          ? newHabitColor 
                          : 'transparent' 
                      }}
                    >
                      {['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'].includes(newHabitColor) && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">+</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowNewHabitModal(false)}
                  className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewHabit}
                  disabled={!newHabitName}
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReactCanvasConfetti
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 50
        }}
      />
    </div>
  );
} 