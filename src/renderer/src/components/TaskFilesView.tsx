import { FileText } from "lucide-react";
import { formatTaskFileSize, type TaskFile } from "@/lib/taskFiles";

type Props = {
  files: TaskFile[];
  inkColor: string;
  bgColor: string;
};

export function TaskFilesView({ files, inkColor, bgColor }: Props) {
  if (files.length === 0) return null;

  const open = (file: TaskFile) => {
    if (window.desktop?.localFiles) void window.desktop.localFiles.open(file.path);
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <ul className="space-y-1.5">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => open(file)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
              style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
              title={`Abrir ${file.name}`}
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
