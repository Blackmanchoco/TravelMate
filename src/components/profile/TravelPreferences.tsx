import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { ApiError } from "../../lib/api-client";
import type { UserPreference } from "../../types/user";

interface Props { preferences: UserPreference | null; isLoading: boolean; error: ApiError | null; onRetry: () => Promise<UserPreference | null>; }

function Value({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-panel border border-line bg-bg p-4"><p className="text-sm font-semibold text-muted">{label}</p><p className="mt-2 font-semibold text-fg">{value || "Not set"}</p></div>;
}

function Tags({ label, values }: { label: string; values: string[] }) {
  return <div className="rounded-panel border border-line bg-bg p-4"><p className="text-sm font-semibold text-muted">{label}</p><div className="mt-3 flex flex-wrap gap-2">{values.length ? values.map((value) => <span key={value.toLocaleLowerCase()} className="rounded-full bg-surface px-3 py-1.5 text-sm text-muted shadow-panel">{value}</span>) : <span className="text-sm text-muted">Not set</span>}</div></div>;
}

export function TravelPreferences({ preferences, isLoading, error, onRetry }: Props) {
  return <div className="rounded-panel border border-line bg-surface p-6 shadow-panel"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Travel preferences</p><h2 className="mt-2 text-2xl font-semibold text-fg">Your saved travel signals</h2></div><div className="rounded-panel bg-tint p-3 text-accent"><Sparkles size={18} /></div></div>{isLoading ? <p className="mt-6 text-sm text-muted">Loading preferences...</p> : error ? <div className="mt-6 rounded-panel border border-line bg-bg p-4 text-sm text-fg"><p>{error.message}</p><button type="button" onClick={() => void onRetry().catch(() => undefined)} className="mt-2 font-semibold">Try again</button></div> : !preferences ? <div className="mt-6 rounded-panel border border-dashed border-line bg-bg p-5 text-sm text-muted"><p>No travel preferences saved yet.</p><Link to="/account-settings" className="mt-3 inline-block font-semibold text-accent">Set preferences</Link></div> : <div className="mt-6 space-y-4"><div className="grid gap-4 md:grid-cols-2"><Value label="Travel style" value={preferences.travelStyle} /><Value label="Budget" value={preferences.budget} /><Value label="Transportation" value={preferences.preferredTransportation} /><Value label="Trip duration" value={preferences.tripDuration} /></div><Tags label="Interests" values={preferences.interests} /><Tags label="Preferred activities" values={preferences.preferredActivities} /><Tags label="Dietary preferences" values={preferences.dietaryPreferences} /><Link to="/account-settings" className="inline-block text-sm font-semibold text-accent">Edit preferences</Link></div>}</div>;
}
