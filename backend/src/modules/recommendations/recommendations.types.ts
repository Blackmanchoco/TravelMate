export interface RecommendationItem {
  rank: number;
  placeId: number;
  placeName: string;
  destinationId: number;
  destinationName: string;
  category: string;
  rating: number | null;
  priceLevel: number;
  mlRankScore: number;
  finalScore: number;
  reason: string[];
}

export interface RecommendationResult {
  items: RecommendationItem[];
  meta: {
    modelVersion: string;
    algorithm: string;
    destinationId: number | null;
    limit: number;
    skippedCandidates: Record<string, number>;
  };
}

export type RunnerResponse =
  | {
      ok: true;
      modelVersion: string;
      algorithm: string;
      items: RecommendationItem[];
      skippedCandidates: Record<string, number>;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };
