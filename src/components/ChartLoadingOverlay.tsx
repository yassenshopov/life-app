import { LoadingSpinner } from "./LoadingSpinner";

interface ChartLoadingOverlayProps {
  color?: 'purple' | 'yellow' | 'red' | 'teal' | 'orange';
}

export const ChartLoadingOverlay = ({ color = 'purple' }: ChartLoadingOverlayProps) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80" />
      <LoadingSpinner color={color} label="Loading data..." />
    </div>
  );
}; 