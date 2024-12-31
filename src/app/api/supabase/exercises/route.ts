import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = supabase
      .from('training_sessions')
      .select('*')
      .order('date', { ascending: true });

    // Only apply date filters if both dates are provided
    if (startDate && endDate) {
      query = query
        .gte('date', format(new Date(startDate), 'yyyy-MM-dd'))
        .lte('date', format(new Date(endDate), 'yyyy-MM-dd'));
    }

    const { data, error } = await query;

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

export async function PUT(request: Request) {
  const data = await request.json();
  
  const { error } = await supabase
    .from('training_sessions')
    .update({
      type: data.type,
      date: data.date,
      exercise_log: data.exercise_log,
      notes: data.notes,
    })
    .eq('id', data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
