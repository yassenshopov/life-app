import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

// Dynamic import for googleapis
let google: any;
try {
  const googleapis = await import('googleapis');
  google = googleapis.google;
} catch (error) {
  console.warn('googleapis package not installed');
}

const supabase = getSupabaseServiceRoleClient();

interface GoogleCalendarCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

/**
 * Map Google Calendar colorId to hex color
 * Google Calendar uses predefined color IDs (1-11) that map to specific colors
 */
function getColorFromColorId(colorId: string | undefined | null, calendarColor: string): string {
  if (!colorId) {
    return calendarColor; // Fall back to calendar color if no event-specific color
  }

  // Google Calendar color ID to hex mapping
  const colorMap: Record<string, string> = {
    '1': '#a4bdfc', // Lavender
    '2': '#7ae7bf', // Sage
    '3': '#dbadff', // Grape
    '4': '#ff887c', // Flamingo
    '5': '#fbd75b', // Banana
    '6': '#ffb878', // Tangerine
    '7': '#46d6db', // Peacock
    '8': '#e1e1e1', // Graphite
    '9': '#5484ed', // Blueberry
    '10': '#51b749', // Basil
    '11': '#dc2127', // Tomato
  };

  return colorMap[colorId] || calendarColor; // Fall back to calendar color if colorId not recognized
}

/**
 * Map hex color to Google Calendar colorId
 */
function getColorIdFromHex(hexColor: string): string | undefined {
  const normalizedHex = hexColor.toLowerCase().startsWith('#') ? hexColor.toLowerCase() : `#${hexColor.toLowerCase()}`;
  
  const colorMap: Record<string, string> = {
    '#a4bdfc': '1', // Lavender
    '#7ae7bf': '2', // Sage
    '#dbadff': '3', // Grape
    '#ff887c': '4', // Flamingo
    '#fbd75b': '5', // Banana
    '#ffb878': '6', // Tangerine
    '#46d6db': '7', // Peacock
    '#e1e1e1': '8', // Graphite
    '#5484ed': '9', // Blueberry
    '#51b749': '10', // Basil
    '#dc2127': '11', // Tomato
  };

  return colorMap[normalizedHex];
}

/**
 * Find the closest Google Calendar colorId for a custom color
 * This is used when a custom color is provided but Google Calendar only supports predefined colors
 */
