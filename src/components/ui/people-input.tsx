'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { Person } from '@/lib/people-matching';
import { extractNamesFromTitle, matchPeopleToNames } from '@/lib/people-matching';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PeopleInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedPeople: Person[];
  availablePeople: Person[];
  onPeopleChange: (people: Person[]) => void;
  peopleWithRecentDates?: Map<string, Date>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PeopleInput({
  value,
  onChange,
  selectedPeople,
  availablePeople,
  onPeopleChange,
  peopleWithRecentDates = new Map(),
  placeholder = 'Enter title... (e.g., "Coffee w/ John")',
  className,
  disabled,
}: PeopleInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suggestionQuery, setSuggestionQuery] = React.useState('');
  const [suggestionIndex, setSuggestionIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Extract the part after "w/" for suggestions
  const getSuggestionQuery = React.useCallback((text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('w/')) {
      const index = lowerText.indexOf('w/') + 2;
      return text.substring(index).trim();
    }
    return '';
  }, []);

  // Get suggestions based on query
  const suggestions = React.useMemo(() => {
    if (!suggestionQuery.trim() || availablePeople.length === 0) return [];

    const query = suggestionQuery.toLowerCase();
    let filtered = availablePeople.filter(
      (p) =>
        !selectedPeople.some((sp) => sp.id === p.id) &&
        (p.name.toLowerCase().includes(query) ||
          (p.nicknames && p.nicknames.some((n) => n.toLowerCase().includes(query))))
    );

    // Sort by most recently attached
    filtered.sort((a, b) => {
      const dateA = peopleWithRecentDates.get(a.id);
      const dateB = peopleWithRecentDates.get(b.id);

      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      if (!dateA && !dateB) return 0;

      return dateB!.getTime() - dateA!.getTime();
    });

    return filtered.slice(0, 5); // Limit to 5 suggestions
  }, [suggestionQuery, availablePeople, selectedPeople, peopleWithRecentDates]);

  // Update suggestion query when value changes
  React.useEffect(() => {
    const query = getSuggestionQuery(value);
    setSuggestionQuery(query);
    setShowSuggestions(query.length > 0);
    setSuggestionIndex(-1);
  }, [value, getSuggestionQuery]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      // Handle backspace to remove last person
      if (e.key === 'Backspace' && value === '' && selectedPeople.length > 0) {
        e.preventDefault();
        onPeopleChange(selectedPeople.slice(0, -1));
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && suggestionIndex >= 0) {
      e.preventDefault();
      handleSelectPerson(suggestions[suggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSuggestionIndex(-1);
    }
  };

  const handleSelectPerson = (person: Person) => {
    // Remove "w/" and the query from the value
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('w/')) {
      const index = lowerValue.indexOf('w/');
      const beforeW = value.substring(0, index).trim();
      onChange(beforeW);
    }

    // Add person to selected
    onPeopleChange([...selectedPeople, person]);
    setShowSuggestions(false);
    setSuggestionQuery('');
    inputRef.current?.focus();
  };

  const handleRemovePerson = (personId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onPeopleChange(selectedPeople.filter((p) => p.id !== personId));
  };

  // Calculate input padding to make room for chips
  const leftPadding = selectedPeople.length > 0 ? 'pl-2' : '';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center gap-1 flex-wrap min-h-[2.5rem] px-3 py-2 border border-input bg-background rounded-md ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {/* People chips */}
        {selectedPeople.map((person) => (
          <div
            key={person.id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-sm"
          >
            <PersonAvatar person={person} size="xs" />
            <span className="text-xs">{person.name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => handleRemovePerson(person.id, e)}
                className="ml-1 hover:bg-destructive/20 rounded p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Input */}
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const query = getSuggestionQuery(value);
            if (query.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={(e) => {
            // Don't close suggestions if clicking on a suggestion
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setTimeout(() => setShowSuggestions(false), 200);
            }
          }}
          placeholder={selectedPeople.length === 0 ? placeholder : ''}
          className={cn(
            'border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto min-w-[120px] flex-1',
            className
          )}
          disabled={disabled}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[10004] mt-1 w-full border rounded-md bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((person, index) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleSelectPerson(person)}
              onMouseDown={(e) => e.preventDefault()} // Prevent input blur
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent transition-colors text-left',
                index === suggestionIndex && 'bg-accent'
              )}
            >
              <PersonAvatar person={person} size="sm" onClick={undefined} />
              <span className="text-sm">{person.name}</span>
              {peopleWithRecentDates.has(person.id) && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(peopleWithRecentDates.get(person.id)!), 'MMM d, yyyy')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}




