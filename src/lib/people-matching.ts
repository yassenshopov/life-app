/**
 * Utility functions for matching people from calendar event titles
 */

export interface Person {
  id: string;
  name: string;
  nicknames?: string[] | null;
  image?: any;
  image_url?: string | null;
}

/**
 * Extract names from calendar event title that contains "w/" or "with"
 * Examples:
 * - "Coffee w/ John" -> ["John"]
 * - "Meeting with Sarah and Mike" -> ["Sarah", "Mike"]
 * - "Lunch w/ Alex, Bob" -> ["Alex", "Bob"]
 */
export function extractNamesFromTitle(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  
  // Check if title contains "w/" or "with"
  if (!lowerTitle.includes('w/') && !lowerTitle.includes('with')) {
    return [];
  }

  // Find the position after "w/" or "with"
  let matchIndex = -1;
  if (lowerTitle.includes('w/')) {
    matchIndex = lowerTitle.indexOf('w/') + 2;
  } else if (lowerTitle.includes('with')) {
    matchIndex = lowerTitle.indexOf('with') + 4;
  }

  if (matchIndex === -1) return [];

  // Extract the part after "w/" or "with"
  const afterMatch = title.substring(matchIndex).trim();
  
  // Split by common separators: comma, "and", "&"
  const names = afterMatch
    .split(/[,&]|and/i)
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => {
      // Remove trailing punctuation but keep apostrophes
      return name.replace(/[.,;:!?]+$/, '').trim();
    })
    .filter(name => name.length > 0);

  return names;
}

/**
 * Match extracted names against people database
 * Checks both name and nicknames
 */
export function matchPeopleToNames(names: string[], people: Person[]): Person[] {
  const matched: Person[] = [];
  const lowerNames = names.map(n => n.toLowerCase());

  for (const person of people) {
    const personNameLower = person.name.toLowerCase();
    const personNicknames = (person.nicknames || []).map(n => n.toLowerCase());

    // Check if any extracted name matches the person's name or nicknames
    const matches = lowerNames.some(name => {
      // Exact match
      if (name === personNameLower) return true;
      
      // Check nicknames
      if (personNicknames.some(nickname => name === nickname)) return true;
      
      // Partial match (name contains the extracted name or vice versa)
      if (personNameLower.includes(name) || name.includes(personNameLower)) return true;
      if (personNicknames.some(nickname => nickname.includes(name) || name.includes(nickname))) return true;

      return false;
    });

    if (matches) {
      matched.push(person);
    }
  }

  return matched;
}

/**
 * Main function to get matched people from a calendar event title
 */
export function getMatchedPeopleFromEvent(title: string, people: Person[]): Person[] {
  const names = extractNamesFromTitle(title);
  if (names.length === 0) return [];
  
  return matchPeopleToNames(names, people);
}

/**
 * Find all occurrences of person names in a title and return positions
 */
export function findPersonNamePositions(title: string, people: Person[]): Array<{
  person: Person;
  startIndex: number;
  endIndex: number;
  matchedName: string;
}> {
  const positions: Array<{
    person: Person;
    startIndex: number;
    endIndex: number;
    matchedName: string;
  }> = [];

  const lowerTitle = title.toLowerCase();

  for (const person of people) {
    const personNameLower = person.name.toLowerCase();
    const personNicknames = (person.nicknames || []).map(n => n.toLowerCase());

    // Try to find person's name
    let found = false;
    if (lowerTitle.includes(personNameLower)) {
      const index = lowerTitle.indexOf(personNameLower);
      positions.push({
        person,
        startIndex: index,
        endIndex: index + person.name.length,
        matchedName: title.substring(index, index + person.name.length),
      });
      found = true;
    }

    // Try nicknames if name not found
    if (!found) {
      for (const nickname of personNicknames) {
        if (lowerTitle.includes(nickname)) {
          const index = lowerTitle.indexOf(nickname);
          positions.push({
            person,
            startIndex: index,
            endIndex: index + nickname.length,
            matchedName: title.substring(index, index + nickname.length),
          });
          break;
        }
      }
    }
  }

  // Sort by position
  return positions.sort((a, b) => a.startIndex - b.startIndex);
}

