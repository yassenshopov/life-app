/**
 * AI Gateway utilities for Vercel AI Gateway
 *
 * This module provides utilities for interacting with Vercel AI Gateway
 * using the Vercel AI SDK.
 *
 * Reference: https://vercel.com/docs/ai-gateway
 */

import { generateText } from 'ai';

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;

if (!AI_GATEWAY_API_KEY) {
  console.warn('AI_GATEWAY_API_KEY is not set. AI Gateway features will not work.');
}

/**
 * Configuration for AI Gateway models
 * Using Groq models as they are fast and cost-effective
 */
export const AI_MODELS = {
  // Groq models - very fast and cost-effective
  'groq/llama-3.1-8b-instant': {
    name: 'groq/llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B (Groq)',
    provider: 'groq',
  },
  'groq/llama-3.3-70b-versatile': {
    name: 'groq/llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
  },
  'groq/mixtral-8x7b-32768': {
    name: 'groq/mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B (Groq)',
    provider: 'groq',
  },
} as const;

/**
 * Default model - using the cheapest/fastest option
 */
export const DEFAULT_MODEL = 'groq/llama-3.1-8b-instant';

/**
 * Make a request to Vercel AI Gateway using the AI SDK
 * The AI SDK automatically routes through Vercel AI Gateway when AI_GATEWAY_API_KEY is set
 */
export async function callAIGateway(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = DEFAULT_MODEL,
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<string> {
  if (!AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not configured');
  }

  try {
    // Vercel AI Gateway: The AI SDK automatically routes through the gateway
    // when AI_GATEWAY_API_KEY is set as an environment variable.
    // The model format should be: 'provider/model-name' (e.g., 'groq/llama-3.1-8b-instant')
    const { text } = await generateText({
      model: model as any, // Model string format: 'provider/model-name'
      messages,
      temperature: options?.temperature ?? 0.7,
      // Note: max_tokens is handled by the model provider, not as a direct parameter
    });

    return text;
  } catch (error: any) {
    console.error('AI Gateway error:', error);
    throw new Error(`AI Gateway request failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Generate suggestions for unscheduled time based on calendar context
 */
export async function generateUnscheduledTimeSuggestions(context: {
  currentTime: Date;
  recentEvents: Array<{ title: string; start: Date; end: Date; location?: string }>;
  upcomingEvents: Array<{ title: string; start: Date; end: Date; location?: string }>;
  timeUntilNextEvent?: number; // minutes
  availableTimeBlocks: Array<{ start: Date; end: Date; durationMinutes: number }>;
  mediaItems?: Array<{ name: string; category: string | null; by: string[] | null }>;
}): Promise<string[]> {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Build context string
  let contextString = `Current time: ${formatTime(context.currentTime)} on ${formatDate(
    context.currentTime
  )}\n\n`;

  if (context.recentEvents.length > 0) {
    contextString += 'Recent past events:\n';
    context.recentEvents.slice(0, 5).forEach((event) => {
      contextString += `- ${event.title} (${formatTime(event.start)} - ${formatTime(event.end)})`;
      if (event.location) contextString += ` at ${event.location}`;
      contextString += '\n';
    });
    contextString += '\n';
  }

  if (context.upcomingEvents.length > 0) {
    contextString += 'Upcoming events:\n';
    context.upcomingEvents.slice(0, 5).forEach((event) => {
      contextString += `- ${event.title} (${formatTime(event.start)} - ${formatTime(event.end)})`;
      if (event.location) contextString += ` at ${event.location}`;
      contextString += '\n';
    });
    contextString += '\n';
  }

  if (context.timeUntilNextEvent !== undefined) {
    const hours = Math.floor(context.timeUntilNextEvent / 60);
    const minutes = context.timeUntilNextEvent % 60;
    contextString += `Time until next event: ${
      hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ` : ''
    }${minutes} minute${minutes !== 1 ? 's' : ''}\n\n`;
  }

  if (context.availableTimeBlocks.length > 0) {
    contextString += 'Available time blocks today:\n';
    context.availableTimeBlocks.forEach((block) => {
      const durationHours = Math.floor(block.durationMinutes / 60);
      const durationMins = block.durationMinutes % 60;
      contextString += `- ${formatTime(block.start)} - ${formatTime(block.end)} (${
        durationHours > 0 ? `${durationHours}h ` : ''
      }${durationMins}m)\n`;
    });
    contextString += '\n';
  }

  // Add media ToDo items to context
  if (context.mediaItems && context.mediaItems.length > 0) {
    contextString += 'Media items in ToDo list:\n';
    context.mediaItems.slice(0, 10).forEach((item) => {
      contextString += `- ${item.name}`;
      if (item.category) contextString += ` (${item.category})`;
      if (item.by && item.by.length > 0) {
        contextString += ` by ${item.by.join(', ')}`;
      }
      contextString += '\n';
    });
    contextString += '\n';
  }

  const prompt = `You are a helpful productivity assistant. Based on the following calendar context and available media items, suggest 3-5 specific, actionable bullet points for what to do during the current unscheduled time block. 

Consider:
- The time available until the next event
- Recent activities (to avoid repetition or suggest follow-ups)
- Upcoming events (to prepare or avoid conflicts)
- The time of day and context
- Media items from the ToDo list (books, movies, series, etc.) - suggest specific items that fit the available time

Format your response as a simple list of bullet points, one per line, starting with "- ". Keep each suggestion concise (one line) and practical. When suggesting media items, mention the specific title (e.g., "Read [Book Title]" or "Watch [Movie/Series Title]") when appropriate.

Calendar context:
${contextString}

Suggestions:`;

  try {
    const response = await callAIGateway(
      [
        {
          role: 'system',
          content:
            'You are a helpful productivity assistant that suggests practical activities for unscheduled time blocks based on calendar context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      DEFAULT_MODEL,
      {
        temperature: 0.8,
        max_tokens: 300,
      }
    );

    // Parse bullet points from response
    const suggestions = response
      .split('\n')
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))
      )
      .map((line) =>
        line
          .replace(/^[-•]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim()
      )
      .filter((line) => line.length > 0)
      .slice(0, 5); // Limit to 5 suggestions

    return suggestions.length > 0
      ? suggestions
      : ['No specific suggestions available at this time.'];
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw error;
  }
}
