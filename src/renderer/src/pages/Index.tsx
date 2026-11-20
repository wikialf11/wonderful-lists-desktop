import type { JSX } from "react";
import { cloneElement, useEffect, useState, FormEvent, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Archive, Plus, Settings, ChevronDown, Check, CalendarDays, Lock, Repeat } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLists } from "@/hooks/useLists";
import { supabase } from "@/integrations/local/client";
import { TaskItem } from "@/components/TaskItem";
import { CalendarView } from "@/components/CalendarView";
import { TaskImagePreview } from "@/components/TaskImagePreview";
import { CustomField, createImagePreviewValue, createPendingFileValue, prepareCustomFieldValueForSave, MAX_FILE_SIZE_MB, dateRangeDays } from "@/lib/customFields";
import { TaskFileAttachment } from "@/components/TaskFileAttachment";

const CALENDAR_ID = "__calendar__";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { EditListDialog } from "@/components/EditListDialog";
import { CompletedPanel } from "@/components/CompletedPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { FoldersBar } from "@/components/FoldersBar";
import { RecurringPanel, type RecurringTemplate } from "@/components/RecurringPanel";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import { parseChecklist, type ChecklistItem } from "@/lib/checklist";
import { TaskFilesEditor } from "@/components/TaskFilesEditor";
import { TaskTableEditor } from "@/components/TaskTableEditor";
import { parseTaskFiles, type TaskFile } from "@/lib/taskFiles";
import { parseTaskTable, emptyTaskTable, type TaskTable } from "@/lib/taskTable";


import { toast } from "sonner";

type Task = {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  recurrence_days?: number[];
  recurrence_interval_days?: number;
  recurrence_anchor_date?: string | null;
  reminder_at?: string | null;
  checklist?: ChecklistItem[];
  task_files?: TaskFile[];
  table_data?: TaskTable | null;
  recurrence_parent_id?: string | null;
  completable?: boolean;
  link?: string | null;
  folder_id?: string | null;
};

