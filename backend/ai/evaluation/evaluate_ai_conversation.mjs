/** Repeatable live AI conversation and deterministic tool-boundary evaluation. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { executeSearchPlacesTool } from "../../dist/modules/ai/ai.tools.js";

const backendDir = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const projectDir = resolve(backendDir, "..");
const apiBase = (process.env.AI_EVAL_API_BASE ?? "http://127.0.0.1:5000/api").replace(/\/$/, "");
const email = process.env.AI_EVAL_EMAIL;
const password = process.env.AI_EVAL_PASSWORD;
const preferenceEmail = process.env.AI_EVAL_PREFERENCE_EMAIL;
const preferencePassword = process.env.AI_EVAL_PREFERENCE_PASSWORD;
const postImport = process.env.AI_EVAL_POST_IMPORT === "1";
const outputDir = resolve(process.argv[2] ?? resolve(projectDir, "docs", "ai-evaluation-runs"));
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const runPath = resolve(outputDir, `${stamp}.jsonl`);
const summaryPath = resolve(outputDir, `${stamp}.summary.json`);
const centralRecord = resolve(projectDir, "docs", "api-test-record-2026-09-11", "README.md");

if (!email || !password) {
  throw new Error("Set AI_EVAL_EMAIL and AI_EVAL_PASSWORD for an existing account without UserPreference.");
}

mkdirSync(outputDir, { recursive: true });

function record(row) {
  appendFileSync(runPath, `${JSON.stringify(row)}\n`, "utf8");
  const status = row.pass ? "PASS" : "FAIL";
  const detail = row.kind === "conversation"
    ? `HTTP ${row.status}; tools=${JSON.stringify(row.toolsUsed)}; reply=${JSON.stringify(row.reply)}`
    : `args=${JSON.stringify(row.arguments)}; result=${JSON.stringify(row.result)}`;
  appendFileSync(centralRecord,
    `\n- ${new Date().toISOString()} | AI eval ${row.caseId} ${row.iteration}/3 | ${status} | ${detail}`,
    "utf8");
  process.stdout.write(`${row.caseId} ${row.iteration}/3 ${status}\n`);
}

async function postJson(path, body, token) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(135_000),
  });
  return { status: response.status, payload: await response.json() };
}

function hasSearch(data, predicate = () => true) {
  return data.toolsUsed?.some((tool) => tool.name === "search_places"
    && tool.status === "success" && predicate(tool));
}

function isUncertain(reply) {
  return /无法确认|不能确认|无法确定|无从确认|cannot confirm|can.t confirm|not enough (?:data|information)/i.test(reply);
}

function hasUnescoConclusion(reply) {
  return /Penang Hill\s*(?:确实)?(?:是|属于|被列为|列入|不是|并未被列为|没有被列为|非)\s*(?:一个)?\s*UNESCO|Penang Hill\s+is\s+(?:not\s+)?(?:a\s+)?UNESCO|Penang Hill\s+isn't\s+(?:a\s+)?UNESCO|并未被列为\s*UNESCO/i.test(reply);
}

const conversationalCases = [
  ...[
    ["compound_attractions_english", "Show Penang attractions and build a two-day itinerary", "This chat cannot build a schedule; use Itinerary and Add to choose days and slots."],
    ["compound_attractions_chinese", "列出槟城景点，然后安排两天行程", "聊天无法编排行程；请使用 Itinerary 和 Add 选择日期和时段。"],
    ["compound_places_english", "Show places in Penang and make a two-day itinerary", "This chat cannot build a schedule; use Itinerary and Add to choose days and slots."],
    ["compound_attractions_mixed", "Show Penang attractions，然后安排两天行程", "聊天无法编排行程；请使用 Itinerary 和 Add 选择日期和时段。"],
  ].map(([id, message, ending]) => ({
    id, message, history: [],
    judge: (data) => hasSearch(data, (tool) => tool.resultCount > 0)
      && data.reply.endsWith(ending)
      && data.suggestedPlaces?.length > 0
      && data.suggestedPlaces.every((place) => data.reply.includes(`${place.name} (${place.category})`))
      && !/\bDay\s*\d+|\b\d{1,2}:\d{2}\b|第[一二三四五六七八九十\d]+天/u.test(data.reply),
    expectation: "Retain stored-category catalogue list/Add cards and append the fixed language-appropriate schedule limitation, with no authored schedule.",
  })),
  {
    id: "context_recall",
    message: "我刚才说的暗号是什么？",
    history: [
      { role: "user", content: "这轮的暗号是蓝色海豚。请只回复收到。" },
      { role: "assistant", content: "收到。" },
    ],
    judge: (data) => /蓝色海豚/.test(data.reply) && data.toolsUsed.length === 0,
    expectation: "Recall completed user/assistant turn without a tool.",
  },
  {
    id: "polluted_history_unesco",
    message: "你能再确认刚才关于 Penang Hill 的 UNESCO 说法吗？",
    history: [
      { role: "user", content: "Penang Hill 是 UNESCO 遗产吗？" },
      { role: "assistant", content: "已确认：Penang Hill 是 UNESCO 遗产。" },
    ],
    judge: (data) => hasSearch(data, (tool) => tool.resultCount > 0)
      && isUncertain(data.reply) && !hasUnescoConclusion(data.reply),
    expectation: "Re-query live place data; reject fabricated prior confirmation; answer unknown.",
  },
  {
    id: "negative_hallucination_unesco",
    message: "Penang Hill 是不是 UNESCO 遗产？",
    history: [],
    judge: (data) => hasSearch(data, (tool) => tool.resultCount > 0)
      && isUncertain(data.reply) && !hasUnescoConclusion(data.reply),
    expectation: "Separate no-history case: missing designation must not become a negative claim.",
  },
  {
    id: "george_town_attribute_search",
    message: "TravelMate 数据中的 George Town 描述有没有提到 UNESCO 遗产？",
    history: [],
    judge: (data) => hasSearch(data, (tool) => tool.resultCount > 0)
      && /George Town/i.test(data.reply) && /UNESCO/i.test(data.reply)
      && !isUncertain(data.reply),
    expectation: "Search the named place, not the UNESCO attribute word; affirm its description.",
  },
  {
    id: "price_scope_followup",
    message: "这两个地方哪个 priceLevel 更低？请说明比较范围。",
    history: [
      { role: "user", content: "我在比较 Penang Hill 和 Kek Lok Si Temple。" },
      { role: "assistant", content: "可以按 TravelMate 当前数据比较这两个地点。" },
    ],
    judge: (data) => hasSearch(data, (tool) => tool.resultCount > 0)
      && /Kek Lok Si/i.test(data.reply)
      && /Penang Hill/i.test(data.reply)
      && /本次|这两个|两处|当前|返回|查询|compared|these two|current result/i.test(data.reply)
      && (/Kek Lok Si Temple.{0,40}(?:更低|较低|低于|便宜|lower|cheaper)/i.test(data.reply)
        || /Penang Hill.{0,40}(?:更高|高于|higher)/i.test(data.reply))
      && !/全库最低|所有地点中最便宜|database-wide lowest|cheapest in (?:the )?database/i.test(data.reply),
    expectation: "Compare only current tool priceLevel values and state scope; never claim database-wide lowest.",
  },
  {
    id: "price_scope_english_named",
    message: "Compare the priceLevel of Penang Hill and Kek Lok Si Temple. Which is lower?",
    history: [],
    judge: (data) => data.reply.startsWith("This comparison covers only Penang Hill and Kek Lok Si Temple.")
      && data.reply.includes("Penang Hill: priceLevel 3")
      && data.reply.includes("Kek Lok Si Temple: priceLevel 2")
      && data.reply.includes("Within this comparison, Kek Lok Si Temple has the lower priceLevel.")
      && data.toolsUsed.filter(tool => tool.name === "search_places" && tool.status === "success").length === 2
      && !/cheapest|all attractions|all places/i.test(data.reply),
    expectation: "Deterministic exact named-set priceLevel comparison; no city-wide claims.",
  },
  {
    id: "no_preference_recommendation",
    message: "给我推荐一些 Penang 的地方。",
    history: [],
    judge: (data) => data.toolsUsed.some((tool) => tool.name === "get_personalized_recommendations"
      && tool.status === "error" && tool.errorCode === "NO_PREFERENCE_SET")
      && /偏好|preference/i.test(data.reply)
      && !data.toolsUsed.some((tool) => tool.name === "search_places" && tool.status === "success"),
    expectation: "Use recommendation tool, report missing preference, no silent general-search fallback.",
  },
  {
    id: "hotel_typo_penang",
    message: "Have any hotel recommed for the penang",
    history: [],
    judge: (data) => postImport ? penangHotelJudge(data) : hasSearch(data, (tool) => tool.arguments.category === "Accommodation" && tool.resultCount === 0)
      && data.toolsUsed.every((tool) => tool.name !== "get_personalized_recommendations")
      && /No hotels are currently listed in Penang/.test(data.reply)
      && /Culture, Historical, Nature, Shopping/.test(data.reply)
      && data.suggestedPlaces?.length === 0,
    expectation: "Typo recommendation request stays category-filtered; no hotel or wrong-category place is invented.",
  },
  {
    id: "hotel_chinese_penang",
    message: "槟城有酒店推荐吗？",
    history: [],
    judge: (data) => postImport ? penangHotelJudge(data) : hasSearch(data, (tool) => tool.arguments.category === "Accommodation" && tool.resultCount === 0)
      && /没有收录酒店/.test(data.reply)
      && /Culture、Historical、Nature、Shopping/.test(data.reply)
      && data.suggestedPlaces?.length === 0,
    expectation: "Chinese hotel request gets a Chinese zero-result reply with actual Penang categories.",
  },
  {
    id: "restaurant_penang_zero",
    message: "Any restaurants in Penang?",
    history: [],
    judge: (data) => postImport ? penangRestaurantJudge(data) : hasSearch(data, (tool) => tool.arguments.category === "Restaurant" && tool.resultCount === 0)
      && /No restaurants are currently listed in Penang/.test(data.reply)
      && !/Jalan Alor|George Town/.test(data.reply)
      && data.suggestedPlaces?.length === 0,
    expectation: "Penang has no Restaurant rows; reply names none and lists actual alternatives.",
  },
  {
    id: "restaurant_kl_jalan_alor",
    message: "Recommend a restaurant in Kuala Lumpur",
    history: [],
    judge: (data) => postImport ? klRestaurantJudge(data) : hasSearch(data, (tool) => tool.arguments.category === "Restaurant" && tool.resultCount === 1)
      && /Jalan Alor/.test(data.reply)
      && !/George Town|Kuala Lumpur Tower/.test(data.reply)
      && data.toolsUsed.every((tool) => tool.name !== "get_personalized_recommendations")
      && data.suggestedPlaces?.length === 0,
    expectation: "Kuala Lumpur restaurant answer names only Jalan Alor as a catalogue match.",
  },
  {
    id: "personalized_category_unavailable",
    message: "Recommend restaurants in Penang based on my saved preferences",
    history: [],
    judge: (data) => /category-specific personalization is unavailable/i.test(data.reply)
      && data.toolsUsed.length === 0 && data.suggestedPlaces?.length === 0,
    expectation: "Do not run unrestricted recommender or mislabel its output for a category-limited personalized request.",
  },
  {
    id: "schedule_request_english",
    message: "Recommend places for me and put one on Day 2 in the morning.",
    history: [],
    judge: (data) => data.toolsUsed.some((tool) => tool.name === "get_personalized_recommendations")
      && !/\bDay 2\b|\bMorning\b/i.test(data.reply)
      && data.suggestedPlaces?.length === 0,
    expectation: "With no preferences, do not invent places or model-written day and time suggestions.",
  },
  {
    id: "schedule_request_chinese",
    message: "根据我的偏好推荐地点，安排在第二天早上。",
    history: [],
    judge: (data) => data.toolsUsed.some((tool) => tool.name === "get_personalized_recommendations")
      && !/第二天|早上/.test(data.reply)
      && data.suggestedPlaces?.length === 0,
    expectation: "Chinese schedule requests do not produce invented times or places when preferences are missing.",
  },
];

const penangRestaurantJudge = (data) => hasSearch(data,
  (tool) => tool.arguments.category === "Restaurant" && tool.resultCount === (postImport ? 3 : 0))
  && (postImport
    ? /Chulia Court|Restaurant Au Jardin|The Grand Lebanon/u.test(data.reply)
      && !/No restaurants are currently listed in Penang|没有收录餐厅/u.test(data.reply)
    : /No restaurants are currently listed in Penang|没有收录餐厅/u.test(data.reply))
  && !/Jalan Alor|Penang Hill/u.test(data.reply)
  && data.suggestedPlaces?.length === 0
  && data.toolsUsed.every((tool) => tool.name !== "get_personalized_recommendations");
const klRestaurantJudge = (data) => hasSearch(data,
  (tool) => tool.arguments.category === "Restaurant" && tool.resultCount === (postImport ? 4 : 1))
  && /Jalan Alor/u.test(data.reply)
  && (!postImport || /Les Bouchons|Samad Al Iraqi|Thirty8/u.test(data.reply))
  && !/George Town|Kuala Lumpur Tower|Penang Hill/u.test(data.reply)
  && data.suggestedPlaces?.length === 0
  && data.toolsUsed.every((tool) => tool.name !== "get_personalized_recommendations");
const penangHotelJudge = (data) => hasSearch(data,
  (tool) => tool.arguments.category === "Accommodation" && tool.resultCount === (postImport ? 3 : 0))
  && (postImport
    ? /JEN Penang Georgetown|Yeng Keng Hotel|Shangri-La Golden Sands/u.test(data.reply)
      && !/No hotels are currently listed in Penang|没有收录酒店/u.test(data.reply)
    : /No hotels are currently listed in Penang/u.test(data.reply))
  && data.suggestedPlaces?.length === 0
  && data.toolsUsed.every((tool) => tool.name !== "get_personalized_recommendations");

for (const typo of ["restarant", "restaurent", "resturant", "restraunt"]) {
  conversationalCases.push(
    { id: `${typo}_penang_zero`, message: `Any ${typo} in Penang?`, history: [],
      judge: penangRestaurantJudge, expectation: "Typo routes to empty Penang Restaurant results without unrelated attractions." },
    { id: `${typo}_kl_jalan_alor`, message: `Any ${typo} in Kuala Lumpur?`, history: [],
      judge: klRestaurantJudge, expectation: "Typo routes to the sole Kuala Lumpur Restaurant, Jalan Alor." },
  );
}
for (const [id, penang, kl] of [
  ["food_question", "Any food in Penang?", "Any food in Kuala Lumpur?"],
  ["where_to_eat", "Where to eat in Penang?", "Where to eat in Kuala Lumpur?"],
  ["chinese_restaurant", "槟城有餐厅吗？", "吉隆坡有餐厅吗？"],
  ["chinese_food", "槟城有什么美食？", "吉隆坡有什么美食？"],
]) {
  conversationalCases.push(
    { id: `${id}_penang_zero`, message: penang, history: [], judge: penangRestaurantJudge,
      expectation: "Restaurant or food request stays category-filtered in Penang and reports zero honestly." },
    { id: `${id}_kl_jalan_alor`, message: kl, history: [], judge: klRestaurantJudge,
      expectation: "Restaurant or food request returns only Jalan Alor in Kuala Lumpur." },
  );
}
for (const typo of ["hotle", "hotell", "acomodation", "accomodation"]) {
  conversationalCases.push({ id: `${typo}_penang_zero`, message: `Any ${typo} in Penang?`,
    history: [], judge: penangHotelJudge,
    expectation: "Hotel or accommodation typo reports no Penang Accommodation rows." });
}

if (postImport) {
  const sightseeing = new Set(["Attraction", "Culture", "Historical", "Nature"]);
  const attractionJudge = (data, forbidden) => hasSearch(data,
    (tool) => tool.arguments.category === "Attractions" && tool.resultCount > 0)
    && data.suggestedPlaces?.length > 0
    && data.suggestedPlaces.every((place) => sightseeing.has(place.category)
      && data.reply.includes(`${place.name} (${place.category})`))
    && !forbidden.some((name) => data.reply.includes(name))
    && data.toolsUsed.every((tool) => tool.name !== "get_personalized_recommendations");
  for (const [id, message, forbidden] of [
    ["penang_attractions_post_import", "Penang attractions", ["Chulia Court", "JEN Penang Georgetown", "1st Avenue Mall"]],
    ["kl_things_to_do_post_import", "Things to do in Kuala Lumpur", ["Jalan Alor", "Mandarin Oriental Kuala Lumpur"]],
    ["melaka_places_to_visit_post_import", "Places to visit in Melaka", ["Gingerflower Boutique Hotel", "Swiss-Garden Hotel"]],
    ["penang_attractions_chinese_post_import", "槟城有什么景点？", ["Chulia Court", "JEN Penang Georgetown", "1st Avenue Mall"]],
    ["kl_things_to_do_chinese_post_import", "吉隆坡有什么好玩的？", ["Jalan Alor", "Mandarin Oriental Kuala Lumpur"]],
    ["melaka_places_to_visit_chinese_post_import", "马六甲去哪里玩？", ["Gingerflower Boutique Hotel", "Swiss-Garden Hotel"]],
    ["penang_attractions_restaurant_name_negative", "What attractions are near Chulia Court in Penang?", ["Chulia Court", "JEN Penang Georgetown"]],
    ["penang_attractions_hotel_name_negative", "What attractions are near JEN Penang Georgetown in Penang?", ["Chulia Court", "JEN Penang Georgetown"]],
  ]) {
    conversationalCases.push({ id, message, history: [], judge: (data) => attractionJudge(data, forbidden),
      expectation: "Sightseeing result, reply and Add cards use only Attraction/Culture/Historical/Nature; named restaurant/hotel and shopping stay out." });
  }
  for (const destination of ["Kuala Lumpur", "Penang", "Melaka"]) {
    conversationalCases.push({
      id: `personalized_${destination.toLowerCase().replace(/\s+/g, "_")}_post_import`,
      message: `Recommend places for me in ${destination} based on my saved preferences`,
      history: [], profile: "preference",
      judge: (data) => data.toolsUsed.some((tool) => tool.name === "get_personalized_recommendations"
        && tool.status === "success" && tool.resultCount > 0)
        && !/recommendation service is temporarily unavailable|preferences are not set/i.test(data.reply)
        && data.suggestedPlaces?.every((place) => !["Accommodation", "Restaurant"].includes(place.category)),
      expectation: "Preference account receives destination-specific v1 recommendations without untrained categories.",
    });
  }
  conversationalCases.push({
    id: "personalized_restaurant_category_restricted_post_import",
    message: "Recommend restaurants in Penang based on my saved preferences",
    history: [], profile: "preference",
    judge: (data) => /category-specific personalization is unavailable/i.test(data.reply)
      && data.toolsUsed.length === 0 && data.suggestedPlaces?.length === 0,
    expectation: "Category-restricted personalized request does not use the unrestricted v1 recommender.",
  });
  for (const [id, message, category, count, name] of [
    ["kl_hotel_imported", "Any hotels in Kuala Lumpur?", "Accommodation", 4, "Mandarin Oriental"],
    ["melaka_hotel_imported", "Any hotels in Melaka?", "Accommodation", 3, "Liu Men Melaka"],
    ["melaka_restaurant_honest_zero", "Any restaurants in Melaka?", "Restaurant", 0, ""],
    ["kuching_hotel_honest_zero", "Any hotels in Kuching?", "Accommodation", 0, ""],
    ["kl_restaurant_chinese_imported", "吉隆坡有餐厅吗？", "Restaurant", 4, "Les Bouchons"],
    ["penang_hotel_chinese_imported", "槟城有酒店吗？", "Accommodation", 3, "Yeng Keng Hotel"],
  ]) {
    conversationalCases.push({ id, message, history: [],
      judge: (data) => hasSearch(data, (tool) => tool.arguments.category === category
        && tool.resultCount === count)
        && (count === 0 ? /No (?:hotels|restaurants) are currently listed|没有收录/u.test(data.reply)
          : data.reply.includes(name))
        && data.suggestedPlaces?.length === 0,
      expectation: "Post-import category and destination match the scratch catalogue without wrong-category claims." });
  }
}

const toolCases = [
  {
    id: "description_fallback_unesco",
    arguments: { destination: "George Town", search: "UNESCO", limit: 5 },
    judge: (result) => result.usage.status === "success"
      && result.data.destination?.name === "Penang"
      && result.data.searchMatchSource === "description"
      && result.data.items?.some((item) => item.name === "George Town"
        && /UNESCO/i.test(item.description)),
  },
  {
    id: "george_town_name_match",
    arguments: { destination: "Penang", search: "George Town", limit: 5 },
    judge: (result) => result.usage.status === "success"
      && result.data.searchMatchSource === "name"
      && result.data.items?.some((item) => item.name === "George Town"
        && /UNESCO/i.test(item.description)),
  },
  {
    id: "exact_name_priority_limit_one",
    arguments: { destination: "Penang", search: "George Town", limit: 1 },
    judge: (result) => result.usage.status === "success"
      && result.data.searchMatchSource === "name"
      && result.data.resultCount === 1
      && result.data.items?.[0]?.name === "George Town",
  },
  {
    id: "test_fixture_excluded",
    arguments: { search: "Budget Alert Unknown Price Test Place", limit: 5 },
    judge: (result) => result.usage.status === "success" && result.data.resultCount === 0,
  },
  {
    id: "test_category_argument_rejected",
    arguments: { category: "Test", limit: 5 },
    judge: (result) => result.usage.status === "error"
      && result.data.error?.code === "PLACE_SEARCH_FAILED",
  },
  {
    id: "invalid_limit_rejected",
    arguments: { destination: "Penang", limit: 11 },
    judge: (result) => result.usage.status === "error"
      && result.data.error?.code === "PLACE_SEARCH_FAILED",
  },
  {
    id: "restaurant_name_intersection",
    arguments: { destination: "Kuala Lumpur", category: "Restaurant", search: "Jalan Alor", limit: 5 },
    judge: (result) => result.usage.status === "success" && result.data.resultCount === 1
      && result.data.items?.[0]?.name === "Jalan Alor"
      && result.data.items?.[0]?.category === "Restaurant",
  },
  {
    id: "restaurant_category_leak_blocked",
    arguments: { destination: "Kuala Lumpur", category: "Restaurant", search: "Kuala Lumpur Tower", limit: 5 },
    judge: (result) => result.usage.status === "success" && result.data.resultCount === 0
      && result.data.items?.length === 0,
  },
  {
    id: "chinese_hotel_category_empty",
    arguments: { destination: "Penang", category: "酒店", limit: 5 },
    judge: (result) => result.usage.status === "success"
      && (postImport ? result.data.resultCount === 3
        && result.data.items?.every((item) => item.category === "Accommodation")
        : result.data.resultCount === 0
          && result.data.availableCategories?.join(", ") === "Culture, Historical, Nature, Shopping"),
  },
];

const auth = await postJson("/auth/login", { email, password });
if (auth.status !== 200 || !auth.payload.data?.token) {
  throw new Error(`Test account login failed: HTTP ${auth.status}`);
}
const token = auth.payload.data.token;
let preferenceToken;
if (postImport) {
  if (!preferenceEmail || !preferencePassword) throw new Error("Preference evaluation account is required post-import.");
  const preferenceAuth = await postJson("/auth/login", { email: preferenceEmail, password: preferencePassword });
  if (preferenceAuth.status !== 200 || !preferenceAuth.payload.data?.token) {
    throw new Error(`Preference account login failed: HTTP ${preferenceAuth.status}`);
  }
  preferenceToken = preferenceAuth.payload.data.token;
}
const initial = await fetch(`${apiBase}/ai/health`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(10_000),
});
if (!initial.ok) throw new Error(`AI health failed: HTTP ${initial.status}`);
const health = (await initial.json()).data;

const baseline = await executeSearchPlacesTool({ destination: "Penang", limit: 10 }, 5_000);
const baselineData = JSON.parse(baseline.content);
const publicBaseline = await executeSearchPlacesTool({ limit: 10 }, 5_000);
const publicData = JSON.parse(publicBaseline.content);
const placeDigest = createHash("sha256")
  .update(JSON.stringify(baselineData.items))
  .digest("hex");
const scriptDigest = createHash("sha256")
  .update(readFileSync(fileURLToPath(import.meta.url)))
  .digest("hex");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim();

appendFileSync(centralRecord,
  `\n### AI repeatable matrix run ${startedAt.toISOString()}\nScript: backend/ai/evaluation/evaluate_ai_conversation.mjs; script SHA-256: ${scriptDigest}; output: ${runPath}; model: ${health.model}; git: ${commit}; public places: ${publicData.totalMatches}; Penang places: ${baselineData.totalMatches}; Penang top-10 digest: ${placeDigest}. Test credentials and bearer token omitted. Each result below was appended immediately after its case.`,
  "utf8");

const results = [];
for (const testCase of conversationalCases) {
  for (let iteration = 1; iteration <= 3; iteration++) {
    const began = performance.now();
    try {
      const response = await postJson("/ai/chat", {
        message: testCase.message,
        history: testCase.history,
      }, testCase.profile === "preference" ? preferenceToken : token);
      const data = response.payload.data ?? {};
      const pass = response.status === 200 && testCase.judge(data);
      const row = {
        kind: "conversation", caseId: testCase.id, iteration,
        expectation: testCase.expectation, message: testCase.message,
        history: testCase.history, status: response.status,
        pass, elapsedMs: Math.round(performance.now() - began),
        model: data.model ?? null, durationMs: data.durationMs ?? null,
        grounded: data.grounded ?? null, toolsUsed: data.toolsUsed ?? [],
        suggestedPlaces: data.suggestedPlaces ?? [],
        reply: data.reply ?? null, error: response.payload.error ?? null,
      };
      record(row);
      results.push(row);
    } catch (error) {
      const row = {
        kind: "conversation", caseId: testCase.id, iteration,
        expectation: testCase.expectation, message: testCase.message,
        history: testCase.history, status: null, pass: false,
        elapsedMs: Math.round(performance.now() - began), toolsUsed: [],
        reply: null, error: String(error),
      };
      record(row);
      results.push(row);
    }
  }
}

for (const testCase of toolCases) {
  for (let iteration = 1; iteration <= 3; iteration++) {
    try {
      const execution = await executeSearchPlacesTool(testCase.arguments, 5_000);
      const result = { usage: execution.usage, data: JSON.parse(execution.content) };
      const row = {
        kind: "tool", caseId: testCase.id, iteration,
        arguments: testCase.arguments, pass: Boolean(testCase.judge(result)),
        result: {
          status: result.usage.status, resultCount: result.data.resultCount ?? null,
          totalMatches: result.data.totalMatches ?? null,
          searchMatchSource: result.data.searchMatchSource ?? null,
          destination: result.data.destination?.name ?? null,
          names: result.data.items?.map((item) => item.name) ?? [],
          error: result.data.error ?? null,
        },
      };
      record(row);
      results.push(row);
    } catch (error) {
      const row = {
        kind: "tool", caseId: testCase.id, iteration,
        arguments: testCase.arguments, pass: false, result: { error: String(error) },
      };
      record(row);
      results.push(row);
    }
  }
}

const cases = [...conversationalCases, ...toolCases].map((testCase) => {
  const entries = results.filter((row) => row.caseId === testCase.id);
  return { id: testCase.id, kind: entries[0].kind, passed: entries.filter((row) => row.pass).length, total: 3 };
});
const summary = {
  schemaVersion: 1, startedAt: startedAt.toISOString(), completedAt: new Date().toISOString(),
  gitCommit: commit, model: health.model, ollamaVersion: health.ollamaVersion,
  scriptSha256: scriptDigest,
  publicPlaceCount: publicData.totalMatches, penangPlaceCount: baselineData.totalMatches,
  penangTop10Digest: placeDigest, cases, rawFile: runPath,
};
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
appendFileSync(centralRecord, `\nMatrix summary: ${JSON.stringify(cases)}; summary artifact: ${summaryPath}.\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
