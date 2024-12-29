import React from 'react';
import { Moon } from 'lucide-react';
import { format } from 'date-fns';

interface DayEntry {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  totalSleepHours: number;
  totalSleepMinutes: number;
  deepSleepPercentage: number;
  remSleepPercentage: number;
  awakeTimeMinutes: number;
  restingHeartRate: number | null;
  steps: number | null;
  weight: number | null;
}

interface SleepAnalysis {
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  qualityScore: number;
  insights: Array<{
    text: string;
    metric?: { value: number; min: number; max: number; unit: string };
  }>;
  recommendations: string[];
}

const analyzeSleepData = (entry: DayEntry): SleepAnalysis => {
  const insights: Array<{
    text: string;
    metric?: { value: number; min: number; max: number; unit: string };
  }> = [];
  const recommendations: string[] = [];
  let qualityScore = 100;

  // Calculate total sleep duration in hours
  const totalSleep = entry.totalSleepHours + entry.totalSleepMinutes / 60;

  // Analyze sleep duration (without progress bar)
  if (totalSleep < 7) {
    qualityScore -= 20;
    insights.push({
      text: `You slept ${totalSleep.toFixed(
        1
      )} hours, which is below the recommended 7-9 hours`,
    });
    recommendations.push(
      'Try to get to bed earlier to reach at least 7 hours of sleep'
    );
  } else if (totalSleep > 9) {
    qualityScore -= 10;
    insights.push({
      text: `You slept ${totalSleep.toFixed(
        1
      )} hours, which is above the recommended range`,
    });
    recommendations.push(
      'Consider adjusting your sleep schedule to avoid oversleeping'
    );
  } else {
    insights.push({
      text: `Your sleep duration of ${totalSleep.toFixed(
        1
      )} hours is within the ideal range`,
    });
  }

  // Add Light sleep analysis (before Deep sleep)
  const lightSleepPercentage =
    100 - entry.deepSleepPercentage - entry.remSleepPercentage;
  insights.push({
    text: `Light sleep`,
    metric: { value: lightSleepPercentage, min: 0, max: 55, unit: '%' },
  });

  // Analyze deep sleep
  insights.push({
    text: `Deep sleep`,
    metric: { value: entry.deepSleepPercentage, min: 20, max: 60, unit: '%' },
  });

  // Analyze REM sleep
  insights.push({
    text: `REM sleep`,
    metric: { value: entry.remSleepPercentage, min: 10, max: 30, unit: '%' },
  });

  // Enhanced awake time analysis
  if (entry.awakeTimeMinutes > 0) {
    if (entry.awakeTimeMinutes > 60) {
      qualityScore -= 25;
      insights.push({
        text: `Significant sleep disruption: ${entry.awakeTimeMinutes} minutes spent awake`,
        metric: { value: entry.awakeTimeMinutes, min: 0, max: 60, unit: 'm' },
      });
      recommendations.push(
        'Consider checking for environmental disturbances (noise, light, temperature)'
      );
      recommendations.push(
        'Evaluate if stress or anxiety might be affecting your sleep'
      );
    } else if (entry.awakeTimeMinutes > 30) {
      qualityScore -= 15;
      insights.push({
        text: `Moderate sleep disruption: ${entry.awakeTimeMinutes} minutes spent awake`,
        metric: { value: entry.awakeTimeMinutes, min: 0, max: 60, unit: 'm' },
      });
      recommendations.push(
        'Try to minimize evening screen time and create a more sleep-friendly environment'
      );
    } else {
      qualityScore -= 5;
      insights.push({
        text: `Minor sleep disruption: ${entry.awakeTimeMinutes} minutes spent awake`,
        metric: { value: entry.awakeTimeMinutes, min: 0, max: 60, unit: 'm' },
      });
      recommendations.push(
        'Consider your evening routine to minimize sleep disruptions'
      );
    }
  }

  // Determine quality label
  let quality: SleepAnalysis['quality'] = 'Poor';
  if (qualityScore >= 90) quality = 'Excellent';
  else if (qualityScore >= 75) quality = 'Good';
  else if (qualityScore >= 60) quality = 'Fair';

  return { quality, qualityScore, insights, recommendations };
};

