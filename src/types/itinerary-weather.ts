export type ItineraryWeatherDay = {
  dayNumber: number;
  date: string | null;
  location: {
    sourcePlaceName: string;
    multipleDestinations: boolean;
  } | null;
  outdoorPlaceNames: string[];
} & (
  | { status: "no_date" | "no_coordinates" | "unavailable" | "out_of_range" }
  | {
    status: "available";
    condition: string;
    tempMinC: number;
    tempMaxC: number;
    maxPrecipitationProbability: number;
    alertLevel: "rain" | "severe" | null;
  }
);

export type ItineraryWeather = {
  provider: "OpenWeatherMap";
  days: ItineraryWeatherDay[];
};
