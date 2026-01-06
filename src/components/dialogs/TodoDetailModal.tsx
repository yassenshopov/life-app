'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MiniCalendar } from '@/components/MiniCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { Person } from '@/lib/people-matching';
import { PeopleTitleInput } from '@/components/ui/people-title-input';
import { Todo } from '@/components/ActionZoneView';

interface TodoDetailModalProps {
  todo: Todo | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTodo: Todo) => void;
}

const PRIORITY_OPTIONS = [
  'Immediate',
  'Quick',
  'Scheduled',
  '1st Priority',
  '2nd Priority',
  '3rd Priority',
  '4th Priority',
  '5th Priority',
  'Errand',
  'Remember',
];

const STATUS_OPTIONS = ['To-Do', 'In progress', 'Done'];

export function TodoDetailModal({ todo, isOpen, onClose, onUpdate }: TodoDetailModalProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string>('To-Do');
  const [priority, setPriority] = useState<string>('');
  const [doDate, setDoDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [doDatePopoverOpen, setDoDatePopoverOpen] = useState(false);
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [linkedPeople, setLinkedPeople] = useState<Person[]>([]);
  const [peopleWithRecentDates, setPeopleWithRecentDates] = useState<Map<string, Date>>(new Map());
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);

  // Initialize form when todo changes
  useEffect(() => {
    if (todo && isOpen) {
      setTitle(todo.title || '');
      setStatus(todo.status || 'To-Do');
      setPriority(todo.priority || '');
      setDoDate(todo.do_date ? new Date(todo.do_date) : undefined);
      setDueDate(todo.due_date ? new Date(todo.due_date) : undefined);
    }
  }, [todo, isOpen]);

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

    if (isOpen) {
      fetchPeople();
    }
  }, [isOpen]);

  // Fetch linked people for this todo
  useEffect(() => {
    const fetchLinkedPeople = async () => {
      if (!todo?.id || !isOpen) return;

      setIsLoadingPeople(true);
      try {
        const response = await fetch(`/api/todos/${todo.id}/people`);
        if (response.ok) {
          const data = await response.json();
          // Convert to Person format
          const peopleList: Person[] = (data.people || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            image: p.image,
            image_url: p.image_url,
            nicknames: p.nicknames,
          }));
          setLinkedPeople(peopleList);
        }
      } catch (error) {
        console.error('Error fetching linked people:', error);
      } finally {
        setIsLoadingPeople(false);
      }
    };

    fetchLinkedPeople();
  }, [todo?.id, isOpen]);

  // Fetch most recent attachment date for each person
  useEffect(() => {
    const fetchRecentDates = async () => {
      if (people.length === 0) return;
      
      try {
        const response = await fetch('/api/people/recent-attachments');
        if (response.ok) {
          const data = await response.json();
          const recentDates = data.recentDates || {};
          const dateMap = new Map<string, Date>();
          Object.entries(recentDates).forEach(([personId, dateStr]) => {
            dateMap.set(personId, new Date(dateStr as string));
          });
          setPeopleWithRecentDates(dateMap);
        }
      } catch (error) {
        // Silently fail
      }
    };

    if (isOpen && people.length > 0) {
      fetchRecentDates();
    }
  }, [isOpen, people]);

  const handlePeopleChange = async (newPeople: Person[]) => {
    if (!todo?.id) return;

    const currentIds = linkedPeople.map(p => p.id);
    const newIds = newPeople.map(p => p.id);
    
    // Find people to add
    const toAdd = newPeople.filter(p => !currentIds.includes(p.id));
    // Find people to remove
    const toRemove = linkedPeople.filter(p => !newIds.includes(p.id));

    // Optimistically update
    setLinkedPeople(newPeople);

    // Add new people
    for (const person of toAdd) {
      try {
        const response = await fetch(`/api/todos/${encodeURIComponent(todo.id)}/people`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: person.id }),
        });
        if (!response.ok) {
          // Revert on error
          setLinkedPeople((prev) => prev.filter(p => p.id !== person.id));
        }
      } catch (error) {
        console.error('Error adding person:', error);
        setLinkedPeople((prev) => prev.filter(p => p.id !== person.id));
      }
    }

    // Remove people
    for (const person of toRemove) {
      try {
        const response = await fetch(`/api/todos/${encodeURIComponent(todo.id)}/people?personId=${person.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          // Revert on error
          setLinkedPeople((prev) => [...prev, person]);
        }
      } catch (error) {
        console.error('Error removing person:', error);
        setLinkedPeople((prev) => [...prev, person]);
      }
    }
  };

  const handleSave = async () => {
    if (!todo || !title.trim()) return;

    setIsSaving(true);

    try {
      // Update todo in Notion and Supabase
      // For now, we'll just update in Supabase and sync will handle Notion
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          status: status || undefined,
          priority: priority || undefined,
          do_date: doDate ? doDate.toISOString() : undefined,
          due_date: dueDate ? dueDate.toISOString().split('T')[0] : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update todo');
      }

      const data = await response.json();
      
      onUpdate({
        ...todo,
        ...data.todo,
        linkedPeople: linkedPeople,
      });
      onClose();
    } catch (error) {
      console.error('Error updating todo:', error);
      alert(error instanceof Error ? error.message : 'Failed to update todo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      if (todo) {
        setTitle(todo.title || '');
        setStatus(todo.status || 'To-Do');
        setPriority(todo.priority || '');
        setDoDate(todo.do_date ? new Date(todo.do_date) : undefined);
        setDueDate(todo.due_date ? new Date(todo.due_date) : undefined);
      }
      onClose();
    }
  };

  if (!todo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Todo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <PeopleTitleInput
              value={title}
              onChange={setTitle}
              selectedPeople={linkedPeople}
              availablePeople={people}
              onPeopleChange={handlePeopleChange}
              peopleWithRecentDates={peopleWithRecentDates}
              placeholder="Enter todo title... (e.g., 'Coffee w/ John')"
              disabled={isSaving}
            />
          </div>

          {/* People */}
          {people.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">People</Label>
              {linkedPeople.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {linkedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors group"
                    >
                      <PersonAvatar
                        person={person}
                        size="sm"
                      />
                      <span className="text-sm">{person.name}</span>
                      <button
                        type="button"
                        onClick={() => handlePeopleChange(linkedPeople.filter(p => p.id !== person.id))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded"
                        title="Remove person"
                        disabled={isSaving}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No people added. Type "w/" in the title to add people.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={isSaving}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority} disabled={isSaving}>
                <SelectTrigger id="edit-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Do Date</Label>
              <Popover open={doDatePopoverOpen} onOpenChange={setDoDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !doDate && 'text-muted-foreground'
                    )}
                    disabled={isSaving}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {doDate ? format(doDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0" 
                  align="start"
                  style={{ zIndex: 10005 }}
                >
                  <MiniCalendar
                    selectedDate={doDate}
                    onDateSelect={(date) => {
                      setDoDate(date);
                      setDoDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover open={dueDatePopoverOpen} onOpenChange={setDueDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                    disabled={isSaving}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0" 
                  align="start"
                  style={{ zIndex: 10005 }}
                >
                  <MiniCalendar
                    selectedDate={dueDate}
                    onDateSelect={(date) => {
                      setDueDate(date);
                      setDueDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

