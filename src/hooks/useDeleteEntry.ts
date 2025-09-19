import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheUtils } from '@/lib/cache-utils';

interface UseDeleteEntryOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useDeleteEntry(options?: UseDeleteEntryOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const deleteEntry = async (entryId: string, databaseId: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/notion/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete entry');
      }

      // Invalidate relevant caches
      cacheUtils.invalidateDatabase(databaseId);

      // Refetch database pages
      await queryClient.invalidateQueries({
        queryKey: ['database-pages', databaseId],
      });

      options?.onSuccess?.();
    } catch (error) {
      console.error('Error deleting entry:', error);
      options?.onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    deleteEntry,
    isLoading,
  };
}