const getHistoricalInsights = (
  todayEntry: DayEntry,
  recentEntries: DayEntry[]
) => {
  if (!todayEntry || recentEntries.length < 2) return [];

  const insights: string[] = [];
  const last7Days = recentEntries
    .filter((entry) => entry.date !== todayEntry.date)
    .slice(0, 7);

  // Calculate averages
  const avgSleepTime =
    last7Days.reduce(
      (sum, entry) =>
        sum + entry.totalSleepHours + entry.totalSleepMinutes / 60,
      0
    ) / last7Days.length;

  const avgDeepSleep =
    last7Days.reduce((sum, entry) => sum + entry.deepSleepPercentage, 0) /
    last7Days.length;

  const avgRemSleep =
    last7Days.reduce((sum, entry) => sum + entry.remSleepPercentage, 0) /
    last7Days.length;

  const todayTotalSleep =
    todayEntry.totalSleepHours + todayEntry.totalSleepMinutes / 60;

  // Compare with today
  if (Math.abs(todayTotalSleep - avgSleepTime) > 1) {
    const comparison = todayTotalSleep > avgSleepTime ? 'more' : 'less';
    insights.push(
      `You slept ${Math.abs(todayTotalSleep - avgSleepTime).toFixed(
        1
      )} hours ${comparison} than your 7-day average`
    );
  }

  if (Math.abs(todayEntry.deepSleepPercentage - avgDeepSleep) > 5) {
    const comparison =
      todayEntry.deepSleepPercentage > avgDeepSleep ? 'higher' : 'lower';
    insights.push(
      `Deep sleep was ${Math.abs(
        todayEntry.deepSleepPercentage - avgDeepSleep
      ).toFixed(1)}% ${comparison} than your recent average`
    );
  }

  if (Math.abs(todayEntry.remSleepPercentage - avgRemSleep) > 5) {
    const comparison =
      todayEntry.remSleepPercentage > avgRemSleep ? 'higher' : 'lower';
    insights.push(
      `REM sleep was ${Math.abs(
        todayEntry.remSleepPercentage - avgRemSleep
      ).toFixed(1)}% ${comparison} than your recent average`
    );
  }

  return insights;
};

const formatPercentage = (value: number): string => {
  const formatted = value.toFixed(1);
  return formatted.endsWith('.0') ? Math.floor(value) + '%' : formatted + '%';
};

const sleepTypeNames = {
  'light sleep': 'Light Sleep',
  'deep sleep': 'Deep Sleep',
  'rem sleep': 'REM Sleep',
} as const;

