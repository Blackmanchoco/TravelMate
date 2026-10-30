import PhotoPlaceholder from "./PhotoPlaceholder";
import { useState, type ReactNode } from "react";
import { usePhotoCredits } from "../../hooks/usePhotoCredits";

interface LocalPhotoProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  category?: string;
}

export default function LocalPhoto({ src, alt, className, fallback, category }: LocalPhotoProps) {
  const { credits } = usePhotoCredits();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const localSource = src?.startsWith("/") && !src.startsWith("//") ? src : null;
  const credit = credits.find((entry) => entry.file === localSource);
  if (!localSource || !credit || localSource === "/destination-placeholder.svg" || failedSource === localSource) {
    return fallback ?? <PhotoPlaceholder name={alt || "TravelMate"} category={category} className={className} />;
  }
  return <img src={localSource} alt={alt} className={className}
    style={{ objectFit: "cover", objectPosition: credit?.objectPosition ?? "50% 50%" }}
    onError={() => setFailedSource(localSource)} />;
}
