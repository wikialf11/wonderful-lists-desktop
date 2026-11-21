import { useRef, useState } from "react";
import { ExternalLink, Paperclip } from "lucide-react";
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
  const lastOpenRef = useRef(0);

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

  const open = async () => {
    setLoading(true);
    try {
      if (window.desktop?.localFiles) {
        const result = await window.desktop.localFiles.open(`task-files/${value.path}`);
        if (!result.ok) throw new Error(result.error ?? "No se pudo abrir el archivo");
        return;
      }
      const url = await getTaskFileSignedUrl(value.path, value.name);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el archivo");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    // Double click fires two clicks: open only once.
    const now = Date.now();
    if (now - lastOpenRef.current < 450) return;
    lastOpenRef.current = now;
    void open();
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      onDoubleClick={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      disabled={loading}
      aria-label={`Abrir ${value.name}`}
      title={`Abrir ${value.name} (doble clic)`}
      className="mt-2 w-full flex items-center gap-2 px-3 py-2 font-mono-brutal text-[11px] uppercase text-left disabled:opacity-60"
      style={{ border: `3px solid ${inkColor}`, color: inkColor, backgroundColor: bgColor }}
    >
      <Paperclip className="w-4 h-4 shrink-0" strokeWidth={3} />
      <span className="truncate flex-1">{value.name}</span>
      <span className="opacity-70 shrink-0">{formatFileSize(value.size)}</span>
      <ExternalLink className="w-4 h-4 shrink-0" strokeWidth={3} />
    </button>
  );
};
