import { AppError } from "../../core/errors/app-error.js";

type UserPreference = { interests: string[]; preferredActivities: string[]; travelStyle: string | null; budget: string | null };
type Place = { id: number; name: string; tags: string[]; activityTypes: string[]; travelStyleTags: string[]; priceLevel: number | null };

const CONFIGURED_WEIGHTS = {
  interests: 35,
  activities: 30,
  travelStyle: 25,
  budget: 10,
} as const;

type DimensionName = keyof typeof CONFIGURED_WEIGHTS;
type PreferenceInput = Pick<
  UserPreference,
  "interests" | "preferredActivities" | "travelStyle" | "budget"
>;
type PlaceInput = Pick<
  Place,
  | "id"
  | "name"
  | "tags"
  | "activityTypes"
  | "travelStyleTags"
  | "priceLevel"
>;
type ItemInput = { id: number; place: PlaceInput };

type DimensionDetail = {
  score: number | null;
  weightedScore: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  matched: string[];
  unmatched: string[];
  reason: string | null;
};

type RawDimension = {
  score: number | null;
  matched: string[];
  unmatched: string[];
  reason: string | null;
};

const INTEREST_ALIASES = createAliases({
  culture: [
    "culture",
    "cultural",
    "heritage",
    "history",
    "historical",
    "museum",
    "temple",
    "religious",
    "buddhist",
    "chinese heritage",
    "colonial",
    "portuguese",
    "architecture",
    "fort",
    "street art",
  ],
  food: ["food", "local food", "street food", "cuisine", "restaurant", "dining"],
  nature: [
    "nature",
    "natural",
    "park",
    "scenic",
    "river",
    "waterfront",
    "wildlife",
    "waterfall",
    "garden",
  ],
});

const ACTIVITY_ALIASES = createAliases({
  beach: ["beach", "beaches", "seaside"],
  hiking: ["hiking", "hike", "trekking", "trek"],
  nightlife: ["nightlife", "night life", "evening entertainment"],
  photography: ["photography", "photo", "photos", "photo taking"],
  relaxation: ["relaxation", "relaxing", "relax"],
  shopping: ["shopping", "shop", "market", "antiques"],
  sightseeing: ["sightseeing", "sight seeing"],
  walking: ["walking", "walk", "stroll"],
});

const STYLE_ALIASES = createAliases({
  adventure: ["adventure", "adventurous"],
  cultural: ["cultural", "culture"],
  family: ["family", "family friendly"],
  luxury: ["luxury", "luxurious"],
  relaxed: ["relaxed", "relaxation"],
});

const BUDGET_ALIASES = createAliases({
  low: ["low", "budget", "budget friendly", "economical"],
  mid: ["mid", "mid range", "medium", "moderate"],
  high: ["high", "luxury", "premium"],
});

const BUDGET_SCORES: Record<string, Record<number, number>> = {
  low: { 1: 1, 2: 0.75, 3: 0.25, 4: 0 },
  mid: { 1: 0.5, 2: 1, 3: 0.75, 4: 0.25 },
  high: { 1: 0.25, 2: 0.5, 3: 1, 4: 1 },
};

