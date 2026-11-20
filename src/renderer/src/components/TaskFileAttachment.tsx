import { useState } from "react";
import { Download, Paperclip } from "lucide-react";
import {
  formatFileSize,
  getTaskFileSignedUrl,
  isPendingFileValue,
  isStoredFileValue,
} from "@/lib/customFields";
import { toast } from "sonner";

type Props = {
  value: unknown;
  inkColor: string;
  bgColor?: string;
};

export const TaskFileAttachment = ({ value, inkColor, bgColor }: Props) => {
  const [loading, setLoading] = useState(false);

  if (isPendingFileValue(value)) {
    return (
      <div
        className="mt-2 flex items-center gap-2 px-3 py-2 font-mono-brutal text-[11px] uppercase"
        style={{ border: `3px solid ${inkColor}`, color: inkColor }}
      >
        <Paperclip className="w-4 h-4 shrink-0" strokeWidth={3} />
        <span className="truncate flex-1">{value.name}</span>
        <span className="opacity-70 shrink-0">{formatFileSize(value.size)} · pendiente</span>
      </div>
    );
  }

  if (!isStoredFileValue(value)) return null;

  const download = async () => {
    setLoading(true);
    try {
      const url = await getTaskFileSignedUrl(value.path, value.name);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo descargar el archivo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      aria-label={`Descargar ${value.name}`}
      className="mt-2 w-full flex items-center gap-2 px-3 py-2 font-mono-brutal text-[11px] uppercase text-left disabled:opacity-60"
      style={{ border: `3px solid ${inkColor}`, color: inkColor, backgroundColor: bgColor }}
    >
      <Paperclip className="w-4 h-4 shrink-0" strokeWidth={3} />
      <span className="truncate flex-1">{value.name}</span>
      <span className="opacity-70 shrink-0">{formatFileSize(value.size)}</span>
      <Download className="w-4 h-4 shrink-0" strokeWidth={3} />
    </button>
  );
};
