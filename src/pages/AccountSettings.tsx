import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Image, Mail, Save, Sparkles, UserRound } from "lucide-react";

import { StringListEditor } from "../components/settings/StringListEditor";
import { useAuth } from "../hooks/useAuth";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { ApiError } from "../lib/api-client";
import type { UserPreference } from "../types/user";

interface PreferenceForm {
  budget: string;
  travelStyle: string;
  interests: string[];
  preferredActivities: string[];
  dietaryPreferences: string[];
  preferredTransportation: string;
  tripDuration: string;
}

const durationOptions = ["1-2 days", "3-4 days", "5+ days"] as const;
const defaultTripDuration = durationOptions[0];

const emptyPreferences: PreferenceForm = {
  budget: "",
  travelStyle: "",
  interests: [],
  preferredActivities: [],
  dietaryPreferences: [],
  preferredTransportation: "",
  tripDuration: defaultTripDuration,
};

function toPreferenceForm(preferences: UserPreference | null): PreferenceForm {
  if (!preferences) return { ...emptyPreferences };
  return {
    budget: preferences.budget ?? "",
    travelStyle: preferences.travelStyle ?? "",
    interests: [...preferences.interests],
    preferredActivities: [...preferences.preferredActivities],
    dietaryPreferences: [...preferences.dietaryPreferences],
    preferredTransportation: preferences.preferredTransportation ?? "",
    tripDuration: durationOptions.find((option) => option === preferences.tripDuration) ?? defaultTripDuration,
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function formatJoined(value: string) {
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function AccountSettings() {
  const { user, updateUser } = useAuth();
  const { preferences, isLoading: preferencesLoading, isSaving: preferencesSaving, loadError: preferencesLoadError, saveError: preferencesSaveError, refresh: refreshPreferences, save: savePreferences } = useUserPreferences();
  const [activeSection, setActiveSection] = useState<"account" | "preferences">("account");
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? "", avatar: user?.avatar ?? "" });
  const [preferenceForm, setPreferenceForm] = useState<PreferenceForm>(emptyPreferences);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => setProfileForm({ name: user?.name ?? "", avatar: user?.avatar ?? "" }), [user]);
  useEffect(() => setPreferenceForm(toPreferenceForm(preferences)), [preferences]);

  if (!user) return null;

  const saveProfile = async () => {
    if (!profileForm.name.trim()) {
      setProfileError(new ApiError("Name cannot be empty.", 400, "VALIDATION_ERROR"));
      return;
    }
    setIsSavingProfile(true);
    setProfileError(null);
    setSuccessMessage("");
    try {
      await updateUser({ name: profileForm.name.trim(), avatar: nullable(profileForm.avatar) });
      setSuccessMessage("Account details saved.");
    } catch (error) {
      setProfileError(error instanceof ApiError ? error : new ApiError("Account details could not be saved.", 0, "UNKNOWN_ERROR"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePreferenceForm = async () => {
    setSuccessMessage("");
    try {
      await savePreferences({
        budget: nullable(preferenceForm.budget),
        travelStyle: nullable(preferenceForm.travelStyle),
        interests: preferenceForm.interests,
        preferredActivities: preferenceForm.preferredActivities,
        dietaryPreferences: preferenceForm.dietaryPreferences,
        preferredTransportation: nullable(preferenceForm.preferredTransportation),
        tripDuration: nullable(preferenceForm.tripDuration),
      });
      setSuccessMessage("Travel preferences saved.");
    } catch {
      // The shared preference hook exposes the request error beside the form.
    }
  };

  const scalarFields = [
    { field: "budget", label: "Budget", list: "budget-options", suggestions: ["Budget", "Mid-range", "Premium"] },
    { field: "travelStyle", label: "Travel Style", list: "style-options", suggestions: ["Relaxed Luxury", "Adventure", "Food-Centric", "Culture-First"] },
    { field: "preferredTransportation", label: "Preferred Transportation", list: "transport-options", suggestions: ["Drive", "Train", "Flight", "Public Transit"] },
  ] as const;

  return (
    <div className="bg-bg">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">Settings</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Your account and preferences</h1><p className="mt-3 max-w-2xl text-lg leading-8 text-muted">Manage the profile and travel signals stored by TravelMate.</p></div>
          <Link to="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-accent"><ArrowLeft size={16} /> Back to profile</Link>
        </div>

        <div className="mt-8 flex gap-2 rounded-panel border border-line bg-surface p-2 shadow-panel">
          <button type="button" onClick={() => { setActiveSection("account"); setSuccessMessage(""); }} className={`flex-1 rounded-control px-4 py-3 text-sm font-semibold ${activeSection === "account" ? "bg-fg text-accent-fg" : "text-muted hover:bg-bg"}`}>Account</button>
          <button type="button" onClick={() => { setActiveSection("preferences"); setSuccessMessage(""); }} className={`flex-1 rounded-control px-4 py-3 text-sm font-semibold ${activeSection === "preferences" ? "bg-fg text-accent-fg" : "text-muted hover:bg-bg"}`}>Travel preferences</button>
        </div>

        {successMessage && <div className="mt-5 rounded-panel border border-line bg-tint px-4 py-3 text-sm font-medium text-accent">{successMessage}</div>}

        {activeSection === "account" ? (
          <motion.section initial={false} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-panel border border-line bg-surface p-6 shadow-panel sm:p-8">
            <div className="flex items-center gap-3"><div className="rounded-panel bg-tint p-3 text-accent"><UserRound size={20} /></div><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Account</p><h2 className="mt-1 text-2xl font-semibold text-fg">Personal details</h2></div></div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
              <div className="flex flex-col items-center rounded-panel border border-line bg-bg p-6">
                {profileForm.avatar ? <img src={profileForm.avatar} alt={profileForm.name || user.name} className="h-24 w-24 rounded-panel object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-panel bg-accent text-3xl font-semibold text-accent-fg">{(profileForm.name || user.name).charAt(0).toUpperCase()}</div>}
                <p className="mt-4 text-center text-sm text-muted">TravelMate stores an image URL only. File upload is not enabled.</p>
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-fg"><span className="mb-2 block">Name</span><input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-panel border border-line bg-bg px-3 py-3 outline-none focus:border-accent focus:bg-surface" /></label>
                <label className="block text-sm font-medium text-fg"><span className="mb-2 flex items-center gap-2"><Mail size={15} /> Email</span><input readOnly value={user.email} className="w-full cursor-not-allowed rounded-panel border border-line bg-tint px-3 py-3 text-muted" /><span className="mt-1.5 block text-xs font-normal text-muted">Email changes are not supported.</span></label>
                <label className="block text-sm font-medium text-fg"><span className="mb-2 flex items-center gap-2"><Image size={15} /> Avatar URL</span><input value={profileForm.avatar} onChange={(event) => setProfileForm((current) => ({ ...current, avatar: event.target.value }))} placeholder="https://example.com/avatar.jpg" className="w-full rounded-panel border border-line bg-bg px-3 py-3 outline-none focus:border-accent focus:bg-surface" /></label>
                <div className="flex items-center gap-2 rounded-panel bg-bg px-4 py-3 text-sm text-muted"><CalendarDays size={16} /> Joined {formatJoined(user.createdAt)}</div>
                {profileError && <p role="alert" className="rounded-panel border border-line bg-bg px-4 py-3 text-sm text-fg">{profileError.message}</p>}
                <div className="flex gap-3 border-t border-line pt-5"><button type="button" disabled={isSavingProfile} onClick={() => void saveProfile()} className="inline-flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50"><Save size={15} /> {isSavingProfile ? "Saving..." : "Save account"}</button><button type="button" onClick={() => setProfileForm({ name: user.name, avatar: user.avatar ?? "" })} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-fg">Reset</button></div>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section initial={false} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-panel border border-line bg-surface p-6 shadow-panel sm:p-8">
            <div className="flex items-center gap-3"><div className="rounded-panel bg-tint p-3 text-accent"><Sparkles size={20} /></div><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Travel preferences</p><h2 className="mt-1 text-2xl font-semibold text-fg">Shape your recommendations</h2></div></div>
            {preferencesLoading ? <p className="mt-8 text-sm text-muted">Loading preferences...</p> : preferencesLoadError ? <div className="mt-8 rounded-panel border border-line bg-bg p-4 text-sm text-fg"><p>{preferencesLoadError.message}</p><button type="button" onClick={() => void refreshPreferences().catch(() => undefined)} className="mt-2 font-semibold">Try again</button></div> : (
              <div className="mt-8 space-y-6">
                {!preferences && <p className="rounded-panel border border-line bg-tint p-4 text-sm text-accent">No preferences are saved yet. Complete any fields you want and save to create them.</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  {scalarFields.map(({ field, label, list, suggestions }) => <label key={field} className="text-sm font-medium text-fg"><span className="mb-2 block">{label}</span><input list={list} value={preferenceForm[field]} onChange={(event) => setPreferenceForm((current) => ({ ...current, [field]: event.target.value }))} className="w-full rounded-panel border border-line bg-bg px-3 py-3 outline-none focus:border-accent focus:bg-surface" /><datalist id={list}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist></label>)}
                  <label className="text-sm font-medium text-fg"><span className="mb-2 block">Trip Duration</span><select value={preferenceForm.tripDuration} onChange={(event) => setPreferenceForm((current) => ({ ...current, tripDuration: event.target.value }))} className="w-full rounded-panel border border-line bg-bg px-3 py-3 outline-none focus:border-accent focus:bg-surface">{durationOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>{!preferences?.tripDuration && <span className="mt-1 block text-xs font-normal text-muted">Suggested default; save preferences to apply it.</span>}</label>
                </div>
                <StringListEditor label="Interests" values={preferenceForm.interests} onChange={(interests) => setPreferenceForm((current) => ({ ...current, interests }))} placeholder="Culture, Food, Nature..." suggestions={["Culture", "Food", "Nature"]} />
                <StringListEditor label="Preferred Activities" values={preferenceForm.preferredActivities} onChange={(preferredActivities) => setPreferenceForm((current) => ({ ...current, preferredActivities }))} placeholder="Sightseeing, Walking..." suggestions={["Beach", "Hiking", "Nightlife", "Photography", "Relaxation", "Shopping", "Sightseeing", "Walking"]} />
                <StringListEditor label="Dietary Preferences" values={preferenceForm.dietaryPreferences} onChange={(dietaryPreferences) => setPreferenceForm((current) => ({ ...current, dietaryPreferences }))} placeholder="No Pork, Vegetarian-friendly..." suggestions={["No Pork", "Vegetarian-friendly", "Halal", "Seafood"]} />
                {preferencesSaveError && <p role="alert" className="rounded-panel border border-line bg-bg px-4 py-3 text-sm text-fg">{preferencesSaveError.message}</p>}
                <div className="flex flex-wrap gap-3 border-t border-line pt-5"><button type="button" disabled={preferencesSaving} onClick={() => void savePreferenceForm()} className="inline-flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50"><Save size={15} /> {preferencesSaving ? "Saving..." : "Save preferences"}</button><button type="button" onClick={() => setPreferenceForm(toPreferenceForm(preferences))} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-fg">Reset</button></div>
              </div>
            )}
          </motion.section>
        )}

        <section aria-labelledby="your-data-heading" className="mt-6 rounded-panel border border-line bg-surface p-6 shadow-panel sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="your-data-heading" className="text-xl font-semibold text-fg">Your data</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Read how TravelMate uses and stores your information. To request deletion of your account and associated data, contact travelmate@gmail.com.
              </p>
            </div>
            <Link to="/privacy" className="inline-flex shrink-0 items-center justify-center rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-accent underline underline-offset-4">
              Privacy Notice
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}

export default AccountSettings;
