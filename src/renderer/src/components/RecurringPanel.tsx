import { useState } from "react";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type RecurringTemplate = {
  id: string;
  name: string;
  description?: string | null;
  due_date: string | null;
  recurrence_days?: number[];
  recurrence_interval_days?: number;
  recurrence_anchor_date?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  templates: RecurringTemplate[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void> | void;
  bgColor: string;
  inkColor: string;
};

const WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

function recurrenceLabel(template: RecurringTemplate): string {
  const days = Array.isArray(template.recurrence_days) ? template.recurrence_days : [];
  const interval = template.recurrence_interval_days ?? 0;
  if (days.length === 7) return "Todos los días";
  if (days.length > 0) return days.map((day) => WEEKDAYS[day] ?? day).join(" · ");
  if (interval > 0) return `Cada ${interval} día${interval === 1 ? "" : "s"}`;
  return "Sin repetición";
}

function nextDate(template: RecurringTemplate): string {
  const days = Array.isArray(template.recurrence_days) ? template.recurrence_days : [];
  const interval = template.recurrence_interval_days ?? 0;
  const due = template.due_date ? new Date(template.due_date) : null;

  // A real due date is the best source of truth (not the 1970 time-only anchor).
  if (due && !Number.isNaN(due.getTime()) && due.getUTCFullYear() !== 1970) {
    return due.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (days.length > 0) {
    const today = new Date();
    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + offset);
      if (days.includes(candidate.getDay())) {
        return candidate.toLocaleDateString("es-ES", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        });
      }
    }
  }

  if (interval > 0 && template.recurrence_anchor_date) {
    const anchor = new Date(`${template.recurrence_anchor_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - anchor.getTime()) / 86400000);
    const next = new Date(anchor);
    if (diff > 0) {
      const remainder = diff % interval;
      next.setDate(anchor.getDate() + diff + (remainder === 0 ? 0 : interval - remainder));
    }
    return next.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  }

  return "Para hoy";
}

export function RecurringPanel({ open, onClose, templates, onEdit, onDelete, bgColor, inkColor }: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await onDelete(id);
      toast.success("Repetición eliminada");
      setDeleteId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg p-5 md:p-6 shadow-brutal max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="display-font text-2xl uppercase flex items-center gap-2">
            <Repeat className="w-5 h-5" strokeWidth={3} /> Repeticiones
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="font-mono-brutal text-lg uppercase w-9 h-9 flex items-center justify-center shadow-brutal-hover leading-none"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            ×
          </button>
        </div>
        <p className="font-mono-brutal text-[10px] uppercase opacity-70 mb-5 leading-relaxed">
          Estas son las reglas que generan las tareas repetidas. No se muestran en la
          lista para no duplicar el item; aquí puedes editarlas o borrarlas.
        </p>

        {templates.length === 0 ? (
          <div className="p-6 text-center" style={{ border: `3px dashed ${inkColor}` }}>
            <p className="font-mono-brutal text-xs uppercase">No hay repeticiones.</p>
            <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-2">
              Crea una tarea y añade el campo «Repetir».
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {templates.map((template) => (
              <li
                key={template.id}
                className="p-3"
                style={{ border: `3px solid ${inkColor}` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono-brutal text-sm uppercase break-words">{template.name}</p>
                    <p className="font-mono-brutal text-[10px] uppercase opacity-70 mt-1">
                      {recurrenceLabel(template)} · próxima: {nextDate(template)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(template.id)}
                      aria-label={`Editar ${template.name}`}
                      className="w-8 h-8 flex items-center justify-center"
                      style={{ border: `2px solid ${inkColor}` }}
                    >
                      <Pencil className="w-3 h-3" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(template.id)}
                      aria-label={`Eliminar ${template.name}`}
                      className="w-8 h-8 flex items-center justify-center"
                      style={{ border: `2px solid ${inkColor}` }}
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={3} />
                    </button>
                  </div>
                </div>

                {deleteId === template.id && (
                  <div className="mt-3 pt-3" style={{ borderTop: `2px solid ${inkColor}` }}>
                    <p className="font-mono-brutal text-[10px] uppercase mb-2">
                      ¿Eliminar esta repetición? Las instancias ya creadas se quedan.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(template.id)}
                        className="flex-1 font-mono-brutal uppercase text-[10px] py-2 disabled:opacity-50"
                        style={{ backgroundColor: "hsl(var(--danger))", color: bgColor, border: "3px solid hsl(var(--danger))" }}
                      >
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(null)}
                        className="flex-1 font-mono-brutal uppercase text-[10px] py-2"
                        style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full font-mono-brutal uppercase text-sm py-3 shadow-brutal-hover mt-5"
          style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