function findClosestColorId(hexColor: string): string | undefined {
  const normalizedHex = hexColor.toLowerCase().startsWith('#') ? hexColor.toLowerCase() : `#${hexColor.toLowerCase()}`;
  
  // Parse RGB values
  const r = parseInt(normalizedHex.slice(1, 3), 16);
  const g = parseInt(normalizedHex.slice(3, 5), 16);
  const b = parseInt(normalizedHex.slice(5, 7), 16);
  
  // Calculate distance to each predefined color
  const colors = [
    { id: '1', hex: '#a4bdfc' },
    { id: '2', hex: '#7ae7bf' },
    { id: '3', hex: '#dbadff' },
    { id: '4', hex: '#ff887c' },
    { id: '5', hex: '#fbd75b' },
    { id: '6', hex: '#ffb878' },
    { id: '7', hex: '#46d6db' },
    { id: '8', hex: '#e1e1e1' },
    { id: '9', hex: '#5484ed' },
    { id: '10', hex: '#51b749' },
    { id: '11', hex: '#dc2127' },
  ];
  
  let minDistance = Infinity;
  let closestId: string | undefined;
  
  for (const color of colors) {
    const colorHex = color.hex.toLowerCase();
    const cr = parseInt(colorHex.slice(1, 3), 16);
    const cg = parseInt(colorHex.slice(3, 5), 16);
    const cb = parseInt(colorHex.slice(5, 7), 16);
    
    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestId = color.id;
    }
  }
  
  return closestId;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const body = await req.json();
    const { calendarId, startTime, endTime, isAllDay, newCalendarId, location, color, useCalendarDefault } = body;

    // If updating calendar, newCalendarId is required
    if (newCalendarId && !calendarId) {
      return NextResponse.json(
        { error: 'calendarId is required when moving to a new calendar' },
        { status: 400 }
      );
    }

    // Validate dates if provided
    if (startTime && endTime) {
      const newStart = new Date(startTime);
      const newEnd = new Date(endTime);

      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }

      if (newStart >= newEnd) {
        return NextResponse.json(
          { error: 'Start time must be before end time' },
          { status: 400 }
        );
      }
    }

    // calendarId is required to fetch the existing event
    if (!calendarId) {
      return NextResponse.json(
        { error: 'calendarId is required' },
        { status: 400 }
      );
    }

    // At least one field must be provided
    if (!startTime && !endTime && !newCalendarId && location === undefined && color === undefined) {
      return NextResponse.json(
        { error: 'At least one field (startTime, endTime, newCalendarId, location, or color) must be provided' },
        { status: 400 }
      );
    }

    // If updating time, both startTime and endTime are required
    if ((startTime && !endTime) || (!startTime && endTime)) {
      return NextResponse.json(
        { error: 'Both startTime and endTime must be provided together' },
        { status: 400 }
      );
    }

    // Fetch user's Google Calendar credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;

    if (!credentials || !credentials.access_token) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 400 }
      );
    }

    if (!google) {
      return NextResponse.json(
        { error: 'Google Calendar API not configured' },
        { status: 503 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry_date: credentials.expiry_date,
    });

    // Refresh token if needed
    if (credentials.expiry_date && credentials.expiry_date <= Date.now()) {
      try {
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(newCredentials);

        // Update stored credentials
        await supabase
          .from('users')
          .update({
            google_calendar_credentials: {
              ...credentials,
              access_token: newCredentials.access_token,
              expiry_date: newCredentials.expiry_date,
            },
          })
          .eq('id', userId);
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return NextResponse.json(
          { error: 'Failed to refresh access token' },
          { status: 401 }
        );
      }
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // First, get the existing event to preserve other fields
    let existingEvent;
    try {
      const eventResponse = await calendar.events.get({
        calendarId,
        eventId,
      });
      existingEvent = eventResponse.data;
    } catch (error: any) {
      // If event is not found (404) or deleted (410) and we're moving calendars, 
      // try to fetch from Supabase cache as fallback
      if ((error.code === 404 || error.code === 410) && newCalendarId) {
        const { data: cachedEvent } = await supabase
          .from('google_calendar_events')
          .select('event_data')
          .eq('user_id', userId)
          .eq('calendar_id', calendarId)
          .eq('event_id', eventId)
          .single();
        
        if (cachedEvent?.event_data) {
          existingEvent = cachedEvent.event_data;
        } else {
          console.error('Error fetching event from Google Calendar and no cache found:', error);
          return NextResponse.json(
            { error: 'Event not found and cannot be moved' },
            { status: 404 }
          );
        }
      } else {
        console.error('Error fetching event from Google Calendar:', error);
        return NextResponse.json(
          { error: 'Failed to fetch event from Google Calendar' },
          { status: 404 }
        );
      }
    }

    // Handle calendar move (if newCalendarId is provided)
    let targetCalendarId = calendarId;
    let googleEvent = existingEvent;
    
    if (newCalendarId && newCalendarId !== calendarId) {
      // Move event to new calendar: delete from old, insert into new
      try {
        // Try to delete from old calendar (ignore 404/410 errors - event might already be deleted)
        try {
          await calendar.events.delete({
            calendarId,
            eventId,
          });
        } catch (deleteError: any) {
          // If event is already deleted (404) or gone (410), that's okay - proceed with insert
          if (deleteError.code !== 404 && deleteError.code !== 410) {
            throw deleteError;
          }
          console.log('Event already deleted from old calendar, proceeding with move');
        }
        
        // Prepare event data for new calendar
        // Remove id field completely to let Google generate a new one
        const { id, ...eventDataWithoutId } = existingEvent;
        const eventToMove: any = {
          ...eventDataWithoutId,
        };
        
      // Update location if provided
      if (location !== undefined) {
        eventToMove.location = location || undefined;
      }
      
      // Update color if provided
      if (color !== undefined) {
        if (useCalendarDefault) {
          // Remove colorId to use calendar default
          delete eventToMove.colorId;
        } else {
          const colorId = getColorIdFromHex(color);
          if (colorId) {
            // Use predefined Google Calendar colorId
            eventToMove.colorId = colorId;
          } else {
            // Custom color - Google Calendar doesn't support custom colors directly
            // We'll store it in the event_data and use it in our UI
            // For Google Calendar API, we'll use the closest predefined color
            // but store the custom color in our database
            const closestColorId = findClosestColorId(color);
            if (closestColorId) {
              eventToMove.colorId = closestColorId;
            }
          }
        }
      }
      
      // Update times if provided
      if (startTime && endTime) {
          const shouldBeAllDay = isAllDay !== undefined ? isAllDay : (existingEvent.start?.date ? true : false);
          const newStart = new Date(startTime);
          const newEnd = new Date(endTime);
          
          eventToMove.start = shouldBeAllDay
            ? { date: newStart.toISOString().split('T')[0] }
            : { dateTime: newStart.toISOString(), timeZone: existingEvent.start?.timeZone || 'UTC' };
          eventToMove.end = shouldBeAllDay
            ? { date: newEnd.toISOString().split('T')[0] }
            : { dateTime: newEnd.toISOString(), timeZone: existingEvent.end?.timeZone || 'UTC' };
        }
        
        // Try to insert into new calendar
        // If it already exists (409), the event might already be in the new calendar
        let insertResponse;
        try {
          insertResponse = await calendar.events.insert({
            calendarId: newCalendarId,
            requestBody: eventToMove,
          });
          googleEvent = insertResponse.data;
          targetCalendarId = newCalendarId;
        } catch (insertError: any) {
          // If event already exists (409), check if it's already in the new calendar
          if (insertError.code === 409) {
            try {
              // Check if event exists in new calendar with same ID
              const existingInNew = await calendar.events.get({
                calendarId: newCalendarId,
                eventId: eventId,
              });
              
              // Event already exists in new calendar, just update it
              const updateResponse = await calendar.events.update({
                calendarId: newCalendarId,
                eventId: eventId,
                requestBody: eventToMove,
              });
              googleEvent = updateResponse.data;
              targetCalendarId = newCalendarId;
            } catch (checkError: any) {
              // Event doesn't exist in new calendar with that ID
              // The 409 might be due to a different conflict - try without ID
              try {
                // Remove any potential conflicting fields and try again
                const cleanEvent = { ...eventToMove };
                delete cleanEvent.id;
                delete cleanEvent.iCalUID;
                
                insertResponse = await calendar.events.insert({
                  calendarId: newCalendarId,
                  requestBody: cleanEvent,
                });
                googleEvent = insertResponse.data;
                targetCalendarId = newCalendarId;
              } catch (retryError: any) {
                console.error('Failed to move event after retry:', retryError);
                throw retryError;
              }
            }
          } else {
            throw insertError;
          }
        }
        
        // Delete old event from Supabase cache (if it exists)
        await supabase
          .from('google_calendar_events')
          .delete()
          .eq('user_id', userId)
          .eq('calendar_id', calendarId)
          .eq('event_id', eventId);
      } catch (error: any) {
        console.error('Error moving event to new calendar:', error);
        return NextResponse.json(
          { error: 'Failed to move event to new calendar', details: error.message },
          { status: 500 }
        );
      }
    } else {
      // Regular update (no calendar move)
      // Update the event with new start/end times and location
      const shouldBeAllDay = isAllDay !== undefined ? isAllDay : (existingEvent.start?.date ? true : false);
      
      const updatedEvent: any = {
        ...existingEvent,
      };
      
      // Update location if provided
      if (location !== undefined) {
        updatedEvent.location = location || undefined;
      }
      
      // Update color if provided
      if (color !== undefined) {
        if (useCalendarDefault) {
          // Remove colorId to use calendar default
          delete updatedEvent.colorId;
        } else {
          const colorId = getColorIdFromHex(color);
          if (colorId) {
            // Use predefined Google Calendar colorId
            updatedEvent.colorId = colorId;
          } else {
            // Custom color - Google Calendar doesn't support custom colors directly
            // We'll store it in the event_data and use it in our UI
            // For Google Calendar API, we'll use the closest predefined color
            // but store the custom color in our database
            const closestColorId = findClosestColorId(color);
            if (closestColorId) {
              updatedEvent.colorId = closestColorId;
            }
          }
        }
      }
      
      // Update times if provided
      if (startTime && endTime) {
        const newStart = new Date(startTime);
        const newEnd = new Date(endTime);
        
        updatedEvent.start = shouldBeAllDay
          ? { date: newStart.toISOString().split('T')[0] }
          : { dateTime: newStart.toISOString(), timeZone: existingEvent.start?.timeZone || 'UTC' };
        updatedEvent.end = shouldBeAllDay
          ? { date: newEnd.toISOString().split('T')[0] }
          : { dateTime: newEnd.toISOString(), timeZone: existingEvent.end?.timeZone || 'UTC' };
      }

      // Update event in Google Calendar
      try {
        const updateResponse = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: updatedEvent,
        });
        googleEvent = updateResponse.data;
      } catch (error: any) {
        console.error('Error updating event in Google Calendar:', error);
        return NextResponse.json(
          { error: 'Failed to update event in Google Calendar', details: error.message },
          { status: 500 }
        );
      }
    }

    // Get calendar color and summary for fallback (use target calendar)
    let calendarColor = '#4285f4';
    let calendarSummary = targetCalendarId;
    try {
      const { data: cachedCalendar } = await supabase
        .from('google_calendars')
        .select('background_color, summary')
        .eq('user_id', userId)
        .eq('calendar_id', targetCalendarId)
        .single();
      
      if (cachedCalendar?.background_color) {
        calendarColor = cachedCalendar.background_color.startsWith('#') 
          ? cachedCalendar.background_color 
          : `#${cachedCalendar.background_color}`;
      }
      
      if (cachedCalendar?.summary) {
        calendarSummary = cachedCalendar.summary;
      }
    } catch (error) {
      console.warn('Could not fetch calendar info for event update response:', error);
    }

    // Update event in Supabase cache
    const isAllDayEvent = !!googleEvent.start?.date;
    const eventStartTime = isAllDayEvent
      ? new Date(googleEvent.start.date + 'T00:00:00Z')
      : new Date(googleEvent.start.dateTime);
    const eventEndTime = isAllDayEvent
      ? new Date(googleEvent.end.date + 'T00:00:00Z')
      : new Date(googleEvent.end.dateTime);

    // Determine event color:
    // - If useCalendarDefault is true, use calendar color (colorId was removed)
    // - If color was provided, use that color (even if custom)
    // - Otherwise, use colorId from Google event (or calendar color as fallback)
    let eventColor: string;
    let isCustomColor = false;
    if (useCalendarDefault) {
      // Use calendar color when resetting to default
      eventColor = calendarColor;
    } else if (color !== undefined) {
      // Check if it's a custom color (not in predefined list)
      const colorId = getColorIdFromHex(color);
      isCustomColor = !colorId;
      eventColor = color; // Use the provided color (custom or predefined)
    } else {
      eventColor = getColorFromColorId(googleEvent.colorId, calendarColor);
    }

    // Upsert event in Supabase cache (use target calendar and event ID)
    const finalEventId = googleEvent.id || eventId;
    const { error: updateError } = await supabase
      .from('google_calendar_events')
      .upsert({
        user_id: userId,
        calendar_id: targetCalendarId,
        event_id: finalEventId,
        title: googleEvent.summary || 'No Title',
        start_time: eventStartTime.toISOString(),
        end_time: eventEndTime.toISOString(),
        is_all_day: isAllDayEvent,
        start_date: isAllDayEvent ? googleEvent.start.date : null,
        end_date: isAllDayEvent ? googleEvent.end.date : null,
        color: eventColor,
        description: googleEvent.description || null,
        location: googleEvent.location || null,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        event_data: googleEvent,
      }, {
        onConflict: 'user_id,calendar_id,event_id',
      });

    if (updateError) {
      console.error('Error updating event in Supabase:', updateError);
      // Don't fail the request if Supabase update fails - Google Calendar update succeeded
    }

    // Return updated event in the same format as GET /api/google-calendar/events
    const responseEvent = {
      id: finalEventId,
      title: googleEvent.summary || 'No Title',
      start: eventStartTime,
      end: eventEndTime,
      color: eventColor,
      calendar: calendarSummary, // Use calendar name, not ID
      calendarId: targetCalendarId,
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      htmlLink: googleEvent.htmlLink || null,
      hangoutLink: googleEvent.hangoutLink || null,
      isAllDay: isAllDayEvent,
      organizer: googleEvent.organizer
        ? {
            email: googleEvent.organizer.email,
            displayName: googleEvent.organizer.displayName,
          }
        : undefined,
      attendees: googleEvent.attendees || null,
      reminders: googleEvent.reminders || null,
      recurrence: googleEvent.recurrence || null,
      status: googleEvent.status || null,
      transparency: googleEvent.transparency || null,
      visibility: googleEvent.visibility || null,
      conferenceData: googleEvent.conferenceData || null,
      created: googleEvent.created ? new Date(googleEvent.created) : undefined,
      updated: googleEvent.updated ? new Date(googleEvent.updated) : undefined,
    };

    return NextResponse.json({ event: responseEvent, success: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/google-calendar/events/[eventId]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

