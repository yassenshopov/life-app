'use client';

import * as React from 'react';
import {
  Settings,
  MapPin,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Droplets,
  Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  icon: string;
  precipitation: number;
  windSpeed: number;
  feelsLike: number;
}

interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  precipitation: number;
  windSpeed: number;
}

interface WeatherProps {
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export function Weather({ colorPalette }: WeatherProps) {
  const [weather, setWeather] = React.useState<WeatherData | null>(null);
  const [forecast, setForecast] = React.useState<ForecastDay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForecast, setShowForecast] = React.useState(false);
  const [showLocationDialog, setShowLocationDialog] = React.useState(false);
  const [locationInput, setLocationInput] = React.useState('');
  const [savingLocation, setSavingLocation] = React.useState(false);
  const [forecastView, setForecastView] = React.useState<'list' | 'graph'>('graph');
  const [showTemperature, setShowTemperature] = React.useState(true);
  const [showPrecipitation, setShowPrecipitation] = React.useState(false);
  const [showWindSpeed, setShowWindSpeed] = React.useState(false);

  const fetchWeather = React.useCallback(async () => {
    try {
      setLoading(true);
      const [weatherResponse, forecastResponse] = await Promise.all([
        fetch('/api/weather'),
        fetch('/api/weather/forecast'),
      ]);

      if (!weatherResponse.ok) {
        const errorData = await weatherResponse.json();
        throw new Error(errorData.error || 'Failed to fetch weather');
      }

      const weatherData = await weatherResponse.json();
      setWeather(weatherData);

      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        setForecast(forecastData.forecast || []);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError(err instanceof Error ? err.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchWeather();

    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const handleSetLocation = async () => {
    if (!locationInput.trim()) return;

    setSavingLocation(true);
    try {
      // First, geocode the location to get coordinates
      const geocodeResponse = await fetch(
        `/api/weather/geocode?q=${encodeURIComponent(locationInput)}`
      );

      if (!geocodeResponse.ok) {
        const errorData = await geocodeResponse.json();
        alert(errorData.error || 'Failed to find location');
        return;
      }

      const geocodeData = await geocodeResponse.json();
      const locationName = geocodeData.state
        ? `${geocodeData.name}, ${geocodeData.state}, ${geocodeData.country}`
        : `${geocodeData.name}, ${geocodeData.country}`;

      // Save location to database
      const response = await fetch('/api/weather/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: geocodeData.latitude,
          longitude: geocodeData.longitude,
          locationName: locationName,
        }),
      });

      if (response.ok) {
        setShowLocationDialog(false);
        setLocationInput('');
        fetchWeather(); // Refresh weather with new location
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save location');
      }
    } catch (err) {
      console.error('Error setting location:', err);
      alert('Failed to set location. Please try again.');
    } finally {
      setSavingLocation(false);
    }
  };

  const getWeatherIcon = (iconCode: string) => {
    const iconMap: Record<string, string> = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '☁️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌦️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️',
    };
    return iconMap[iconCode] || '🌤️';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  // Apply color palette to card if available
  const cardStyle = colorPalette
    ? {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.3)'),
      }
    : undefined;

