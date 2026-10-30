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
  listSavedPlaces,
  removeSavedPlace,
  savePlace as savePlaceRequest,
} from "../api/saved-places.api";
import { SESSION_CLEARED_EVENT } from "../auth/auth-events";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api-client";
import type { Pagination } from "../types/api";
import type { SavedPlace } from "../types/saved-place";

interface SavedPlacesContextValue {
  savedPlaces: SavedPlace[];
  pagination: Pagination | null;
  isLoading: boolean;
  loadError: ApiError | null;
  mutationError: ApiError | null;
  savingPlaceIds: ReadonlySet<number>;
  removingPlaceIds: ReadonlySet<number>;
  refreshSavedPlaces: () => Promise<void>;
  savePlace: (placeId: number) => Promise<SavedPlace>;
  removePlace: (placeId: number) => Promise<void>;
  isPlaceSaved: (placeId: number) => boolean;
  isSavingPlace: (placeId: number) => boolean;
  isRemovingPlace: (placeId: number) => boolean;
  clearMutationError: () => void;
}

const SavedPlacesContext = createContext<SavedPlacesContextValue | undefined>(undefined);

function asApiError(error: unknown) {
  return error instanceof ApiError
    ? error
    : new ApiError("The saved places request could not be completed.", 0, "UNKNOWN_ERROR");
}

function removePendingId(current: ReadonlySet<number>, placeId: number) {
  const next = new Set(current);
  next.delete(placeId);
  return next;
}

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const requestSequence = useRef(0);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [mutationError, setMutationError] = useState<ApiError | null>(null);
  const [savingPlaceIds, setSavingPlaceIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [removingPlaceIds, setRemovingPlaceIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const clearState = useCallback(() => {
    requestSequence.current += 1;
    setSavedPlaces([]);
    setPagination(null);
    setIsLoading(false);
    setLoadError(null);
    setMutationError(null);
    setSavingPlaceIds(new Set());
    setRemovingPlaceIds(new Set());
  }, []);

  const refreshSavedPlaces = useCallback(async () => {
    if (!isAuthenticated) {
      clearState();
      return;
    }

    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await listSavedPlaces();

      if (sequence !== requestSequence.current) {
        return;
      }

      setSavedPlaces(result.items);
      setPagination(result.pagination);
    } catch (error) {
      if (sequence === requestSequence.current) {
        setLoadError(asApiError(error));
      }
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
      }
    }
  }, [clearState, isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      clearState();
      return;
    }

    void refreshSavedPlaces();
  }, [clearState, isAuthenticated, isAuthLoading, refreshSavedPlaces, user?.id]);

  useEffect(() => {
    window.addEventListener(SESSION_CLEARED_EVENT, clearState);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, clearState);
  }, [clearState]);

  const savePlace = useCallback(async (placeId: number) => {
    setMutationError(null);
    setSavingPlaceIds((current) => new Set(current).add(placeId));

    try {
      const savedPlace = await savePlaceRequest(placeId);

      setSavedPlaces((current) => {
        const existingIndex = current.findIndex((item) => item.placeId === placeId);

        if (existingIndex >= 0) {
          return current.map((item, index) =>
            index === existingIndex ? savedPlace : item,
          );
        }

        setPagination((currentPagination) =>
          currentPagination
            ? {
                ...currentPagination,
                total: currentPagination.total + 1,
                totalPages: Math.ceil((currentPagination.total + 1) / currentPagination.limit),
              }
            : currentPagination,
        );
        return [savedPlace, ...current];
      });

      return savedPlace;
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setSavingPlaceIds((current) => removePendingId(current, placeId));
    }
  }, []);

  const removePlace = useCallback(async (placeId: number) => {
    setMutationError(null);
    setRemovingPlaceIds((current) => new Set(current).add(placeId));

    try {
      await removeSavedPlace(placeId);
      setSavedPlaces((current) => current.filter((item) => item.placeId !== placeId));
      setPagination((currentPagination) =>
        currentPagination
          ? {
              ...currentPagination,
              total: Math.max(0, currentPagination.total - 1),
              totalPages: Math.ceil(
                Math.max(0, currentPagination.total - 1) / currentPagination.limit,
              ),
            }
          : currentPagination,
      );
    } catch (error) {
      const apiError = asApiError(error);
      setMutationError(apiError);
      throw apiError;
    } finally {
      setRemovingPlaceIds((current) => removePendingId(current, placeId));
    }
  }, []);

  const isPlaceSaved = useCallback(
    (placeId: number) => savedPlaces.some((item) => item.placeId === placeId),
    [savedPlaces],
  );

  return (
    <SavedPlacesContext.Provider
      value={{
        savedPlaces,
        pagination,
        isLoading,
        loadError,
        mutationError,
        savingPlaceIds,
        removingPlaceIds,
        refreshSavedPlaces,
        savePlace,
        removePlace,
        isPlaceSaved,
        isSavingPlace: (placeId) => savingPlaceIds.has(placeId),
        isRemovingPlace: (placeId) => removingPlaceIds.has(placeId),
        clearMutationError: () => setMutationError(null),
      }}
    >
      {children}
    </SavedPlacesContext.Provider>
  );
}

export function useSavedPlaces() {
  const value = useContext(SavedPlacesContext);
  if (!value) {
    throw new Error("useSavedPlaces must be used inside SavedPlacesProvider");
  }
  return value;
}
