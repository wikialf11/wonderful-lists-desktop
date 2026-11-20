import { useEffect, useState } from "react";
import { getTaskImageSignedUrl, isPendingImageValue, isStoredImageValue } from "@/lib/customFields";

type Props = {
  value: unknown;
  alt: string;
  inkColor: string;
};

export const TaskImagePreview = ({ value, alt, inkColor }: Props) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isPendingImageValue(value)) {
      setSrc(value.previewUrl);
      return;
    }
    if (isStoredImageValue(value)) {
      getTaskImageSignedUrl(value.path)
        .then((url) => { if (!cancelled) setSrc(url); })
        .catch(() => { if (!cancelled) setSrc(null); });
      return () => { cancelled = true; };
    }
    setSrc(null);
    return () => { cancelled = true; };
  }, [value]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className="mt-2 w-full max-h-56 object-cover"
      style={{ border: `3px solid ${inkColor}` }}
    />
  );
};