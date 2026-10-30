import { AppError } from "../../core/errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { calculateBudgetAlert } from "./budget-alert.calculation.js";

export { calculateBudgetAlert } from "./budget-alert.calculation.js";

export async function getBudgetAlert(userId: string, itineraryId: number) {
  const itinerary = await prisma.itinerary.findFirst({
    where: { id: itineraryId, userId },
    select: {
      budget: true,
      items: {
        orderBy: [{ day: "asc" }, { timeSlot: "asc" }, { order: "asc" }],
        select: {
          id: true,
          day: true,
          timeSlot: true,
          order: true,
          place: {
            select: {
              id: true,
              name: true,
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

  return calculateBudgetAlert(itinerary.budget, itinerary.items);
}
