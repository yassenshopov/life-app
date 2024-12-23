import { LoadingSpinner } from "./LoadingSpinner";

interface ChartLoadingOverlayProps {
  color?: 'purple' | 'yellow' | 'red' | 'teal' | 'orange';
}

export const ChartLoadingOverlay = ({ color = 'purple' }: ChartLoadingOverlayProps) => {
  return (
    <div className="absolute inset-0 top-[52px] flex items-center justify-center">
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80" />
      <LoadingSpinner color={color} label="Loading data..." />
    </div>
  );
}; 