import type { AIChatResponse } from "../api/ai.api";

type ToolOutcome = Pick<AIChatResponse["toolsUsed"][number], "name" | "status">;

export function aiToolBadge(tools: ToolOutcome[]): string | null {
  if (tools.some((tool) => tool.name === "search_places" && tool.status === "success")) {
    return "Used TravelMate catalogue search";
  }
  if (tools.some((tool) => tool.name === "get_personalized_recommendations" && tool.status === "success")) {
    return "Used TravelMate recommendations";
  }
  return null;
}
