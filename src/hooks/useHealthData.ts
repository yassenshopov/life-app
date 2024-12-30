import { useState, useEffect } from 'react';
import { DayEntry } from '@/types/day-entry';

export function useHealthData() {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        // First, fetch the database ID
        const credResponse = await fetch('/api/user/notion-credentials');
        const { notionDatabaseId } = await credResponse.json();

        if (!notionDatabaseId) {
          throw new Error('No Notion database ID found');
        }

        // Calculate date range
        const endDate = new Date().toISOString();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1); // Last 30 days
        
        // Build the URL with all required parameters
        const url = `/api/notion/entries?` + new URLSearchParams({
          databaseId: notionDatabaseId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        });

        console.log('Fetching from:', url); // Debug log

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
  }, []);

  return { entries, isLoading, error };
} 