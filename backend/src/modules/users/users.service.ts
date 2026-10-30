import { prisma } from "../../lib/prisma.js";

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

type UpdateProfileInput = {
  userId: string;
  name?: string;
  avatar?: string | null;
};

export async function updateUserProfile(input: UpdateProfileInput) {
  const data: {
    name?: string;
    avatar?: string | null;
  } = {};

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }

  if (input.avatar !== undefined) {
    data.avatar = input.avatar;
  }

  return prisma.user.update({
    where: {
      id: input.userId,
    },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getUserPreferences(userId: string) {
  return prisma.userPreference.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      userId: true,
      budget: true,
      travelStyle: true,
      interests: true,
      preferredActivities: true,
      dietaryPreferences: true,
      preferredTransportation: true,
      tripDuration: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type UpdateUserPreferencesInput = {
  userId: string;
  budget?: string | null;
  travelStyle?: string | null;
  interests?: string[];
  preferredActivities?: string[];
  dietaryPreferences?: string[];
  preferredTransportation?: string | null;
  tripDuration?: string | null;
};

export async function updateUserPreferences(
  input: UpdateUserPreferencesInput,
) {
  const {
    userId,
    budget,
    travelStyle,
    interests,
    preferredActivities,
    dietaryPreferences,
    preferredTransportation,
    tripDuration,
  } = input;

  return prisma.userPreference.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      budget: budget ?? null,
      travelStyle: travelStyle ?? null,
      interests: interests ?? [],
      preferredActivities: preferredActivities ?? [],
      dietaryPreferences: dietaryPreferences ?? [],
      preferredTransportation: preferredTransportation ?? null,
      tripDuration: tripDuration ?? null,
    },
    update: {
      ...(budget !== undefined && { budget }),
      ...(travelStyle !== undefined && { travelStyle }),
      ...(interests !== undefined && { interests }),
      ...(preferredActivities !== undefined && { preferredActivities }),
      ...(dietaryPreferences !== undefined && { dietaryPreferences }),
      ...(preferredTransportation !== undefined && {
        preferredTransportation,
      }),
      ...(tripDuration !== undefined && { tripDuration }),
    },
    select: {
      id: true,
      userId: true,
      budget: true,
      travelStyle: true,
      interests: true,
      preferredActivities: true,
      dietaryPreferences: true,
      preferredTransportation: true,
      tripDuration: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
