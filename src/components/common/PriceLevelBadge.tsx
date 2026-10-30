const PRICE_LEVEL_LABELS = {
  1: "Budget",
  2: "Moderate",
  3: "Premium",
  4: "Luxury",
} as const;

interface PriceLevelBadgeProps {
  priceLevel: number | null;
}

export function PriceLevelBadge({ priceLevel }: PriceLevelBadgeProps) {
  const normalizedLevel = priceLevel !== null
    && Number.isInteger(priceLevel)
    && priceLevel >= 1
    && priceLevel <= 4
      ? priceLevel as keyof typeof PRICE_LEVEL_LABELS
      : null;

  if (normalizedLevel === null) {
    return (
      <span className="inline-flex rounded-full border border-line bg-surface/70 px-3 py-1 text-sm font-semibold text-muted">
        Not available
      </span>
    );
  }

  const label = PRICE_LEVEL_LABELS[normalizedLevel];

  return (
    <span
      className="inline-flex items-center gap-3 rounded-full border border-line bg-surface/70 px-3 py-1.5"
      aria-label={`${label} price level, ${normalizedLevel} out of 4`}
    >
      <span className="text-sm font-semibold text-accent">{label}</span>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`h-2 w-2 rounded-full ${
              level <= normalizedLevel ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </span>
    </span>
  );
}
