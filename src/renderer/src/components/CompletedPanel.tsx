import { useEffect, useState } from "react";
import { supabase } from "@/integrations/local/client";
import { toast } from "sonner";

type CompletedTask = {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  completed_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  listId: string;
  bgColor: string;
  inkColor: string;
  onChanged: () => void;
};

export const CompletedPanel = ({ open, onClose, listId, bgColor, inkColor, onChanged }: Props) => {
  const [items, setItems] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, description, due_date, completed_at")
        .eq("list_id", listId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      setLoading(false);
      if (error) {
        toast.error("Error cargando completadas");
        return;
      }
      setItems((data ?? []) as CompletedTask[]);
    };
    load();
  }, [open, listId]);

  if (!open) return null;

  const restore = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ completed_at: null }).eq("id", id);
    if (error) {
      toast.error("No se pudo restaurar");
      return;
    }
    setItems((it) => it.filter((x) => x.id !== id));
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo borrar");
      return;
    }
    setItems((it) => it.filter((x) => x.id !== id));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: `${inkColor}cc` }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl p-5 md:p-6 shadow-brutal max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="display-font text-2xl uppercase">Completadas</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="font-mono-brutal text-lg uppercase w-10 h-10 flex items-center justify-center shadow-brutal-hover leading-none"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="font-mono-brutal text-xs uppercase">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center" style={{ border: `4px dashed ${inkColor}` }}>
            <p className="font-mono-brutal uppercase text-sm">Aún no hay completadas.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((t) => (
              <li
                key={t.id}
                className="p-4 flex items-center justify-between gap-3"
                style={{ border: `3px solid ${inkColor}`, opacity: 0.85 }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="display-font text-xl uppercase truncate line-through">{t.name}</h3>
                  <p className="font-mono-brutal text-[10px] uppercase opacity-70 mt-1">
                    Hecha {new Date(t.completed_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => restore(t.id)}
                  className="font-mono-brutal text-xs uppercase px-3 py-2 shadow-brutal-hover"
                  style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
                >
                  Restaurar
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="font-mono-brutal text-xs uppercase px-3 py-2 shadow-brutal-hover"
                  style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