export const ProgressBar = ({
  value,
  min,
  max,
  type,
}: {
  value: number;
  min: number;
  max: number;
  type: string;
}) => {
  const colors = {
    'light sleep': 'bg-blue-400',
    'deep sleep': 'bg-blue-700',
    'rem sleep': 'bg-teal-500',
    default: 'bg-blue-500',
  };

  const colorClass =
    colors[type.toLowerCase() as keyof typeof colors] || colors.default;

  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-full sm:w-48 md:w-64 lg:w-96 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
        <div
          className="absolute h-full bg-stripes"
          style={{
            left: `${min}%`,
            width: `${max - min}%`,
            background:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.2), rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)',
          }}
        />
        <div
          className={`h-full transition-all ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 w-16 text-right">
        {min}-{max}%
      </span>
    </div>
  );
};

export const EmptyStateCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
    <div className="flex flex-col items-center justify-center text-center py-8">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-400 max-w-md">
        {description}
      </p>
    </div>
  </div>
);

export const InsightSection = ({
  title,
  insights,
  renderProgressBar,
}: {
  title: string;
  insights: Array<{
    text: string;
    metric?: { value: number; min: number; max: number; unit: string };
  }>;
  renderProgressBar: (
    value: number,
    min: number,
    max: number,
    type: string
  ) => React.ReactElement;
}) => (
  <div>
    <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
      {title}
    </h3>
    <div className="space-y-4">
      {insights.map((insight, index) => (
        <div key={index}>
          {insight.metric ? (
            renderProgressBar(
              insight.metric.value,
              insight.metric.min,
              insight.metric.max,
              insight.text
            )
          ) : (
            <p className="text-slate-600 dark:text-slate-400">{insight.text}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

export const RecommendationSection = ({
  recommendations,
}: {
  recommendations: string[];
}) => (
  <div>
    <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
      Recommendations
    </h3>
    <ul className="list-disc list-inside space-y-2">
      {recommendations.map((recommendation, index) => (
        <li key={index} className="text-slate-600 dark:text-slate-400">
          {recommendation}
        </li>
      ))}
    </ul>
  </div>
);

export const HistoricalSection = ({ insights }: { insights: string[] }) => (
  <div>
    <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
      Historical Insights
    </h3>
    <ul className="list-disc list-inside space-y-2">
      {insights.map((insight, index) => (
        <li key={index} className="text-slate-600 dark:text-slate-400">
          {insight}
        </li>
      ))}
    </ul>
  </div>
);

export const QualityBadge = ({
  quality,
  score,
}: {
  quality: string;
  score: number;
}) => {
  const colors = {
    Excellent:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Good: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    Fair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    Poor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-medium ${
        colors[quality as keyof typeof colors]
      }`}
    >
      {quality} ({score}%)
    </div>
  );
};

export const CardHeader = ({
  date,
  sleepTime,
  wakeTime,
  quality,
  score,
}: {
  date: string;
  sleepTime: string;
  wakeTime: string;
  quality: string;
  score: number;
}) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex flex-col">
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 opacity-50 mb-2">
        Today's Sleep Analysis ({format(new Date(date), 'MMM do yyyy')})
      </h2>
      <p className="text-2xl font-medium text-slate-900 dark:text-slate-100">
        {sleepTime} - {wakeTime}
      </p>
    </div>
    <QualityBadge quality={quality} score={score} />
  </div>
);

export const SleepAnalysisCard = ({
  entry,
  entries,
}: {
  entry: any;
  entries: any[];
}) => {
  if (!entry) {
    return (
      <EmptyStateCard
        icon={<Moon className="w-12 h-12 text-purple-500" />}
        title="No Sleep Data for Today"
        description="Track your sleep by logging today's data using the form above."
      />
    );
  }

  const analysis = analyzeSleepData(entry);
  const historicalInsights = getHistoricalInsights(entry, entries);

  const renderProgressBar = (
    value: number,
    min: number,
    max: number,
    type: string
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex flex-col">
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {sleepTypeNames[type.toLowerCase() as keyof typeof sleepTypeNames] ||
            type}
        </span>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {formatPercentage(value)}
        </span>
      </div>
      <ProgressBar
        value={value}
        min={min}
        max={max}
        type={type.toLowerCase()}
      />
    </div>
  );

  return (
    <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
      <CardHeader
        date={entry.date}
        sleepTime={entry.sleepTime}
        wakeTime={entry.wakeTime}
        quality={analysis.quality}
        score={analysis.qualityScore}
      />

      <div className="space-y-4">
        <InsightSection
          title="Key Insights"
          insights={analysis.insights}
          renderProgressBar={renderProgressBar}
        />

        {analysis.recommendations.length > 0 && (
          <RecommendationSection recommendations={analysis.recommendations} />
        )}

        {historicalInsights.length > 0 && (
          <HistoricalSection insights={historicalInsights} />
        )}
      </div>
    </div>
  );
};
