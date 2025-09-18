import { Calendar, Dumbbell, Plus, type LucideIcon } from 'lucide-react';

export interface NotionDatabaseTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  properties: {
    [key: string]: {
      type: string;
      required?: boolean;
      description?: string;
    };
  };
}

export const NOTION_DATABASE_TEMPLATES: NotionDatabaseTemplate[] = [
  {
    id: 'daily_tracking',
    name: 'Daily Tracking',
    description: 'Track your daily metrics, habits, and activities',
    icon: Calendar,
    properties: {
      Date: {
        type: 'date',
        required: true,
        description: 'The date of the entry',
      },
      Sleep: {
        type: 'number',
        description: 'Hours of sleep',
      },
      'Resting Heart Rate': {
        type: 'number',
        description: 'Morning resting heart rate',
      },
      Steps: {
        type: 'number',
        description: 'Daily step count',
      },
      Weight: {
        type: 'number',
        description: 'Morning weight in kg',
      },
      Mood: {
        type: 'select',
        description: 'Daily mood rating',
      },
      Energy: {
        type: 'select',
        description: 'Energy level throughout the day',
      },
      Notes: {
        type: 'rich_text',
        description: 'Additional notes for the day',
      },
    },
  },
  {
    id: 'fitness_tracking',
    name: 'Fitness Tracking',
    description: 'Track your workouts, exercises, and progress',
    icon: Dumbbell,
    properties: {
      Date: {
        type: 'date',
        required: true,
        description: 'The date of the workout',
      },
      'Workout Type': {
        type: 'select',
        required: true,
        description: 'Type of workout (e.g., Strength, Cardio, HIIT)',
      },
      Duration: {
        type: 'number',
        description: 'Workout duration in minutes',
      },
      'Muscle Groups': {
        type: 'multi_select',
        description: 'Muscle groups targeted',
      },
      Exercises: {
        type: 'relation',
        description: 'Related exercises performed',
      },
      'Total Volume': {
        type: 'number',
        description: 'Total weight lifted in kg',
      },
      Notes: {
        type: 'rich_text',
        description: 'Workout notes and observations',
      },
    },
  },
  {
    id: 'custom',
    name: 'Custom Database',
    description: 'Create your own custom database structure',
    icon: Plus,
    properties: {
      Name: {
        type: 'title',
        required: true,
        description: 'Entry name',
      },
      Date: {
        type: 'date',
        required: true,
        description: 'Entry date',
      },
    },
  },
];
