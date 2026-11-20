import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/local/client";

type Props = {
  taskId: string;
  listId?: string | null | undefined;
  fieldId: string;
  value: unknown;
  bgColor: string;
  inkColor: string;
};

export const TaskCounterField = ({ taskId, listId, fieldId, value, bgColor, inkColor }: Props) => {
  const initial = Number(value) || 0;
  const [count, setCount] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCount(Number(value) || 0);
  }, [value]);

  const persist = async (next: number) => {
    if (!listId) return;
    setBusy(true);
    const prev = count;
    setCount(next);
    const { data: existing } = await supabase
      .from("task_custom_field_values")
      .select("id")
      .eq("task_id", taskId)
      .eq("custom_field_id", fieldId)
      .maybeSingle();

    const { error } = existing?.id
      ? await supabase.from("task_custom_field_values").update({ value: next }).eq("id", existing.id)
      : await supabase
          .from("task_custom_field_values")
          .insert({ task_id: taskId, custom_field_id: fieldId, list_id: listId, value: next });

    setBusy(false);
    if (error) {
      setCount(prev);
      toast.error("No se pudo actualizar el contador");
    }
  };

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const btnStyle = { backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` };

  return (
    <div
      className="flex items-stretch gap-2"
      onClick={stop}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Disminuir"
        disabled={busy}
        onClick={(e) => { stop(e); persist(count - 1); }}
        className="w-12 h-11 flex items-center justify-center disabled:opacity-50"
        style={btnStyle}
      >
        <Minus className="w-5 h-5" strokeWidth={3} />
      </button>
      <div
        className="flex-1 h-11 flex items-center justify-center font-mono-brutal text-lg font-bold"
        style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
      >
        {count}
      </div>
      <button
        type="button"
        aria-label="Aumentar"
        disabled={busy}
        onClick={(e) => { stop(e); persist(count + 1); }}
        className="w-12 h-11 flex items-center justify-center disabled:opacity-50"
        style={btnStyle}
      >
        <Plus className="w-5 h-5" strokeWidth={3} />
      </button>
    </div>
  );
};
