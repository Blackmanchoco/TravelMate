import { AppError } from "../../core/errors/app-error.js";
import { getDestinations } from "../destinations/destinations.service.js";
import { getPlaceById, getPlaceCategories, getPlaces, getPublicPlaceNames } from "../places/places.service.js";
import { isPublicPlace } from "../places/place-visibility.js";
import { getRecommendations } from "../recommendations/recommendations.service.js";
import { getUserPreferences } from "../users/users.service.js";
import type { AIChatHistoryMessage, AIToolUsage } from "./ai.types.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_TEXT_LENGTH = 120;
const CATEGORY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  culture: ["Culture", "Historical"], cultural: ["Culture", "Historical"],
  "文化": ["Culture", "Historical"], "文化景点": ["Culture", "Historical"],
  historical: ["Historical"], history: ["Historical"],
  "历史": ["Historical"], "历史景点": ["Historical"],
  nature: ["Nature"], "自然": ["Nature"], "自然景点": ["Nature"],
  food: ["Restaurant"], restaurant: ["Restaurant"], restaurants: ["Restaurant"],
  dining: ["Restaurant"], "餐厅": ["Restaurant"], "餐廳": ["Restaurant"], "美食": ["Restaurant"],
  hotel: ["Accommodation"], hotels: ["Accommodation"], accommodation: ["Accommodation"],
  lodging: ["Accommodation"], "住宿": ["Accommodation"], "酒店": ["Accommodation"],
  "旅馆": ["Accommodation"], "旅館": ["Accommodation"],
  shopping: ["Shopping"], shop: ["Shopping"], shops: ["Shopping"], "购物": ["Shopping"], "購物": ["Shopping"], "逛街": ["Shopping"],
  attraction: ["Attraction", "Culture", "Historical", "Nature"],
  attractions: ["Attraction", "Culture", "Historical", "Nature"],
  sightseeing: ["Attraction", "Culture", "Historical", "Nature"],
  "景点": ["Attraction", "Culture", "Historical", "Nature"],
  "景點": ["Attraction", "Culture", "Historical", "Nature"],
};
const DESTINATION_ALIASES: Readonly<Record<string, string>> = {
  "槟城": "Penang",
  "檳城": "Penang",
  "吉隆坡": "Kuala Lumpur",
  "马六甲": "Melaka",
  "馬六甲": "Melaka",
  "麻六甲": "Melaka",
  "亚庇": "Kota Kinabalu",
  "亞庇": "Kota Kinabalu",
  "哥打基纳巴卢": "Kota Kinabalu",
  "哥打基納巴盧": "Kota Kinabalu",
  "古晋": "Kuching",
  "古晉": "Kuching",
  "巴生": "Klang",
  "布城": "Putrajaya",
  "实兆远": "Sitiawan",
  "實兆遠": "Sitiawan",
};

export { searchPlacesTool, personalizedRecommendationsTool, aiToolDefinitions } from "./ai.tool-definitions.js";

export async function findMentionedPublicPlaceNames(message: string, history: AIChatHistoryMessage[], timeoutMs = 5_000): Promise<string[]> {
  const names = await withTimeout(getPublicPlaceNames(), timeoutMs, "The place-name lookup timed out.");
  const matching = (text: string) => {
    const lower = text.toLocaleLowerCase();
    return names.map((name) => ({ name, index: lower.indexOf(name.toLocaleLowerCase()) }))
      .filter(({ index }) => index >= 0)
      .sort((left, right) => left.index - right.index || right.name.length - left.name.length)
      .slice(0, 3).map(({ name }) => name);
  };
  const current = matching(message);
  if (current.length > 0) return current;
  const priorUser = [...history].reverse().find((entry) => entry.role === "user")?.content;
  return priorUser ? matching(priorUser) : [];
}

type SearchPlacesArguments = AIToolUsage["arguments"];
type PersonalizedRecommendationsArguments = Pick<
  SearchPlacesArguments,
  "destination" | "limit"
>;