function createAliases(groups: Record<string, string[]>) {
  return new Map(
    Object.entries(groups).flatMap(([canonical, aliases]) =>
      aliases.map((alias) => [alias, canonical] as const),
    ),
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function singularize(value: string) {
  const words = value.split(" ");
  const last = words.at(-1) ?? "";
  let singular = last;

  if (last.endsWith("ies") && last.length > 3) singular = `${last.slice(0, -3)}y`;
  else if (last.endsWith("s") && !last.endsWith("ss") && last.length > 1) {
    singular = last.slice(0, -1);
  }

  words[words.length - 1] = singular;
  return words.join(" ");
}

function canonicalize(value: string, aliases: Map<string, string>) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const phraseMatch = aliases.get(normalized);
  if (phraseMatch) return phraseMatch;

  return aliases.get(singularize(normalized)) ?? null;
}

function canonicalSet(values: string[], aliases: Map<string, string>) {
  return new Set(
    values
      .map((value) => canonicalize(value, aliases))
      .filter((value): value is string => value !== null),
  );
}

function travelStyleSet(value: string | null) {
  if (!value) return new Set<string>();
  const normalized = normalizeText(value);
  const phraseMatch = canonicalize(normalized, STYLE_ALIASES);
  if (phraseMatch) return new Set([phraseMatch]);
  return canonicalSet(normalized.split(" "), STYLE_ALIASES);
}

function overlapScore(userValues: Set<string>, placeValues: Set<string>, emptyReason: string): RawDimension {
  if (placeValues.size === 0) {
    return { score: 0, matched: [], unmatched: [], reason: emptyReason };
  }

  const matched = [...placeValues].filter((value) => userValues.has(value)).sort();
  const unmatched = [...placeValues].filter((value) => !userValues.has(value)).sort();
  return {
    score: matched.length / placeValues.size,
    matched,
    unmatched,
    reason: null,
  };
}

function skippedDimension(reason: string): RawDimension {
  return { score: null, matched: [], unmatched: [], reason };
}

function roundOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function calculatePreferenceMatch(preference: PreferenceInput, items: ItemInput[]) {
  if (items.length === 0) {
    return { score: null, reason: "NO_ITEMS", breakdown: null };
  }

  const userInterests = canonicalSet(preference.interests, INTEREST_ALIASES);
  const userActivities = canonicalSet(preference.preferredActivities, ACTIVITY_ALIASES);
  const userTravelStyles = travelStyleSet(preference.travelStyle);
  const userBudget = preference.budget
    ? canonicalize(preference.budget, BUDGET_ALIASES)
    : null;

  const active: Record<DimensionName, boolean> = {
    interests: userInterests.size > 0,
    activities: userActivities.size > 0,
    travelStyle: userTravelStyles.size > 0,
    budget: userBudget !== null,
  };
  const activeWeight = (Object.keys(CONFIGURED_WEIGHTS) as DimensionName[]).reduce(
    (sum, dimension) => sum + (active[dimension] ? CONFIGURED_WEIGHTS[dimension] : 0),
    0,
  );

  if (activeWeight === 0) {
    throw new AppError(
      "No matchable preference values are set.",
      422,
      "NO_MATCHABLE_PREFERENCE",
    );
  }

  const effectiveWeights = Object.fromEntries(
    (Object.keys(CONFIGURED_WEIGHTS) as DimensionName[]).map((dimension) => [
      dimension,
      active[dimension] ? (CONFIGURED_WEIGHTS[dimension] / activeWeight) * 100 : 0,
    ]),
  ) as Record<DimensionName, number>;

  const rawPlaces = items.map((item) => {
    const interest = active.interests
      ? overlapScore(userInterests, canonicalSet(item.place.tags, INTEREST_ALIASES), "NO_MATCHABLE_TAGS")
      : skippedDimension("NO_USER_INTERESTS");
    const activity = active.activities
      ? overlapScore(userActivities, canonicalSet(item.place.activityTypes, ACTIVITY_ALIASES), "NO_ACTIVITY_DATA")
      : skippedDimension("NO_USER_ACTIVITIES");
    const style = active.travelStyle
      ? overlapScore(userTravelStyles, canonicalSet(item.place.travelStyleTags, STYLE_ALIASES), "NO_TRAVEL_STYLE_DATA")
      : skippedDimension("NO_USER_TRAVEL_STYLE");

    let budget: RawDimension;
    if (!active.budget) budget = skippedDimension("NO_USER_BUDGET");
    else if (item.place.priceLevel === null) {
      budget = { score: 0, matched: [], unmatched: [], reason: "NO_PRICE_LEVEL" };
    } else {
      const budgetScore = BUDGET_SCORES[userBudget!]?.[item.place.priceLevel];
      budget = budgetScore === undefined
        ? { score: 0, matched: [], unmatched: [], reason: "UNSUPPORTED_PRICE_LEVEL" }
        : {
            score: budgetScore,
            matched: budgetScore > 0 ? [`${userBudget}:price-level-${item.place.priceLevel}`] : [],
            unmatched: budgetScore === 0 ? [`${userBudget}:price-level-${item.place.priceLevel}`] : [],
            reason: null,
          };
    }

    const rawDimensions: Record<DimensionName, RawDimension> = {
      interests: interest,
      activities: activity,
      travelStyle: style,
      budget,
    };
    const rawScore = (Object.keys(rawDimensions) as DimensionName[]).reduce(
      (sum, dimension) =>
        sum + (rawDimensions[dimension].score ?? 0) * effectiveWeights[dimension],
      0,
    );

    return { item, rawScore, rawDimensions };
  });

  const rawItineraryScore = rawPlaces.reduce((sum, place) => sum + place.rawScore, 0) / rawPlaces.length;
  const dimensionSummary = Object.fromEntries(
    (Object.keys(CONFIGURED_WEIGHTS) as DimensionName[]).map((dimension) => {
      const rawScores = rawPlaces
        .map((place) => place.rawDimensions[dimension].score)
        .filter((score): score is number => score !== null);
      return [
        dimension,
        {
          score: rawScores.length
            ? roundOne((rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length) * 100)
            : null,
          configuredWeight: CONFIGURED_WEIGHTS[dimension],
          effectiveWeight: roundOne(effectiveWeights[dimension]),
          active: active[dimension],
          reason: active[dimension] ? null : rawPlaces[0]!.rawDimensions[dimension].reason,
        },
      ];
    }),
  );

  return {
    score: Math.round(rawItineraryScore),
    reason: null,
    breakdown: {
      aggregation: "ITEM_OCCURRENCE_AVERAGE",
      itemCount: items.length,
      weights: { ...CONFIGURED_WEIGHTS },
      dimensions: dimensionSummary,
      places: rawPlaces.map(({ item, rawScore, rawDimensions }) => ({
        itineraryItemId: item.id,
        placeId: item.place.id,
        placeName: item.place.name,
        score: roundOne(rawScore),
        dimensions: Object.fromEntries(
          (Object.keys(rawDimensions) as DimensionName[]).map((dimension) => {
            const detail = rawDimensions[dimension];
            const formatted: DimensionDetail = {
              score: detail.score === null ? null : roundOne(detail.score * 100),
              weightedScore: detail.score === null
                ? null
                : roundOne(detail.score * effectiveWeights[dimension]),
              configuredWeight: CONFIGURED_WEIGHTS[dimension],
              effectiveWeight: roundOne(effectiveWeights[dimension]),
              matched: detail.matched,
              unmatched: detail.unmatched,
              reason: detail.reason,
            };
            return [dimension, formatted];
          }),
        ),
      })),
    },
  };
}
