'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  Tag,
  User,
  AlertCircle,
  Target,
  Loader2,
  Plus,
  Edit,
} from 'lucide-react';
import { format, parseISO, isPast, isToday, isFuture, startOfDay, isEqual } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { CreateTodoDialog } from '@/components/dialogs/CreateTodoDialog';
import { TodoDetailModal } from '@/components/dialogs/TodoDetailModal';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { Person } from '@/lib/people-matching';
import { Checkbox } from '@/components/ui/checkbox';
import confetti from 'canvas-confetti';

interface Todo {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  do_date: string | null;
  due_date: string | null;
  mega_tags: string[];
  assignee: any;
  duration_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  linkedPeople?: Array<{ id: string; name: string; image?: any; image_url?: string | null }>;
}

const PRIORITY_COLORS: Record<string, string> = {
  Immediate: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  Quick: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  Scheduled: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  '1st Priority': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  '2nd Priority': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  '3rd Priority': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  '4th Priority': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  '5th Priority': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  Errand: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  Remember: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUS_COLORS: Record<string, string> = {
  'To-Do': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  'In progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  Done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function ActionZoneView() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('today');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const { toast } = useToast();

  // Fire confetti function
  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    // Get colors from CSS custom properties (theme colors)
    const getThemeColors = () => {
      if (typeof window === 'undefined') return ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'];
      
      const root = document.documentElement;
      const isDark = root.classList.contains('dark');
      
      // Chart colors from globals.css
      const colors = [];
      for (let i = 1; i <= 5; i++) {
        const hsl = getComputedStyle(root).getPropertyValue(`--chart-${i}`).trim();
        if (hsl) {
          // Convert HSL to RGB
          const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
          const hNorm = h / 360;
          const sNorm = s / 100;
          const lNorm = l / 100;
          
          const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
          const x = c * (1 - Math.abs((hNorm * 6) % 2 - 1));
          const m = lNorm - c / 2;
          
          let r = 0, g = 0, b = 0;
          if (hNorm < 1/6) { r = c; g = x; b = 0; }
          else if (hNorm < 2/6) { r = x; g = c; b = 0; }
          else if (hNorm < 3/6) { r = 0; g = c; b = x; }
          else if (hNorm < 4/6) { r = 0; g = x; b = c; }
          else if (hNorm < 5/6) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          
          r = Math.round((r + m) * 255);
          g = Math.round((g + m) * 255);
          b = Math.round((b + m) * 255);
          
          colors.push(`rgb(${r}, ${g}, ${b})`);
        }
      }
      
      return colors.length > 0 ? colors : ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'];
    };

    const colors = getThemeColors();
    const defaults = { 
      startVelocity: 30, 
      spread: 360, 
      ticks: 60, 
      zIndex: 9999,
      colors: colors
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Launch confetti from multiple positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  // Fetch people data
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch('/api/people');
        const data = await response.json();
        if (response.ok && data.people && Array.isArray(data.people)) {
          setPeople(data.people);
        }
      } catch (error) {
        console.error('Error fetching people:', error);
      }
    };

    fetchPeople();
  }, []);


  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    filterTodos();
  }, [todos, searchQuery, statusFilter, priorityFilter, activeTab]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/todos');
      if (!response.ok) throw new Error('Failed to fetch todos');
      const data = await response.json();
      const todosList = data.todos || [];
      
      // Debug: Log fetched todos
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetched todos:', todosList.length);
        if (todosList.length > 0) {
          console.log('Sample todo:', todosList[0]);
          const todosWithDoDate = todosList.filter((t: Todo) => t.do_date);
          console.log('Todos with do_date:', todosWithDoDate.length);
          if (todosWithDoDate.length > 0) {
            console.log('Sample do_date values:', todosWithDoDate.slice(0, 3).map((t: Todo) => ({
              title: t.title,
              do_date: t.do_date,
              status: t.status,
            })));
          }
        }
      }
      
      setTodos(todosList);

      // Fetch linked people for all todos in batch
      if (todosList.length > 0) {
        try {
          const todoIds = todosList.map((todo: Todo) => todo.id);
          const peopleResponse = await fetch('/api/todos/people/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ todoIds }),
          });

          if (peopleResponse.ok) {
            const peopleData = await peopleResponse.json();
            const todoPeopleMap = peopleData.todoPeopleMap || {};
            
            setTodos((prevTodos) =>
              prevTodos.map((todo) => ({
                ...todo,
                linkedPeople: todoPeopleMap[todo.id] || [],
              }))
            );
          }
        } catch (error) {
          console.error('Error fetching people for todos:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch todos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const syncTodos = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/todos/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to sync todos');
      const data = await response.json();
      toast({
        title: 'Sync Complete',
        description: `Synced ${data.synced} todos`,
      });
      await fetchTodos();
    } catch (error) {
      console.error('Error syncing todos:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync todos from Notion',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const filterTodos = () => {
    let filtered = [...todos];

    // Apply tab filter
    if (activeTab === 'today') {
      filtered = filtered.filter((todo) => {
        if (!todo.do_date) {
          console.log('Todo without do_date:', todo.title, todo.id);
          return false;
        }
        try {
          const doDate = parseISO(todo.do_date);
          const today = startOfDay(new Date());
          const todoDate = startOfDay(doDate);
          const isTodayMatch = isEqual(todoDate, today);
          
          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log('Date comparison:', {
              title: todo.title,
              do_date: todo.do_date,
              parsed: doDate.toISOString(),
              todoDate: todoDate.toISOString(),
              today: today.toISOString(),
              isTodayMatch,
            });
          }
          
          return isTodayMatch;
        } catch (error) {
          console.error('Error parsing date:', todo.do_date, error, todo);
          return false;
        }
      });
      
      // Debug: Log all todos and filtered results
      if (process.env.NODE_ENV === 'development') {
        console.log('Today filter - All todos:', todos.length);
        console.log('Today filter - Filtered todos:', filtered.length);
        console.log('Today filter - Todos with do_date:', todos.filter(t => t.do_date).length);
      }
    } else if (activeTab === 'upcoming') {
      filtered = filtered.filter((todo) => {
        if (!todo.do_date) return false;
        const doDate = parseISO(todo.do_date);
        return isFuture(doDate);
      });
    } else if (activeTab === 'overdue') {
      filtered = filtered.filter((todo) => {
        if (!todo.do_date) return false;
        const doDate = parseISO(todo.do_date);
        return isPast(doDate) && !isToday(doDate) && todo.status !== 'Done';
      });
    } else if (activeTab === 'done') {
      filtered = filtered.filter((todo) => todo.status === 'Done');
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((todo) => todo.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((todo) => todo.priority === priorityFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (todo) =>
          todo.title?.toLowerCase().includes(query) ||
          todo.mega_tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredTodos(filtered);
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'Done':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'In progress':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getDateStatus = (doDate: string | null) => {
    if (!doDate) return null;
    const date = parseISO(doDate);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'today';
    if (isFuture(date)) return 'upcoming';
    return null;
  };

  // Play check sound
  const playCheckSound = () => {
    try {
      // Create a simple check sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Silently fail if audio context is not available
      console.warn('Could not play check sound:', error);
    }
  };

  // Check if a todo matches the current filters
  const todoMatchesFilters = (todo: Todo): boolean => {
    // Apply tab filter
    if (activeTab === 'today') {
      if (!todo.do_date) return false;
      try {
        const doDate = parseISO(todo.do_date);
        const today = startOfDay(new Date());
        const todoDate = startOfDay(doDate);
        if (!isEqual(todoDate, today)) return false;
      } catch (error) {
        return false;
      }
    } else if (activeTab === 'upcoming') {
      if (!todo.do_date) return false;
      const doDate = parseISO(todo.do_date);
      if (!isFuture(doDate)) return false;
    } else if (activeTab === 'overdue') {
      if (!todo.do_date) return false;
      const doDate = parseISO(todo.do_date);
      if (!(isPast(doDate) && !isToday(doDate) && todo.status !== 'Done')) return false;
    } else if (activeTab === 'done') {
      if (todo.status !== 'Done') return false;
    }
    // 'all' tab passes through

    // Apply status filter
    if (statusFilter !== 'all' && todo.status !== statusFilter) {
      return false;
    }

    // Apply priority filter
    if (priorityFilter !== 'all' && todo.priority !== priorityFilter) {
      return false;
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = todo.title?.toLowerCase().includes(query);
      const matchesTags = todo.mega_tags?.some((tag) => tag.toLowerCase().includes(query));
      if (!matchesTitle && !matchesTags) return false;
    }

    return true;
  };

  // Get suggested tabs where the todo would be visible
  const getSuggestedTabs = (todo: Todo): string[] => {
    const suggestions: string[] = [];
    
    // Check if it would be visible in 'all' tab
    if (statusFilter === 'all' && priorityFilter === 'all' && !searchQuery) {
      suggestions.push('All');
    }
    
    // Check tab-specific visibility
    if (todo.do_date) {
      try {
        const doDate = parseISO(todo.do_date);
        const today = startOfDay(new Date());
        const todoDate = startOfDay(doDate);
        
        if (isEqual(todoDate, today)) {
          suggestions.push('Today');
        } else if (isFuture(doDate)) {
          suggestions.push('Upcoming');
        } else if (isPast(doDate) && !isToday(doDate) && todo.status !== 'Done') {
          suggestions.push('Overdue');
        }
      } catch (error) {
        // Invalid date, skip
      }
    }
    
    if (todo.status === 'Done') {
      suggestions.push('Done');
    }
    
    // If no specific suggestions, always suggest 'All'
    if (suggestions.length === 0) {
      suggestions.push('All');
    }
    
    return suggestions;
  };

  // Check if all To-Do items are done and trigger confetti
  const checkAllTodosDone = (updatedTodos: Todo[]) => {
    if (activeTab !== 'today') return;

    // Get todos for today
    const todayTodos = updatedTodos.filter((todo) => {
      if (!todo.do_date) return false;
      try {
        const doDate = parseISO(todo.do_date);
        const today = startOfDay(new Date());
        const todoDate = startOfDay(doDate);
        return isEqual(todoDate, today);
      } catch (error) {
        return false;
      }
    });

    // Check if there are any todos in "To-Do" status
    const todoStatusItems = todayTodos.filter((todo) => todo.status === 'To-Do' || !todo.status);
    
    // If there are no "To-Do" items and there are todos, trigger confetti
    if (todoStatusItems.length === 0 && todayTodos.length > 0) {
      // Fire confetti
      fireConfetti();
    }
  };

  // Toggle todo status
  const handleToggleStatus = async (todo: Todo) => {
    const newStatus = todo.status === 'Done' ? 'To-Do' : 'Done';
    
    // Optimistically update the UI
    setTodos((prev) => {
      const updated = prev.map((t) => (t.id === todo.id ? { ...t, status: newStatus } : t));
      // Check if all todos are done after update
      checkAllTodosDone(updated);
      return updated;
    });

    // Play sound
    playCheckSound();

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: todo.title,
          status: newStatus,
          priority: todo.priority || undefined,
          do_date: todo.do_date || undefined,
          due_date: todo.due_date || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update todo status');
      }

      const data = await response.json();
      // Update with the response data
      setTodos((prev) => {
        const updated = prev.map((t) => (t.id === todo.id ? { ...t, ...data.todo } : t));
        // Check again after API update
        checkAllTodosDone(updated);
        return updated;
      });
    } catch (error) {
      console.error('Error updating todo status:', error);
      // Revert optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, status: todo.status } : t))
      );
      toast({
        title: 'Error',
        description: 'Failed to update todo status',
        variant: 'destructive',
      });
    }
  };

  // Group todos by status for the Today view
  const groupTodosByStatus = (todos: Todo[]) => {
    const grouped: Record<string, Todo[]> = {};
    
    todos.forEach((todo) => {
      const status = todo.status || 'To-Do';
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(todo);
    });

    // Sort statuses: Done should be last
    const statusOrder = ['To-Do', 'In progress', 'Done'];
    const sortedStatuses = Object.keys(grouped).sort((a, b) => {
      const indexA = statusOrder.indexOf(a);
      const indexB = statusOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return sortedStatuses.map((status) => ({
      status,
      todos: grouped[status],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Action Zone</h1>
          <p className="text-muted-foreground mt-1">Manage your to-do items and action items</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Todo
          </Button>
          <Button onClick={syncTodos} disabled={syncing} variant="outline">
            <RefreshCw className={cn('w-4 h-4 mr-2', syncing && 'animate-spin')} />
            {syncing ? 'Syncing...' : 'Sync from Notion'}
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search todos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="To-Do">To-Do</SelectItem>
                <SelectItem value="In progress">In progress</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Immediate">Immediate</SelectItem>
                <SelectItem value="Quick">Quick</SelectItem>
                <SelectItem value="1st Priority">1st Priority</SelectItem>
                <SelectItem value="2nd Priority">2nd Priority</SelectItem>
                <SelectItem value="3rd Priority">3rd Priority</SelectItem>
                <SelectItem value="4th Priority">4th Priority</SelectItem>
                <SelectItem value="5th Priority">5th Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredTodos.length === 0 ? (
            activeTab === 'today' ? (
              <div className="text-center py-12">
                <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No todos found</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Todo
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No todos found</p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Todo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          ) : activeTab === 'today' ? (
            // List view for Today tab
            <div className="space-y-6">
              {groupTodosByStatus(filteredTodos)
                .filter(({ todos: statusTodos }) => statusTodos.length > 0)
                .map(({ status, todos: statusTodos }) => (
                  <div key={status} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {status}
                    </h3>
                    <div className="space-y-1">
                      {statusTodos.map((todo) => {
                      const isDone = todo.status === 'Done';
                      return (
                        <div
                          key={todo.id}
                          className={cn(
                            'flex items-center gap-3 py-2 transition-colors hover:bg-accent/50',
                            isDone && 'opacity-60'
                          )}
                        >
                          <Checkbox
                            checked={isDone}
                            onCheckedChange={() => handleToggleStatus(todo)}
                            className="flex-shrink-0"
                          />
                          <div
                            className={cn(
                              'flex-1 cursor-pointer',
                              isDone && 'line-through text-muted-foreground'
                            )}
                            onClick={() => {
                              setSelectedTodo(todo);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{todo.title}</span>
                              {todo.priority && (
                                <Badge
                                  variant="outline"
                                  className={cn('text-xs', PRIORITY_COLORS[todo.priority] || '')}
                                >
                                  {todo.priority}
                                </Badge>
                              )}
                              {todo.linkedPeople && todo.linkedPeople.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {todo.linkedPeople.map((person) => (
                                    <PersonAvatar
                                      key={person.id}
                                      person={person}
                                      size="xs"
                                      className="border border-border"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            {(todo.mega_tags?.length > 0 || todo.duration_hours) && (
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {todo.mega_tags && todo.mega_tags.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    <span>{todo.mega_tags.slice(0, 2).join(', ')}</span>
                                    {todo.mega_tags.length > 2 && (
                                      <span>+{todo.mega_tags.length - 2}</span>
                                    )}
                                  </div>
                                )}
                                {todo.duration_hours && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{todo.duration_hours}h</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Card view for other tabs
            <div className="space-y-3">
              {filteredTodos.map((todo) => {
                const dateStatus = getDateStatus(todo.do_date);
                return (
                  <Card
                    key={todo.id}
                    className={cn(
                      'transition-colors',
                      todo.status === 'Done' && 'opacity-60',
                      dateStatus === 'overdue' && 'border-red-500'
                    )}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">{getStatusIcon(todo.status)}</div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <h3
                              className={cn(
                                'font-medium',
                                todo.status === 'Done' && 'line-through text-muted-foreground'
                              )}
                            >
                              {todo.title}
                            </h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {todo.status && (
                                <Badge
                                  variant="outline"
                                  className={cn('text-xs', STATUS_COLORS[todo.status] || '')}
                                >
                                  {todo.status}
                                </Badge>
                              )}
                              {todo.priority && (
                                <Badge
                                  variant="outline"
                                  className={cn('text-xs', PRIORITY_COLORS[todo.priority] || '')}
                                >
                                  {todo.priority}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            {todo.do_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span
                                  className={cn(
                                    dateStatus === 'overdue' && 'text-red-600 font-medium'
                                  )}
                                >
                                  {format(parseISO(todo.do_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                            )}
                            {todo.duration_hours && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{todo.duration_hours}h</span>
                              </div>
                            )}
                            {todo.mega_tags && todo.mega_tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Tag className="w-4 h-4" />
                                <div className="flex gap-1">
                                  {todo.mega_tags.slice(0, 3).map((tag, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {todo.mega_tags.length > 3 && (
                                    <span className="text-xs">+{todo.mega_tags.length - 3}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {todo.linkedPeople && todo.linkedPeople.length > 0 && (
                              <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <div className="flex items-center gap-1">
                                  {todo.linkedPeople.map((person) => (
                                    <PersonAvatar
                                      key={person.id}
                                      person={person}
                                      size="xs"
                                      className="border border-border"
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => {
                            setSelectedTodo(todo);
                            setIsEditDialogOpen(true);
                          }}
                          title="Edit todo"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTodoDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={(newTodo) => {
          // Check if the new todo matches current filters
          if (todoMatchesFilters(newTodo)) {
            // Optimistically add the new todo to the list
            setTodos((prev) => [newTodo, ...prev]);
            toast({
              title: 'Todo Created',
              description: 'Your todo has been created and synced to Notion',
            });
          } else {
            // Add to state but don't show in current view
            setTodos((prev) => [newTodo, ...prev]);
            
            // Show toast with information about where to find it
            const suggestedTabs = getSuggestedTabs(newTodo);
            const tabMessage = suggestedTabs.length > 0 
              ? `View in ${suggestedTabs.join(' or ')}`
              : 'View in All';
            
            toast({
              title: 'Todo Created',
              description: `Your todo has been created. ${tabMessage}.`,
            });
          }
        }}
      />

      <TodoDetailModal
        todo={selectedTodo}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedTodo(null);
        }}
        onUpdate={(updatedTodo) => {
          // Update the todo in the list
          setTodos((prev) => {
            const updated = prev.map((t) => (t.id === updatedTodo.id ? updatedTodo : t));
            checkAllTodosDone(updated);
            return updated;
          });
          toast({
            title: 'Todo Updated',
            description: 'Your todo has been updated',
          });
          setIsEditDialogOpen(false);
          setSelectedTodo(null);
        }}
      />
    </div>
  );
}
