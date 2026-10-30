import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createAdminPlace, getAdminPlaceOptions } from "../../api/admin.api";
import type { AdminPlaceOptions, CreateAdminPlaceInput } from "../../api/admin.api";
import { ApiError } from "../../lib/api-client";

type Field = keyof CreateAdminPlaceInput;
type Draft = Record<Exclude<Field, "destinationId" | "latitude" | "longitude" | "priceLevel" | "tags" | "activityTypes" | "travelStyleTags" | "displayTags">, string> & {
  destinationId: string; latitude: string; longitude: string; priceLevel: string;
  tags: string[]; activityTypes: string[]; travelStyleTags: string[]; displayTags: string;
};

const initialDraft: Draft = {
  destinationId: "", name: "", category: "", description: "", address: "", latitude: "", longitude: "",
  priceLevel: "", sourceUrl: "", tags: [], activityTypes: [], travelStyleTags: [], displayTags: "",
};

function fieldForError(error: ApiError): Field | null {
  if (error.status === 409) return "name";
  if (error.message === "Destination not found.") return "destinationId";
  const match = /Invalid (destinationId|name|category|description|address|priceLevel|sourceUrl|tags|activityTypes|travelStyleTags|displayTags)\./u.exec(error.message);
  if (match) return match[1] as Field;
  if (error.message === "Invalid coordinates.") return "latitude";
  if (error.message === "Too many displayTags.") return "displayTags";
  return null;
}

