import { FormEvent, useEffect, useState } from "react";
import type { List } from "@/hooks/useLists";

type Props = {
  list: List | null;
  canEdit: boolean;
  onClose: () => void;
  onSave: (patch: Partial<List>) => Promise<void> | void;
  onDelete?: () => void;
  bgColor: string;
  inkColor: string;
};

export const EditListDialog = ({ list, canEdit, onClose, onSave, onDelete, bgColor, inkColor }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description ?? "");
    }
  }, [list]);

  if (!list) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name: name.trim(), description: description.trim() || null });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: `${inkColor}cc` }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md p-5 md:p-6 shadow-brutal"
        style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
      >
        <h2 className="display-font text-2xl uppercase mb-4">Editar lista</h2>

        <label className="font-mono-brutal text-xs uppercase block mb-2">Nombre</label>
        <input
          type="text"
          aria-label="Nombre de la lista"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={!canEdit}
          autoFocus
          className="w-full px-4 py-3 text-xl display-font uppercase outline-hidden mb-4 disabled:opacity-60"
          style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
        />

        <label className="font-mono-brutal text-xs uppercase block mb-2">Descripción</label>
        <textarea
          aria-label="Descripción de la lista"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={!canEdit}
          placeholder="Para qué es esta lista…"
          className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden mb-4 resize-y disabled:opacity-60"
          style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 font-mono-brutal uppercase text-sm py-3 shadow-brutal-hover"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            Cerrar
          </button>
          {canEdit && (
            <button
              type="submit"
              className="flex-1 font-mono-brutal uppercase text-sm py-3 shadow-brutal-hover"
              style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
            >
              Guardar
            </button>
          )}
        </div>

        {canEdit && onDelete && (confirmDelete ? (
          <div className="w-full mt-3 p-3" style={{ border: `3px solid ${inkColor}` }}>
            <p className="font-mono-brutal text-xs uppercase mb-2">
              ¿Borrar la lista "{list.name}" y todas sus tareas?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTimeout(() => {
                    onDelete();
                    onClose();
                  }, 80);
                }}
                className="flex-1 font-mono-brutal uppercase text-xs py-2"
                style={{ backgroundColor: "hsl(var(--danger))", color: bgColor, border: "3px solid hsl(var(--danger))" }}
              >
                Sí, borrar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 font-mono-brutal uppercase text-xs py-2"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full mt-3 font-mono-brutal uppercase text-xs py-2 shadow-brutal-hover"
            style={{ backgroundColor: "hsl(var(--danger))", color: bgColor, border: `3px solid hsl(var(--danger))` }}
          >
            Borrar lista
          </button>
        ))}
      </form>
    </div>
  );
};
