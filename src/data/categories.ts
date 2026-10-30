export interface TravelCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export const travelCategories: TravelCategory[] = [
  {
    id: 1,
    name: "Attraction",
    description:
      "Discover landmarks, observation points, family experiences, and city highlights.",
    icon: "attraction",
  },
  {
    id: 2,
    name: "Nature",
    description:
      "Experience parks, beaches, forests, hills, and other natural places.",
    icon: "nature",
  },
  {
    id: 3,
    name: "Historical",
    description:
      "Explore monuments, heritage buildings, museums, and historic districts.",
    icon: "historical",
  },
  {
    id: 4,
    name: "Shopping",
    description:
      "Browse markets, artisan stores, shopping districts, and souvenir stops.",
    icon: "shopping",
  },
  {
    id: 5,
    name: "Accommodation",
    description:
      "Find comfortable stays, luxury resorts, boutique hotels, and unique accommodations.",
    icon: "accommodation",
  },
  {
    id: 6,
    name: "Restaurant",
    description:
      "Discover local dishes, street food, cafes, and notable dining places.",
    icon: "restaurant",
  },
  {
    id: 7,
    name: "Culture",
    description:
      "Experience places of worship, galleries, living heritage, and local traditions.",
    icon: "culture",
  },
];
