import { useState, useEffect } from 'react';
import { DayEntry } from '@/types/day-entry';

export function useHealthData(dateRange?: { from: Date; to: Date }) {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const credResponse = await fetch('/api/user/notion-credentials');
        const { notionDatabaseId } = await credResponse.json();

        if (!notionDatabaseId) {
          throw new Error('No Notion database ID found');
        }

        // Use provided date range or default to last 30 days
        const startDate = dateRange?.from || (() => {
          const date = new Date();
          date.setMonth(date.getMonth() - 1);
          return date;
        })();
        
        const endDate = dateRange?.to || new Date();
        
        const url = `/api/notion/entries?` + new URLSearchParams({
          databaseId: notionDatabaseId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        });

        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setEntries(data);
      } catch (err) {
        console.error('Error fetching entries:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntries();
  }, [dateRange]); // Add dateRange to dependencies

  return { entries, setEntries, isLoading, error };
} 