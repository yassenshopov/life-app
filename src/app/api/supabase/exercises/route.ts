import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('date', startDate ? format(new Date(startDate), 'yyyy-MM-dd') : '')
      .lte('date', endDate ? format(new Date(endDate), 'yyyy-MM-dd') : '')
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching exercise data:', error);
    return NextResponse.json({ error: 'Failed to fetch exercise data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, date, exercise_log, notes, user_id } = body;

    const { data, error } = await supabase
      .from('training_sessions')
      .insert([
        {
          type,
          date,
          exercise_log,
          notes,
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving exercise:', error);
    return NextResponse.json(
      { error: 'Failed to save exercise' },
      { status: 500 }
    );
  }
}