export default function AdminPlaceForm({ onCreated }: { onCreated: (id: number, name: string) => void }) {
  const [options, setOptions] = useState<AdminPlaceOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [preview, setPreview] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getAdminPlaceOptions(undefined, controller.signal)
      .then(setOptions)
      .catch((error) => {
        if (!controller.signal.aborted) setOptionsError(error instanceof Error ? error.message : "Could not load place options.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!options) return;
    if (!draft.displayTags.trim()) { setPreview([]); setPreviewError(null); setPreviewLoading(false); return; }
    setPreviewLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void getAdminPlaceOptions(draft.displayTags, controller.signal)
        .then((result) => { setPreview(result.displayTagsPreview); setPreviewError(null); setPreviewLoading(false); })
        .catch((error) => {
          if (!controller.signal.aborted) { setPreview([]); setPreviewError(error instanceof Error ? error.message : "Invalid display tags."); setPreviewLoading(false); }
        });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [draft.displayTags, options]);

  function setText(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "displayTags") { setPreviewLoading(Boolean(value.trim())); setPreviewError(null); }
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  function toggle(field: "tags" | "activityTypes" | "travelStyleTags", value: string) {
    setDraft((current) => ({ ...current, [field]: current[field].includes(value)
      ? current[field].filter((item) => item !== value) : [...current[field], value] }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || previewLoading || previewError || !options) return;
    setSubmitting(true);
    setErrors({});
    setSubmitError(null);
    setCreatedId(null);
    try {
      const normalized = draft.displayTags.trim()
        ? (await getAdminPlaceOptions(draft.displayTags)).displayTagsPreview : [];
      const input: CreateAdminPlaceInput = {
        destinationId: Number(draft.destinationId), name: draft.name, category: draft.category,
        description: draft.description, address: draft.address, latitude: Number(draft.latitude),
        longitude: Number(draft.longitude), priceLevel: Number(draft.priceLevel), sourceUrl: draft.sourceUrl,
        tags: draft.tags, activityTypes: draft.activityTypes, travelStyleTags: draft.travelStyleTags,
        displayTags: normalized,
      };
      const created = await createAdminPlace(input);
      setCreatedId(created.id);
      setDraft(initialDraft);
      setPreview([]);
      onCreated(created.id, created.name);
    } catch (error) {
      if (error instanceof ApiError) {
        const field = fieldForError(error);
        if (field === "latitude" && error.message === "Invalid coordinates.") setErrors({ latitude: error.message, longitude: error.message });
        else if (field) setErrors({ [field]: error.message });
        else setSubmitError(error.message);
      } else setSubmitError("The place could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-accent";
  const labelClass = "block min-w-0 text-sm font-medium text-fg";
  const fieldError = (field: Field) => errors[field] && <span role="alert" className="mt-1 block text-xs text-fg">{errors[field]}</span>;
  const vocabularyLabels = { tags: "Place themes", activityTypes: "Activities", travelStyleTags: "Travel styles" } as const;

  return (
    <section className="border-b border-line p-5 sm:p-7" aria-labelledby="add-place-heading">
      <h2 id="add-place-heading" className="text-xl font-semibold text-fg">Add place</h2>
      <p className="mt-1 text-sm text-muted">Source and controlled tags are required. The source link stays in Admin.</p>
      {optionsError && <p role="alert" className="mt-3 text-sm text-fg">{optionsError}</p>}
      {!options ? null : <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Destination *
            <select required value={draft.destinationId} onChange={(event) => setText("destinationId", event.target.value)} className={inputClass}>
              <option value="">Choose destination</option>{options.destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>{fieldError("destinationId")}
          </label>
          <label className={labelClass}>Category *
            <select required value={draft.category} onChange={(event) => setText("category", event.target.value)} className={inputClass}>
              <option value="">Choose category</option>{options.categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>{fieldError("category")}
          </label>
          <label className={labelClass}>Name *
            <input required maxLength={options.limits.name} value={draft.name} onChange={(event) => setText("name", event.target.value)} className={inputClass} />{fieldError("name")}
          </label>
          <label className={labelClass}>Address *
            <input required maxLength={options.limits.address} value={draft.address} onChange={(event) => setText("address", event.target.value)} className={inputClass} />{fieldError("address")}
          </label>
        </div>
        <label className={labelClass}>Description *
          <textarea required maxLength={options.limits.description} rows={3} value={draft.description} onChange={(event) => setText("description", event.target.value)} className={inputClass} />{fieldError("description")}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>Latitude * ({options.bounds.minLatitude}–{options.bounds.maxLatitude})
            <input required type="number" step="any" min={options.bounds.minLatitude} max={options.bounds.maxLatitude} value={draft.latitude} onChange={(event) => setText("latitude", event.target.value)} className={inputClass} />{fieldError("latitude")}
          </label>
          <label className={labelClass}>Longitude * ({options.bounds.minLongitude}–{options.bounds.maxLongitude})
            <input required type="number" step="any" min={options.bounds.minLongitude} max={options.bounds.maxLongitude} value={draft.longitude} onChange={(event) => setText("longitude", event.target.value)} className={inputClass} />{fieldError("longitude")}
          </label>
          <label className={labelClass}>Price level *
            <select required value={draft.priceLevel} onChange={(event) => setText("priceLevel", event.target.value)} className={inputClass}>
              <option value="">Choose level</option>{[1, 2, 3, 4].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>{fieldError("priceLevel")}
          </label>
        </div>
        <label className={labelClass}>Source URL *
          <input required type="url" maxLength={options.limits.sourceUrl} value={draft.sourceUrl} onChange={(event) => setText("sourceUrl", event.target.value)} placeholder="https://…" className={inputClass} />{fieldError("sourceUrl")}
        </label>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["tags", "activityTypes", "travelStyleTags"] as const).map((field) => <fieldset key={field} className="rounded-control border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-fg">{vocabularyLabels[field]} *</legend>
            <div className="flex flex-wrap gap-3">{options.vocabulary[field].map((value) => <label key={value} className="inline-flex items-center gap-1.5 text-sm text-fg">
              <input type="checkbox" checked={draft[field].includes(value)} onChange={() => toggle(field, value)} />{value}
            </label>)}</div>{fieldError(field)}
          </fieldset>)}
        </div>
        <label className={labelClass}>Display labels (comma separated, up to {options.limits.displayTags})
          <input value={draft.displayTags} onChange={(event) => setText("displayTags", event.target.value)} placeholder="City Walk, Night Market" className={inputClass} />
          <span className="mt-1 block text-xs font-normal text-muted">Server preview: {previewLoading ? "normalizing…" : preview.length ? preview.join(", ") : "none"}</span>
          {previewError && <span role="alert" className="mt-1 block text-xs text-fg">{previewError}</span>}{fieldError("displayTags")}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={submitting || previewLoading || Boolean(previewError)} className="rounded-control bg-fg px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:cursor-wait disabled:opacity-50">
            {submitting ? "Creating…" : "Create place"}
          </button>
          {createdId !== null && <p role="status" className="text-sm font-medium text-accent">Place created: ID {createdId}</p>}
          {submitError && <p role="alert" className="text-sm text-fg">{submitError}</p>}
        </div>
      </form>}
    </section>
  );
}
