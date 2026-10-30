import { AppError } from "../../core/errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { calculatePreferenceMatch } from "./preference-match.calculation.js";

export { calculatePreferenceMatch } from "./preference-match.calculation.js";

export async function getPreferenceMatch(userId: string, itineraryId: number) {
  const itinerary = await prisma.itinerary.findFirst({
    where: { id: itineraryId, userId },
    select: {
      id: true,
      items: {
        orderBy: [{ day: "asc" }, { timeSlot: "asc" }, { order: "asc" }],
        select: {
          id: true,
          place: {
            select: {
              id: true,
              name: true,
              tags: true,
              activityTypes: true,
              travelStyleTags: true,
              priceLevel: true,
            },
          },
        },
      },
    },
  });

  if (!itinerary) {
    throw new AppError("Itinerary not found.", 404, "ITINERARY_NOT_FOUND");
  }

  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: {
      interests: true,
      preferredActivities: true,
      travelStyle: true,
      budget: true,
    },
  });

  if (!preference) {
    throw new AppError(
      "Set your preferences before calculating a preference match.",
      422,
      "NO_PREFERENCE_SET",
    );
  }

  return calculatePreferenceMatch(preference, itinerary.items);
}
