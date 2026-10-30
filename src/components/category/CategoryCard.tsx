import { BedDouble, FerrisWheel, Landmark, Leaf, ShoppingBag, Theater, Utensils } from "lucide-react";
import type { TravelCategory } from "../../data/categories";

interface CategoryCardProps {
  category: TravelCategory;
}

function CategoryCard({ category }: CategoryCardProps) {
  const icons = { attraction: FerrisWheel, nature: Leaf, historical: Landmark, shopping: ShoppingBag, accommodation: BedDouble, restaurant: Utensils, culture: Theater };
  const Icon = icons[category.icon as keyof typeof icons];

  return (
    <article className="flex cursor-default h-full w-full flex-col rounded-panel border border-line bg-surface p-6 text-left shadow-panel">
      <div className="flex h-14 w-14 items-center justify-center rounded-panel bg-tint text-accent">
        <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="mt-6">
        <h3 className="text-lg font-bold text-fg">{category.name}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{category.description}</p>
      </div>
    </article>
  );
}

export default CategoryCard;
