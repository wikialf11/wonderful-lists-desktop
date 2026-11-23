import type { JSX } from "react";
import { FormEvent, cloneElement, useEffect, useRef, useState } from "react";
import { Plus, Lock } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/local/client";
import { TaskImagePreview } from "@/components/TaskImagePreview";
import { createImagePreviewValue, createPendingFileValue, prepareCustomFieldValueForSave, MAX_FILE_SIZE_MB, dateRangeDays } from "@/lib/customFields";
import { TaskFileAttachment } from "@/components/TaskFileAttachment";
import { FieldWidgets } from "@/components/FieldWidgets";
import { NodeGraphFieldRenderer } from "@/components/nodeGraph/NodeGraphFieldRenderer";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import { parseChecklist, type ChecklistItem } from "@/lib/checklist";
import { TaskFilesEditor } from "@/components/TaskFilesEditor";
import { TaskTableEditor } from "@/components/TaskTableEditor";
import { parseTaskFiles, type TaskFile } from "@/lib/taskFiles";
import { parseTaskTable, emptyTaskTable, type TaskTable } from "@/lib/taskTable";
import {
  normalizeRecurrenceType,
  type RecurrenceType,
} from "@/lib/recurrence";
import type { GraphDefinition } from "@/lib/nodeGraph";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm";

type Task = {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  completable?: boolean;
  task_files?: TaskFile[];
  table_data?: TaskTable | null;
  link?: string | null;
  recurrence_days?: number[];
  recurrence_interval_days?: number;
  recurrence_anchor_date?: string | null;
  recurrence_type?: string | null;
  reminder_at?: string | null;
  checklist?: ChecklistItem[];
  folder_id?: string | null;
};

type Props = {
  task: Task | null;
  listId?: string | null;
  listOwnerId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  bgColor: string;
  inkColor: string;
  canEdit?: boolean;
  isOwner?: boolean;
  relatedTasks?: Array<{ id: string; name: string }>;
  onOpenPricing?: () => void;
};

type CustomField = {
  id: string;
  name: string;
  field_type: string;
  icon: string | null;
  validation: any;
  options: any;
  locked: boolean;
  is_node_graph?: boolean;
  graph_definition?: any;
  is_official?: boolean;
};

const WEEKDAYS = ["D", "L", "M", "X", "J", "V", "S"];

type FieldKey =
  | "description"
  | "date"
  | "recurrence"
  | "reminder"
  | "checklist"
  | "files"
  | "table"
  | "completable"
  | "link"
  ;

const FIELD_LABELS: Record<FieldKey, string> = {
  description: "Descripción",
  date: "Fecha / Hora",
  recurrence: "Repetir",
  reminder: "Recordatorio",
  checklist: "Segmentar tarea",
  files: "Archivos",
  table: "Tabla",
  completable: "Completable",
  link: "Enlace",
};

