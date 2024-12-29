import { useState, useEffect } from 'react';

export function useGymData(dateRange: { from: Date; to: Date }) {
  const [exerciseData, setExerciseData] = useState<any[]>([]);
  const [gymSessions, setGymSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [exerciseResponse, gymResponse] = await Promise.all([
          fetch(`/api/supabase/exercises?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`),
          fetch(`/api/supabase/exercises?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`)
        ]);

        const [exerciseData, gymData] = await Promise.all([
          exerciseResponse.json(),
          gymResponse.json()
        ]);

        setExerciseData(exerciseData);
        setGymSessions(gymData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return { exerciseData, gymSessions, loading };
} 