interface StatusFilterProps {
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
}

export const StatusFilter = ({
  selectedStatuses,
  setSelectedStatuses,
}: StatusFilterProps) => {
  const statuses = ['Active', 'Unplanned', 'Discontinued'];

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
  };

  return (
    <div className="flex gap-2 pb-2">
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => toggleStatus(status)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedStatuses.includes(status)
              ? status === 'Active'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500'
                : status === 'Discontinued'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-500'
              : 'bg-transparent border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          {status}
        </button>
      ))}
    </div>
  );
}; 