const Index = () => {
  const { user } = useAuth();
  const {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    loading: listsLoading,
    reload: reloadLists,
    createList,
    updateList,
    deleteList,
    next,
    prev,
  } = useLists();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState<string>("");
  const [recurrenceAnchorDate, setRecurrenceAnchorDate] = useState<string>("");
  const [completable, setCompletable] = useState(false);
  const [link, setLink] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [tableData, setTableData] = useState<TaskTable | null>(null);
  const [filesUploading, setFilesUploading] = useState(false);
  // Notion-style: which optional fields are visible
  type FieldKey = "description" | "date" | "recurrence" | "reminder" | "checklist" | "files" | "table" | "completable" | "link";
  const [activeFields, setActiveFields] = useState<Set<FieldKey>>(new Set());
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const fieldMenuRef = useRef<HTMLDivElement>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [activeCustomFieldIds, setActiveCustomFieldIds] = useState<Set<string>>(new Set());
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [taskCustomValues, setTaskCustomValues] = useState<Record<string, Record<string, any>>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [showNewList, setShowNewList] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [showListDesc, setShowListDesc] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const titleTimerRef = useRef<number | null>(null);
  const titleLongRef = useRef(false);
  const titleLastTapRef = useRef(0);
  // Folders
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; type: "task" | "folder" } | null>(null);
  // Reset folder when list changes
  useEffect(() => { setCurrentFolderId(null); }, [activeListId]);

  useEffect(() => {
    if (!showListMenu) return;
    const onDown = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setShowListMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showListMenu]);

  useEffect(() => {
    if (!showFieldMenu) return;
    const onDown = (e: MouseEvent) => {
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(e.target as Node)) {
        setShowFieldMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showFieldMenu]);

  const loadCustomFields = useCallback(async () => {
    if (!user || !activeList) {
      setCustomFields([]);
      return;
    }
    const { data, error } = await supabase
      .from("custom_fields")
      .select("id, name, field_type, icon, validation, options, widgets, locked, user_id, is_official")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[Index] custom_fields load error", error);
      setCustomFields([]);
      return;
    }
    setCustomFields((data ?? []) as CustomField[]);
  }, [user?.id, activeList?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadCustomFields();
    })();
    return () => { cancelled = true; };
  }, [loadCustomFields]);

  useEffect(() => {
    setActiveCustomFieldIds(new Set());
    setCustomValues({});
  }, [activeListId]);

  const toggleField = (k: FieldKey) => {
    setActiveFields((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
        // clear field values when removed
        if (k === "description") setDescription("");
        if (k === "date") { setDueDay(""); setDueTime(""); }
        if (k === "recurrence") { setRecurrenceDays([]); setRecurrenceIntervalDays(""); setRecurrenceAnchorDate(""); }
        if (k === "completable") setCompletable(false);
        if (k === "link") setLink("");
        if (k === "reminder") setReminderAt("");
        if (k === "checklist") setChecklist([]);
        if (k === "files") setTaskFiles([]);
        if (k === "table") setTableData(null);
      } else {
        next.add(k);
        if (k === "completable") setCompletable(true);
        if (k === "table") setTableData((current) => current ?? emptyTaskTable());
      }
      return next;
    });
    setShowFieldMenu(false);
  };

  const addCustomField = (cfId: string) => {
    setActiveCustomFieldIds((prev) => {
      const next = new Set(prev);
      next.add(cfId);
      return next;
    });
    setShowFieldMenu(false);
  };

  const removeCustomField = (cfId: string) => {
    setActiveCustomFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(cfId);
      return next;
    });
    setCustomValues((prev) => {
      const next = { ...prev };
      delete next[cfId];
      return next;
    });
  };

  const renderCustomFieldIcon = (iconName: string | null) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName] ?? LucideIcons.Hash;
    return <Icon className="w-4 h-4 shrink-0" strokeWidth={3} />;
  };


  const [showCalendar, setShowCalendar] = useState(() => localStorage.getItem("active-list-id") === CALENDAR_ID);

  const bgColor = showCalendar ? "#ffffff" : (activeList?.bg_color ?? "#ffffff");
  const inkColor = showCalendar ? "#000000" : (activeList?.ink_color ?? "#000000");
  const isOwner = !!(user && activeList && activeList.owner_id === user.id);
  const canCompleteTask = (_t: Task) => true;
  const canEditTask = (_t: Task) => true;

  useEffect(() => {
    if (showCalendar) localStorage.setItem("active-list-id", CALENDAR_ID);
  }, [showCalendar]);

  useEffect(() => {
    const listName = activeList?.name;
    document.title = listName
      ? `${listName} — Wonderful Lists`
      : "Wonderful Lists";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        "Gestor de listas y tareas 100% local, con cuenta atrás y diseño brutalista. Tus datos se quedan en tu ordenador."
      );
  }, [activeList?.name]);

  useEffect(() => {
    document.documentElement.style.setProperty("--paper-custom", bgColor);
    document.documentElement.style.setProperty("--ink-custom", inkColor);
  }, [bgColor, inkColor]);

  const loadTasks = useCallback(async () => {
    if (!activeListId) {
      setTasks([]);
      setRecurringTemplates([]);
      return;
    }
    const { data, error } = await supabase
      .from("tasks")
      .select("id, name, description, due_date, created_at, recurrence_days, recurrence_interval_days, recurrence_anchor_date, reminder_at, checklist, task_files, table_data, recurrence_parent_id, completable, link, folder_id")
      .eq("list_id", activeListId)
      .is("completed_at", null);
    if (error) {
      toast.error("Error al cargar tareas");
      return;
    }
    let rows = (data ?? []) as (Task & { created_at: string })[];
    rows = rows.map((task) => ({
      ...task,
      checklist: parseChecklist(task.checklist),
      task_files: parseTaskFiles(task.task_files),
      table_data: parseTaskTable(task.table_data),
    }));

    // Recurring templates are the rules, not items. Keep them in a separate
    // panel so the list only shows today's instances.
    const isTemplate = (t: Task) =>
      !t.recurrence_parent_id &&
      ((t.recurrence_days?.length ?? 0) > 0 || (t.recurrence_interval_days ?? 0) > 0);
    setRecurringTemplates(rows.filter(isTemplate) as RecurringTemplate[]);
    rows = rows.filter((t) => !isTemplate(t));

    const withDate = rows.filter((t) => t.due_date).sort((a, b) =>
      new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime()
    );
    const withoutDate = rows.filter((t) => !t.due_date).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setTasks([...withDate, ...withoutDate] as Task[]);
  }, [activeListId]);

  useEffect(() => {
    if (user && activeListId) loadTasks();
  }, [user, activeListId, loadTasks]);

  // Desktop has no pg_cron: materialize recurring instances from the client.
  useEffect(() => {
    if (!user || !activeListId) return;
    let cancelled = false;

    const run = async () => {
      const { data, error } = await supabase.rpc("generate_recurring_tasks");
      if (cancelled || error) return;
      if ((data ?? 0) > 0) loadTasks();
    };

    void run();
    const timer = window.setInterval(run, 30 * 60 * 1000);
    window.addEventListener("focus", run);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", run);
    };
  }, [user, activeListId, loadTasks]);

  // Load all custom field values for tasks in the active list
  const loadTaskCustomValues = useCallback(async () => {
    if (!activeListId) {
      setTaskCustomValues({});
      return;
    }
    const { data, error } = await supabase
      .from("task_custom_field_values")
      .select("task_id, custom_field_id, value")
      .eq("list_id", activeListId);
    if (error) {
      console.error("[Index] task_custom_field_values load error", error);
      return;
    }
    const map: Record<string, Record<string, any>> = {};
    (data ?? []).forEach((row: any) => {
      const bucket = map[row.task_id] ?? (map[row.task_id] = {});
      bucket[row.custom_field_id] = row.value;
    });
    setTaskCustomValues(map);
  }, [activeListId]);

  useEffect(() => {
    if (user && activeListId) loadTaskCustomValues();
  }, [user, activeListId, loadTaskCustomValues, tasks.length]);

  // Realtime: refresca tareas cuando cualquier miembro las cambia
  useEffect(() => {
    if (!activeListId) return;
    const channel = supabase
      .channel(`tasks-${activeListId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `list_id=eq.${activeListId}` },
        () => loadTasks()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_custom_field_values", filter: `list_id=eq.${activeListId}` },
        () => {
          loadTaskCustomValues();
          // Un nuevo valor puede revelar un campo creado por otro miembro → recarga catálogo.
          loadCustomFields();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_fields" },
        () => loadCustomFields()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeListId, loadTasks, loadTaskCustomValues, loadCustomFields]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user || !activeListId) return;
    const intervalNum = parseInt(recurrenceIntervalDays, 10);
    const hasInterval = !isNaN(intervalNum) && intervalNum > 0;
    const anchorForInterval = hasInterval
      ? (recurrenceAnchorDate || new Date().toISOString().slice(0, 10))
      : null;
    const hasAnyRecurrence = recurrenceDays.length > 0 || hasInterval;
    let dueIso: string | null = null;
    if (dueDay || dueTime) {
      // If only time is set with any recurrence, store as time-only template
      // using anchor date 1970-01-01 (the cron job will apply this hour daily).
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
    const { data: createdTask, error } = await supabase.from("tasks").insert({
      user_id: user.id,
      list_id: activeListId,
      name: name.trim(),
      description: description.trim() || null,
      due_date: dueIso,
      recurrence_days: recurrenceDays,
      recurrence_interval_days: hasInterval ? intervalNum : 0,
      recurrence_anchor_date: anchorForInterval,
      completable,
      link: link.trim() || null,
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      reminder_sent_at: null,
      checklist,
      task_files: taskFiles,
      table_data: tableData,
      folder_id: currentFolderId,
    }).select("id").single();
    if (error) {
      setBusy(false);
      toast.error("No se pudo crear");
      return;
    }
    const activeCustomIds = Array.from(activeCustomFieldIds);
    if (createdTask?.id && activeCustomIds.length > 0) {
      try {
        const rows = await Promise.all(activeCustomIds.map(async (customFieldId) => {
          const field = customFields.find((cf) => cf.id === customFieldId);
          return {
            task_id: createdTask.id,
            custom_field_id: customFieldId,
            list_id: activeListId,
            value: field
              ? await prepareCustomFieldValueForSave(field, customValues[customFieldId], activeListId, createdTask.id)
              : customValues[customFieldId] ?? null,
          };
        }));
        const { error: customError } = await supabase.from("task_custom_field_values").insert(rows);
        if (customError) toast.error("Item creado, pero no se guardaron algunos campos");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Item creado, pero no se guardaron algunos campos");
      }
    }
    setBusy(false);
    setName("");
    setDescription("");
    setDueDay("");
    setDueTime("");
    setRecurrenceDays([]);
    setRecurrenceIntervalDays("");
    setRecurrenceAnchorDate("");
    setCompletable(false);
    setLink("");
    setReminderAt("");
    setChecklist([]);
    setTaskFiles([]);
    setTableData(null);
    setActiveFields(new Set());
    setActiveCustomFieldIds(new Set());
    setCustomValues({});
    setShowForm(false);
    if (recurrenceDays.length > 0 || hasInterval) {
      await supabase.rpc("generate_recurring_tasks");
      toast.success("Repetición creada. Gestiónala en Repeticiones.");
    }
    await Promise.all([loadTasks(), loadTaskCustomValues()]);
  };

  const toggleRecurrenceDay = (d: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };
  const WEEKDAYS = ["D", "L", "M", "X", "J", "V", "S"];

  const toggleChecklistItem = async (taskId: string, itemId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const current = parseChecklist(task.checklist);
    const next = current.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    setTasks((items) =>
      items.map((item) => (item.id === taskId ? { ...item, checklist: next } : item)),
    );
    const { error } = await supabase.from("tasks").update({ checklist: next }).eq("id", taskId);
    if (error) toast.error("No se pudo actualizar el checklist");
  };

  const handleComplete = async (id: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo completar");
      return;
    }
    setTasks((t) => t.filter((x) => x.id !== id));
  };

  const handleCreateList = async (e: FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    await createList(newListName.trim(), newListDesc);
    setNewListName("");
    setNewListDesc("");
    setShowNewList(false);
  };

  const handleDeleteList = async () => {
    if (!activeList) return;
    if (!isOwner) {
      toast.error("Solo el propietario puede borrar");
      return;
    }
    await deleteList(activeList.id);
  };

  const LONG_PRESS_MS = 500;
  const startTitlePress = () => {
    if (!isOwner) return;
    titleLongRef.current = false;
    if (titleTimerRef.current) window.clearTimeout(titleTimerRef.current);
    titleTimerRef.current = window.setTimeout(() => {
      titleLongRef.current = true;
      setEditingList(true);
    }, LONG_PRESS_MS);
  };
  const cancelTitlePress = () => {
    if (titleTimerRef.current) {
      window.clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
  };
  const handleTitleTouchEnd = (e: React.TouchEvent) => {
    cancelTitlePress();
    if (titleLongRef.current) {
      e.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - titleLastTapRef.current < 300) {
      e.preventDefault();
      setShowListDesc((v) => !v);
    }
    titleLastTapRef.current = now;
  };

  if (!user || listsLoading || (!activeList && !showCalendar)) {
    return (
      <main className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <p className="font-mono-brutal uppercase">Cargando…</p>
      </main>
    );
  }

  const paperStyle = { backgroundColor: bgColor };
  const pageStyle = { backgroundColor: bgColor, color: inkColor };
  const renderCreateCustomField = (cf: CustomField) => {
    const value = customValues[cf.id];
    const setVal = (v: any) => setCustomValues((prev) => ({ ...prev, [cf.id]: v }));
    const inputStyle = { ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` };
    const baseInputCls = "w-full px-4 py-3 font-mono-brutal text-sm outline-hidden";
    const options: string[] = Array.isArray(cf.options) ? cf.options : [];
    const validation = cf.validation || {};
    const removeBtn = (
      <button
        type="button"
        onClick={() => removeCustomField(cf.id)}
        aria-label={`Quitar campo ${cf.name}`}
        className="font-mono-brutal text-xs uppercase w-7 h-7 flex items-center justify-center leading-none shrink-0"
        style={{ ...paperStyle, color: inkColor, border: `2px solid ${inkColor}` }}
      >
        ×
      </button>
    );
    const nameInput = (el: JSX.Element) =>
      typeof el.type === "string" && ["input", "textarea", "select"].includes(el.type) && !el.props["aria-label"]
        ? cloneElement(el, { "aria-label": cf.name })
        : el;
    let input: JSX.Element;
    if (cf.field_type === "textarea") {
      input = <textarea value={value ?? ""} onChange={(e) => setVal(e.target.value)} rows={3} className={baseInputCls + " resize-y"} style={inputStyle} maxLength={validation.maxLength} />;
    } else if (["number", "currency", "percentage"].includes(cf.field_type)) {
      input = <input type="number" value={value ?? ""} onChange={(e) => setVal(e.target.value === "" ? null : Number(e.target.value))} min={validation.min} max={validation.max} step={validation.step ?? "any"} className={baseInputCls} style={inputStyle} />;
    } else if (cf.field_type === "date") {
      input = <input type="date" value={value ?? ""} onChange={(e) => setVal(e.target.value)} className={baseInputCls} style={inputStyle} />;
    } else if (cf.field_type === "daterange") {
      const range = (value && typeof value === "object" ? value : {}) as { start?: string | null; end?: string | null };
      const days = dateRangeDays(range);
      input = (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-mono-brutal text-[10px] uppercase opacity-70 block mb-1">Inicio</span>
              <input type="date" aria-label={`${cf.name}: inicio`} value={range.start ?? ""} max={range.end ?? undefined} onChange={(e) => setVal({ start: e.target.value || null, end: range.end ?? null })} className={baseInputCls} style={inputStyle} />
            </div>
            <div>
              <span className="font-mono-brutal text-[10px] uppercase opacity-70 block mb-1">Fin</span>
              <input type="date" aria-label={`${cf.name}: fin`} value={range.end ?? ""} min={range.start ?? undefined} onChange={(e) => setVal({ start: range.start ?? null, end: e.target.value || null })} className={baseInputCls} style={inputStyle} />
            </div>
          </div>
          {days !== null && <p className="font-mono-brutal text-[10px] uppercase opacity-70">Duración: {days} día{days === 1 ? "" : "s"}</p>}
        </div>
      );

    } else if (cf.field_type === "datetime") {
      input = <input type="datetime-local" value={value ?? ""} onChange={(e) => setVal(e.target.value)} className={baseInputCls} style={inputStyle} />;
    } else if (["email", "phone", "url"].includes(cf.field_type)) {
      input = <input type={cf.field_type === "phone" ? "tel" : cf.field_type === "email" ? "email" : "url"} value={value ?? ""} onChange={(e) => setVal(e.target.value)} className={baseInputCls} style={inputStyle} />;
    } else if (cf.field_type === "image") {
      input = <div><input type="file" aria-label={`${cf.name}: subir imagen`} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVal(createImagePreviewValue(file)); }} className={baseInputCls} style={inputStyle} /><TaskImagePreview value={value} alt={cf.name} inkColor={inkColor} /></div>;
    } else if (cf.field_type === "file") {
      const maxMB = Number(validation.maxSizeMB ?? MAX_FILE_SIZE_MB) || MAX_FILE_SIZE_MB;
      input = (
        <div>
          <input type="file" aria-label={`${cf.name}: subir archivo`} accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.rar,.7z,image/*,audio/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > maxMB * 1024 * 1024) { toast.error(`El archivo no puede superar ${maxMB} MB`); e.target.value = ""; return; } setVal(createPendingFileValue(file)); }} className={baseInputCls} style={inputStyle} />
          <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-1">Máx. {maxMB} MB · PDF, Word, Excel, imágenes y más</p>
          <TaskFileAttachment value={value} inkColor={inkColor} bgColor={bgColor} />
        </div>
      );
    } else if (cf.field_type === "relation") {
      const arr: string[] = Array.isArray(value) ? value : [];
      input = <div className="space-y-2 max-h-48 overflow-y-auto pr-1">{tasks.map((t) => { const on = arr.includes(t.id); return <button key={t.id} type="button" onClick={() => setVal(on ? arr.filter((id) => id !== t.id) : [...arr, t.id])} className="w-full text-left font-mono-brutal text-xs uppercase px-3 py-2" style={{ backgroundColor: on ? inkColor : bgColor, color: on ? bgColor : inkColor, border: `3px solid ${inkColor}` }}>{t.name}</button>; })}</div>;
    } else if (cf.field_type === "color") {
      input = <input type="color" aria-label={cf.name} value={value ?? "#000000"} onChange={(e) => setVal(e.target.value)} className="w-full h-12 outline-hidden" style={inputStyle} />;
    } else if (cf.field_type === "checkbox") {
      input = <label className="flex items-center gap-3 cursor-pointer select-none px-4 py-3" style={inputStyle}><input type="checkbox" aria-label={cf.name} checked={!!value} onChange={(e) => setVal(e.target.checked)} className="w-5 h-5" style={{ accentColor: inkColor }} /><span className="font-mono-brutal text-xs uppercase flex-1">{cf.name}</span></label>;
    } else if (cf.field_type === "counter") {
      const current = Number(value ?? 0);
      const step = Number(validation.step ?? 1) || 1;
      const clamp = (n: number) => {
        if (validation.min !== undefined && validation.min !== null && n < validation.min) return validation.min;
        if (validation.max !== undefined && validation.max !== null && n > validation.max) return validation.max;
        return n;
      };
      input = (
        <div className="flex items-center gap-2" style={inputStyle}>
          <button type="button" aria-label={`Disminuir ${cf.name}`} onClick={() => setVal(clamp(current - step))}
            className="w-12 h-12 font-mono-brutal text-2xl shrink-0"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}>−</button>
          <input type="number" aria-label={cf.name} value={current}
            onChange={(e) => setVal(e.target.value === "" ? 0 : clamp(Number(e.target.value)))}
            className="flex-1 min-w-0 text-center font-mono-brutal text-2xl px-2 h-12 outline-hidden"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }} />
          <button type="button" aria-label={`Aumentar ${cf.name}`} onClick={() => setVal(clamp(current + step))}
            className="w-12 h-12 font-mono-brutal text-2xl shrink-0"
            style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}>+</button>
        </div>
      );
    } else if (cf.field_type === "stars") {
      const current = Number(value ?? 0);
      input = <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${cf.name}: ${n} estrella${n > 1 ? "s" : ""}`} onClick={() => setVal(n === current ? 0 : n)} className="w-10 h-10 font-mono-brutal text-lg" style={{ backgroundColor: n <= current ? inkColor : bgColor, color: n <= current ? bgColor : inkColor, border: `3px solid ${inkColor}` }}>★</button>)}</div>;

    } else if (cf.field_type === "select") {
      input = <select value={value ?? ""} onChange={(e) => setVal(e.target.value || null)} className={baseInputCls} style={inputStyle}><option value="">—</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    } else if (cf.field_type === "multiselect") {
      const arr: string[] = Array.isArray(value) ? value : [];
      input = <div className="flex flex-wrap gap-2">{options.map((o) => { const on = arr.includes(o); return <button key={o} type="button" onClick={() => setVal(on ? arr.filter((x) => x !== o) : [...arr, o])} className="font-mono-brutal text-xs uppercase px-3 py-2" style={{ backgroundColor: on ? inkColor : bgColor, color: on ? bgColor : inkColor, border: `3px solid ${inkColor}` }}>{o}</button>; })}</div>;
    } else {
      input = <input type="text" value={value ?? ""} onChange={(e) => setVal(e.target.value)} maxLength={validation.maxLength} className={baseInputCls} style={inputStyle} />;
    }

    return (
      <div key={cf.id} className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="font-mono-brutal text-xs uppercase flex items-center gap-2">
            {renderCustomFieldIcon(cf.icon)}
            {cf.name}
          </label>
          {removeBtn}
        </div>
        {nameInput(input)}
      </div>
    );
  };

  return (
    <main className="min-h-screen pb-32 transition-colors" style={pageStyle}>
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        {/* List navigator */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => { setShowCalendar(false); prev(); }}
            disabled={lists.length < 2 || showCalendar}
            aria-label="Lista anterior"
            className="w-10 h-10 flex items-center justify-center shadow-brutal-hover disabled:opacity-30"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={3} />
          </button>
          <div ref={listMenuRef} className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setShowListMenu((v) => !v)}
              className="w-full px-3 py-2 font-mono-brutal text-sm uppercase shadow-brutal-hover flex items-center justify-between gap-2"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            >
              <span className="truncate flex items-center gap-2">
                {showCalendar ? (
                  <>
                    <CalendarDays className="w-4 h-4 shrink-0" strokeWidth={3} />
                    Calendario
                  </>
                ) : (
                  <>
                    {activeList?.name}
                    
                  </>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${showListMenu ? "rotate-180" : ""}`} strokeWidth={3} />
            </button>
            {showListMenu && (
              <ul
                className="absolute left-0 right-0 top-full mt-2 z-30 shadow-brutal max-h-72 overflow-auto"
                style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
              >
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCalendar(true);
                      setShowListMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 font-mono-brutal text-sm uppercase flex items-center gap-2"
                    style={{
                      backgroundColor: showCalendar ? inkColor : bgColor,
                      color: showCalendar ? bgColor : inkColor,
                      borderBottom: `2px solid ${inkColor}`,
                    }}
                  >
                    <Check className={`w-4 h-4 shrink-0 ${showCalendar ? "opacity-100" : "opacity-0"}`} strokeWidth={3} />
                    <CalendarDays className="w-4 h-4 shrink-0" strokeWidth={3} />
                    <span className="truncate flex-1">Calendario (todas)</span>
                  </button>
                </li>
                {lists.map((l) => {
                  const isActive = !showCalendar && l.id === activeListId;
                  const isLocked = l.locked && l.owner_id === user.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            setShowListMenu(false);
                            toast.error("Esta lista está bloqueada.");
                            return;
                          }
                          setShowCalendar(false);
                          setActiveListId(l.id);
                          setShowListMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 font-mono-brutal text-sm uppercase flex items-center gap-2 hover:opacity-100 transition-opacity"
                        style={{
                          backgroundColor: isActive ? inkColor : bgColor,
                          color: isActive ? bgColor : inkColor,
                          borderBottom: `2px solid ${inkColor}`,
                          opacity: isLocked ? 0.55 : 1,
                        }}
                      >
                        <Check className={`w-4 h-4 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`} strokeWidth={3} />
                        <span className="truncate flex-1">{l.name}</span>
                        {isLocked && <Lock className="w-3 h-3 shrink-0" strokeWidth={3} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button
            onClick={() => { setShowCalendar(false); next(); }}
            disabled={lists.length < 2 || showCalendar}
            aria-label="Lista siguiente"
            className="w-10 h-10 flex items-center justify-center shadow-brutal-hover disabled:opacity-30"
            style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={3} />
          </button>
          <button
            onClick={() => {
              setShowNewList(true);
            }}
            aria-label="Nueva lista"
            className="w-10 h-10 flex items-center justify-center shadow-brutal-hover"
            style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        <header
          className="mb-10 pb-6"
          style={{ borderBottom: `4px solid ${inkColor}` }}
        >
          <p className="font-mono-brutal text-xs uppercase tracking-widest mb-2">
            Mis listas · 100% local
          </p>
          {showCalendar ? (
            <h1 className="display-font text-5xl md:text-7xl uppercase leading-[0.85] mb-6 break-words flex items-center gap-4">
              <CalendarDays className="w-12 h-12 md:w-16 md:h-16 shrink-0" strokeWidth={3} />
              Calendario
            </h1>
          ) : (
            <>
              <h1
                className={`display-font text-5xl md:text-7xl uppercase leading-[0.85] mb-6 ${showListDesc ? "break-words" : "truncate"} ${isOwner ? "cursor-pointer select-none" : ""}`}
                onDoubleClick={() => setShowListDesc((v) => !v)}
                onMouseDown={startTitlePress}
                onMouseUp={cancelTitlePress}
                onMouseLeave={cancelTitlePress}
                onTouchStart={startTitlePress}
                onTouchEnd={handleTitleTouchEnd}
                onTouchMove={cancelTitlePress}
                onTouchCancel={cancelTitlePress}
                title={isOwner ? "Doble clic: ver descripción · Mantener: editar" : undefined}
              >
                {activeList!.name}
              </h1>
              {showListDesc && (
                <p className="font-mono-brutal text-sm mb-6 whitespace-pre-wrap break-words opacity-80">
                  {activeList!.description?.trim() ? activeList!.description : "Sin descripción"}
                </p>
              )}
            </>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {!showCalendar && recurringTemplates.length > 0 && (
              <button
                onClick={() => setShowRecurring(true)}
                aria-label="Repeticiones"
                className="font-mono-brutal text-xs uppercase px-3 py-2 shadow-brutal-hover flex items-center gap-2"
                style={{ ...paperStyle, border: `3px solid ${inkColor}` }}
              >
                <Repeat className="w-4 h-4" strokeWidth={3} /> Repeticiones ({recurringTemplates.length})
              </button>
            )}
            {!showCalendar && (
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Ajustes"
                className="font-mono-brutal text-xs uppercase px-3 py-2 shadow-brutal-hover flex items-center gap-2"
                style={{ ...paperStyle, border: `3px solid ${inkColor}` }}
              >
                <Settings className="w-4 h-4" strokeWidth={3} /> Ajustes
              </button>
            )}
            {!showCalendar && (
              <button
                onClick={() => setShowForm((v) => !v)}
                aria-label={showForm ? "Cerrar nueva tarea" : "Nueva tarea"}
                aria-expanded={showForm}
                className="font-mono-brutal text-lg uppercase h-10 w-full md:w-10 flex items-center justify-center shadow-brutal-hover leading-none basis-full md:basis-auto"
                style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
              >
                {showForm ? "×" : "+"}
              </button>
            )}
          </div>
        </header>

        {!showCalendar && showForm && (() => {
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
          const FIELD_ORDER: FieldKey[] = ["description", "date", "recurrence", "reminder", "checklist", "files", "table", "completable", "link"];
          const available = FIELD_ORDER.filter((k) => !activeFields.has(k));
          const availableCustom = customFields.filter((f) => (!f.locked || f.is_official) && !activeCustomFieldIds.has(f.id));
          const totalAvailable = available.length + availableCustom.length;
          return (
            <section aria-label="Nueva tarea" className="mb-10">
              <form
                onSubmit={handleAdd}
                className="p-5 md:p-6 shadow-brutal"
                style={{ ...paperStyle, border: `4px solid ${inkColor}` }}
              >
                <label htmlFor="quick-add-name" className="font-mono-brutal text-xs uppercase block mb-2">Nombre</label>
                <input
                  id="quick-add-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Comprar pan…"
                  required
                  autoFocus
                  className="w-full px-4 py-3 text-xl display-font uppercase outline-hidden mb-4"
                  style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                />

                {/* Active fields, in selection order */}
                {Array.from(activeFields).map((k) => {
                  const removeBtn = (
                    <button
                      type="button"
                      onClick={() => toggleField(k)}
                      aria-label={`Quitar campo ${FIELD_LABELS[k]}`}
                      className="font-mono-brutal text-xs uppercase w-7 h-7 flex items-center justify-center leading-none shrink-0"
                      style={{ ...paperStyle, color: inkColor, border: `2px solid ${inkColor}` }}
                    >
                      ×
                    </button>
                  );
                  if (k === "description") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <textarea
                          aria-label="Descripción"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Detalles…"
                          rows={3}
                          autoFocus
                          className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden resize-y"
                          style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                        />
                      </div>
                    );
                  }
                  if (k === "date") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            aria-label="Fecha límite"
                            value={dueDay}
                            onChange={(e) => setDueDay(e.target.value)}
                            className="w-full px-4 py-3 font-mono-brutal text-lg outline-hidden"
                            style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                          />
                          <input
                            type="time"
                            value={dueTime}
                            onChange={(e) => setDueTime(e.target.value)}
                            aria-label="Hora (opcional)"
                            className="w-full px-4 py-3 font-mono-brutal text-lg outline-hidden"
                            style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                          />
                        </div>
                      </div>
                    );
                  }
                  if (k === "recurrence") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <div className="grid grid-cols-7 gap-2 mb-2">
                          {WEEKDAYS.map((label, idx) => {
                            const active = recurrenceDays.includes(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleRecurrenceDay(idx)}
                                aria-pressed={active}
                                aria-label={`Día ${label}`}
                                className="font-mono-brutal text-sm uppercase py-2 transition-colors"
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
                          <button type="button" onClick={() => setRecurrenceDays([0,1,2,3,4,5,6])}
                            className="flex-1 font-mono-brutal text-[10px] uppercase py-2"
                            style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}>Todos</button>
                          <button type="button" onClick={() => setRecurrenceDays([1,2,3,4,5])}
                            className="flex-1 font-mono-brutal text-[10px] uppercase py-2"
                            style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}>L–V</button>
                          <button type="button" onClick={() => setRecurrenceDays([0,6])}
                            className="flex-1 font-mono-brutal text-[10px] uppercase py-2"
                            style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}>S–D</button>
                          <button type="button" onClick={() => setRecurrenceDays([])}
                            className="flex-1 font-mono-brutal text-[10px] uppercase py-2"
                            style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}>Ninguno</button>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={recurrenceIntervalDays}
                          aria-label="Repetir cada N días"
                          onChange={(e) => setRecurrenceIntervalDays(e.target.value)}
                          placeholder="O cada N días (ej. 28)"
                          className="w-full px-4 py-3 font-mono-brutal text-lg outline-hidden"
                          style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                        />
                      </div>
                    );
                  }
                  if (k === "completable") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <label
                          className="flex items-center gap-3 cursor-pointer select-none px-4 py-3"
                          style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                        >
                          <input
                            type="checkbox"
                            checked={completable}
                            onChange={(e) => setCompletable(e.target.checked)}
                            className="w-5 h-5 cursor-pointer"
                            style={{ accentColor: inkColor }}
                          />
                          <span className="font-mono-brutal text-xs uppercase flex-1">
                            Se puede marcar como completada
                          </span>
                        </label>
                      </div>
                    );
                  }
                  if (k === "reminder") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <input
                          type="datetime-local"
                          value={reminderAt}
                          onChange={(e) => setReminderAt(e.target.value)}
                          className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden"
                          style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                        />
                        <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-2">
                          La app debe estar abierta para mostrarte la notificación.
                        </p>
                      </div>
                    );
                  }
                  if (k === "checklist") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <ChecklistEditor
                          items={checklist}
                          onChange={setChecklist}
                          bgColor={bgColor}
                          inkColor={inkColor}
                        />
                        <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-2">
                          Añade subtareas. La barra avanza al completarlas.
                        </p>
                      </div>
                    );
                  }
                  if (k === "files") {
                    return (
                      <div key={k} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
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
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
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
                        <div className="flex items-center justify-between mb-2">
                          <label className="font-mono-brutal text-xs uppercase">{FIELD_LABELS[k]}</label>
                          {removeBtn}
                        </div>
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => setLink(e.target.value)}
                          placeholder="https://ejemplo.com"
                          autoFocus
                          className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden"
                          style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
                        />
                        <p className="font-mono-brutal text-[10px] uppercase opacity-60 mt-2">
                          Al pulsar el item se abrirá esta URL en una nueva pestaña.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })}

                {customFields.filter((cf) => activeCustomFieldIds.has(cf.id)).map((cf) => renderCreateCustomField(cf))}

                {/* + Add field button (Notion-style) */}
                <div ref={fieldMenuRef} className="relative mb-4">
                  <button
                    type="button"
                    onClick={() => setShowFieldMenu((v) => !v)}
                    disabled={totalAvailable === 0}
                    className="w-full font-mono-brutal text-xs uppercase py-3 flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ ...paperStyle, color: inkColor, border: `3px dashed ${inkColor}` }}
                  >
                    <Plus className="w-4 h-4" strokeWidth={3} />
                    {totalAvailable === 0 ? "Todos los campos añadidos" : "Añadir campo"}
                  </button>
                  {showFieldMenu && totalAvailable > 0 && (
                    <ul
                      className="absolute left-0 right-0 top-full mt-2 z-30 shadow-brutal max-h-72 overflow-y-auto"
                      style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
                    >
                      {available.map((k) => (
                        <li key={k}>
                          <button
                            type="button"
                            onClick={() => toggleField(k)}
                            className="w-full text-left px-3 py-2 font-mono-brutal text-sm uppercase flex items-center gap-2"
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
                              className="w-full text-left px-3 py-2 font-mono-brutal text-sm uppercase flex items-center gap-2"
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
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy || filesUploading}
                  className="w-full font-mono-brutal uppercase text-lg py-4 shadow-brutal-sm shadow-brutal-hover disabled:opacity-50"
                  style={{ backgroundColor: inkColor, color: bgColor, border: `4px solid ${inkColor}` }}
                >
                  {busy ? "Añadiendo…" : "+ Añadir tarea"}
                </button>
              </form>
            </section>
          );
        })()}


        {showCalendar ? (
          <CalendarView lists={lists} bgColor={bgColor} inkColor={inkColor} />
        ) : (
          <section aria-label="Tareas">
            {activeListId && user && (
              <FoldersBar
                listId={activeListId}
                userId={user.id}
                isMember={!!activeList}
                isPremium={true}
                bgColor={bgColor}
                inkColor={inkColor}
                currentFolderId={currentFolderId}
                onChangeFolder={setCurrentFolderId}
                onOpenPricing={() => undefined}
                draggingId={dragging?.id ?? null}
                draggingType={dragging?.type ?? null}
                onDropOnFolder={async (folderId) => {
                  if (!dragging) return;
                  const { id, type } = dragging;
                  setDragging(null);
                  if (type === "task") {
                    const { error } = await supabase
                      .from("tasks")
                      .update({ folder_id: folderId })
                      .eq("id", id);
                    if (error) toast.error("No se pudo mover");
                    else { toast.success("Movido"); loadTasks(); }
                  } else {
                    // Move folder
                    const { error } = await supabase
                      .from("task_folders")
                      .update({ parent_folder_id: folderId })
                      .eq("id", id);
                    if (error) toast.error("No se pudo mover la carpeta");
                    else toast.success("Carpeta movida");
                  }
                }}
              />
            )}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar tareas"
                className="flex-1 px-3 py-2 font-mono-brutal text-xs uppercase outline-hidden"
                style={{ ...paperStyle, color: inkColor, border: `3px solid ${inkColor}` }}
              />
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                const inFolder = q ? tasks : tasks.filter((t) => (t.folder_id ?? null) === currentFolderId);
                const filtered = q
                  ? inFolder.filter(
                      (t) =>
                        t.name.toLowerCase().includes(q) ||
                        (t.description ?? "").toLowerCase().includes(q)
                    )
                  : inFolder;
                return (
                  <span className="font-mono-brutal text-xs uppercase shrink-0">
                    [{filtered.length}{q ? `/${tasks.length}` : ""}]
                  </span>
                );
              })()}
            </div>
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const inFolder = q ? tasks : tasks.filter((t) => (t.folder_id ?? null) === currentFolderId);
              const filtered = q
                ? inFolder.filter(
                    (t) =>
                      t.name.toLowerCase().includes(q) ||
                      (t.description ?? "").toLowerCase().includes(q)
                  )
                : inFolder;
              if (tasks.length === 0 && !currentFolderId) {
                return (
                  <div className="p-10 text-center" style={{ border: `4px dashed ${inkColor}` }}>
                    <p className="font-mono-brutal uppercase text-sm">Sin tareas. Añade la primera.</p>
                  </div>
                );
              }
              if (filtered.length === 0) {
                return (
                  <div className="p-10 text-center" style={{ border: `4px dashed ${inkColor}` }}>
                    <p className="font-mono-brutal uppercase text-sm">{q ? "Sin resultados." : "Carpeta vacía."}</p>
                  </div>
                );
              }
              return (
                <ul className="space-y-4">
                  {filtered.map((t) => {
                    const isCompletable = t.completable !== false;
                    const allowed = isCompletable && canCompleteTask(t);
                    return (
                      <div
                        key={t.id}
                        draggable={canEditTask(t)}
                        onDragStart={(e) => {
                          setDragging({ id: t.id, type: "task" });
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/task-id", t.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                      >
                        <TaskItem
                          id={t.id}
                          name={t.name}
                          description={t.description}
                          dueDate={t.due_date}
                          recurrenceDays={t.recurrence_days ?? []}
                          recurrenceIntervalDays={t.recurrence_interval_days ?? 0}
                          recurrenceAnchorDate={t.recurrence_anchor_date ?? null}
                          link={t.link ?? null}
                          reminderAt={t.reminder_at ?? null}
                          checklist={t.checklist ?? []}
                          onToggleChecklist={(itemId) => void toggleChecklistItem(t.id, itemId)}
                          taskFiles={t.task_files ?? []}
                          tableData={t.table_data ?? null}
                          isTemplate={!t.recurrence_parent_id && ((t.recurrence_days?.length ?? 0) > 0 || (t.recurrence_interval_days ?? 0) > 0)}
                          listId={activeListId!}
                          userId={user.id}
                          completable={isCompletable}
                          canComplete={allowed}
                          canLongPress={canEditTask(t)}
                          onDelete={handleComplete}
                          onLongPress={(id) => {
                            const task = tasks.find((x) => x.id === id);
                            if (task) setEditingTask(task);
                          }}
                          bgColor={bgColor}
                          inkColor={inkColor}
                          customFields={customFields}
                          customValues={taskCustomValues[t.id] ?? {}}
                          relatedTaskNames={Object.fromEntries(tasks.map((rt) => [rt.id, rt.name]))}
                        />
                      </div>
                    );
                  })}
                </ul>
              );
            })()}
          </section>
        )}

        <footer
          className="mt-16 pt-6 font-mono-brutal text-xs uppercase tracking-widest"
          style={{ borderTop: `4px solid ${inkColor}` }}
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-between items-center">
            <span>Wonderful Lists · Desktop</span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <a href="#/terms" className="underline">Términos</a>
              <a href="#/privacy" className="underline">Privacidad</a>
            </span>
          </div>
        </footer>
      </div>

      <EditTaskDialog
        task={editingTask}
        listId={activeListId}
        listOwnerId={activeList?.owner_id ?? null}
        onClose={() => setEditingTask(null)}
        onSaved={() => {
          loadTasks();
          loadTaskCustomValues();
        }}
        bgColor={bgColor}
        inkColor={inkColor}
        canEdit={editingTask ? canEditTask(editingTask) : false}
        isOwner={isOwner}
        relatedTasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
      />


      {activeList && !showCalendar && (
        <>
          <SettingsPanel
            open={showSettings}
            onClose={() => setShowSettings(false)}
            bgColor={bgColor}
            inkColor={inkColor}
            onChangeBg={(c) => updateList(activeList.id, { bg_color: c })}
            onChangeInk={(c) => updateList(activeList.id, { ink_color: c })}
            listId={activeList.id}
            listName={activeList.name}
            isOwner={isOwner}
            {...(isOwner && lists.length > 1 ? { onDeleteList: handleDeleteList } : {})}
          />

          <RecurringPanel
            open={showRecurring}
            onClose={() => setShowRecurring(false)}
            templates={recurringTemplates}
            onEdit={(id) => {
              const template = recurringTemplates.find((item) => item.id === id);
              if (!template) return;
              setEditingTask(template as Task);
              setShowRecurring(false);
            }}
            onDelete={async (id) => {
              const { error } = await supabase.from("tasks").delete().eq("id", id);
              if (error) {
                toast.error("No se pudo eliminar la repetición");
                return;
              }
              await loadTasks();
            }}
            bgColor={bgColor}
            inkColor={inkColor}
          />

          <EditListDialog
            list={editingList ? activeList : null}
            canEdit={isOwner}
            onClose={() => setEditingList(false)}
            onSave={(patch) => updateList(activeList.id, patch)}
            {...(lists.length > 1 ? { onDelete: handleDeleteList } : {})}
            bgColor={bgColor}
            inkColor={inkColor}
          />
        </>
      )}

      {showNewList && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: `${inkColor}cc` }}
          onClick={() => setShowNewList(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateList}
            className="w-full max-w-md p-5 md:p-6 shadow-brutal"
            style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
          >
            <h2 className="display-font text-2xl uppercase mb-4">Nueva lista</h2>
            <label htmlFor="new-list-name" className="font-mono-brutal text-xs uppercase block mb-2">Nombre</label>
            <input
              id="new-list-name"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Trabajo, casa, viaje…"
              required
              autoFocus
              className="w-full px-4 py-3 text-xl display-font uppercase outline-hidden mb-4"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            />
            <label className="font-mono-brutal text-xs uppercase block mb-2">
              Descripción (opcional)
            </label>
            <textarea
              aria-label="Descripción de la lista"
              value={newListDesc}
              onChange={(e) => setNewListDesc(e.target.value)}
              placeholder="Para qué es esta lista…"
              rows={3}
              className="w-full px-4 py-3 font-mono-brutal text-sm outline-hidden mb-4 resize-y"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            />
            <button
              type="submit"
              className="w-full font-mono-brutal uppercase text-lg py-4 shadow-brutal-sm shadow-brutal-hover"
              style={{ backgroundColor: inkColor, color: bgColor, border: `4px solid ${inkColor}` }}
            >
              Crear
            </button>
          </form>
        </div>
      )}
      
    </main>
  );
};

export default Index;
