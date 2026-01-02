'use client';

import * as React from 'react';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { Person, findPersonNamePositions } from '@/lib/people-matching';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PeopleTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedPeople: Person[];
  availablePeople: Person[];
  onPeopleChange: (people: Person[]) => void;
  peopleWithRecentDates?: Map<string, Date>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onPersonClick?: (person: Person) => void;
}

export function PeopleTitleInput({
  value,
  onChange,
  selectedPeople,
  availablePeople,
  onPeopleChange,
  peopleWithRecentDates = new Map(),
  placeholder = 'Enter title... (e.g., "Coffee w/ John")',
  className,
  disabled,
  onPersonClick,
}: PeopleTitleInputProps) {
  const inputRef = React.useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suggestionQuery, setSuggestionQuery] = React.useState('');
  const [suggestionIndex, setSuggestionIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isComposingRef = React.useRef(false);

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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
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
    // Add person to selected (don't remove the text - keep "w/ Name")
    if (!selectedPeople.some((p) => p.id === person.id)) {
      onPeopleChange([...selectedPeople, person]);
    }

    // Just close suggestions, keep the text as-is
    setShowSuggestions(false);
    setSuggestionQuery('');
    // Update rendered content to show avatar
    setTimeout(() => updateRenderedContent(), 0);
    inputRef.current?.focus();
  };

  // Find person positions in the text for rendering avatars
  const personPositions = React.useMemo(() => {
    if (!value || selectedPeople.length === 0) return [];
    return findPersonNamePositions(value, selectedPeople);
  }, [value, selectedPeople]);

  // Update rendered content with avatars
  const updateRenderedContent = React.useCallback(() => {
    if (!inputRef.current || isComposingRef.current) return;

    const positions = findPersonNamePositions(value, selectedPeople);
    if (positions.length === 0) {
      // No people to show, just set text
      if (inputRef.current.textContent !== value) {
        inputRef.current.textContent = value || '';
      }
      return;
    }

    // Build content with avatars
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    positions.forEach(({ person, startIndex, endIndex, matchedName }, idx) => {
      // Add text before the person's name
      if (startIndex > lastIndex) {
        parts.push(value.substring(lastIndex, startIndex));
      }

      // Add avatar before the name (we'll render this as HTML)
      const avatarKey = `avatar-${person.id}-${idx}`;
      // We'll create a span with the avatar
      parts.push({
        type: 'avatar',
        key: avatarKey,
        person,
        matchedName,
      });

      lastIndex = endIndex;
    });

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(value.substring(lastIndex));
    }

    // Create HTML string with avatars
    let html = '';
    let partIndex = 0;
    positions.forEach(({ person, startIndex, endIndex, matchedName }, idx) => {
      if (startIndex > partIndex) {
        html += escapeHtml(value.substring(partIndex, startIndex));
      }

      // Create avatar HTML
      const imageUrl = person.image_url || (person.image?.[0]?.external?.url || person.image?.[0]?.file?.url);
      if (imageUrl) {
        html += `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(person.name)}" class="w-4 h-4 rounded-full inline-block align-middle mr-0.5" data-person-id="${person.id}" contenteditable="false" />`;
      } else {
        html += `<span class="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-medium inline-block align-middle mr-0.5" data-person-id="${person.id}" contenteditable="false">${escapeHtml(person.name.charAt(0))}</span>`;
      }

      html += escapeHtml(matchedName);
      partIndex = endIndex;
    });

    if (partIndex < value.length) {
      html += escapeHtml(value.substring(partIndex));
    }

    // Only update if content changed
    if (inputRef.current.innerHTML !== html) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const startOffset = range?.startOffset || 0;
      const endOffset = range?.endOffset || 0;

      inputRef.current.innerHTML = html;

      // Try to restore cursor position
      if (range && inputRef.current.firstChild) {
        try {
          const newRange = document.createRange();
          const textNode = inputRef.current.firstChild;
          const maxOffset = textNode.textContent?.length || 0;
          newRange.setStart(textNode, Math.min(startOffset, maxOffset));
          newRange.setEnd(textNode, Math.min(endOffset, maxOffset));
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } catch (e) {
          // Ignore cursor restoration errors
        }
      }
    }
  }, [value, selectedPeople]);

  // Update content when value or selectedPeople changes (only when not focused or not composing)
  React.useEffect(() => {
    if (!inputRef.current || document.activeElement === inputRef.current) {
      // If focused, update on next tick to avoid cursor jumping
      if (document.activeElement === inputRef.current) {
        const timer = setTimeout(() => updateRenderedContent(), 100);
        return () => clearTimeout(timer);
      }
      return;
    }
    updateRenderedContent();
  }, [value, selectedPeople, updateRenderedContent]);

  // Helper to escape HTML
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        ref={inputRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={(e) => {
          const text = e.currentTarget.textContent || '';
          onChange(text);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          updateRenderedContent();
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          const query = getSuggestionQuery(value);
          if (query.length > 0) {
            setShowSuggestions(true);
          }
          updateRenderedContent();
        }}
        onBlur={(e) => {
          // Don't close suggestions if clicking on a suggestion
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setTimeout(() => setShowSuggestions(false), 200);
          }
          updateRenderedContent();
        }}
        className={cn(
          'min-h-[2.5rem] px-3 py-2 border border-input bg-background rounded-md ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          disabled && 'opacity-50 cursor-not-allowed',
          !value && 'text-muted-foreground',
          className
        )}
        data-placeholder={placeholder}
      />

      {/* Placeholder styling */}
      <style dangerouslySetInnerHTML={{__html: `
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}} />

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
