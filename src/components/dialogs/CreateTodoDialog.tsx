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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { Person } from '@/lib/people-matching';
import { PeopleTitleInput } from '@/components/ui/people-title-input';
import { X } from 'lucide-react';

interface CreateTodoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (todo: any) => void;
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

export function CreateTodoDialog({ isOpen, onClose, onSuccess }: CreateTodoDialogProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string>('To-Do');
  const [priority, setPriority] = useState<string>('');
  const [doDate, setDoDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doDatePopoverOpen, setDoDatePopoverOpen] = useState(false);
  const [dueDatePopoverOpen, setDueDatePopoverOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [peopleWithRecentDates, setPeopleWithRecentDates] = useState<Map<string, Date>>(new Map());

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/todos/create', {
        method: 'POST',
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
        throw new Error(errorData.error || 'Failed to create todo');
      }

      const data = await response.json();
      
      // Link people to the todo if any are selected
      if (selectedPeople.length > 0 && data.todo?.id) {
        try {
          await Promise.all(
            selectedPeople.map(async (person) => {
              try {
                const linkResponse = await fetch(`/api/todos/${data.todo.id}/people`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ personId: person.id }),
                });
                if (!linkResponse.ok) {
                  console.error('Failed to link person:', person.id);
                }
              } catch (error) {
                console.error('Error linking person:', error);
              }
            })
          );
        } catch (error) {
          console.error('Error linking people to todo:', error);
        }
      }
      
      // Reset form
      setTitle('');
      setStatus('To-Do');
      setPriority('');
      setDoDate(undefined);
      setDueDate(undefined);
      setSelectedPeople([]);

      onSuccess(data.todo);
      onClose();
    } catch (error) {
      console.error('Error creating todo:', error);
      alert(error instanceof Error ? error.message : 'Failed to create todo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle('');
      setStatus('To-Do');
      setPriority('');
      setDoDate(undefined);
      setDueDate(undefined);
      setSelectedPeople([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Todo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <PeopleTitleInput
                value={title}
                onChange={setTitle}
                selectedPeople={selectedPeople}
                availablePeople={people}
                onPeopleChange={setSelectedPeople}
                peopleWithRecentDates={peopleWithRecentDates}
                placeholder="Enter todo title... (e.g., 'Coffee w/ John')"
                disabled={isSubmitting}
              />
            </div>

            {/* People */}
            {people.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">People</Label>
                {selectedPeople.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPeople.map((person) => (
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
                          onClick={() => setSelectedPeople(prev => prev.filter(p => p.id !== person.id))}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded"
                          title="Remove person"
                          disabled={isSubmitting}
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
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                  <SelectTrigger id="status">
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
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                  <SelectTrigger id="priority">
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Todo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

