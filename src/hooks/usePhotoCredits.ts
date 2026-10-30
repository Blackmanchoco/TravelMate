import { useEffect, useState } from "react";

export interface PhotoCredit {
  file: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourcePageUrl: string;
  note?: string;
  modifications: { cropped: boolean; resized: boolean; recompressed: boolean };
  objectPosition: string;
}

let pendingCredits: Promise<PhotoCredit[]> | undefined;
function loadCredits() {
  pendingCredits ??= fetch("/images/credits.json").then(async (response) => {
    if (!response.ok) throw new Error("Photo credits could not be loaded.");
    const result: unknown = await response.json();
    if (!Array.isArray(result)) throw new Error("Invalid photo credits.");
    return result.filter((entry): entry is PhotoCredit => (
      typeof entry === "object" && entry !== null
      && ["file", "title", "author", "license", "licenseUrl", "sourcePageUrl"].every(
        (key) => typeof entry[key] === "string" && entry[key].trim().length > 0,
      )
      && /^\/images\/(?:places|destinations)\/[a-z0-9-]+\.jpg$/.test(entry.file)
      && (entry.note === undefined || (typeof entry.note === "string" && entry.note.trim().length > 0))
    ));
  });
  return pendingCredits;
}

export function usePhotoCredits() {
  const [credits, setCredits] = useState<PhotoCredit[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    loadCredits().then((result) => { if (active) setCredits(result); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return { credits, error };
}
