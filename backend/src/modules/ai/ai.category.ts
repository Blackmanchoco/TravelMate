export type RequestedCategory = "Accommodation" | "Restaurant" | "Attractions" | "Shopping";

export const SIGHTSEEING_CATEGORIES = ["Attraction", "Culture", "Historical", "Nature"] as const;

export function allowedCategoriesForIntent(category: RequestedCategory): readonly string[] {
  return category === "Attractions" ? SIGHTSEEING_CATEGORIES : [category];
}

const CATEGORY_TERMS: ReadonlyArray<{ category: RequestedCategory; english: readonly string[]; chinese: RegExp }> = [
  { category: "Accommodation", english: ["hotel", "hotels", "hostel", "hostels", "motel", "motels", "guesthouse", "guesthouses", "homestay", "homestays", "accommodation", "accommodations", "lodging", "lodgings", "resort", "resorts"], chinese: /住宿|酒店|旅馆|旅館/u },
  { category: "Restaurant", english: ["restaurant", "restaurants", "food", "dining"], chinese: /餐厅|餐廳|美食/u },
  { category: "Attractions", english: ["attraction", "attractions", "sightseeing"], chinese: /景点|景點|好玩|去哪里玩|去哪裡玩/u },
  { category: "Shopping", english: ["shopping", "shops", "shop", "mall", "malls"], chinese: /购物|購物|逛街/u },
];

const CATEGORY_STOPLIST = new Set([
  "hostile", "hotter", "restful", "report", "reports", "model", "models", "diving", "logging", "hosted", "stopping",
]);

function editDistanceWithin(left: string, right: string, maximum: number): boolean {
  if (Math.abs(left.length - right.length) > maximum) return false;
  let previousPrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let column = 1; column <= right.length; column++) {
      let distance = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]) {
        distance = Math.min(distance, (previousPrevious[column - 2] ?? 0) + 1);
      }
      current.push(distance);
    }
    previousPrevious = previous;
    previous = current;
  }
  return (previous[right.length] ?? Number.POSITIVE_INFINITY) <= maximum;
}

function matchesEnglishCategory(tokens: string[], aliases: readonly string[]): boolean {
  return tokens.some((token, index) => {
    if (CATEGORY_STOPLIST.has(token) || (token === "resort" && tokens[index + 1] === "to")) return false;
    const maximum = token.length >= 8 ? 2 : token.length >= 5 ? 1 : 0;
    return aliases.some((alias) => editDistanceWithin(token, alias, maximum)
      || (token.length >= 8 && alias.length >= 8 && editDistanceWithin(
        token.replace(/([aeiou])[aeiou]+/gu, "$1"),
        alias.replace(/([aeiou])[aeiou]+/gu, "$1"),
        maximum,
      )));
  });
}

const DESTINATIONS: ReadonlyArray<{ name: string; terms: readonly string[] }> = [
  { name: "Kuala Lumpur", terms: ["Kuala Lumpur", "吉隆坡"] },
  { name: "Kota Kinabalu", terms: ["Kota Kinabalu", "亚庇", "亞庇", "哥打基纳巴卢", "哥打基納巴盧"] },
  { name: "Penang", terms: ["Penang", "槟城", "檳城"] },
  { name: "Melaka", terms: ["Melaka", "Malacca", "马六甲", "馬六甲", "麻六甲"] },
  { name: "Kuching", terms: ["Kuching", "古晋", "古晉"] },
  { name: "Klang", terms: ["Klang", "巴生"] },
];

export function requestedCategory(message: string): RequestedCategory | "multiple" | null {
  const normalized = message.normalize("NFKC").toLocaleLowerCase("en-US");
  const tokens = normalized.match(/[a-z]+/g) ?? [];
  const foodPhrase = /\b(?:where|places)\s+to\s+eat\b/u.test(normalized);
  const sightseeingPhrase = /\b(?:things?\s+to\s+do|places?\s+to\s+visit|what\s+to\s+see)\b/u.test(normalized);
  const matches = CATEGORY_TERMS.filter(({ category, english, chinese }) =>
    chinese.test(normalized) || matchesEnglishCategory(tokens, english)
      || (category === "Restaurant" && foodPhrase)
      || (category === "Attractions" && sightseeingPhrase));
  return matches.length > 1 ? "multiple" : matches[0]?.category ?? null;
}

export function requestedDestination(message: string): string | undefined {
  return DESTINATIONS.find(({ terms }) => terms.some((term) => {
    if (Array.from(term).some((character) => character.charCodeAt(0) > 127)) return message.includes(term);
    return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message);
  }))?.name;
}

export function requestsPersonalization(message: string): boolean {
  return /\b(?:my (?:saved )?preferences?|based on my|personalized|personalised|tailored to me|for me)\b/i.test(message)
    || /我的偏好|根据.{0,8}偏好|根據.{0,8}偏好|个性化|個性化|适合我|適合我/u.test(message);
}

export function categorySpecificPersonalizationReply(chinese: boolean): string {
  return chinese
    ? "目前无法按指定类别提供个性化推荐。您可以改为查询 TravelMate 目录中的该类别地点；那不是个性化推荐。"
    : "Category-specific personalization is unavailable. You can ask for general catalogue matches in that category instead.";
}

export function multipleCategoryReply(chinese: boolean): string {
  return chinese
    ? "请分别查询不同地点类别，以便按准确的类别筛选 TravelMate 地点。"
    : "Please ask about one place category at a time so TravelMate can filter accurately.";
}

export function formatCategoryReply(input: {
  category: RequestedCategory;
  destination?: string;
  names: string[];
  totalMatches: number;
  availableCategories: string[];
  chinese: boolean;
}): string {
  const { category, destination, names, totalMatches, availableCategories, chinese } = input;
  const englishNoun = category === "Accommodation" ? "hotel" : category === "Restaurant" ? "restaurant"
    : category === "Shopping" ? "shopping place" : "attraction";
  const chineseNoun = category === "Accommodation" ? "酒店" : category === "Restaurant" ? "餐厅"
    : category === "Shopping" ? "购物地点" : "景点";
  if (names.length === 0) {
    const categories = availableCategories.length > 0
      ? chinese
        ? `当地已有类别：${availableCategories.join("、")}。`
        : ` Available categories ${destination ? "there" : "in the catalogue"}: ${availableCategories.join(", ")}.`
      : "";
    if (chinese) {
      return `${destination ?? "TravelMate"} 目前没有收录${chineseNoun}。${categories}`;
    }
    return destination
      ? `No ${englishNoun}s are currently listed in ${destination}.${categories}`
      : `No ${englishNoun}s are currently listed in the TravelMate catalogue.${categories}`;
  }

  const count = Math.max(totalMatches, names.length);
  const nameList = names.join(chinese ? "、" : ", ");
  if (chinese) {
    const lead = names.length < count ? `以下 ${names.length} 个：` : "：";
    return `TravelMate 目前在${destination ?? "目录中"}收录 ${count} ${category === "Accommodation" || category === "Restaurant" ? "家" : "个"}${chineseNoun}${names.length < count ? "。" : ""}${lead}${nameList}。这些是目录匹配结果。`;
  }
  const location = destination ? ` in ${destination}` : " in the TravelMate catalogue";
  const lead = names.length < count ? `. Showing ${names.length}: ` : ": ";
  return `TravelMate currently lists ${count} ${englishNoun}${count === 1 ? "" : "s"}${location}${lead}${nameList}. These are catalogue matches.`;
}
