import { useCallback, useEffect, useRef, useState } from "react";

import {
  getUserPreferences,
  updateUserPreferences,
} from "../api/users.api";
import { useAuth } from "./useAuth";
import { ApiError } from "../lib/api-client";
import type { UpdateUserPreferenceInput, UserPreference } from "../types/user";

function asApiError(error: unknown) {
  return error instanceof ApiError
    ? error
    : new ApiError("The preference request could not be completed.", 0, "UNKNOWN_ERROR");
}

export function useUserPreferences() {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const requestSequence = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [preferences, setPreferences] = useState<UserPreference | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    if (isAuthLoading || !isAuthenticated || !user) {
      setPreferences(null);
      setIsLoading(false);
      return null;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await getUserPreferences(controller.signal);
      if (sequence === requestSequence.current) setPreferences(result);
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      if (sequence === requestSequence.current) setLoadError(asApiError(error));
      throw error;
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [isAuthLoading, isAuthenticated, user]);

  useEffect(() => {
    void refresh().catch(() => undefined);
    return () => {
      requestSequence.current += 1;
      controllerRef.current?.abort();
    };
  }, [refresh]);

  const save = useCallback(async (input: UpdateUserPreferenceInput) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await updateUserPreferences(input);
      setPreferences(result);
      return result;
    } catch (error) {
      setSaveError(asApiError(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    preferences,
    isLoading,
    isSaving,
    loadError,
    saveError,
    refresh,
    save,
    clearSaveError: () => setSaveError(null),
  };
}
