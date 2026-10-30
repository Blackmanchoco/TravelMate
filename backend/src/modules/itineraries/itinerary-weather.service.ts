import { env } from "../../config/env.js";
import { getItinerary } from "./itineraries.service.js";

type ItineraryItem = Awaited<ReturnType<typeof getItinerary>>["items"][number];
type ForecastPoint = {
  dt: number;
  main: { temp: number };
  pop?: number;
  weather: Array<{ id: number; description: string }>;
};
type Forecast = { city: { timezone: number }; list: ForecastPoint[] };

const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const FORECAST_TIMEOUT_MS = 8_000;
const FORECAST_CACHE_MS = 10 * 60_000;
const RAIN_PROBABILITY_THRESHOLD = 0.5;
const timeSlotOrder = { Morning: 0, Afternoon: 1, Evening: 2 } as const;
const outdoorTags = new Set([
  "outdoor", "beach", "hiking", "trail", "nature", "park", "garden",
  "forest", "waterfall", "island", "hill", "coast", "viewpoint",
]);
const forecastCache = new Map<string, { expiresAt: number; value: Forecast }>();

function hasCoordinates(item: ItineraryItem) {
  return item.place.latitude !== null && item.place.longitude !== null;
}

function isOutdoor(item: ItineraryItem) {
  return item.place.category.toLowerCase() === "nature"
    || item.place.tags.some((tag) => outdoorTags.has(tag.toLowerCase()));
}

function itineraryDate(startDate: Date, dayNumber: number) {
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
}

function localDate(point: ForecastPoint, offsetSeconds: number) {
  return new Date((point.dt + offsetSeconds) * 1_000).toISOString().slice(0, 10);
}

function localHour(point: ForecastPoint, offsetSeconds: number) {
  return new Date((point.dt + offsetSeconds) * 1_000).getUTCHours();
}

function parseForecast(value: unknown): Forecast | null {
  if (typeof value !== "object" || value === null || !("city" in value) || !("list" in value)) return null;
  const candidate = value as { city?: unknown; list?: unknown };
  if (typeof candidate.city !== "object" || candidate.city === null
    || !("timezone" in candidate.city) || typeof candidate.city.timezone !== "number"
    || !Array.isArray(candidate.list)) return null;
  const points = candidate.list.flatMap((point: unknown) => {
    if (typeof point !== "object" || point === null || !("dt" in point)
      || typeof point.dt !== "number" || !("main" in point)
      || typeof point.main !== "object" || point.main === null
      || !("temp" in point.main) || typeof point.main.temp !== "number"
      || !("weather" in point) || !Array.isArray(point.weather)) return [];
    const conditions = point.weather.filter((condition: unknown) => (
      typeof condition === "object" && condition !== null
      && "id" in condition && typeof condition.id === "number"
      && "description" in condition && typeof condition.description === "string"
    )) as ForecastPoint["weather"];
    if (conditions.length === 0) return [];
    const probability = "pop" in point && typeof point.pop === "number" ? point.pop : undefined;
    return [{ dt: point.dt, main: { temp: point.main.temp }, pop: probability, weather: conditions }];
  });
  if (points.length === 0) return null;
  return { city: { timezone: candidate.city.timezone }, list: points };
}

async function fetchForecast(latitude: number, longitude: number): Promise<Forecast | null> {
  if (!env.weatherApiKey) return null;
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(FORECAST_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", env.weatherApiKey);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS) });
    if (!response.ok) return null;
    const forecast = parseForecast(await response.json() as unknown);
    if (forecast) forecastCache.set(cacheKey, { expiresAt: Date.now() + FORECAST_CACHE_MS, value: forecast });
    return forecast;
  } catch {
    return null;
  }
}

function weatherAlert(points: ForecastPoint[]) {
  const codes = points.flatMap((point) => point.weather.map((condition) => condition.id));
  const severe = codes.some((code) => (code >= 200 && code < 300)
    || (code >= 600 && code < 800) || code >= 900);
  const rain = codes.some((code) => (code >= 300 && code < 600))
    || points.some((point) => (point.pop ?? 0) >= RAIN_PROBABILITY_THRESHOLD);
  return severe ? "severe" : rain ? "rain" : null;
}

export async function getItineraryWeather(userId: string, itineraryId: number) {
  const itinerary = await getItinerary(userId, itineraryId);
  const dayGroups = new Map<number, ItineraryItem[]>();
  for (const item of itinerary.items) {
    dayGroups.set(item.day, [...(dayGroups.get(item.day) ?? []), item]);
  }

  const days = await Promise.all([...dayGroups.entries()].sort(([a], [b]) => a - b).map(async ([dayNumber, unsorted]) => {
    const items = [...unsorted].sort((a, b) => timeSlotOrder[a.timeSlot] - timeSlotOrder[b.timeSlot]
      || a.order - b.order || a.id - b.id);
    const source = items.find(hasCoordinates);
    const outdoorPlaceNames = [...new Set(items.filter(isOutdoor).map((item) => item.place.name))];
    const location = source ? {
      sourcePlaceName: source.place.name,
      multipleDestinations: new Set(items.map((item) => item.place.destinationId)).size > 1,
    } : null;
    const date = itinerary.startDate ? itineraryDate(itinerary.startDate, dayNumber) : null;
    const base = { dayNumber, date, location, outdoorPlaceNames };
    if (!date) return { ...base, status: "no_date" as const };
    if (!source) return { ...base, status: "no_coordinates" as const };
    const forecast = await fetchForecast(Number(source.place.latitude), Number(source.place.longitude));
    if (!forecast) return { ...base, status: "unavailable" as const };
    const daytime = forecast.list.filter((point) => localDate(point, forecast.city.timezone) === date
      && localHour(point, forecast.city.timezone) >= 6
      && localHour(point, forecast.city.timezone) < 21);
    if (daytime.length === 0) return { ...base, status: "out_of_range" as const };

    const midday = [...daytime].sort((a, b) => Math.abs(localHour(a, forecast.city.timezone) - 12)
      - Math.abs(localHour(b, forecast.city.timezone) - 12))[0];
    if (!midday?.weather[0]) return { ...base, status: "out_of_range" as const };
    const alertLevel = outdoorPlaceNames.length > 0 ? weatherAlert(daytime) : null;
    return {
      ...base,
      status: "available" as const,
      condition: midday.weather[0].description,
      tempMinC: Math.round(Math.min(...daytime.map((point) => point.main.temp))),
      tempMaxC: Math.round(Math.max(...daytime.map((point) => point.main.temp))),
      maxPrecipitationProbability: Math.round(Math.max(...daytime.map((point) => point.pop ?? 0)) * 100),
      alertLevel,
    };
  }));

  return { provider: "OpenWeatherMap" as const, days };
}