const FIELD_ORDER: FieldKey[] = [
  "description",
  "date",
  "recurrence",
  "reminder",
  "checklist",
  "files",
  "table",
  "completable",
  "link",
];

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const EditTaskDialog = ({ task, listId, listOwnerId, onClose, onSaved, bgColor, inkColor, canEdit = true, isOwner = false, relatedTasks = [], onOpenPricing }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [completable, setCompletable] = useState(false);
  const [link, setLink] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [tableData, setTableData] = useState<TaskTable | null>(null);
  const [filesUploading, setFilesUploading] = useState(false);
  const [originalReminder, setOriginalReminder] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState<string>("");
  const [recurrenceAnchorDate, setRecurrenceAnchorDate] = useState<string>("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeFields, setActiveFields] = useState<Set<FieldKey>>(new Set());
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [lastAddedField, setLastAddedField] = useState<FieldKey | null>(null);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLDivElement | null>>>({});
  const [lastAddedCustomField, setLastAddedCustomField] = useState<string | null>(null);
  const customFieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Custom AI-generated fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [activeCustomFieldIds, setActiveCustomFieldIds] = useState<Set<string>>(new Set());
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [initialCustomValueIds, setInitialCustomValueIds] = useState<Record<string, string>>({});

  // Folders
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string; parent_folder_id: string | null }>>([]);
  useEffect(() => {
    if (!listId) { setFolders([]); return; }
    let cancelled = false;
    supabase
      .from("task_folders")
      .select("id, name, parent_folder_id")
      .eq("list_id", listId)
      .order("name", { ascending: true })
      .then((result: any) => {
        if (!cancelled) setFolders((result?.data ?? []) as any);
      });
    return () => { cancelled = true; };
  }, [listId, task?.id]);
  useEffect(() => {
    setFolderId(task?.folder_id ?? null);
  }, [task?.id]);

  // Build a "path" label for each folder
  const folderPath = (id: string | null): string => {
    if (!id) return "Raíz";
    const parts: string[] = [];
    let cur: string | null = id;
    let safety = 0;
    while (cur && safety < 50) {
      const f = folders.find((x) => x.id === cur);
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parent_folder_id;
      safety++;
    }
    return parts.length ? parts.join(" / ") : "Raíz";
  };

  // Load custom fields catalog (catalogue belongs to the list OWNER)
  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, icon, validation, options, widgets, locked, is_node_graph, graph_definition, is_official")
        .order("created_at", { ascending: false });
      if (error) console.error("[EditTaskDialog] custom_fields load error", error);
      if (!cancelled) setCustomFields((data ?? []) as CustomField[]);
    })();
    return () => { cancelled = true; };
  }, [task?.id, listId, listOwnerId]);

  // Load existing custom values for this task
  useEffect(() => {
    if (!task) { setCustomValues({}); setInitialCustomValueIds({}); setActiveCustomFieldIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("task_custom_field_values")
        .select("id, custom_field_id, value")
        .eq("task_id", task.id);
      if (cancelled) return;
      const vals: Record<string, any> = {};
      const ids: Record<string, string> = {};
      const active = new Set<string>();
      (data ?? []).forEach((row: any) => {
        vals[row.custom_field_id] = row.value;
        ids[row.custom_field_id] = row.id;
        active.add(row.custom_field_id);
      });
      setCustomValues(vals);
      setInitialCustomValueIds(ids);
      setActiveCustomFieldIds(active);
    })();
    return () => { cancelled = true; };
  }, [task?.id]);

  // A newly added field can be inserted far from the "Añadir campo" button
  // (fields render in canonical order). Bring it into view and focus it so it
  // is obvious that the field was actually added.
  useEffect(() => {
    if (!lastAddedField) return;
    const element = fieldRefs.current[lastAddedField];
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    const focusable = element.querySelector<HTMLElement>(
      "textarea, input:not([type=hidden]), select",
    );
    focusable?.focus({ preventScroll: true });
    setLastAddedField(null);
  }, [lastAddedField]);

  useEffect(() => {
    if (!lastAddedCustomField) return;
    const element = customFieldRefs.current[lastAddedCustomField];
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    const focusable = element.querySelector<HTMLElement>(
      "textarea, input:not([type=hidden]), select",
    );
    focusable?.focus({ preventScroll: true });
    setLastAddedCustomField(null);
  }, [lastAddedCustomField]);

  useEffect(() => {
    if (!task) return;
    setName(task.name);
    const desc = task.description ?? "";
    setDescription(desc);
    const isCompletable = task.completable === true;
    setCompletable(isCompletable);
    const lnk = task.link ?? "";
    setLink(lnk);
    const rem = toLocalInput(task.reminder_at);
    setReminderAt(rem);
    setOriginalReminder(rem);
    const taskChecklist = parseChecklist(task.checklist);
    setChecklist(taskChecklist);
    const parsedFiles = parseTaskFiles(task.task_files);
    setTaskFiles(parsedFiles);
    const parsedTable = parseTaskTable(task.table_data);
    setTableData(parsedTable);
    const recDays = task.recurrence_days ?? [];
    setRecurrenceDays(recDays);
    setRecurrenceType(
      normalizeRecurrenceType(task.recurrence_type, recDays, task.recurrence_interval_days ?? 0),
    );
    const recInterval =
      task.recurrence_interval_days && task.recurrence_interval_days > 0
        ? String(task.recurrence_interval_days)
        : "";
    setRecurrenceIntervalDays(recInterval);
    setRecurrenceAnchorDate(task.recurrence_anchor_date ?? "");

    let hasDate = false;
    if (task.due_date) {
      const d = new Date(task.due_date);
      const pad = (n: number) => String(n).padStart(2, "0");
      const isAnchor = d.getUTCFullYear() === 1970;
      if (!isAnchor) {
        setDueDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      } else {
        setDueDay("");
      }
      const hh = d.getHours();
      const mm = d.getMinutes();
      const noTime = hh === 23 && mm === 59;
      setDueTime(noTime ? "" : `${pad(hh)}:${pad(mm)}`);
      hasDate = !isAnchor || !noTime;
    } else {
      setDueDay("");
      setDueTime("");
    }

    // Determine which optional fields are already populated on the item
    const initial = new Set<FieldKey>();
    if (desc.trim()) initial.add("description");
    if (hasDate) initial.add("date");
    if (normalizeRecurrenceType(task.recurrence_type, recDays, task.recurrence_interval_days ?? 0)) {
      initial.add("recurrence");
    }
    if (isCompletable) initial.add("completable");
    if (lnk.trim()) initial.add("link");
    if (rem) initial.add("reminder");
    if (taskChecklist.length > 0) initial.add("checklist");
    if (parsedFiles.length > 0) initial.add("files");
    if (parsedTable && parsedTable.rows.length > 0) initial.add("table");
    setActiveFields(initial);
    setShowFieldMenu(false);
  }, [task]);

  const deleteTask = async () => {
    if (!task) return;
    setBusy(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setBusy(false);
    if (error) {
      toast.error("No se pudo eliminar");
      return;
    }
    toast.success("Eliminado");
    // Let the click event finish before unmounting the dialog.
    setTimeout(() => {
      onSaved();
      onClose();
    }, 80);
  };

  if (!task) return null;

  const todayKey = () => new Date().toISOString().slice(0, 10);

  const setWeeklyRecurrence = (days: number[]) => {
    setRecurrenceDays(days);
    setRecurrenceIntervalDays("");
    setRecurrenceType(days.length > 0 ? "weekly" : null);
  };

  const toggleRecurrenceDay = (d: number) => {
    const next = recurrenceDays.includes(d)
      ? recurrenceDays.filter((x) => x !== d)
      : [...recurrenceDays, d].sort();
    setWeeklyRecurrence(next);
  };

  const setCalendarRecurrence = (type: "monthly" | "yearly") => {
    setRecurrenceType(type);
    setRecurrenceDays([]);
    setRecurrenceIntervalDays("");
    setRecurrenceAnchorDate(dueDay || recurrenceAnchorDate || todayKey());
  };

  const addField = (k: FieldKey) => {
    setActiveFields((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });
    if (k === "completable") setCompletable(true);
    if (k === "table") setTableData((current) => current ?? emptyTaskTable());
    setShowFieldMenu(false);
    setLastAddedField(k);
  };

  const removeField = (k: FieldKey) => {
    setActiveFields((prev) => {
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
    if (k === "description") setDescription("");
    if (k === "date") { setDueDay(""); setDueTime(""); }
    if (k === "recurrence") {
      setRecurrenceDays([]);
      setRecurrenceIntervalDays("");
      setRecurrenceAnchorDate("");
      setRecurrenceType(null);
    }
    if (k === "completable") setCompletable(false);
    if (k === "link") setLink("");
    if (k === "reminder") setReminderAt("");
    if (k === "checklist") setChecklist([]);
    if (k === "files") setTaskFiles([]);
    if (k === "table") setTableData(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (filesUploading) {
      toast.error("Espera a que terminen de guardarse los archivos");
      return;
    }
    const intervalNum = parseInt(recurrenceIntervalDays, 10);
    const hasInterval = !isNaN(intervalNum) && intervalNum > 0;
    const hasCalendarRecurrence = recurrenceType === "monthly" || recurrenceType === "yearly";
    const hasAnyRecurrence =
      recurrenceDays.length > 0 || hasInterval || hasCalendarRecurrence;
    const anchorForInterval = hasInterval || hasCalendarRecurrence
      ? (dueDay || recurrenceAnchorDate || new Date().toISOString().slice(0, 10))
      : null;

    let dueIso: string | null = null;
    if (dueDay || dueTime) {
      const isTimeOnlyTemplate = !dueDay && dueTime && hasAnyRecurrence;
      const dayPart = dueDay || (isTimeOnlyTemplate ? "1970-01-01" : new Date().toISOString().slice(0, 10));
      const timePart = dueTime || "23:59";
      const iso = isTimeOnlyTemplate
        ? new Date(`${dayPart}T${timePart}:00Z`)
        : new Date(`${dayPart}T${timePart}`);
      if (isNaN(iso.getTime())) {
        toast.error("Fecha no válida");
        return;
      }
      dueIso = iso.toISOString();
    }
    if (dueTime && !dueDay && !hasAnyRecurrence) {
      toast.error("Para usar solo hora, selecciona repetición");
      return;
    }

    setBusy(true);
    const updatePayload = {
      name: name.trim(),
      description: description.trim() || null,
      due_date: dueIso,
      completable,
      recurrence_days: recurrenceDays,
      recurrence_interval_days: hasInterval ? intervalNum : 0,
      recurrence_anchor_date: anchorForInterval,
      recurrence_type: recurrenceType,
      link: link.trim() || null,
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      ...(reminderAt !== originalReminder ? { reminder_sent_at: null } : {}),
      checklist,
      task_files: taskFiles,
      table_data: tableData,
      folder_id: folderId,
    };
    const { error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", task.id);
    if (error) {
      setBusy(false);
      toast.error("No se pudo guardar");
      return;
    }

    // Persist custom field values: upsert active, delete removed
    if (listId) {
      const removedIds = Object.keys(initialCustomValueIds).filter((cfId) => !activeCustomFieldIds.has(cfId));
      if (removedIds.length > 0) {
        await supabase
          .from("task_custom_field_values")
          .delete()
          .in("custom_field_id", removedIds)
          .eq("task_id", task.id);
      }
      const activeArr = Array.from(activeCustomFieldIds);
      for (const cfId of activeArr) {
        const field = customFields.find((cf) => cf.id === cfId);
        const value = field
          ? await prepareCustomFieldValueForSave(field, customValues[cfId], listId, task.id)
          : customValues[cfId] ?? null;
        const existingRowId = initialCustomValueIds[cfId];
        if (existingRowId) {
          await supabase
            .from("task_custom_field_values")
            .update({ value })
            .eq("id", existingRowId);
        } else {
          await supabase
            .from("task_custom_field_values")
            .insert({ task_id: task.id, custom_field_id: cfId, list_id: listId, value });
        }
      }
    }

    setBusy(false);
    toast.success("Guardado");
    onSaved();
    onClose();
  };

  const available = FIELD_ORDER.filter((k) => !activeFields.has(k));

  const availableCustom = customFields.filter((f) => (!f.locked || f.is_official) && !activeCustomFieldIds.has(f.id));

  const addCustomField = (cfId: string) => {
    const cf = customFields.find((f) => f.id === cfId);
    // Free users can see official fields but not use them → open pricing instead.
    setActiveCustomFieldIds((prev) => {
      const n = new Set(prev);
      n.add(cfId);
      return n;
    });
    setShowFieldMenu(false);
    setLastAddedCustomField(cfId);
  };

  const removeCustomField = (cfId: string) => {
    setActiveCustomFieldIds((prev) => {
      const n = new Set(prev);
      n.delete(cfId);
      return n;
    });
    setCustomValues((prev) => {
      const n = { ...prev };
      delete n[cfId];
      return n;
    });
  };

  const renderCustomFieldIcon = (iconName: string | null) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName] ?? LucideIcons.Hash;
    return <Icon className="w-4 h-4 shrink-0" strokeWidth={3} />;
  };

  /** Native controls need their own accessible name (a wrapper label isn't enough). */
  const withFieldName = (el: JSX.Element, fieldName: string) =>
    typeof el.type === "string" && ["input", "textarea", "select"].includes(el.type) && !el.props["aria-label"]
      ? cloneElement(el, { "aria-label": fieldName })
      : el;

  const renderCustomField = (cf: CustomField) => {
    const value = customValues[cf.id];
    const setVal = (v: any) => setCustomValues((prev) => ({ ...prev, [cf.id]: v }));
    const inputStyle = { backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` } as const;
    const baseInputCls = "w-full px-4 py-3 font-mono-brutal text-sm outline-hidden disabled:opacity-60";

    const header = (
      <div className="flex items-center justify-between mb-2">
        <label className="font-mono-brutal text-xs uppercase flex items-center gap-2">
          {renderCustomFieldIcon(cf.icon)}
          {cf.name}
        </label>
        {canEdit && (
          <button
            type="button"
            onClick={() => removeCustomField(cf.id)}
            aria-label={`Quitar campo ${cf.name}`}
            className="font-mono-brutal text-xs uppercase w-7 h-7 flex items-center justify-center leading-none shrink-0"
            style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
          >×</button>
        )}
      </div>
    );

    let input: JSX.Element;
    const t = cf.field_type;
    const v = cf.validation || {};
    if (cf.is_node_graph && cf.graph_definition) {
      const stored = (value && typeof value === "object" && "inputs" in value) ? value : { inputs: undefined, value };
      input = (
        <div className={baseInputCls + " !p-2"} style={inputStyle}>
          <NodeGraphFieldRenderer
            graph={cf.graph_definition as GraphDefinition}
            value={stored as any}
            fieldValues={customValues}
            onChange={(next) => setVal(next)}
          />
        </div>
      );
    } else if (t === "textarea") {
      input = <textarea value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} rows={3} className={baseInputCls + " resize-y"} style={inputStyle} maxLength={v.maxLength} />;
    } else if (t === "number" || t === "currency" || t === "percentage") {
      input = <input type="number" value={value ?? ""} onChange={(e) => setVal(e.target.value === "" ? null : Number(e.target.value))} disabled={!canEdit} min={v.min} max={v.max} step={v.step ?? "any"} className={baseInputCls} style={inputStyle} />;
    } else if (t === "date") {
      input = <input type="date" value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} className={baseInputCls} style={inputStyle} />;
    } else if (t === "daterange") {
      const range = (value && typeof value === "object" ? value : {}) as { start?: string | null; end?: string | null };
      const days = dateRangeDays(range);
      input = (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-mono-brutal text-[10px] uppercase opacity-70 block mb-1">Inicio</span>
              <input type="date" aria-label={`${cf.name}: inicio`} value={range.start ?? ""} max={range.end ?? undefined}
                onChange={(e) => setVal({ start: e.target.value || null, end: range.end ?? null })}
                disabled={!canEdit} className={baseInputCls} style={inputStyle} />
            </div>
            <div>
              <span className="font-mono-brutal text-[10px] uppercase opacity-70 block mb-1">Fin</span>
              <input type="date" aria-label={`${cf.name}: fin`} value={range.end ?? ""} min={range.start ?? undefined}
                onChange={(e) => setVal({ start: range.start ?? null, end: e.target.value || null })}
                disabled={!canEdit} className={baseInputCls} style={inputStyle} />
            </div>
          </div>
          {days !== null && (
            <p className="font-mono-brutal text-[10px] uppercase opacity-70">Duración: {days} día{days === 1 ? "" : "s"}</p>
          )}
        </div>
      );

    } else if (t === "datetime") {
      input = <input type="datetime-local" value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} className={baseInputCls} style={inputStyle} />;
    } else if (t === "email") {
      input = <input type="email" value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} className={baseInputCls} style={inputStyle} />;
    } else if (t === "phone") {
      input = <input type="tel" value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} className={baseInputCls} style={inputStyle} />;
    } else if (t === "url") {
      input = <input type="url" value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} className={baseInputCls} style={inputStyle} />;
    } else if (t === "image") {
      input = (
        <div>
          <input type="file" aria-label={`${cf.name}: subir imagen`} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVal(createImagePreviewValue(file)); }} disabled={!canEdit} className={baseInputCls} style={inputStyle} />
          <TaskImagePreview value={value} alt={cf.name} inkColor={inkColor} />
        </div>
      );
    } else if (t === "file") {
      const maxMB = Number(v.maxSizeMB ?? MAX_FILE_SIZE_MB) || MAX_FILE_SIZE_MB;
      input = (
        <div>
          <input
            type="file"
            aria-label={`${cf.name}: subir archivo`}
            accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar,.7z,image/*,audio/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > maxMB * 1024 * 1024) {
                toast.error(`El archivo no puede superar ${maxMB} MB`);
                e.target.value = "";
                return;
              }
              setVal(createPendingFileValue(file));
            }}
            disabled={!canEdit}
            className={baseInputCls}
            style={inputStyle}
          />
          <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-1">Máx. {maxMB} MB · PDF, Word, Excel, imágenes y más</p>
          <TaskFileAttachment value={value} inkColor={inkColor} bgColor={bgColor} />
        </div>
      );

    } else if (t === "relation") {
      const arr: string[] = Array.isArray(value) ? value : [];
      input = (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {relatedTasks.filter((item) => item.id !== task.id).map((item) => {
            const on = arr.includes(item.id);
            return (
              <button key={item.id} type="button" disabled={!canEdit} onClick={() => setVal(on ? arr.filter((id) => id !== item.id) : [...arr, item.id])}
                className="w-full text-left font-mono-brutal text-xs uppercase px-3 py-2 disabled:opacity-60"
                style={{ backgroundColor: on ? inkColor : bgColor, color: on ? bgColor : inkColor, border: `3px solid ${inkColor}` }}>{item.name}</button>
            );
          })}
        </div>
      );
    } else if (t === "color") {
      input = <input type="color" value={value ?? "#000000"} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} className="w-full h-12 outline-hidden disabled:opacity-60" style={inputStyle} />;
    } else if (t === "checkbox") {
      input = (
        <label className="flex items-center gap-3 cursor-pointer select-none px-4 py-3" style={inputStyle}>
          <input type="checkbox" checked={!!value} onChange={(e) => setVal(e.target.checked)} disabled={!canEdit} className="w-5 h-5" style={{ accentColor: inkColor }} />
          <span className="font-mono-brutal text-xs uppercase flex-1">{cf.name}</span>
        </label>
      );
    } else if (t === "checklist") {
      type ChecklistItem = { id: string; label: string; done: boolean };
      type ChecklistGroup = { id: string; name: string; items: ChecklistItem[]; collapsed?: boolean };
      const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

      // Normalize: support legacy array of items, new array of groups, or seed from options.
      const normalize = (raw: any): ChecklistGroup[] => {
        if (Array.isArray(raw) && raw.length > 0) {
          // New format: array of groups (objects with `items` array)
          if (raw.every((g) => g && typeof g === "object" && Array.isArray((g as any).items))) {
            return (raw as any[]).map((g, gi) => ({
              id: typeof g.id === "string" ? g.id : `g-${gi}`,
              name: typeof g.name === "string" ? g.name : "",
              collapsed: !!g.collapsed,
              items: (g.items as any[]).map((it, i) => ({
                id: typeof it?.id === "string" ? it.id : `m-${gi}-${i}`,
                label: typeof it?.label === "string" ? it.label : String(it ?? ""),
                done: !!it?.done,
              })),
            }));
          }
          // Legacy format: flat array of items → wrap into a single group
          const items: ChecklistItem[] = (raw as any[]).map((it, i) => ({
            id: typeof it?.id === "string" ? it.id : `m-${i}`,
            label: typeof it?.label === "string" ? it.label : String(it ?? ""),
            done: !!it?.done,
          }));
          return [{ id: "g-default", name: "", items }];
        }
        // Empty/null → seed from options if available
        const opts: string[] = Array.isArray(cf.options) ? cf.options : [];
        const seeded: ChecklistItem[] = opts.map((label, i) => ({ id: `seed-${i}`, label, done: false }));
        return [{ id: "g-default", name: "", items: seeded }];
      };

      const groups: ChecklistGroup[] = normalize(value);
      const update = (next: ChecklistGroup[]) => setVal(next);
      const updateGroup = (gid: string, patch: Partial<ChecklistGroup>) =>
        update(groups.map((g) => (g.id === gid ? { ...g, ...patch } : g)));
      const updateItems = (gid: string, items: ChecklistItem[]) => updateGroup(gid, { items });

      const totalDone = groups.reduce((s, g) => s + g.items.filter((it) => it.done).length, 0);
      const totalItems = groups.reduce((s, g) => s + g.items.length, 0);

      input = (
        <div className="space-y-3">
          <div className="font-mono-brutal text-[10px] uppercase opacity-60">{totalDone}/{totalItems} completados · {groups.length} {groups.length === 1 ? "lista" : "listas"}</div>
          {groups.map((g, gi) => {
            const doneCount = g.items.filter((it) => it.done).length;
            return (
              <div key={g.id} className="space-y-2 p-2" style={{ border: `3px solid ${inkColor}` }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateGroup(g.id, { collapsed: !g.collapsed })}
                    aria-label={g.collapsed ? "Expandir" : "Colapsar"}
                    className="font-mono-brutal text-xs w-6 h-6 flex items-center justify-center leading-none shrink-0"
                    style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
                  >{g.collapsed ? "▸" : "▾"}</button>
                  <input
                    type="text"
                    value={g.name}
                    aria-label={`Nombre de la lista ${gi + 1}`}
                    onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                    disabled={!canEdit}
                    placeholder={`Lista ${gi + 1} (p.ej. Temporada ${gi + 1})`}
                    className="flex-1 bg-transparent outline-hidden font-mono-brutal text-xs uppercase px-2 py-1"
                    style={{ color: inkColor, border: `2px solid ${inkColor}`, backgroundColor: bgColor }}
                  />
                  <span className="font-mono-brutal text-[10px] uppercase opacity-60 shrink-0">{doneCount}/{g.items.length}</span>
                  {canEdit && groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmDialog(`¿Eliminar la lista "${g.name || `Lista ${gi + 1}`}" con ${g.items.length} casillas?`)) {
                          update(groups.filter((x) => x.id !== g.id));
                        }
                      }}
                      aria-label="Eliminar lista"
                      className="font-mono-brutal text-xs uppercase w-6 h-6 flex items-center justify-center leading-none shrink-0"
                      style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
                    >×</button>
                  )}
                </div>
                {!g.collapsed && (
                  <>
                    <ul className="space-y-1">
                      {g.items.map((it, idx) => (
                        <li key={it.id} className="flex items-center gap-2 px-2 py-1" style={{ border: `2px solid ${inkColor}`, backgroundColor: bgColor, color: inkColor }}>
                          <input
                            type="checkbox"
                            aria-label={it.label || `Elemento ${idx + 1}`}
                            checked={it.done}
                            onChange={(e) => updateItems(g.id, g.items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)))}
                            disabled={!canEdit}
                            className="w-4 h-4 shrink-0"
                            style={{ accentColor: inkColor }}
                          />
                          <input
                            type="text"
                            value={it.label}
                            aria-label={`Texto del elemento ${idx + 1}`}
                            onChange={(e) => updateItems(g.id, g.items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))}
                            disabled={!canEdit}
                            placeholder={`Elemento ${idx + 1}`}
                            className="flex-1 bg-transparent outline-hidden font-mono-brutal text-xs px-1 py-1"
                            style={{ color: inkColor, textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.6 : 1 }}
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => updateItems(g.id, g.items.filter((x) => x.id !== it.id))}
                              aria-label="Eliminar"
                              className="font-mono-brutal text-xs uppercase w-6 h-6 flex items-center justify-center leading-none shrink-0"
                              style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
                            >×</button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateItems(g.id, [...g.items, { id: newId(), label: "", done: false }])}
                          className="font-mono-brutal text-[10px] uppercase px-3 py-2 shadow-brutal-hover"
                          style={{ border: `2px solid ${inkColor}`, backgroundColor: inkColor, color: bgColor }}
                        >
                          + Añadir casilla
                        </button>
                        <span className="font-mono-brutal text-[10px] uppercase opacity-70">o generar</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          placeholder="N"
                          aria-label="Cantidad de casillas a generar"
                          className="w-16 px-2 py-1 font-mono-brutal text-xs outline-hidden"
                          style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const n = Math.min(500, Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 0));
                              if (!n) return;
                              const base = (g.name || cf.name || "Elemento").replace(/s$/i, "");
                              const start = g.items.length + 1;
                              const extra = Array.from({ length: n }, (_, i) => ({
                                id: newId(),
                                label: `${base} ${start + i}`,
                                done: false,
                              }));
                              updateItems(g.id, [...g.items, ...extra]);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                        <span className="font-mono-brutal text-[9px] uppercase opacity-60">↵ enter</span>
                        {g.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirmDialog(`¿Vaciar las ${g.items.length} casillas?`)) updateItems(g.id, []);
                            }}
                            className="font-mono-brutal text-[10px] uppercase px-2 py-2 ml-auto"
                            style={{ border: `2px solid ${inkColor}`, backgroundColor: bgColor, color: inkColor }}
                          >
                            Vaciar
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {canEdit && (
            <button
              type="button"
              onClick={() => update([...groups, { id: newId(), name: "", items: [] }])}
              className="font-mono-brutal text-[10px] uppercase px-3 py-2 shadow-brutal-hover w-full"
              style={{ border: `3px solid ${inkColor}`, backgroundColor: bgColor, color: inkColor }}
            >
              + Añadir nueva lista (p.ej. nueva temporada)
            </button>
          )}
        </div>
      );
    } else if (t === "stars") {
      const current = Number(value ?? 0);
      input = (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" disabled={!canEdit} onClick={() => setVal(n === current ? 0 : n)}
              className="w-10 h-10 font-mono-brutal text-lg disabled:opacity-60"
              style={{ backgroundColor: n <= current ? inkColor : bgColor, color: n <= current ? bgColor : inkColor, border: `3px solid ${inkColor}` }}>★</button>
          ))}
        </div>
      );
    } else if (t === "counter") {
      const current = Number(value ?? 0);
      const step = Number(v.step ?? 1) || 1;
      const min = v.min ?? null;
      const max = v.max ?? null;
      const clamp = (n: number) => {
        if (min !== null && n < min) return min;
        if (max !== null && n > max) return max;
        return n;
      };
      input = (
        <div className="flex items-center gap-2" style={inputStyle}>
          <button type="button" aria-label={`Disminuir ${cf.name}`} disabled={!canEdit} onClick={() => setVal(clamp(current - step))}
            className="w-12 h-12 font-mono-brutal text-2xl disabled:opacity-60 shrink-0"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}>−</button>
          <input type="number" aria-label={cf.name} value={value ?? 0} onChange={(e) => setVal(e.target.value === "" ? 0 : clamp(Number(e.target.value)))}
            disabled={!canEdit} className="flex-1 min-w-0 text-center font-mono-brutal text-2xl px-2 h-12 outline-hidden disabled:opacity-60"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }} />
          <button type="button" aria-label={`Aumentar ${cf.name}`} disabled={!canEdit} onClick={() => setVal(clamp(current + step))}
            className="w-12 h-12 font-mono-brutal text-2xl disabled:opacity-60 shrink-0"
            style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}>+</button>
        </div>
      );

    } else if (t === "select") {
      const opts: string[] = Array.isArray(cf.options) ? cf.options : [];
      input = (
        <select value={value ?? ""} onChange={(e) => setVal(e.target.value || null)} disabled={!canEdit} className={baseInputCls} style={inputStyle}>
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else if (t === "multiselect") {
      const opts: string[] = Array.isArray(cf.options) ? cf.options : [];
      const arr: string[] = Array.isArray(value) ? value : [];
      input = (
        <div className="flex flex-wrap gap-2">
          {opts.map((o) => {
            const on = arr.includes(o);
            return (
              <button key={o} type="button" disabled={!canEdit} onClick={() => setVal(on ? arr.filter((x) => x !== o) : [...arr, o])}
                className="font-mono-brutal text-xs uppercase px-3 py-2 disabled:opacity-60"
                style={{ backgroundColor: on ? inkColor : bgColor, color: on ? bgColor : inkColor, border: `3px solid ${inkColor}` }}>{o}</button>
            );
          })}
        </div>
      );
    } else {
      input = <input type="text" value={value ?? ""} onChange={(e) => setVal(e.target.value)} disabled={!canEdit} maxLength={v.maxLength} className={baseInputCls} style={inputStyle} />;
    }

    return (
      <div key={cf.id} className="mb-4">
        {header}
        {withFieldName(input, cf.name)}
        <FieldWidgets
          widgets={(cf as any).widgets}
          value={value}
          fieldType={cf.field_type}
          fieldId={cf.id}
          taskId={task?.id ?? null}
          taskName={name}
          listId={listId ?? null}
          bgColor={bgColor}
          inkColor={inkColor}
        />
      </div>
    );
  };


  const renderField = (k: FieldKey) => {
    const removeBtn = canEdit ? (
      <button
        type="button"
        onClick={() => removeField(k)}
        aria-label={`Quitar campo ${FIELD_LABELS[k]}`}
        className="font-mono-brutal text-xs uppercase w-7 h-7 flex items-center justify-center leading-none shrink-0"
        style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
      >
        ×
      </button>
    ) : null;

    const header = (
      <div className="flex items-center justify-between mb-2">
        <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
        {removeBtn}
      </div>
    );

    if (k === "description") {
      return (
        <div key={k} className="mb-4">
          {header}
          <textarea
            aria-label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={!canEdit}
            className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden resize-y disabled:opacity-60"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          />
        </div>
      );
    }
    if (k === "date") {
      return (
        <div key={k} className="mb-4">
          {header}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="Fecha límite"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              disabled={!canEdit}
              className="w-full px-4 py-3 font-mono-brutal text-lg outline-hidden disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={!canEdit}
              aria-label="Hora (opcional)"
              className="w-full px-4 py-3 font-mono-brutal text-lg outline-hidden disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            />
          </div>
        </div>
      );
    }
    if (k === "recurrence") {
      return (
        <div key={k} className="mb-4">
          {header}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((label, idx) => {
              const active = recurrenceType === "weekly" && recurrenceDays.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => canEdit && toggleRecurrenceDay(idx)}
                  disabled={!canEdit}
                  aria-pressed={active}
                  aria-label={`Día ${label}`}
                  className="font-mono-brutal text-sm uppercase py-2 transition-colors disabled:opacity-60"
                  style={{
                    backgroundColor: active ? inkColor : bgColor,
                    color: active ? bgColor : inkColor,
                    border: `3px solid ${inkColor}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => canEdit && setWeeklyRecurrence([0,1,2,3,4,5,6])} disabled={!canEdit}
              className="flex-1 font-mono-brutal text-[10px] uppercase py-2 disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}>Todos</button>
            <button type="button" onClick={() => canEdit && setWeeklyRecurrence([1,2,3,4,5])} disabled={!canEdit}
              className="flex-1 font-mono-brutal text-[10px] uppercase py-2 disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}>L–V</button>
            <button type="button" onClick={() => canEdit && setWeeklyRecurrence([0,6])} disabled={!canEdit}
              className="flex-1 font-mono-brutal text-[10px] uppercase py-2 disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}>S–D</button>
            <button type="button" onClick={() => canEdit && setWeeklyRecurrence([])} disabled={!canEdit}
              className="flex-1 font-mono-brutal text-[10px] uppercase py-2 disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}>Ninguno</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              onClick={() => canEdit && setCalendarRecurrence("monthly")}
              disabled={!canEdit}
              aria-pressed={recurrenceType === "monthly"}
              className="font-mono-brutal text-xs uppercase py-2 disabled:opacity-60"
              style={{
                backgroundColor: recurrenceType === "monthly" ? inkColor : bgColor,
                color: recurrenceType === "monthly" ? bgColor : inkColor,
                border: `3px solid ${inkColor}`,
              }}
            >
              Cada mes
            </button>
            <button
              type="button"
              onClick={() => canEdit && setCalendarRecurrence("yearly")}
              disabled={!canEdit}
              aria-pressed={recurrenceType === "yearly"}
              className="font-mono-brutal text-xs uppercase py-2 disabled:opacity-60"
              style={{
                backgroundColor: recurrenceType === "yearly" ? inkColor : bgColor,
                color: recurrenceType === "yearly" ? bgColor : inkColor,
                border: `3px solid ${inkColor}`,
              }}
            >
              Cada año
            </button>
          </div>
          {recurrenceType === "monthly" && (
            <p className="font-mono-brutal text-[10px] uppercase opacity-70 mb-2 leading-relaxed">
              Se repite el mismo día de cada mes. Si el mes es más corto, se usa el último día.
            </p>
          )}
          {recurrenceType === "yearly" && (
            <p className="font-mono-brutal text-[10px] uppercase opacity-70 mb-2 leading-relaxed">
              Se repite el mismo día y mes cada año. El 29 de febrero se ajusta al 28 en años no bisiestos.
            </p>
          )}
          <input
            type="number"
            min={1}
            max={365}
            value={recurrenceIntervalDays}
            onChange={(e) => {
              const value = e.target.value;
              setRecurrenceIntervalDays(value);
              setRecurrenceDays([]);
              setRecurrenceType(value ? "interval" : null);
            }}
            disabled={!canEdit}
            placeholder="O cada N días (ej. 28)"
            className="w-full px-4 py-3 font-mono-brutal text-lg outline-hidden disabled:opacity-60"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          />
        </div>
      );
    }
    if (k === "completable") {
      return (
        <div key={k} className="mb-4">
          {header}
          <label
            className="flex items-center gap-3 cursor-pointer select-none px-4 py-3"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            <input
              type="checkbox"
              checked={completable}
              onChange={(e) => setCompletable(e.target.checked)}
              disabled={!canEdit}
              className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
              style={{ accentColor: inkColor }}
            />
            <span className="font-mono-brutal text-xs uppercase flex-1">
              Se puede marcar como completada
            </span>
          </label>
        </div>
      );
    }
    if (k === "files") {
      return (
        <div key={k} className="mb-4">
          {header}
          <TaskFilesEditor
            files={taskFiles}
            onChange={setTaskFiles}
            onUploadingChange={setFilesUploading}
            bgColor={bgColor}
            inkColor={inkColor}
          />
        </div>
      );
    }
    if (k === "table") {
      return (
        <div key={k} className="mb-4">
          {header}
          <TaskTableEditor
            table={tableData}
            onChange={setTableData}
            bgColor={bgColor}
            inkColor={inkColor}
          />
        </div>
      );
    }
    if (k === "link") {
      return (
        <div key={k} className="mb-4">
          {header}
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={!canEdit}
            placeholder="https://ejemplo.com"
            className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden disabled:opacity-60"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: `${inkColor}cc` }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg p-5 md:p-6 shadow-brutal max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="display-font text-2xl uppercase">Editar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="font-mono-brutal text-lg uppercase w-10 h-10 flex items-center justify-center shadow-brutal-hover leading-none"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            ×
          </button>
        </div>

        {!canEdit && (
          <p
            className="font-mono-brutal text-[10px] uppercase mb-4 px-3 py-2"
            style={{ border: `3px solid ${inkColor}` }}
          >
            Solo lectura. Este item está bloqueado por el propietario.
          </p>
        )}

        <label htmlFor="task-title" className="font-mono-brutal text-xs uppercase block mb-2">Título</label>
        <input
          id="task-title"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={!canEdit}
          className="w-full px-4 py-3 text-xl display-font uppercase outline-hidden mb-4 disabled:opacity-60"
          style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
        />

        {folders.length > 0 && (
          <div className="mb-4">
            <label htmlFor="task-folder" className="font-mono-brutal text-xs uppercase block mb-2">Carpeta</label>
            <select
              id="task-folder"
              value={folderId ?? ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              disabled={!canEdit}
              className="w-full px-3 py-2 font-mono-brutal text-xs uppercase outline-hidden disabled:opacity-60"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            >
              <option value="">Raíz</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{folderPath(f.id)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Active fields, in canonical order */}
        {FIELD_ORDER.filter((k) => activeFields.has(k)).map((k) => (
          <div
            key={k}
            ref={(element) => {
              fieldRefs.current[k] = element;
            }}
          >
            {renderField(k)}
          </div>
        ))}

        {/* Active custom (AI) fields */}
        {customFields.filter((cf) => activeCustomFieldIds.has(cf.id)).map((cf) => (
          <div
            key={cf.id}
            ref={(element) => {
              customFieldRefs.current[cf.id] = element;
            }}
          >
            {renderCustomField(cf)}
          </div>
        ))}

        {/* + Add field button (Notion-style) */}
        {canEdit && (() => {
          const hasAnything = available.length + availableCustom.length > 0;
          return (
          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setShowFieldMenu((v) => !v)}
              disabled={!hasAnything}
              className="w-full font-mono-brutal text-xs uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px dashed ${inkColor}` }}
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              {!hasAnything ? "Todos los campos añadidos" : "Añadir campo"}
            </button>
            {showFieldMenu && hasAnything && (
              <div
                className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                style={{ backgroundColor: `${inkColor}cc` }}
                onClick={() => setShowFieldMenu(false)}
              >
                <div
                  className="w-full max-w-md max-h-[75vh] overflow-y-auto shadow-brutal"
                  style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2 sticky top-0"
                    style={{ backgroundColor: bgColor, borderBottom: `3px solid ${inkColor}` }}
                  >
                    <span className="font-mono-brutal text-xs uppercase">Añadir campo</span>
                    <button
                      type="button"
                      onClick={() => setShowFieldMenu(false)}
                      aria-label="Cerrar selector de campos"
                      className="font-mono-brutal text-sm uppercase w-8 h-8 flex items-center justify-center leading-none"
                      style={{ backgroundColor: bgColor, color: inkColor, border: `2px solid ${inkColor}` }}
                    >
                      ×
                    </button>
                  </div>
                  <ul>
                    {available.map((k) => (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => addField(k)}
                          className="w-full text-left px-3 py-3 font-mono-brutal text-sm uppercase flex items-center gap-2"
                          style={{ borderBottom: `2px solid ${inkColor}` }}
                        >
                          <Plus className="w-4 h-4 shrink-0" strokeWidth={3} />
                          {FIELD_LABELS[k]}
                        </button>
                      </li>
                    ))}
                    {availableCustom.map((cf) => {
                      const blocked = false;
                      return (
                        <li key={cf.id}>
                          <button
                            type="button"
                            onClick={() => addCustomField(cf.id)}
                            title={blocked ? "Disponible solo para usuarios premium" : undefined}
                            className="w-full text-left px-3 py-3 font-mono-brutal text-sm uppercase flex items-center gap-2"
                            style={{ borderBottom: `2px solid ${inkColor}`, opacity: blocked ? 0.55 : 1 }}
                          >
                            {renderCustomFieldIcon(cf.icon) ?? <Plus className="w-4 h-4 shrink-0" strokeWidth={3} />}
                            <span className="flex-1 truncate">{cf.name}</span>
                            {blocked && <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
          );
        })()}


        {canEdit && (
          <>
            <button
              type="submit"
              disabled={busy || filesUploading}
              className="w-full font-mono-brutal uppercase text-lg py-4 shadow-brutal-sm shadow-brutal-hover disabled:opacity-50 mb-3"
              style={{ backgroundColor: inkColor, color: bgColor, border: `4px solid ${inkColor}` }}
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
            {confirmDelete ? (
              <div className="w-full p-3" style={{ border: `3px solid ${inkColor}` }}>
                <p className="font-mono-brutal text-xs uppercase mb-2">
                  ¿Eliminar este item? No se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={deleteTask}
                    className="flex-1 font-mono-brutal uppercase text-xs py-2 disabled:opacity-50"
                    style={{ backgroundColor: "hsl(var(--danger))", color: bgColor, border: "3px solid hsl(var(--danger))" }}
                  >
                    Sí, eliminar
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
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                className="w-full font-mono-brutal uppercase text-sm py-3 shadow-brutal-hover disabled:opacity-50"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              >
                Eliminar item
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
};
