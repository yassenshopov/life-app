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
} from 'lucide-react';
import { format, parseISO, isPast, isToday, isFuture } from 'date-fns';
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
  const { toast } = useToast();

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
      setTodos(data.todos || []);
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
        if (!todo.do_date) return false;
        const doDate = parseISO(todo.do_date);
        return isToday(doDate);
      });
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
          ) : (
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
                          </div>
                        </div>
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
          // Optimistically add the new todo to the list
          setTodos((prev) => [newTodo, ...prev]);
          toast({
            title: 'Todo Created',
            description: 'Your todo has been created and synced to Notion',
          });
        }}
      />
    </div>
  );
}
