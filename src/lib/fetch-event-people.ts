/**
 * Utility to fetch linked people for calendar events from the database
 */

import { Person } from './people-matching';

interface EventPeopleMap {
  [eventId: string]: Person[];
}

/**
 * Fetch linked people for multiple events in batch
 */
export async function fetchEventPeople(eventIds: string[]): Promise<EventPeopleMap> {
  if (eventIds.length === 0) return {};

  try {
    // Fetch all linked people for these events in one query
    const response = await fetch('/api/events/people/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds }),
    });

    if (!response.ok) {
      console.error('Failed to fetch event people');
      return {};
    }

    const data = await response.json();
    return data.eventPeopleMap || {};
  } catch (error) {
    console.error('Error fetching event people:', error);
    return {};
  }
}

/**
 * Fetch linked people for a single event
 */
export async function fetchPeopleForEvent(eventId: string): Promise<Person[]> {
  try {
    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/people`);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.people || [];
  } catch (error) {
    console.error('Error fetching people for event:', error);
    return [];
  }
}

