import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/local/client";
import { toast } from "sonner";
import {
  formatTaskFileSize,
  safeTaskFileName,
  type TaskFile,
} from "@/lib/taskFiles";

const MAX_TASK_FILE_MB = 100;

type Props = {
  files: TaskFile[];
  onChange: (files: TaskFile[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  inkColor: string;
  bgColor: string;
};

export function TaskFilesEditor({ files, onChange, onUploadingChange, inkColor, bgColor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const setBusy = (delta: number) => {
    setUploading((current) => {
      const next = Math.max(0, current + delta);
      onUploadingChange?.(next > 0);
      return next;
    });
  };

  const addFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const list = Array.from(selected);
    const accepted: TaskFile[] = [];

    for (const file of list) {
      if (file.size > MAX_TASK_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name}: supera ${MAX_TASK_FILE_MB} MB`);
        continue;
      }
      setBusy(1);
      try {
        // `upload` adds the "task-files/" bucket internally. Store the full
        // relative path so opening it later resolves under attachments/.
        const objectPath = `${crypto.randomUUID()}-${safeTaskFileName(file.name)}`;
        const path = `task-files/${objectPath}`;
        const { error } = await supabase.storage.from("task-files").upload(objectPath, file);
        if (error) throw error;
        accepted.push({
          id: crypto.randomUUID(),
          path,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        });
      } catch {
        toast.error(`No se pudo guardar ${file.name}`);
      } finally {
        setBusy(-1);
      }
    }

    if (accepted.length > 0) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const open = (file: TaskFile) => {
    if (window.desktop?.localFiles) void window.desktop.localFiles.open(file.path);
  };

  const remove = (id: string) => onChange(files.filter((file) => file.id !== id));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        aria-label="Añadir archivos a la tarea"
        onChange={(event) => void addFiles(event.target.files)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading > 0}
        className="w-full font-mono-brutal text-xs uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ backgroundColor: bgColor, color: inkColor, border: `3px dashed ${inkColor}` }}
      >
        {uploading > 0 ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Paperclip className="w-4 h-4" strokeWidth={3} />
        )}
        {uploading > 0 ? "Guardando archivos…" : "Añadir archivos"}
      </button>
      <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-2">
        Cualquier extensión · máx. {MAX_TASK_FILE_MB} MB por archivo · se guardan en tu equipo
      </p>

      {files.length > 0 && (
        <ul className="space-y-2 mt-3">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 px-3 py-2"
              style={{ border: `2px solid ${inkColor}` }}
            >
              <FileText className="w-4 h-4 shrink-0" strokeWidth={3} />
              <button
                type="button"
                onClick={() => open(file)}
                className="flex-1 min-w-0 text-left font-mono-brutal text-[11px] uppercase truncate"
                style={{ color: inkColor }}
                title={`Abrir ${file.name}`}
              >
                {file.name}
              </button>
              <span className="font-mono-brutal text-[10px] uppercase opacity-60 shrink-0">
                {formatTaskFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(file.id)}
                aria-label={`Quitar ${file.name}`}
                className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{ border: `2px solid ${inkColor}` }}
              >
                <Trash2 className="w-3 h-3" strokeWidth={3} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