type ToolExecutionResult = {
  content: string;
  usage: AIToolUsage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalText(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw new Error(`${field} must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  }
  return normalized;
}

function parseArguments(value: unknown): SearchPlacesArguments {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value) as unknown;
    } catch {
      throw new Error("Tool arguments must be valid JSON.");
    }
  }

  if (!isRecord(parsedValue)) {
    throw new Error("Tool arguments must be an object.");
  }

  const unsupportedFields = Object.keys(parsedValue).filter(
    (field) => !["destination", "search", "category", "limit"].includes(field),
  );
  if (unsupportedFields.length > 0) {
    const testCategoryRequested = typeof parsedValue.category === "string"
      && parsedValue.category.trim().toLocaleLowerCase() === "test";
    throw new Error(
      testCategoryRequested
        ? "The Test category is not available to the assistant."
        : `Unsupported tool argument: ${unsupportedFields[0]}.`,
    );
  }

  const destination = optionalText(parsedValue.destination, "destination");
  const search = optionalText(parsedValue.search, "search");
  const category = optionalText(parsedValue.category, "category");
  if (category?.toLocaleLowerCase() === "test") {
    throw new Error("The Test category is not available to the assistant.");
  }
  if (category && !CATEGORY_ALIASES[category.toLocaleLowerCase()]) {
    throw new Error("Unsupported place category.");
  }
  const categories = category ? CATEGORY_ALIASES[category.toLocaleLowerCase()] : undefined;
  let limit = DEFAULT_LIMIT;
  if (parsedValue.limit !== undefined) {
    if (!Number.isInteger(parsedValue.limit)
      || Number(parsedValue.limit) < 1
      || Number(parsedValue.limit) > MAX_LIMIT) {
      throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
    }
    limit = Number(parsedValue.limit);
  }

  return {
    ...(destination ? { destination } : {}),
    ...(search ? { search } : {}),
    ...(categories ? { category: categories.length === 1 ? categories[0] : category } : {}),
    limit,
  };
}

function parsePersonalizedArguments(
  value: unknown,
): PersonalizedRecommendationsArguments {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value) as unknown;
    } catch {
      throw new Error("Tool arguments must be valid JSON.");
    }
  }

  if (!isRecord(parsedValue)) {
    throw new Error("Tool arguments must be an object.");
  }

  const unsupportedFields = Object.keys(parsedValue).filter(
    (field) => !["destination", "limit"].includes(field),
  );
  if (unsupportedFields.length > 0) {
    throw new Error(`Unsupported tool argument: ${unsupportedFields[0]}.`);
  }

  const destination = optionalText(parsedValue.destination, "destination");
  let limit = DEFAULT_LIMIT;
  if (parsedValue.limit !== undefined) {
    if (!Number.isInteger(parsedValue.limit)
      || Number(parsedValue.limit) < 1
      || Number(parsedValue.limit) > MAX_LIMIT) {
      throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
    }
    limit = Number(parsedValue.limit);
  }

  return {
    ...(destination ? { destination } : {}),
    limit,
  };
}

async function resolveDestination(destination: string) {
  const canonicalDestination = DESTINATION_ALIASES[destination.trim()] ?? destination;
  const normalized = canonicalDestination.toLocaleLowerCase();
  const bySearch = await getDestinations({
    search: canonicalDestination,
    page: 1,
    limit: 100,
  });

  const exactSearchMatch = bySearch.items.find((item) => (
    item.name.toLocaleLowerCase() === normalized
    || item.city.toLocaleLowerCase() === normalized
    || item.state.toLocaleLowerCase() === normalized
  ));

  if (exactSearchMatch) return exactSearchMatch;
  if (bySearch.items.length === 1) return bySearch.items[0];

  const byCity = await getDestinations({
    city: canonicalDestination,
    page: 1,
    limit: 100,
  });

  return byCity.items.length === 1 ? byCity.items[0] : null;
}

function categorySearchIntent(args: SearchPlacesArguments) {
  const search = args.search?.trim();
  const destinationNames = [
    ...Object.keys(DESTINATION_ALIASES),
    "Kuala Lumpur", "Penang", "Melaka", "Kota Kinabalu", "Kuching", "Klang",
  ].sort((a, b) => b.length - a.length);
  const prefix = !args.destination && search
    ? destinationNames.find((name) => search.toLocaleLowerCase() === name.toLocaleLowerCase()
      || search.toLocaleLowerCase().startsWith(`${name.toLocaleLowerCase()} `))
    : undefined;
  const remaining = prefix ? search?.slice(prefix.length).trim() : search;
  const inferredCategory = remaining && CATEGORY_ALIASES[remaining.toLocaleLowerCase()]
    ? remaining : undefined;
  const category = args.category ?? inferredCategory;
  const categories = category ? CATEGORY_ALIASES[category.toLocaleLowerCase()] : undefined;
  return {
    destination: args.destination ?? prefix,
    search: (inferredCategory && (!args.category
      || CATEGORY_ALIASES[inferredCategory.toLocaleLowerCase()]?.includes(args.category)))
      || (prefix && !remaining) ? undefined : search,
    categories,
  };
}

async function runSearchPlaces(args: SearchPlacesArguments) {
  const intent = categorySearchIntent(args);
  const destination = intent.destination
    ? await resolveDestination(intent.destination)
    : null;

  if (intent.destination && !destination) {
    return {
      ok: true,
      query: args,
      destination: null,
      items: [],
      note: "No TravelMate destination matched the request.",
    };
  }

  const query = {
    ...(destination ? { destinationId: destination.id } : {}),
    ...(intent.search ? { search: intent.search } : {}),
    page: 1,
    limit: args.limit,
  };
  const categoryResults = intent.categories
    ? await Promise.all(intent.categories.map((category) => getPlaces({ ...query, category })))
    : null;
  const nameResult = categoryResults ? null : await getPlaces(query);
  const useDescriptionFallback = Boolean(intent.search) && nameResult?.pagination.total === 0;
  const result = categoryResults
    ? {
        items: categoryResults.flatMap((part) => part.items)
          .sort((a, b) => (b.rating === null ? Infinity : Number(b.rating))
            - (a.rating === null ? Infinity : Number(a.rating)) || a.name.localeCompare(b.name))
          .slice(0, args.limit),
        pagination: { total: categoryResults.reduce((sum, part) => sum + part.pagination.total, 0) },
      }
    : useDescriptionFallback
      ? await getPlaces({ ...query, searchField: "description" })
      : nameResult!;

  if (intent.categories && result.items.some((place) =>
    !intent.categories!.some((category) => place.category.toLocaleLowerCase() === category.toLocaleLowerCase()))) {
    throw new Error("Place search returned a place outside the requested category.");
  }
  const availableCategories = intent.categories && result.items.length === 0
    ? await getPlaceCategories(destination?.id)
    : undefined;

  return {
    ok: true,
    evidencePolicy:
      "Use only the returned fields. A missing attribute is unknown and is not evidence that the attribute is false.",
    query: args,
    searchMatchSource: categoryResults ? "category"
      : intent.search ? useDescriptionFallback ? "description" : "name" : "unfiltered",
    destination: destination
      ? {
          id: destination.id,
          name: destination.name,
          city: destination.city,
          state: destination.state,
        }
      : null,
    items: result.items.map((place) => ({
      placeId: place.id,
      name: place.name,
      destinationId: place.destinationId,
      category: place.category,
      description: place.description,
      address: place.address,
      latitude: place.latitude === null ? null : Number(place.latitude),
      longitude: place.longitude === null ? null : Number(place.longitude),
      rating: place.rating === null ? null : Number(place.rating),
      priceLevel: place.priceLevel,
    })),
    resultCount: result.items.length,
    totalMatches: result.pagination.total,
    ...(availableCategories ? { availableCategories } : {}),
  };
}

async function runPersonalizedRecommendations(
  args: PersonalizedRecommendationsArguments,
  userId: string,
) {
  const preferences = await getUserPreferences(userId);
  if (!preferences) {
    throw new AppError(
      "No user preference data is set.",
      422,
      "NO_PREFERENCE_SET",
    );
  }

  const destination = args.destination
    ? await resolveDestination(args.destination)
    : null;

  if (args.destination && !destination) {
    return {
      ok: true,
      evidencePolicy:
        "Use only the returned fields. A missing attribute is unknown and is not evidence that the attribute is false.",
      query: args,
      destination: null,
      meta: null,
      items: [],
      resultCount: 0,
      note: `No TravelMate destination matched "${args.destination}".`,
    };
  }

  const recommendations = await getRecommendations({
    userId,
    destinationId: destination?.id ?? null,
    limit: args.limit,
  });
  const enriched = await Promise.all(
    recommendations.items.map(async (recommendation) => ({
      recommendation,
      place: await getPlaceById(recommendation.placeId),
    })),
  );

  const items = enriched.flatMap(({ recommendation, place }) => {
    if (!place || !isPublicPlace(place)) {
      return [];
    }

    return [{
      rank: recommendation.rank,
      placeId: recommendation.placeId,
      name: place.name,
      destinationId: recommendation.destinationId,
      destinationName: recommendation.destinationName,
      category: place.category,
      activityTypes: place.activityTypes,
      tags: place.tags,
      description: place.description,
      address: place.address,
      latitude: place.latitude === null ? null : Number(place.latitude),
      longitude: place.longitude === null ? null : Number(place.longitude),
      rating: recommendation.rating,
      priceLevel: recommendation.priceLevel,
      mlRankScore: recommendation.mlRankScore,
      finalScore: recommendation.finalScore,
      reasons: recommendation.reason,
    }];
  });

  return {
    ok: true,
    evidencePolicy:
      "Present rank, scores, reasons, and place facts exactly from this result. A missing attribute is unknown.",
    query: args,
    destination: destination
      ? {
          id: destination.id,
          name: destination.name,
          city: destination.city,
          state: destination.state,
        }
      : null,
    meta: recommendations.meta,
    items,
    resultCount: items.length,
  };
}

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(timeoutMessage)),
      timeoutMs,
    );

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export async function executeSearchPlacesTool(
  rawArguments: unknown,
  timeoutMs: number,
): Promise<ToolExecutionResult> {
  const startedAt = performance.now();
  let args: SearchPlacesArguments = { limit: DEFAULT_LIMIT };

  try {
    args = parseArguments(rawArguments);
    const result = await withTimeout(
      runSearchPlaces(args),
      timeoutMs,
      "The place search tool timed out.",
    );
    const resultCount = result.items.length;

    return {
      content: JSON.stringify(result),
      usage: {
        name: "search_places",
        arguments: args,
        status: "success",
        resultCount,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "The place search tool failed.";

    return {
      content: JSON.stringify({
        ok: false,
        error: {
          code: "PLACE_SEARCH_FAILED",
          message,
        },
      }),
      usage: {
        name: "search_places",
        arguments: args,
        status: "error",
        resultCount: 0,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
    };
  }
}

export async function executePersonalizedRecommendationsTool(
  rawArguments: unknown,
  userId: string,
  timeoutMs: number,
): Promise<ToolExecutionResult> {
  const startedAt = performance.now();
  let args: PersonalizedRecommendationsArguments = { limit: DEFAULT_LIMIT };

  try {
    args = parsePersonalizedArguments(rawArguments);
    const result = await withTimeout(
      runPersonalizedRecommendations(args, userId),
      timeoutMs,
      "The personalized recommendation tool timed out.",
    );

    return {
      content: JSON.stringify(result),
      usage: {
        name: "get_personalized_recommendations",
        arguments: args,
        status: "success",
        resultCount: result.items.length,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
    };
  } catch (error) {
    const noPreference = error instanceof AppError
      && error.code === "NO_PREFERENCE_SET";
    const errorCode = noPreference
      ? "NO_PREFERENCE_SET"
      : "PERSONALIZED_RECOMMENDATIONS_FAILED";
    const message = noPreference
      ? "No user preference data is set. Do not silently substitute general recommendations. Tell the user that personalized recommendations are unavailable and that they can ask for highly rated places as a non-personalized alternative."
      : error instanceof Error
        ? error.message
        : "The personalized recommendation tool failed.";

    return {
      content: JSON.stringify({
        ok: false,
        error: {
          code: errorCode,
          message,
        },
      }),
      usage: {
        name: "get_personalized_recommendations",
        arguments: args,
        status: "error",
        resultCount: 0,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        errorCode,
      },
    };
  }
}
