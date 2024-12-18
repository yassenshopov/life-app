"use client"

import { useEffect, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ThemeToggle } from "@/components/theme-toggle"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface SleepEntry {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  totalSleepHours: number;
  totalSleepMinutes: number;
  deepSleepPercentage: number;
  remSleepPercentage: number;
  awakeTimeMinutes: number;
}

export default function Home() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [entries, setEntries] = useState<SleepEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sleepTime, setSleepTime] = useState('')
  const [wakeTime, setWakeTime] = useState('')
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth() - 9, 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() - 6, 0)
  })

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const response = await fetch(
          `/api/notion/entries?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
        )
        const data = await response.json()
        setEntries(data)
      } catch (error) {
        console.error('Failed to fetch entries:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
  }, [dateRange])

  const handleSubmit = async () => {
    if (!date || !sleepTime || !wakeTime) return

    const [sleepHour, sleepMinute] = sleepTime.split(':')
    const [wakeHour, wakeMinute] = wakeTime.split(':')

    try {
      const response = await fetch('/api/notion/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date.toISOString().split('T')[0],
          GoneToSleepH: parseInt(sleepHour),
          GoneToSleepM: parseInt(sleepMinute),
          AwokeH: parseInt(wakeHour),
          AwokeM: parseInt(wakeMinute),
        }),
      })
      
      if (!response.ok) throw new Error('Failed to save entry')
      
      // Refresh entries after saving
      const updatedEntries = await fetch('/api/notion/entries').then(res => res.json())
      setEntries(updatedEntries)
    } catch (error) {
      console.error('Failed to save entry:', error)
    }
  }

  const prepareChartData = () => {
    return entries
      .filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate >= dateRange.from && entryDate <= dateRange.to
      })
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString(),
        totalSleep: Number((entry.totalSleepHours + entry.totalSleepMinutes / 60).toFixed(2)),
        deepSleep: entry.deepSleepPercentage,
        remSleep: entry.remSleepPercentage,
        awakeTime: entry.awakeTimeMinutes
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const prepareSleepPatternData = () => {
    return entries
      .filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate >= dateRange.from && entryDate <= dateRange.to
      })
      .map(entry => {
        const [sleepHour, sleepMin] = entry.sleepTime.split(':').map(Number)
        const [wakeHour, wakeMin] = entry.wakeTime.split(':').map(Number)
        
        // Convert to decimal hours relative to 6PM (18:00)
        let sleepDecimal = sleepHour + sleepMin / 60
        if (sleepDecimal >= 18) {
          sleepDecimal = sleepDecimal - 18  // Hours after 6PM
        } else {
          sleepDecimal = sleepDecimal + 6  // Hours after midnight + 6
        }
        
        let wakeDecimal = wakeHour + wakeMin / 60
        if (wakeDecimal >= 18) {
          wakeDecimal = wakeDecimal - 18
        } else {
          wakeDecimal = wakeDecimal + 6
        }
        
        return {
          date: new Date(entry.date).toLocaleDateString(),
          fullDate: entry.date,
          sleepStart: sleepDecimal,
          sleepEnd: wakeDecimal,
          duration: (wakeDecimal - sleepDecimal + 24) % 24
        }
      })
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
  }

  const SleepPatternChart = ({ data }: { data: any[] }) => {
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
            tick={{ dy: 10 }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis 
            domain={[0, 24]}
            ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
            tickFormatter={(value) => {
              const hour = (value + 18) % 24
              if (hour === 0) return '12AM'
              if (hour === 12) return '12PM'
              if (hour > 12) return `${hour - 12}PM`
              return `${hour}AM`
            }}
            label={{ value: 'Time of Day', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                const formatTime = (decimal: number) => {
                  const hour = Math.floor((decimal + 18) % 24)
                  const minute = Math.floor((decimal % 1) * 60)
                  const period = hour >= 12 ? 'PM' : 'AM'
                  const displayHour = hour % 12 || 12
                  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
                }
                return (
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                    <p className="font-medium">{data.date}</p>
                    <p className="text-sm">Sleep: {formatTime(data.sleepStart)}</p>
                    <p className="text-sm">Wake: {formatTime(data.sleepEnd)}</p>
                    <p className="text-sm font-medium">Duration: {data.duration.toFixed(1)}h</p>
                  </div>
                );
              }
              return null;
            }}
          />
          {data.map((entry, index) => (
            <rect
              key={index}
              x={`${(index / (data.length - 1)) * 90 + 5}%`}
              y={`${(entry.sleepStart / 24) * 100}%`}
              width={`${90 / data.length * 0.5}%`}
              height={`${((entry.sleepEnd - entry.sleepStart + 24) % 24) / 24 * 100}%`}
              fill="#8884d8"
              fillOpacity={0.8}
              className="transition-opacity hover:opacity-100"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const handleDateRangeFilter = (days: number) => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days)
    setDateRange({ from, to })
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <main className="max-w-7xl mx-auto pt-12">
        <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 text-transparent bg-clip-text">
          Sleep Tracker
        </h1>

        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Sleep History
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeFilter(3)}
                >
                  Last 3 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeFilter(7)}
                >
                  Last 7 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeFilter(30)}
                >
                  Last 30 days
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.from.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
                  className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
                <input
                  type="date"
                  value={dateRange.to.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
                  className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-600 dark:text-slate-400">Loading entries...</p>
          ) : entries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">Sleep Duration Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="totalSleep" stroke="#8884d8" name="Total Sleep (hours)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">Latest Entry</h3>
                {entries[0] && (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {entries[0].totalSleepHours}h {entries[0].totalSleepMinutes}m
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(entries[0].date).toLocaleDateString()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Deep Sleep: {entries[0].deepSleepPercentage}%
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        REM Sleep: {entries[0].remSleepPercentage}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">Sleep Quality Metrics</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="deepSleep" stroke="#8884d8" name="Deep Sleep %" />
                    <Line type="monotone" dataKey="remSleep" stroke="#82ca9d" name="REM Sleep %" />
                    <Line type="monotone" dataKey="awakeTime" stroke="#ffc658" name="Awake Time (min)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">Sleep Patterns</h3>
                <SleepPatternChart data={prepareSleepPatternData()} />
              </div>

              <div className="lg:col-span-3">
                <div className="relative">
                  <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-4 py-2 px-4">
                      {entries
                        .filter(entry => {
                          const entryDate = new Date(entry.date)
                          return entryDate >= dateRange.from && entryDate <= dateRange.to
                        })
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 7)
                        .map((entry) => (
                        <div 
                          key={entry.id}
                          className="w-64 flex-shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 transition-all hover:scale-105"
                        >
                          <div className="flex flex-col mb-4">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long' })}
                            </div>
                            <div className="font-medium text-lg text-slate-900 dark:text-slate-100">
                              {new Date(entry.date).toLocaleDateString(undefined, { 
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm mt-1 font-medium text-slate-600 dark:text-slate-400">
                              {entry.sleepTime} - {entry.wakeTime}
                            </div>
                          </div>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>Total Sleep</span>
                              <span className="font-medium">{entry.totalSleepHours}h {entry.totalSleepMinutes}m</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>Awake Time</span>
                              <span className="font-medium">{entry.awakeTimeMinutes}m</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>Deep Sleep</span>
                              <span className="font-medium">{entry.deepSleepPercentage}%</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>REM Sleep</span>
                              <span className="font-medium">{entry.remSleepPercentage}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950 pointer-events-none" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">No entries found.</p>
          )}
        </div>
      </main>
    </div>
  );
}
