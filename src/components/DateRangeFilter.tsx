import { ThemeToggle } from "./theme-toggle";
import { Calendar } from "lucide-react";
import { useState } from "react";

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
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handlePeriodClick = (period: string) => {
    setActiveTab(period);
    handleDateRangeFilter(period === 'YTD' ? period : period.replace('D', ''));
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-2">
        {/* Desktop view */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {['3D', '7D', '30D', '90D', '365D', 'YTD'].map((period) => (
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

          <div className="flex items-center gap-4">
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
              <span className="text-xs text-slate-500 dark:text-slate-400">to</span>
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
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile view */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
              {['3D', '7D', '30D', '90D', '1Y', 'YTD'].map((period) => (
                <button
                  key={period}
                  onClick={() => handlePeriodClick(period)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === period
                      ? 'bg-purple-100 text-purple-700 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile date picker dropdown */}
          {showDatePicker && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">From:</span>
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
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">To:</span>
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
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 