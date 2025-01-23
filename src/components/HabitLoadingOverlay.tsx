export function HabitLoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-800/20 dark:border-slate-200/20 border-t-slate-800 dark:border-t-slate-200 rounded-full animate-spin" />
    </div>
  );
} 