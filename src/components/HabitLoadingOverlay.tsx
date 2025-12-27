import { Spinner } from '@/components/ui/spinner';

export function HabitLoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
      <Spinner size="md" />
    </div>
  );
} 