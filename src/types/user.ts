export interface UserPreference {
  id: number;
  userId: string;
  budget: string | null;
  travelStyle: string | null;
  interests: string[];
  preferredActivities: string[];
  dietaryPreferences: string[];
  preferredTransportation: string | null;
  tripDuration: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCurrentUserInput {
  name?: string;
  avatar?: string | null;
}

export interface UpdateUserPreferenceInput {
  budget?: string | null;
  travelStyle?: string | null;
  interests?: string[];
  preferredActivities?: string[];
  dietaryPreferences?: string[];
  preferredTransportation?: string | null;
  tripDuration?: string | null;
}
