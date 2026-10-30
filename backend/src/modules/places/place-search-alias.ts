const TOWER_ALIASES = new Set(["kuala lumpur tower", "kl tower", "menara kuala lumpur"]);

/** Exact catalogue aliases only; leave every other query unchanged. */
export function normalizePlaceSearch(search: string | undefined): string | undefined {
  if (!search) return search;
  const key = search.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return TOWER_ALIASES.has(key) ? "Kuala Lumpur Tower" : search;
}
