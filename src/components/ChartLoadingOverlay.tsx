import { Spinner } from "@/components/ui/spinner";

interface ChartLoadingOverlayProps {
  color?: 'purple' | 'yellow' | 'red' | 'teal' | 'orange';
}

const colorClasses = {
  purple: 'text-purple-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
  teal: 'text-teal-500',
  orange: 'text-orange-500',
};

export const ChartLoadingOverlay = ({ color = 'purple' }: ChartLoadingOverlayProps) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80" />
      <div className="flex flex-col items-center gap-2">
        <Spinner size="lg" className={colorClasses[color]} />
        <span className="text-sm text-gray-700 dark:text-white/80">Loading data...</span>
      </div>
    </div>
  );
}; 