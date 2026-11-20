import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { ChecklistProgress } from "@/components/ChecklistProgress";
import { newChecklistItem, type ChecklistItem } from "@/lib/checklist";

type Props = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  inkColor: string;
  bgColor: string;
};

export function ChecklistEditor({ items, onChange, inkColor, bgColor }: Props) {
  const [text, setText] = useState("");

  const add = () => {
    const clean = text.trim();
    if (!clean) return;
    onChange([...items, newChecklistItem(clean)]);
    setText("");
  };

  const toggle = (id: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const rename = (id: string, value: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text: value } : item)));
  };

  const remove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Subtarea…"
          className="flex-1 px-3 py-2 font-mono-brutal text-xs outline-hidden"
          style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!text.trim()}
          aria-label="Añadir subtarea"
          className="w-10 h-10 flex items-center justify-center disabled:opacity-40"
          style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2 mb-3">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-label={item.done ? `Desmarcar ${item.text}` : `Completar ${item.text}`}
                aria-pressed={item.done}
                className="w-6 h-6 shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: item.done ? inkColor : bgColor,
                  color: item.done ? bgColor : inkColor,
                  border: `2px solid ${inkColor}`,
                }}
              >
                {item.done && <Check className="w-4 h-4" strokeWidth={3} />}
              </button>
              <input
                type="text"
                value={item.text}
                onChange={(event) => rename(item.id, event.target.value)}
                aria-label={`Subtarea ${index + 1}`}
                className="flex-1 px-2 py-1 font-mono-brutal text-xs outline-hidden"
                style={{
                  backgroundColor: bgColor,
                  color: inkColor,
                  border: `2px solid ${inkColor}`,
                  textDecoration: item.done ? "line-through" : "none",
                  opacity: item.done ? 0.7 : 1,
                }}
              />
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Eliminar ${item.text}`}
                className="w-8 h-8 flex items-center justify-center shrink-0"
                style={{ border: `2px solid ${inkColor}`, color: inkColor }}
              >
                <Trash2 className="w-3 h-3" strokeWidth={3} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ChecklistProgress items={items} inkColor={inkColor} bgColor={bgColor} />
      )}
    </div>
  );
}
