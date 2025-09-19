import { queryClient } from './query-client';

// Cache invalidation utilities
export const cacheUtils = {
  // Invalidate all database-related queries
  invalidateDatabase: (databaseId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['database', databaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ['database-pages', databaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ['all-database-pages', databaseId],
    });
  },

  // Invalidate all database pages for a specific database
  invalidateDatabasePages: (databaseId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['database-pages', databaseId],
    });
    queryClient.invalidateQueries({
      queryKey: ['all-database-pages', databaseId],
    });
  },

  // Invalidate all database queries (useful when user changes)
  invalidateAllDatabases: () => {
    queryClient.invalidateQueries({
      queryKey: ['database'],
    });
    queryClient.invalidateQueries({
      queryKey: ['database-pages'],
    });
    queryClient.invalidateQueries({
      queryKey: ['all-database-pages'],
    });
  },

  // Prefetch database data
  prefetchDatabase: async (databaseId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['database', databaseId],
      queryFn: async () => {
        const response = await fetch(`/api/notion/database/${databaseId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch database');
        }
        return response.json();
      },
      staleTime: 60 * 60 * 1000, // 1 hour
    });
  },

  // Prefetch database pages
  prefetchDatabasePages: async (databaseId: string, pageSize: number = 50) => {
    await queryClient.prefetchInfiniteQuery({
      queryKey: ['database-pages', databaseId, pageSize],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams({
          databaseId,
          pageSize: pageSize.toString(),
        });

        if (pageParam) {
          params.append('start_cursor', pageParam);
        }

        const response = await fetch(`/api/notion/database/${databaseId}/pages?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch database pages');
        }
        return response.json();
      },
      getNextPageParam: (lastPage) => {
        return lastPage.has_more ? lastPage.next_cursor : undefined;
      },
      initialPageParam: undefined as string | undefined,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  },

  // Get cached database data
  getCachedDatabase: (databaseId: string) => {
    return queryClient.getQueryData(['database', databaseId]);
  },

  // Get cached database pages
  getCachedDatabasePages: (databaseId: string, pageSize?: number) => {
    if (pageSize !== undefined) {
      // Return specific cached query for the given pageSize
      return queryClient.getQueryData(['database-pages', databaseId, pageSize]);
    } else {
      // Return all cached queries for this databaseId
      const queries = queryClient.getQueriesData({
        queryKey: ['database-pages', databaseId],
        exact: false,
      });

      // Aggregate all pages from matching queries
      const allPages = queries
        .map(([_, data]) => data)
        .filter((data): data is any => data != null)
        .flatMap((data) => data.pages || []);

      return allPages.length > 0 ? { pages: allPages } : null;
    }
  },
};
