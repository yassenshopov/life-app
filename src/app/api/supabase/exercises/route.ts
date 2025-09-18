import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { createClientWithClerk } from '@/lib/supabase';
import { auth } from '@clerk/nextjs';

export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const supabase = await createClientWithClerk();
    let query = supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', userId)
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
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, date, exercise_log, notes } = body;

    const supabase = await createClientWithClerk();
    const { data, error } = await supabase
      .from('training_sessions')
      .insert([
        {
          user_id: userId,
          type,
          date,
          exercise_log,
          notes,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving exercise:', error);
    return NextResponse.json({ error: 'Failed to save exercise' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();

  try {
    const supabase = await createClientWithClerk();
    const { error } = await supabase
      .from('training_sessions')
      .update({
        type: data.type,
        date: data.date,
        exercise_log: data.exercise_log,
        notes: data.notes,
      })
      .eq('id', data.id)
      .eq('user_id', userId); // Ensure user can only update their own records

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating exercise:', error);
    return NextResponse.json({ error: 'Failed to update exercise' }, { status: 500 });
  }
}
