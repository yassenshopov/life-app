import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';

interface SleepPatternChartProps {
  data: Array<{
    date: string;
    fullDate: string;
    sleepStart: number;
    sleepEnd: number;
    duration: number;
  }>;
}

export const SleepPatternChart = ({ data }: SleepPatternChartProps) => {
  const getTickInterval = (dataLength: number) => {
    if (dataLength <= 7) return 0;
    if (dataLength <= 14) return 1;
    if (dataLength <= 31) return 2;
    return Math.floor(dataLength / 15);
  };

  const tickInterval = getTickInterval(data.length);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          scale="point"
          padding={{ left: 20, right: 20 }}
          tick={{ dy: 10, fontSize: 12 }}
          interval={tickInterval}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={[16, 0]}
          ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16]}
          tickFormatter={(value) => {
            const hour = (value - 4) % 24;
            return hour.toString().padStart(2, '0') + ':00';
          }}
          label={{
            value: 'Time of Day (24H)',
            angle: -90,
            position: 'insideLeft',
          }}
          reversed={true}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              const formatTime = (decimal: number) => {
                const hour = Math.floor((decimal + 18) % 24);
                const minute = Math.floor((decimal % 1) * 60);
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
              };

              return (
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                  <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                    {data.date}
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Sleep: {formatTime(data.sleepStart)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Wake: {formatTime(data.sleepEnd)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Duration: {data.duration.toFixed(1)}h
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Line
          type="step"
          dataKey="sleepStart"
          stroke="transparent"
          dot={false}
          activeDot={false}
        />
        {data.map((entry, index) => {
          const xPercent = 9 + index * 3.005;
          return (
            <line
              key={index}
              x1={`${xPercent}%`}
              x2={`${xPercent}%`}
              y1={entry.sleepStart * (400 / 24)}
              y2={entry.sleepEnd * (400 / 24)}
              strokeWidth="16"
              stroke="#a855f7"
              strokeOpacity={0.9}
              strokeLinecap="round"
              className="transition-opacity hover:opacity-100"
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}; 