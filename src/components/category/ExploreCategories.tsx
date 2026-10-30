import SectionTitle from "../common/SectionTitle";
import CategoryCard from "./CategoryCard";
import { travelCategories } from "../../data/categories";

function ExploreCategories() {
  return (
    <section className="bg-bg py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Place Categories"
          title="What You Can Discover in TravelMate"
          description="These labels describe the real places available in each destination. Open a destination to filter its live place catalogue."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {travelCategories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExploreCategories;