  if (loading) {
    return (
      <div
        className="bg-card rounded-lg border p-6 h-full flex items-center justify-center transition-all duration-1000"
        style={cardStyle}
      >
        <div className="text-sm text-muted-foreground">Loading weather...</div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div
        className="bg-card rounded-lg border p-6 h-full flex items-center justify-center transition-all duration-1000"
        style={cardStyle}
      >
        <div className="text-sm text-muted-foreground">{error || 'Weather unavailable'}</div>
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-lg border p-6 h-full flex flex-col transition-all duration-1000"
      style={cardStyle}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground">Weather</h3>
            <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Settings className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Location</DialogTitle>
                  <DialogDescription>
                    Enter your city name or coordinates (lat,lon)
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                  <Input
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="e.g., New York or 40.7128,-74.0060"
                  />
                  <Button onClick={handleSetLocation} disabled={savingLocation}>
                    {savingLocation ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{weather.location}</span>
          </div>
        </div>
        <div className="text-4xl">{getWeatherIcon(weather.icon)}</div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-4">
          <div className="text-5xl font-bold text-foreground mb-1">{weather.temperature}°</div>
          <div className="text-sm text-muted-foreground capitalize">{weather.description}</div>
          <div className="text-xs text-muted-foreground mt-1">Feels like {weather.feelsLike}°</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Precipitation</div>
            <div className="text-sm font-medium text-foreground">{weather.precipitation}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Wind</div>
            <div className="text-sm font-medium text-foreground">{weather.windSpeed} km/h</div>
          </div>
        </div>

        {forecast.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={() => setShowForecast(!showForecast)}
              className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
            >
              <span>7-Day Forecast</span>
              {showForecast ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showForecast && forecast.length > 0 && (
              <div className="mt-3">
                {/* View Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-1">
                    <Button
                      variant={forecastView === 'graph' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setForecastView('graph')}
                      className="h-7 text-xs"
                    >
                      Graph
                    </Button>
                    <Button
                      variant={forecastView === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setForecastView('list')}
                      className="h-7 text-xs"
                    >
                      List
                    </Button>
                  </div>

                  {forecastView === 'graph' && (
                    <div className="flex gap-1">
                      <Button
                        variant={showTemperature ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowTemperature(!showTemperature)}
                        className="h-7 px-2"
                        title="Temperature"
                      >
                        <Thermometer className="h-3 w-3" />
                      </Button>
                      <Button
                        variant={showPrecipitation ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowPrecipitation(!showPrecipitation)}
                        className="h-7 px-2"
                        title="Precipitation"
                      >
                        <Droplets className="h-3 w-3" />
                      </Button>
                      <Button
                        variant={showWindSpeed ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowWindSpeed(!showWindSpeed)}
                        className="h-7 px-2"
                        title="Wind Speed"
                      >
                        <Wind className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {forecastView === 'graph' ? (
                  <div className="space-y-4">
                    {/* Temperature Bar Chart */}
                    {showTemperature && (
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={forecast
                              .filter(
                                (day) =>
                                  day.temperature &&
                                  day.temperature.max != null &&
                                  day.temperature.min != null
                              )
                              .map((day) => {
                                const max = Number(day.temperature.max) || 0;
                                const min = Number(day.temperature.min) || 0;
                                const avg = (max + min) / 2;
                                // Calculate color gradient: yellow (warm) to blue (cold)
                                // Assuming range from -20°C (blue) to 40°C (yellow)
                                const tempRange = 60; // 40 - (-20)
                                const normalizedTemp = (avg - -20) / tempRange; // 0 to 1
                                const clampedTemp = Math.max(0, Math.min(1, normalizedTemp));

                                // Interpolate between yellow (255, 255, 0) and blue (0, 0, 255)
                                const r = Math.round(255 * (1 - clampedTemp));
                                const g = Math.round(255 * (1 - clampedTemp));
                                const b = Math.round(255 * clampedTemp);

                                return {
                                  date: formatDate(day.date),
                                  dateKey: day.date,
                                  tempMax: max,
                                  tempMin: min,
                                  tempRange: max - min,
                                  tempAvg: avg,
                                  tempR: r,
                                  tempG: g,
                                  tempB: b,
                                  icon: day.icon,
                                  description: day.description,
                                };
                              })}
                            margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                          >
                            <defs>
                              {forecast
                                .filter(
                                  (day) =>
                                    day.temperature &&
                                    day.temperature.max != null &&
                                    day.temperature.min != null
                                )
                                .map((day, index) => {
                                  const max = Number(day.temperature.max) || 0;
                                  const min = Number(day.temperature.min) || 0;
                                  const avg = (max + min) / 2;
                                  const tempRange = 60;
                                  const normalizedTemp = (avg - -20) / tempRange;
                                  const clampedTemp = Math.max(0, Math.min(1, normalizedTemp));
                                  const r = Math.round(255 * (1 - clampedTemp));
                                  const g = Math.round(255 * (1 - clampedTemp));
                                  const b = Math.round(255 * clampedTemp);
                                  return (
                                    <linearGradient
                                      key={`tempGradient-${index}`}
                                      id={`tempGradient-${index}`}
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor={`rgb(${r}, ${g}, ${b})`}
                                        stopOpacity={1}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor={`rgb(${Math.max(0, r - 40)}, ${Math.max(
                                          0,
                                          g - 40
                                        )}, ${Math.min(255, b + 40)})`}
                                        stopOpacity={1}
                                      />
                                    </linearGradient>
                                  );
                                })}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-xs" />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              className="text-xs"
                              label={{
                                value: 'Temperature (°C)',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fontSize: 10 },
                              }}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                      <div className="text-xs font-semibold mb-1">{data.date}</div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{getWeatherIcon(data.icon)}</span>
                                        <span className="text-xs capitalize">
                                          {data.description}
                                        </span>
                                      </div>
                                      <div className="text-xs">
                                        <span className="text-muted-foreground">Range: </span>
                                        <span className="font-medium">
                                          {data.tempMax}° / {data.tempMin}°
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            {/* Base bar (min temp) - transparent */}
                            <Bar
                              dataKey="tempMin"
                              stackId="temp"
                              fill="transparent"
                              radius={[0, 0, 0, 0]}
                              barSize={40}
                            />
                            {/* Range bar (max - min) - colored with gradient */}
                            <Bar
                              dataKey="tempRange"
                              stackId="temp"
                              name="Temperature Range"
                              radius={[4, 4, 4, 4]}
                              barSize={40}
                            >
                              {forecast
                                .filter(
                                  (day) =>
                                    day.temperature &&
                                    day.temperature.max != null &&
                                    day.temperature.min != null
                                )
                                .map((_, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={`url(#tempGradient-${index})`}
                                  />
                                ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Precipitation and Wind Speed Line Chart */}
                    {(showPrecipitation || showWindSpeed) && (
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={forecast.map((day) => ({
                              date: formatDate(day.date),
                              dateKey: day.date,
                              precipitation: Number(day.precipitation) || 0,
                              windSpeed: Number(day.windSpeed) || 0,
                              icon: day.icon,
                              description: day.description,
                            }))}
                            margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-xs" />
                            <YAxis
                              yAxisId="left"
                              tick={{ fontSize: 11 }}
                              className="text-xs"
                              label={{
                                value: 'Wind Speed (km/h)',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fontSize: 10 },
                              }}
                            />
                            {showPrecipitation && (
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={[0, 100]}
                                tick={{ fontSize: 11 }}
                                className="text-xs"
                                label={{
                                  value: 'Precipitation (%)',
                                  angle: 90,
                                  position: 'insideRight',
                                  style: { fontSize: 10 },
                                }}
                              />
                            )}
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                      <div className="text-xs font-semibold mb-1">{data.date}</div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{getWeatherIcon(data.icon)}</span>
                                        <span className="text-xs capitalize">
                                          {data.description}
                                        </span>
                                      </div>
                                      {showPrecipitation && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">
                                            Precipitation:{' '}
                                          </span>
                                          <span className="font-medium">{data.precipitation}%</span>
                                        </div>
                                      )}
                                      {showWindSpeed && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">Wind: </span>
                                          <span className="font-medium">{data.windSpeed} km/h</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            {showPrecipitation && (
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="precipitation"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name="Precipitation %"
                              />
                            )}
                            {showWindSpeed && (
                              <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="windSpeed"
                                stroke="#a855f7"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name="Wind Speed (km/h)"
                              />
                            )}
                            <Legend
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                              iconType="line"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Show message if no metrics selected */}
                    {!showTemperature && !showPrecipitation && !showWindSpeed && (
                      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                        Select at least one metric to display
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {forecast.map((day) => (
                      <div
                        key={day.date}
                        className="flex items-center justify-between py-2 text-sm border-b last:border-0"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
                            {formatDate(day.date)}
                          </span>
                          <span className="text-lg flex-shrink-0">{getWeatherIcon(day.icon)}</span>
                          <span className="text-xs text-muted-foreground capitalize flex-1 truncate">
                            {day.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {day.temperature.min}°
                            </span>
                            <span className="text-sm font-medium">{day.temperature.max}°</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            💧 {day.precipitation}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            💨 {day.windSpeed} km/h
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
