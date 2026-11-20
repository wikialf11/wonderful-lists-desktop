import { Check } from "lucide-react";
import { ChecklistProgress } from "@/components/ChecklistProgress";
import { type ChecklistItem } from "@/lib/checklist";

type Props = {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  inkColor: string;
  bgColor: string;
};

export function ChecklistView({ items, onToggle, inkColor, bgColor }: Props) {
  if (items.length === 0) return null;

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <ul className="space-y-1.5 mb-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              aria-label={item.done ? `Desmarcar ${item.text}` : `Completar ${item.text}`}
              aria-pressed={item.done}
              className="w-5 h-5 mt-0.5 shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: item.done ? inkColor : bgColor,
                color: item.done ? bgColor : inkColor,
                border: `2px solid ${inkColor}`,
              }}
            >
              {item.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </button>
            <span
              className="font-mono-brutal text-sm break-words"
              style={{
                textDecoration: item.done ? "line-through" : "none",
                opacity: item.done ? 0.6 : 1,
              }}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      <ChecklistProgress items={items} inkColor={inkColor} bgColor={bgColor} />
    </div>
  );
}
