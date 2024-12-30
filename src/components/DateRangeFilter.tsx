import { ThemeToggle } from "./theme-toggle";

interface DateRangeFilterProps {
  dateRange: { from: Date; to: Date };
  setDateRange: React.Dispatch<React.SetStateAction<{ from: Date; to: Date }>>;
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  handleDateRangeFilter: (days: number | string) => void;
}

export const DateRangeFilter = ({
  dateRange,
  setDateRange,
  activeTab,
  setActiveTab,
  handleDateRangeFilter,
}: DateRangeFilterProps) => {
  const handlePeriodClick = (period: string) => {
    setActiveTab(period);
    const now = new Date();
    const to = new Date(now);
    let from = new Date(now);

    switch (period) {
      case '90D':
        from.setDate(now.getDate() - 90);
        break;
      case '1Y':
        from.setFullYear(now.getFullYear() - 1);
        break;
      case 'YTD':
        from = new Date(now.getFullYear(), 0, 1); // January 1st of current year
        break;
      default:
        const days = parseInt(period);
        if (!isNaN(days)) {
          from = new Date(now);
          from.setDate(now.getDate() - days);
        }
    }
    
    // Ensure we're working with the start of the day for 'from' and end of the day for 'to'
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    
    console.log('Setting date range:', { from, to });
    setDateRange({ from, to });
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {['3D', '7D', '30D', '90D', '1Y', 'YTD'].map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodClick(period)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === period
                  ? 'bg-purple-100 text-purple-700 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={dateRange.from.toISOString().split('T')[0]}
            onChange={(e) => {
              setActiveTab(null);
              setDateRange((prev) => ({
                ...prev,
                from: new Date(e.target.value),
              }));
            }}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs"
          />
          <input
            type="date"
            value={dateRange.to.toISOString().split('T')[0]}
            onChange={(e) => {
              setActiveTab(null);
              setDateRange((prev) => ({
                ...prev,
                to: new Date(e.target.value),
              }));
            }}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs"
          />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}; 