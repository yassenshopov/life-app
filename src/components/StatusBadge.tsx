import * as Popover from '@radix-ui/react-popover';
import { CircleDot, History, Ban } from 'lucide-react';

interface StatusBadgeProps {
  currentStatus: 'Active' | 'Unplanned' | 'Discontinued';
  onStatusChange: (status: 'Active' | 'Unplanned' | 'Discontinued') => void;
}

export function StatusBadge({ currentStatus, onStatusChange }: StatusBadgeProps) {
  const statuses = ['Active', 'Unplanned', 'Discontinued'];

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500';
      case 'Discontinued':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      default:
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <CircleDot className="w-3 h-3" />;
      case 'Discontinued':
        return <Ban className="w-3 h-3" />;
      default:
        return <History className="w-3 h-3" />;
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={`text-xs px-2 py-1 rounded-full transition-colors hover:opacity-80 ${getStatusClasses(currentStatus)}`}>
          {currentStatus}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="bg-white dark:bg-slate-900 p-1 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800" sideOffset={5}>
          <div className="flex flex-col gap-1">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => onStatusChange(status as 'Active' | 'Unplanned' | 'Discontinued')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-80 ${getStatusClasses(status)}`}
              >
                {getStatusIcon(status)}
                {status}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
} 