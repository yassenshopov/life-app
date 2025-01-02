import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';

interface SleepPatternData {
  date: string;
  fullDate: string;
  sleepStart: number;
  sleepEnd: number;
  duration: number;
}

interface SleepPatternChartProps {
  data: SleepPatternData[];
}

export function SleepPatternChart({ data }: SleepPatternChartProps) {
  // Transform data to show bars from sleep start to end
  const chartData = data.map(entry => ({
    date: format(new Date(entry.fullDate), 'MMM dd'),
    duration: entry.duration || 0,
    fullData: entry
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload.fullData;
    const formatTime = (time: number) => {
      // Handle negative hours by adding 24
      const adjustedHour = Math.floor(((time + 24) % 24));
      // Get minutes and ensure they're positive
      const minutes = Math.abs(time % 1 * 60);
      return `${adjustedHour}:${minutes.toFixed(0).padStart(2, '0')}`;
    };

    const sleepStart = formatTime(data.sleepStart);
    const sleepEnd = formatTime(data.sleepEnd);

    console.log(sleepStart, sleepEnd);

    return (
      <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <p className="font-medium">{format(new Date(data.fullDate), 'MMMM d, yyyy')}</p>
        <p>Sleep time: {sleepStart}</p>
        <p>Wake time: {sleepEnd}</p>
        <p>Duration: {data.duration.toFixed(1)} hours</p>
      </div>
    );
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
          stackOffset="wiggle"
        >
          <XAxis
            type="number"
            domain={[-6, 12]}
            ticks={[-6, -3, 0, 3, 6, 9, 12]}
            tickFormatter={(value) => {
              const hour = ((value + 24) % 24);
              return `${hour}:00`;
            }}
          />
          <YAxis
            dataKey="date"
            type="category"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="duration"
            fill="#8884d8"
            radius={[4, 4, 4, 4]}
            stackId="sleep"
            minPointSize={0}
            background={{ fill: 'transparent' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 