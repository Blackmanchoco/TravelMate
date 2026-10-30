import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

interface StringListEditorProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  suggestions?: string[];
}

export function StringListEditor({ label, values, onChange, placeholder, suggestions = [] }: StringListEditorProps) {
  const listId = useId();
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const candidates = draft.split(",").map((value) => value.trim()).filter(Boolean);
    if (candidates.length === 0) return;
    const seen = new Set(values.map((value) => value.toLocaleLowerCase()));
    const next = [...values];
    candidates.forEach((candidate) => {
      const normalized = candidate.toLocaleLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        next.push(candidate);
      }
    });
    onChange(next);
    setDraft("");
  };

  return (
    <div className="text-sm font-medium text-fg">
      <span className="mb-2 block">{label}</span>
      <div className="rounded-panel border border-line bg-bg p-3 focus-within:border-accent focus-within:bg-surface">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value.toLocaleLowerCase()} className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-sm font-medium text-accent">
              {value}
              <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full p-2 hover:bg-tint"><X size={13} /></button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={draft} list={listId} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addDraft(); } }} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-fg outline-none" />
          <datalist id={listId}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
          <button type="button" onClick={addDraft} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-accent shadow-panel"><Plus size={14} /> Add</button>
        </div>
      </div>
      <p className="mt-1.5 text-xs font-normal text-muted">Press Enter or comma to add another value.</p>
    </div>
  );
}
