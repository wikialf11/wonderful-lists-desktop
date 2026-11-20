import { checklistProgress, type ChecklistItem } from "@/lib/checklist";

type Props = {
  items: ChecklistItem[];
  inkColor: string;
  bgColor: string;
};

export function ChecklistProgress({ items, inkColor, bgColor }: Props) {
  const progress = checklistProgress(items);
  const done = items.filter((item) => item.done).length;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-4 relative overflow-hidden"
        style={{ border: `3px solid ${inkColor}`, backgroundColor: bgColor }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label={`Progreso del checklist: ${progress}%`}
      >
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${progress}%`, backgroundColor: inkColor }}
        />
      </div>
      <span className="font-mono-brutal text-xs uppercase shrink-0">
        {progress}% · {done}/{items.length}
      </span>
    </div>
  );
}
