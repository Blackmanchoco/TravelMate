import { apiRequest } from "../lib/api-client";
import type { Paginated } from "../types/api";

export interface AdminStats {
  users: number;
  destinations: number;
  activePlaces: number;
  itineraries: number;
  savedPlaces: number;
}

export interface CatalogReport {
  generatedAt: string;
  auditSummary: { total: number; byAction: Array<{ action: string; count: number }> };
  totals: { discoverable: number; archived: number; test: number };
  byDestination: Array<{ destinationId: number; name: string; discoverable: number; archived: number }>;
  byCategory: Array<{ category: string; count: number }>;
  completeness: {
    total: number;
    priceLevel: CatalogMissingMetric;
    coordinates: CatalogMissingMetric;
    tags: CatalogMissingMetric;
    travelStyleTags: CatalogMissingMetric;
    activityTypes: CatalogMissingMetric;
    description: CatalogMissingMetric;
  };
  engagement: {
    mostEngaged: CatalogEngagementPlace[];
    leastEngaged: CatalogEngagementPlace[];
  };
}

interface CatalogMissingMetric { missing: number; missingRatio: number }

interface CatalogEngagementPlace {
  placeId: number;
  name: string;
  destination: string;
  savedCount: number;
  itineraryItemCount: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
  _count: { itineraries: number; savedPlaces: number };
}

export interface AdminPlace {
  id: number;
  destinationId: number;
  name: string;
  category: string;
  address: string | null;
  deletedAt: string | null;
  restorable: boolean;
  restoreDisabledReason: string | null;
  createdAt: string;
  updatedAt: string;
  destination: { id: number; name: string; city: string; state: string };
  _count: { savedBy: number; itineraryItems: number };
}

export interface AdminPlaceOptions {
  destinations: Array<{ id: number; name: string }>;
  categories: string[];
  vocabulary: { tags: string[]; activityTypes: string[]; travelStyleTags: string[] };
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number };
  limits: { name: number; description: number; address: number; sourceUrl: number; displayTag: number; displayTags: number };
  displayTagsSeparator: "comma";
  displayTagsPreview: string[];
}

export interface CreateAdminPlaceInput {
  destinationId: number;
  name: string;
  category: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: number;
  sourceUrl: string;
  tags: string[];
  activityTypes: string[];
  travelStyleTags: string[];
  displayTags: string[];
}

export interface CreatedAdminPlace { id: number; destinationId: number; name: string; status: "active"; deletedAt: null }
export interface RestoredAdminPlace { id: number; status: "active"; deletedAt: null }

export interface AdminItinerary {
  id: number;
  userId: string;
  destinationId: number | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  destination: { id: number; name: string; city: string; state: string } | null;
  _count: { items: number };
}

interface PageParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AdminPlaceParams extends PageParams {
  category?: string;
  destinationId?: number;
  status?: "active" | "archived" | "all";
  includeTest?: boolean;
}

export interface AdminItineraryParams extends PageParams {
  userId?: string;
  status?: string;
}

export interface ArchivedPlaceResult {
  id: number;
  status: "archived";
  deletedAt: string;
}

export interface DeletedItineraryResult {
  id: number;
  status: "deleted";
}

function queryString(params: object) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function getAdminStats(signal?: AbortSignal) {
  return apiRequest<AdminStats>("/admin/stats", { auth: true, signal });
}

export function getCatalogReport(signal?: AbortSignal) {
  return apiRequest<CatalogReport>("/admin/reports/catalog", { auth: true, signal });
}

export function listAdminUsers(params: PageParams, signal?: AbortSignal) {
  return apiRequest<Paginated<AdminUser>>(`/admin/users${queryString(params)}`, {
    auth: true,
    signal,
  });
}

export function listAdminPlaces(params: AdminPlaceParams, signal?: AbortSignal) {
  return apiRequest<Paginated<AdminPlace>>(`/admin/places${queryString(params)}`, {
    auth: true,
    signal,
  });
}

export function getAdminPlaceOptions(displayTags?: string, signal?: AbortSignal) {
  return apiRequest<AdminPlaceOptions>(`/admin/places/options${queryString({ displayTags })}`, { auth: true, signal });
}

export function createAdminPlace(body: CreateAdminPlaceInput) {
  return apiRequest<CreatedAdminPlace>("/admin/places", { method: "POST", auth: true, body });
}

export function restoreAdminPlace(placeId: number) {
  return apiRequest<RestoredAdminPlace>(`/admin/places/${placeId}/restore`, { method: "POST", auth: true });
}

export function listAdminItineraries(
  params: AdminItineraryParams,
  signal?: AbortSignal,
) {
  return apiRequest<Paginated<AdminItinerary>>(
    `/admin/itineraries${queryString(params)}`,
    { auth: true, signal },
  );
}

export function archiveAdminPlace(placeId: number) {
  return apiRequest<ArchivedPlaceResult>(`/admin/places/${placeId}`, {
    method: "DELETE",
    auth: true,
  });
}

export function deleteAdminItinerary(itineraryId: number) {
  return apiRequest<DeletedItineraryResult>(`/admin/itineraries/${itineraryId}`, {
    method: "DELETE",
    auth: true,
  });
}
