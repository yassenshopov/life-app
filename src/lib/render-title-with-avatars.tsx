/**
 * Utility to render event titles with person avatars before their names
 */

import * as React from 'react';
import { Person } from './people-matching';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { findPersonNamePositions } from './people-matching';

interface RenderTitleWithAvatarsProps {
  title: string;
  people: Person[];
  onAvatarClick?: (person: Person) => void;
  className?: string;
  textClassName?: string;
}

/**
 * Renders a title with avatars appearing just before each person's name
 */
export function renderTitleWithAvatars({
  title,
  people,
  onAvatarClick,
  className = '',
  textClassName = '',
}: RenderTitleWithAvatarsProps): React.ReactNode {
  if (!people || people.length === 0) {
    return <span className={textClassName}>{title}</span>;
  }

  const positions = findPersonNamePositions(title, people);
  
  if (positions.length === 0) {
    return <span className={textClassName}>{title}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  positions.forEach(({ person, startIndex, endIndex, matchedName }, idx) => {
    // Add text before the person's name
    if (startIndex > lastIndex) {
      parts.push(
        <span key={`text-${idx}`} className={textClassName}>
          {title.substring(lastIndex, startIndex)}
        </span>
      );
    }

    // Add avatar before the name
    parts.push(
      <PersonAvatar
        key={`avatar-${person.id}-${idx}`}
        person={person}
        size="sm"
        onClick={() => onAvatarClick?.(person)}
        className="mr-1"
      />
    );

    // Add the person's name
    parts.push(
      <span key={`name-${idx}`} className={textClassName}>
        {matchedName}
      </span>
    );

    lastIndex = endIndex;
  });

  // Add remaining text after the last person
  if (lastIndex < title.length) {
    parts.push(
      <span key="text-end" className={textClassName}>
        {title.substring(lastIndex)}
      </span>
    );
  }

  return <span className={className}>{parts}</span>;
}

