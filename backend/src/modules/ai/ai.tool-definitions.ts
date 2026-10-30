export const searchPlacesTool = {
  type: "function",
  function: {
    name: "search_places",
    description:
      "Search the live TravelMate database for general place discovery or a specific place fact. Use category=Attractions for sightseeing (Attraction, Culture, Historical, Nature); category=Restaurant for food; category=Accommodation for hotels; category=Shopping for shops. These are catalogue matches, not personalized recommendations. For unrestricted requests based on saved preferences, use get_personalized_recommendations instead.",
    parameters: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Destination name supplied by the user, for example Penang.",
        },
        search: {
          type: "string",
          description: "For a question naming a place, search that place name (for example George Town), never the attribute being checked (for example UNESCO). If no place is named, a topic keyword may find matching descriptions when no place name matches.",
        },
        category: {
          type: "string",
          description: "Optional category or virtual sightseeing group: Attractions, Accommodation, Restaurant, or Shopping. The filter also applies when search is supplied.",
        },
        limit: {
          type: "integer",
          description: "Maximum results from 1 to 10. Defaults to 5.",
        },
      },
    },
  },
} as const;

export const personalizedRecommendationsTool = {
  type: "function",
  function: {
    name: "get_personalized_recommendations",
    description:
      "Get personalized TravelMate place recommendations for the authenticated user. Use whenever the user says recommend/推荐, asks '给我推荐', asks what suits them, or asks based on their preferences, unless they explicitly request only general/high-rated results. Returns real rank, ML score, final score, reasons, and Place facts. The backend supplies the authenticated user identity; never request or invent a userId.",
    parameters: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description:
            "Optional destination name supplied by the user, for example Penang. Omit it for recommendations across all destinations.",
        },
        limit: {
          type: "integer",
          description: "Maximum results from 1 to 10. Defaults to 5.",
        },
      },
    },
  },
} as const;

export const aiToolDefinitions = [
  searchPlacesTool,
  personalizedRecommendationsTool,
] as const;
