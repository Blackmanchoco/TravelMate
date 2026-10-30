import { BedDouble, FerrisWheel, Landmark, Leaf, MapPin, ShoppingBag, Theater, Utensils } from "lucide-react";

const categoryIcons = {
  attraction: FerrisWheel,
  nature: Leaf,
  historical: Landmark,
  shopping: ShoppingBag,
  accommodation: BedDouble,
  restaurant: Utensils,
  culture: Theater,
  destination: MapPin,
};

const categoryColours: Record<string, { background: string; foreground: string }> = {
  accommodation: { background: "#e7effc", foreground: "#244b83" },
  restaurant: { background: "#fff0d6", foreground: "#794a08" },
  attraction: { background: "#e9e8fc", foreground: "#453985" },
  culture: { background: "#f3e5f5", foreground: "#713978" },
  historical: { background: "#eee5db", foreground: "#674326" },
  nature: { background: "#e3f1e6", foreground: "#245c37" },
  shopping: { background: "#fbe5ec", foreground: "#823451" },
};

export default function PhotoPlaceholder({ name, category = "Destination", className = "" }: { name: string; category?: string; className?: string }) {
  const Icon = categoryIcons[category.toLowerCase() as keyof typeof categoryIcons] ?? MapPin;
  const colours = categoryColours[category.toLowerCase()] ?? { background: "#e9eeef", foreground: "#3d535b" };
  return <div className={`flex h-full w-full min-h-0 flex-col items-center justify-center gap-2 p-3 text-center ${className}`} style={{ backgroundColor: colours.background, color: colours.foreground }} role="img" aria-label={`${name}: ${category} placeholder, no photo`}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-panel border border-current/20"><Icon size={24} strokeWidth={1.6} aria-hidden="true" /></span>
    <span className="text-[10px] font-semibold uppercase tracking-wider">{category}</span>
    <span className="line-clamp-2 max-w-full text-sm font-semibold leading-5">{name}</span>
  </div>;
}
