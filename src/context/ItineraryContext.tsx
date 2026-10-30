import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  createItineraryItem,
  createItinerary as createItineraryRequest,
  deleteItineraryItem,
  deleteItinerary as deleteItineraryRequest,
  getItinerary,
  listItineraries,
  updateItineraryItem,
  updateItinerary as updateItineraryRequest,
} from "../api/itineraries.api";
import { SESSION_CLEARED_EVENT } from "../auth/auth-events";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api-client";
import { itineraryDetailToSummary } from "../mappers/itinerary.mapper";
import { allowedItineraryDays, suggestedPosition } from "../lib/itinerary-add-position";
import type { Pagination } from "../types/api";
import type {
  CreateItineraryInput,
  ItineraryDetail,
  ItineraryItem,
  ItinerarySummary,
  UpdateItineraryItemInput,
  UpdateItineraryInput,
} from "../types/itinerary";

export type TimeSlot = "Morning" | "Afternoon" | "Evening";
interface ItineraryContextValue {
  itineraries: ItinerarySummary[];
  pagination: Pagination | null;
  activeItineraryId: number | null;
  activeItinerary: ItineraryDetail | null;
  isLoading: boolean;
  isActiveLoading: boolean;
  loadError: ApiError | null;
  mutationError: ApiError | null;
  pendingMutation: "create" | "update" | "delete" | null;
  addingPlaceIds: ReadonlySet<number>;
  updatingItemIds: ReadonlySet<number>;
  removingItemIds: ReadonlySet<number>;
  isClearingItems: boolean;
  refreshItineraries: () => Promise<void>;
  selectItinerary: (id: number) => Promise<boolean>;
  createItinerary: (input: CreateItineraryInput) => Promise<ItineraryDetail>;
  updateActiveItinerary: (input: UpdateItineraryInput) => Promise<ItineraryDetail>;
  deleteActiveItinerary: () => Promise<void>;
  addPlace: (placeId: number, itineraryId?: number, day?: number, timeSlot?: TimeSlot) => Promise<ItineraryItem>;
  updateItem: (itemId: number, input: UpdateItineraryItemInput) => Promise<ItineraryItem>;
  removeItem: (itemId: number) => Promise<void>;
  clearItems: () => Promise<void>;
  getPlaceOccurrenceCount: (placeId: number) => number;
  isAddingPlace: (placeId: number) => boolean;
  isUpdatingItem: (itemId: number) => boolean;
  isRemovingItem: (itemId: number) => boolean;
  clearMutationError: () => void;
}

const ItineraryContext = createContext<ItineraryContextValue | undefined>(undefined);

function asApiError(error: unknown) {
  return error instanceof ApiError
    ? error
    : new ApiError("The itinerary request could not be completed.", 0, "UNKNOWN_ERROR");
}

function removePendingId(current: ReadonlySet<number>, id: number) {
  const next = new Set(current);
  next.delete(id);
  return next;
}

