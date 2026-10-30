export type SuggestedSlot = "Morning" | "Afternoon" | "Evening";

export function suggestedSlotForPlace(activityTypes: string[], tags: string[]): SuggestedSlot | null {
  const terms = [...activityTypes, ...tags].join(" ").toLocaleLowerCase();
  if (/sunset|nightlife|night market|evening|夜市|夜生活|日落|傍晚|晚上/u.test(terms)) return "Evening";
  if (/hiking|hike|nature|garden|forest|trail|徒步|登山|自然|花园|花園/u.test(terms)) return "Morning";
  return null;
}
