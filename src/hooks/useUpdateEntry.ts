import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheUtils } from '@/lib/cache-utils';

interface UseUpdateEntryOptions {
  onSuccess?: (updatedEntry: any) => void;
  onError?: (error: Error) => void;
}

export function useUpdateEntry(options?: UseUpdateEntryOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const updateEntry = async (
    entryId: string,
    databaseId: string,
    properties: Record<string, any>
  ) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/notion/entries/${entryId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update entry');
      }

      const result = await response.json();

      // Invalidate relevant caches
      cacheUtils.invalidateDatabase(databaseId);

      // Refetch database pages
      await queryClient.invalidateQueries({
        queryKey: ['database-pages', databaseId],
      });

      options?.onSuccess?.(result.page);
    } catch (error) {
      console.error('Error updating entry:', error);
      options?.onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateEntry,
    isLoading,
  };
}
