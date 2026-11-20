import { useEffect, useRef, useState } from "react";
import { Folder, FolderPlus, ChevronRight, Home, Lock, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/local/client";
import { toast } from "sonner";

export type TaskFolder = {
  id: string;
  list_id: string;
  parent_folder_id: string | null;
  name: string;
  position: number;
  allowed_emails?: string[] | null;
};

type Props = {
  listId: string;
  userId: string;
  isMember: boolean;
  isPremium: boolean;
  bgColor: string;
  inkColor: string;
  currentFolderId: string | null;
  onChangeFolder: (id: string | null) => void;
  onOpenPricing: () => void;
  // For drop targets
  draggingId: string | null;
  draggingType: "task" | "folder" | null;
  onDropOnFolder: (folderId: string | null) => void;
};

export const FoldersBar = ({
  listId,
  userId,
  isMember,
  isPremium,
  bgColor,
  inkColor,
  currentFolderId,
  onChangeFolder,
  onOpenPricing,
  draggingId,
  draggingType,
  onDropOnFolder,
}: Props) => {
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  const [dragOverId, setDragOverId] = useState<string | "ROOT" | null>(null);
  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [editTarget, setEditTarget] = useState<TaskFolder | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskFolder | null>(null);
  // Long-press tracking
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const load = async () => {
    if (!listId) return;
    const { data, error } = await supabase
      .from("task_folders")
      .select("id, list_id, parent_folder_id, name, position, allowed_emails")
      .eq("list_id", listId)
      .order("position", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      console.error("[FoldersBar] load error", error);
      return;
    }
    setFolders((data ?? []) as TaskFolder[]);
  };

  useEffect(() => {
    load();
    if (!listId) return;
    const ch = supabase
      .channel(`folders-${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_folders", filter: `list_id=eq.${listId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  // Build path from root to current folder
  const path: TaskFolder[] = (() => {
    const arr: TaskFolder[] = [];
    let id: string | null = currentFolderId;
    let safety = 0;
    while (id && safety < 50) {
      const f = folders.find((x) => x.id === id);
      if (!f) break;
      arr.unshift(f);
      id = f.parent_folder_id;
      safety++;
    }
    return arr;
  })();

  const childFolders = folders
    .filter((f) => (f.parent_folder_id ?? null) === (currentFolderId ?? null))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const openCreate = () => {
    if (!isPremium) {
      onOpenPricing();
      return;
    }
    if (!isMember) return;
    setCreateName("");
    setShowCreate(true);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    const { error } = await supabase.from("task_folders").insert({
      list_id: listId,
      parent_folder_id: currentFolderId,
      user_id: userId,
      name,
      position: childFolders.length,
    });
    if (error) {
      toast.error("No se pudo crear la carpeta");
      return;
    }
    toast.success("Carpeta creada");
    setShowCreate(false);
    load();
  };

  const openEdit = (f: TaskFolder) => {
    if (!isPremium) {
      onOpenPricing();
      return;
    }
    setEditTarget(f);
    setEditName(f.name);
    setEditParentId(f.parent_folder_id);
  };

  const isDescendantOf = (candidateParentId: string, folderId: string): boolean => {
    // Returns true if candidateParentId is folderId itself or a descendant of folderId
    let cur: string | null = candidateParentId;
    let safety = 0;
    while (cur && safety < 50) {
      if (cur === folderId) return true;
      const f = folders.find((x) => x.id === cur);
      cur = f?.parent_folder_id ?? null;
      safety++;
    }
    return false;
  };


  const submitEdit = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    // Validate parent: cannot move into self or descendants
    if (editParentId && isDescendantOf(editParentId, editTarget.id)) {
      toast.error("No puedes mover una carpeta dentro de sí misma");
      return;
    }
    const { error } = await supabase
      .from("task_folders")
      .update({
        name,
        parent_folder_id: editParentId,
      })
      .eq("id", editTarget.id);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Carpeta actualizada");
    setEditTarget(null);
    load();
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("task_folders").delete().eq("id", deleteTarget.id);
    if (error) toast.error("No se pudo eliminar");
    else load();
    setDeleteTarget(null);
  };

  // Drag-drop handlers for folder targets
  const isDescendant = (folderId: string, ancestorId: string): boolean => {
    let cur: string | null = folderId;
    let safety = 0;
    while (cur && safety < 50) {
      if (cur === ancestorId) return true;
      const f = folders.find((x) => x.id === cur);
      cur = f?.parent_folder_id ?? null;
      safety++;
    }
    return false;
  };

  const canDropOn = (folderId: string | null): boolean => {
    if (!draggingId || !draggingType) return false;
    if (draggingType === "folder" && folderId) {
      // Cannot drop a folder into itself or its own descendants
      if (folderId === draggingId) return false;
      if (isDescendant(folderId, draggingId)) return false;
    }
    return true;
  };

  const folderDropProps = (folderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDropOn(folderId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(folderId === null ? "ROOT" : folderId);
    },
    onDragLeave: () => setDragOverId(null),
    onDrop: (e: React.DragEvent) => {
      if (!canDropOn(folderId)) return;
      e.preventDefault();
      setDragOverId(null);
      onDropOnFolder(folderId);
    },
  });

  return (
    <div className="mb-4 space-y-3">
      {/* Breadcrumb + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onChangeFolder(null)}
          {...folderDropProps(null)}
          aria-label="Raíz de la lista"
          title="Raíz"
          className="font-mono-brutal text-xs uppercase px-2 py-1 flex items-center gap-1 shadow-brutal-hover"
          style={{
            backgroundColor: dragOverId === "ROOT" ? inkColor : bgColor,
            color: dragOverId === "ROOT" ? bgColor : inkColor,
            border: `3px solid ${inkColor}`,
          }}
        >
          <Home className="w-3 h-3" strokeWidth={3} />
          {path.length === 0 ? "Raíz" : ""}
        </button>
        {path.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3" strokeWidth={3} style={{ color: inkColor }} />
            <button
              onClick={() => onChangeFolder(f.id)}
              {...folderDropProps(f.id)}
              className="font-mono-brutal text-xs uppercase px-2 py-1 flex items-center gap-1 shadow-brutal-hover"
              style={{
                backgroundColor: dragOverId === f.id ? inkColor : (i === path.length - 1 ? inkColor : bgColor),
                color: dragOverId === f.id ? bgColor : (i === path.length - 1 ? bgColor : inkColor),
                border: `3px solid ${inkColor}`,
              }}
            >
              <Folder className="w-3 h-3" strokeWidth={3} />
              {f.name}
            </button>
          </div>
        ))}
        <div className="flex-1" />
        {isMember && (
          <button
            onClick={openCreate}
            aria-label="Nueva carpeta"
            title={isPremium ? "Nueva carpeta" : "Premium"}
            className="font-mono-brutal text-xs uppercase px-2 py-1 flex items-center gap-1 shadow-brutal-hover"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            {isPremium ? <FolderPlus className="w-3 h-3" strokeWidth={3} /> : <Lock className="w-3 h-3" strokeWidth={3} />}
            Carpeta
          </button>
        )}
      </div>

      {/* Child folders list */}
      {childFolders.length > 0 && (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {childFolders.map((f) => {
            const startLongPress = (e: React.PointerEvent) => {
              if (!isMember || !isPremium) return;
              if (e.pointerType === "mouse" && e.button !== 0) return;
              longPressTriggered.current = false;
              longPressTimer.current = window.setTimeout(() => {
                longPressTriggered.current = true;
                openEdit(f);
              }, 500);
            };
            const cancelLongPress = () => {
              if (longPressTimer.current) {
                window.clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            };
            return (
              <li
                key={f.id}
                {...folderDropProps(f.id)}
                draggable={isMember}
                onDragStart={(e) => {
                  cancelLongPress();
                  e.dataTransfer.setData("text/folder-id", f.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onPointerDown={startLongPress}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                className="p-3 shadow-brutal-sm shadow-brutal-hover cursor-pointer flex items-center justify-between gap-2 select-none"
                style={{
                  backgroundColor: dragOverId === f.id ? inkColor : bgColor,
                  color: dragOverId === f.id ? bgColor : inkColor,
                  border: `4px solid ${inkColor}`,
                }}
                onClick={() => {
                  if (longPressTriggered.current) {
                    longPressTriggered.current = false;
                    return;
                  }
                  onChangeFolder(f.id);
                }}
                title={isPremium ? "Click: abrir · Mantén pulsado: editar" : "Click: abrir"}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 shrink-0" strokeWidth={3} />
                  <span className="font-mono-brutal text-sm uppercase truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(f); }}
                    aria-label="Editar"
                    className="w-7 h-7 flex items-center justify-center"
                    style={{ border: `2px solid ${dragOverId === f.id ? bgColor : inkColor}` }}
                  >
                    <Pencil className="w-3 h-3" strokeWidth={3} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(f); }}
                    aria-label="Eliminar"
                    className="w-7 h-7 flex items-center justify-center"
                    style={{ border: `2px solid ${dragOverId === f.id ? bgColor : inkColor}` }}
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={3} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create folder modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md p-6 shadow-brutal-sm"
            style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="display-font text-2xl uppercase mb-4">Nueva carpeta</h3>
            <label className="font-mono-brutal text-xs uppercase block mb-2">Nombre</label>
            <input
              autoFocus
              type="text"
              aria-label="Nombre de la nueva carpeta"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); if (e.key === "Escape") setShowCreate(false); }}
              placeholder="Ej. Temporada 1"
              className="w-full px-4 py-3 text-lg display-font uppercase outline-hidden mb-6"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="font-mono-brutal text-xs uppercase px-4 py-3 shadow-brutal-hover"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={!createName.trim()}
                className="font-mono-brutal text-xs uppercase px-4 py-3 shadow-brutal-hover disabled:opacity-40"
                style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit folder modal */}
      {editTarget && (() => {
        const validParents = folders.filter((f) => !isDescendantOf(f.id, editTarget.id));
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setEditTarget(null)}
          >
            <div
              className="w-full max-w-lg p-6 shadow-brutal-sm max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="display-font text-2xl uppercase mb-4">Editar carpeta</h3>

              <label className="font-mono-brutal text-xs uppercase block mb-2">Nombre</label>
              <input
                autoFocus
                type="text"
                aria-label="Nombre de la carpeta"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setEditTarget(null); }}
                className="w-full px-4 py-3 text-lg display-font uppercase outline-hidden mb-6"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              />

              <label className="font-mono-brutal text-xs uppercase block mb-2">Ubicación (carpeta padre)</label>
              <select
                aria-label="Carpeta superior"
                value={editParentId ?? ""}
                onChange={(e) => setEditParentId(e.target.value || null)}
                className="w-full px-4 py-3 font-mono-brutal text-xs uppercase outline-hidden mb-6"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              >
                <option value="">— Raíz de la lista —</option>
                {validParents.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="font-mono-brutal text-xs uppercase px-4 py-3 shadow-brutal-hover"
                  style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={!editName.trim()}
                  className="font-mono-brutal text-xs uppercase px-4 py-3 shadow-brutal-hover disabled:opacity-40"
                  style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete folder modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md p-6 shadow-brutal-sm"
            style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="display-font text-2xl uppercase mb-3">Eliminar carpeta</h3>
            <p className="font-mono-brutal text-xs uppercase mb-6 leading-relaxed">
              ¿Eliminar "{deleteTarget.name}"? Su contenido se moverá al nivel superior.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="font-mono-brutal text-xs uppercase px-4 py-3 shadow-brutal-hover"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitDelete}
                className="font-mono-brutal text-xs uppercase px-4 py-3 shadow-brutal-hover"
                style={{ backgroundColor: "hsl(var(--danger))", color: bgColor, border: `3px solid hsl(var(--danger))` }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper exported for parent usage
export const useFolderList = (listId: string | null) => {
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  useEffect(() => {
    if (!listId) {
      setFolders([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("task_folders")
        .select("id, list_id, parent_folder_id, name, position")
        .eq("list_id", listId)
        .order("name", { ascending: true });
      if (!cancelled) setFolders((data ?? []) as TaskFolder[]);
    };
    load();
    const ch = supabase
      .channel(`folders-list-${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_folders", filter: `list_id=eq.${listId}` },
        () => load()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [listId]);
  return folders;
};