function sortItems(items: ItineraryItem[]) {
  const slotOrder: Record<TimeSlot, number> = { Morning: 0, Afternoon: 1, Evening: 2 };
  return [...items].sort((left, right) => left.day - right.day || slotOrder[left.timeSlot] - slotOrder[right.timeSlot] || left.order - right.order || left.id - right.id);
}

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const requestSequence = useRef(0);
  const activeIdRef = useRef<number | null>(null);
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [activeItineraryId, setActiveItineraryIdState] = useState<number | null>(null);
  const [activeItinerary, setActiveItinerary] = useState<ItineraryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActiveLoading, setIsActiveLoading] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [mutationError, setMutationError] = useState<ApiError | null>(null);
  const [pendingMutation, setPendingMutation] = useState<"create" | "update" | "delete" | null>(null);
  const [addingPlaceIds, setAddingPlaceIds] = useState<ReadonlySet<number>>(() => new Set());
  const [updatingItemIds, setUpdatingItemIds] = useState<ReadonlySet<number>>(() => new Set());
  const [removingItemIds, setRemovingItemIds] = useState<ReadonlySet<number>>(() => new Set());
  const [isClearingItems, setIsClearingItems] = useState(false);

  const setActiveItineraryId = useCallback((id: number | null) => {
    activeIdRef.current = id;
    setActiveItineraryIdState(id);
  }, []);

  const clearEntityState = useCallback(() => {
    requestSequence.current += 1;
    setItineraries([]);
    setPagination(null);
    setActiveItineraryId(null);
    setActiveItinerary(null);
    setIsLoading(false);
    setIsActiveLoading(false);
    setLoadError(null);
    setMutationError(null);
    setPendingMutation(null);
    setAddingPlaceIds(new Set());
    setUpdatingItemIds(new Set());
    setRemovingItemIds(new Set());
    setIsClearingItems(false);
  }, [setActiveItineraryId]);

  const loadActiveItinerary = useCallback(async (id: number, sequence: number) => {
    setIsActiveLoading(true);
    try {
      const detail = await getItinerary(id);
      if (sequence === requestSequence.current) setActiveItinerary(detail);
    } catch (error) {
      if (sequence === requestSequence.current) {
        setActiveItinerary(null);
        setLoadError(asApiError(error));
      }
    } finally {
      if (sequence === requestSequence.current) setIsActiveLoading(false);
    }
  }, []);

  const refreshItineraries = useCallback(async () => {
    if (!isAuthenticated) {
      clearEntityState();
      return;
    }
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listItineraries();
      if (sequence !== requestSequence.current) return;
      setItineraries(result.items);
      setPagination(result.pagination);
      const currentId = activeIdRef.current;
      const nextId = currentId !== null && result.items.some((item) => item.id === currentId)
        ? currentId
        : result.items[0]?.id ?? null;
      setActiveItineraryId(nextId);
      if (nextId === null) {
        setActiveItinerary(null);
        setIsActiveLoading(false);
      } else {
        await loadActiveItinerary(nextId, sequence);
      }
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(asApiError(error));
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [clearEntityState, isAuthenticated, loadActiveItinerary, setActiveItineraryId]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      clearEntityState();
      return;
    }
    void refreshItineraries();
  }, [clearEntityState, isAuthenticated, isAuthLoading, refreshItineraries, user?.id]);

  useEffect(() => {
    const clear = () => clearEntityState();
    window.addEventListener(SESSION_CLEARED_EVENT, clear);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, clear);
  }, [clearEntityState]);

  const selectItinerary = useCallback(async (id: number): Promise<boolean> => {
    const sequence = ++requestSequence.current;
    setLoadError(null);
    setIsActiveLoading(true);
    try {
      const detail = await getItinerary(id);
      if (sequence !== requestSequence.current) return false;
      setActiveItineraryId(id);
      setActiveItinerary(detail);
      return true;
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(asApiError(error));
      return false;
    } finally {
      if (sequence === requestSequence.current) setIsActiveLoading(false);
    }
  }, [setActiveItineraryId]);

  const createItinerary = useCallback(async (input: CreateItineraryInput) => {
    setMutationError(null);
    setPendingMutation("create");
    try {
      const detail = await createItineraryRequest(input);
      const summary = itineraryDetailToSummary(detail);
      setItineraries((current) => [summary, ...current.filter((item) => item.id !== detail.id)]);
      setPagination((current) => current ? { ...current, total: current.total + 1, totalPages: Math.ceil((current.total + 1) / current.limit) } : current);
      setActiveItineraryId(detail.id);
      setActiveItinerary(detail);
      setLoadError(null);
      return detail;
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setPendingMutation(null);
    }
  }, [setActiveItineraryId]);

  const updateActiveItinerary = useCallback(async (input: UpdateItineraryInput) => {
    const id = activeIdRef.current;
    if (id === null) throw new ApiError("Select an itinerary before editing it.", 400, "NO_ACTIVE_ITINERARY");
    setMutationError(null);
    setPendingMutation("update");
    try {
      const detail = await updateItineraryRequest(id, input);
      const summary = itineraryDetailToSummary(detail);
      setItineraries((current) => [summary, ...current.filter((item) => item.id !== id)]);
      setActiveItinerary(detail);
      return detail;
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setPendingMutation(null);
    }
  }, []);

  const deleteActiveItinerary = useCallback(async () => {
    const id = activeIdRef.current;
    if (id === null) throw new ApiError("Select an itinerary before deleting it.", 400, "NO_ACTIVE_ITINERARY");
    setMutationError(null);
    setPendingMutation("delete");
    try {
      await deleteItineraryRequest(id);
      const remaining = itineraries.filter((item) => item.id !== id);
      setItineraries(remaining);
      setPagination((current) => current ? { ...current, total: Math.max(0, current.total - 1), totalPages: Math.ceil(Math.max(0, current.total - 1) / current.limit) } : current);
      const nextId = remaining[0]?.id ?? null;
      setActiveItineraryId(nextId);
      setActiveItinerary(null);
      if (nextId !== null) {
        const sequence = ++requestSequence.current;
        setLoadError(null);
        await loadActiveItinerary(nextId, sequence);
      }
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setPendingMutation(null);
    }
  }, [itineraries, loadActiveItinerary, setActiveItineraryId]);

  const addPlace = useCallback(async (placeId: number, selectedItineraryId?: number, selectedDay?: number, selectedSlot?: TimeSlot) => {
    const itineraryId = selectedItineraryId ?? activeIdRef.current;
    if (itineraryId === null || !itineraries.some((itinerary) => itinerary.id === itineraryId)) throw new ApiError("Select an itinerary first.", 400, "NO_ACTIVE_ITINERARY");
    if ((selectedDay === undefined || selectedSlot === undefined) && (!activeItinerary || activeItinerary.id !== itineraryId)) throw new ApiError("Choose a day and time slot.", 400, "SCHEDULE_REQUIRED");
    const defaultPosition = activeItinerary && activeItinerary.id === itineraryId
      ? suggestedPosition(activeItinerary.items, allowedItineraryDays(activeItinerary.startDate, activeItinerary.endDate, activeItinerary.items.map((item) => item.day)), null)
      : null;
    const day = selectedDay ?? defaultPosition?.day;
    const timeSlot = selectedSlot ?? defaultPosition?.timeSlot;
    if (day === undefined || timeSlot === undefined) throw new ApiError("Choose a day and time slot.", 400, "SCHEDULE_REQUIRED");
    setMutationError(null);
    setAddingPlaceIds((current) => new Set(current).add(placeId));
    try {
      const item = await createItineraryItem(itineraryId, { placeId, day, timeSlot });
      if (activeIdRef.current === itineraryId) {
        setActiveItinerary((current) => current ? { ...current, items: sortItems([...current.items, item]) } : current);
        setItineraries((current) => current.map((itinerary) => itinerary.id === itineraryId ? { ...itinerary, itemCount: itinerary.itemCount + 1 } : itinerary));
      }
      return item;
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setAddingPlaceIds((current) => removePendingId(current, placeId));
    }
  }, [activeItinerary, itineraries]);

  const updateItem = useCallback(async (itemId: number, input: UpdateItineraryItemInput) => {
    const itineraryId = activeIdRef.current;
    if (itineraryId === null) throw new ApiError("Create or select an itinerary first.", 400, "NO_ACTIVE_ITINERARY");
    setMutationError(null);
    setUpdatingItemIds((current) => new Set(current).add(itemId));
    try {
      const item = await updateItineraryItem(itineraryId, itemId, input);
      if (activeIdRef.current === itineraryId) setActiveItinerary((current) => current ? { ...current, items: sortItems(current.items.map((existing) => existing.id === itemId ? item : existing)) } : current);
      return item;
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setUpdatingItemIds((current) => removePendingId(current, itemId));
    }
  }, []);

  const removeItem = useCallback(async (itemId: number) => {
    const itineraryId = activeIdRef.current;
    if (itineraryId === null) throw new ApiError("Create or select an itinerary first.", 400, "NO_ACTIVE_ITINERARY");
    setMutationError(null);
    setRemovingItemIds((current) => new Set(current).add(itemId));
    try {
      await deleteItineraryItem(itineraryId, itemId);
      if (activeIdRef.current === itineraryId) {
        setActiveItinerary((current) => current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current);
        setItineraries((current) => current.map((itinerary) => itinerary.id === itineraryId ? { ...itinerary, itemCount: Math.max(0, itinerary.itemCount - 1) } : itinerary));
      }
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setRemovingItemIds((current) => removePendingId(current, itemId));
    }
  }, []);

  const clearItems = useCallback(async () => {
    const itineraryId = activeIdRef.current;
    if (itineraryId === null || !activeItinerary) throw new ApiError("Create or select an itinerary first.", 400, "NO_ACTIVE_ITINERARY");
    setMutationError(null);
    setIsClearingItems(true);
    try {
      const results = await Promise.allSettled(activeItinerary.items.map((item) => deleteItineraryItem(itineraryId, item.id)));
      const detail = await getItinerary(itineraryId);
      if (activeIdRef.current === itineraryId) {
        setActiveItinerary(detail);
        setItineraries((current) => current.map((itinerary) => itinerary.id === itineraryId ? itineraryDetailToSummary(detail) : itinerary));
      }
      const failedCount = results.filter((result) => result.status === "rejected").length;
      if (failedCount > 0) throw new ApiError(`${failedCount} itinerary item${failedCount === 1 ? "" : "s"} could not be deleted. The itinerary was refreshed to show the current server state.`, 0, "ITEM_CLEAR_PARTIAL_FAILURE");
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setIsClearingItems(false);
    }
  }, [activeItinerary]);

  const getPlaceOccurrenceCount = useCallback((placeId: number) => activeItinerary?.items.filter((item) => item.placeId === placeId).length ?? 0, [activeItinerary]);

  return <ItineraryContext.Provider value={{
    itineraries, pagination, activeItineraryId, activeItinerary, isLoading, isActiveLoading,
    loadError, mutationError, pendingMutation, addingPlaceIds, updatingItemIds,
    removingItemIds, isClearingItems, refreshItineraries, selectItinerary,
    createItinerary, updateActiveItinerary, deleteActiveItinerary,
    addPlace, updateItem, removeItem, clearItems, getPlaceOccurrenceCount,
    isAddingPlace: (placeId) => addingPlaceIds.has(placeId),
    isUpdatingItem: (itemId) => updatingItemIds.has(itemId),
    isRemovingItem: (itemId) => removingItemIds.has(itemId),
    clearMutationError: () => setMutationError(null),
  }}>{children}</ItineraryContext.Provider>;
}

export function useItinerary() {
  const value = useContext(ItineraryContext);
  if (!value) throw new Error("useItinerary must be used inside ItineraryProvider");
  return value;
}
