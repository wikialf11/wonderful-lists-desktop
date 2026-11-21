import { useRef } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { formatTaskFileSize, type TaskFile } from "@/lib/taskFiles";

type Props = {
  files: TaskFile[];
  inkColor: string;
  bgColor: string;
};

export function TaskFilesView({ files, inkColor, bgColor }: Props) {
  // A double click fires two click events. Remember the last file we opened so
  // the second click does not launch the document twice.
  const lastOpenRef = useRef<{ id: string; at: number } | null>(null);

  if (files.length === 0) return null;

  const open = async (file: TaskFile) => {
    if (!window.desktop?.localFiles) {
      toast.error("No se puede abrir el archivo en esta versión");
      return;
    }
    const result = await window.desktop.localFiles.open(file.path);
    if (!result.ok) {
      toast.error(result.error ?? `No se pudo abrir ${file.name}`);
    }
  };

  const handleOpen = (file: TaskFile) => {
    const now = Date.now();
    if (lastOpenRef.current?.id === file.id && now - lastOpenRef.current.at < 450) {
      return;
    }
    lastOpenRef.current = { id: file.id, at: now };
    void open(file);
  };

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <div
      onClick={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onDoubleClick={stop}
    >
      <ul className="space-y-1.5">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => handleOpen(file)}
              onDoubleClick={(event) => event.preventDefault()}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
              style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
              title={`Abrir ${file.name} (doble clic)`}
              aria-label={`Abrir ${file.name}`}
            >
              <FileText className="w-4 h-4 shrink-0" strokeWidth={3} />
              <span className="flex-1 min-w-0 font-mono-brutal text-[11px] uppercase truncate">
                {file.name}
              </span>
              <span className="font-mono-brutal text-[10px] uppercase opacity-60 shrink-0">
                {formatTaskFileSize(file.size)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
