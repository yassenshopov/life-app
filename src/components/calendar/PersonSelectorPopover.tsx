'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { PersonAvatar } from './PersonAvatar';
import { Person } from '@/lib/people-matching';
import { format } from 'date-fns';

interface PersonSelectorPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePeople: Person[];
  personSearchQuery: string;
  onSearchChange: (query: string) => void;
  onAddPerson: (personId: string) => void;
  onCreateNew: () => void;
  isAdding: boolean;
  peopleWithRecentDates: Map<string, Date>;
  triggerButton: React.ReactNode;
}

export function PersonSelectorPopover({
  open,
  onOpenChange,
  availablePeople,
  personSearchQuery,
  onSearchChange,
  onAddPerson,
  onCreateNew,
  isAdding,
  peopleWithRecentDates,
  triggerButton,
}: PersonSelectorPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 z-[10006]"
        align="end"
        side="bottom"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          // Don't close when clicking inside the dialog
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          const target = e.target as HTMLElement;
          // Don't close when focusing inside the dialog
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
        onOpenAutoFocus={(e) => {
          // Prevent auto focus to allow manual focus on input
          e.preventDefault();
        }}
      >
        {/* Search bar */}
        <div className="p-2 border-b">
          <Input
            placeholder="Search people..."
            value={personSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
        {/* People list */}
        <div className="max-h-48 overflow-y-auto" style={{ pointerEvents: 'auto' }}>
          {availablePeople.length > 0 ? (
            availablePeople.map((person) => (
              <button
                key={person.id}
                onClick={() => onAddPerson(person.id)}
                disabled={isAdding}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
                style={{ pointerEvents: 'auto' }}
              >
                <PersonAvatar person={person} size="sm" onClick={undefined} />
                <span className="text-sm">{person.name}</span>
                {peopleWithRecentDates.has(person.id) && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(
                      new Date(peopleWithRecentDates.get(person.id)!),
                      'MMM d, yyyy'
                    )}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {personSearchQuery.trim() ? 'No people found' : 'No people available'}
            </div>
          )}
        </div>
        {/* Create new person button */}
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onCreateNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Person
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

