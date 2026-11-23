import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { getTimeRemaining } from "@/lib/timeRemaining";
import { CustomField, isStoredImageValue, isStoredFileValue, formatDateRange, dateRangeDays } from "@/lib/customFields";
import { TaskFileAttachment } from "./TaskFileAttachment";
import { TaskCounterField } from "./TaskCounterField";

import { TaskImagePreview } from "./TaskImagePreview";
import { FieldWidgets } from "./FieldWidgets";
import { ChecklistView } from "./ChecklistView";
import { parseChecklist, type ChecklistItem } from "@/lib/checklist";
import { TaskFilesView } from "./TaskFilesView";
import { TaskTableView } from "./TaskTableView";
import { parseTaskFiles, type TaskFile } from "@/lib/taskFiles";
import { parseTaskTable, type TaskTable } from "@/lib/taskTable";

type Props = {
  id: string;
  name: string;
  description?: string | null;
  dueDate: string | null;
  recurrenceDays?: number[];
  recurrenceIntervalDays?: number;
  recurrenceAnchorDate?: string | null;
  recurrenceType?: string | null;
  reminderAt?: string | null;
  checklist?: ChecklistItem[];
  onToggleChecklist?: (itemId: string) => void;
  taskFiles?: TaskFile[];
  tableData?: TaskTable | null;
  isTemplate?: boolean;
  link?: string | null;
  listId?: string;
  userId?: string;
  completable?: boolean;
  canComplete?: boolean;
  canLongPress?: boolean;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
  bgColor: string;
  inkColor: string;
  customFields?: CustomField[];
  customValues?: Record<string, any>;
  relatedTaskNames?: Record<string, string>;
};

const LONG_PRESS_MS = 500;
const WEEKDAY_INITIALS = ["D", "L", "M", "X", "J", "V", "S"];

const getNextRecurrenceLabel = (
  days: number[] | undefined,
  intervalDays: number | undefined,
  anchorDate: string | null | undefined,
  recurrenceType: string | null | undefined,
): string | null => {
  if (recurrenceType === "monthly") return "1M";
  if (recurrenceType === "yearly") return "1A";
  // Weekly: next matching weekday initial
  if (days && days.length > 0) {
    const today = new Date().getDay();
    for (let offset = 0; offset < 7; offset++) {
      const d = (today + offset) % 7;
      if (days.includes(d)) return WEEKDAY_INITIALS[d] ?? null;
    }
  }
  // Interval: days remaining until next cycle hit
  if (intervalDays && intervalDays > 0) {
    return `/${intervalDays}d`;
  }
  return null;
};

export const TaskItem = ({ id, name, description, dueDate, recurrenceDays, recurrenceIntervalDays, recurrenceAnchorDate, recurrenceType, reminderAt, checklist = [], onToggleChecklist, taskFiles = [], tableData = null, isTemplate = false, link, listId, userId, completable = true, canComplete = true, canLongPress = true, onDelete, onLongPress, bgColor, inkColor, customFields = [], customValues = {}, relatedTaskNames = {} }: Props) => {
  const [, tick] = useState(0);
  const checklistItems = parseChecklist(checklist);
  const fileItems = parseTaskFiles(taskFiles);
  const table = parseTaskTable(tableData);
  const [expanded, setExpanded] = useState(false);
  const lastTapRef = useRef<number>(0);
  const pressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(i);
  }, []);

  const isAnchorTemplate = dueDate ? new Date(dueDate).getUTCFullYear() === 1970 : false;
  const info = dueDate && !isAnchorTemplate ? getTimeRemaining(dueDate) : null;

  const badgeStyle = info?.overdue
    ? { backgroundColor: "hsl(var(--danger))", color: bgColor, border: `3px solid hsl(var(--danger))` }
    : { backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` };

  const toggleExpanded = () => setExpanded((v) => !v);

  const startPress = () => {
    longPressedRef.current = false;
    if (!canLongPress) return;
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onLongPress(id);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    cancelPress();
    if (longPressedRef.current) {
      e.preventDefault();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      toggleExpanded();
    }
    lastTapRef.current = now;
  };

  const handleClick = () => {
    if (longPressedRef.current) return;
  };

  return (
    <li
      className="p-5 md:p-6 shadow-brutal-sm shadow-brutal-hover cursor-pointer select-none"
      style={{ backgroundColor: bgColor, color: inkColor, border: `4px solid ${inkColor}` }}
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={handleTouchEnd}
      onTouchMove={cancelPress}
      onTouchCancel={cancelPress}
      onDragStart={() => { cancelPress(); longPressedRef.current = false; }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 lang="es" className="display-font text-2xl md:text-3xl uppercase break-words hyphens-auto">
            {name}
          </h3>
          {dueDate && (() => {
            const d = new Date(dueDate);
            const hh = d.getHours();
            const mm = d.getMinutes();
            const hasTime = !(hh === 23 && mm === 59);
            const isAnchor = d.getUTCFullYear() === 1970;
            const pad = (n: number) => String(n).padStart(2, "0");
            const text = isAnchor
              ? `Cada día · ${pad(hh)}:${pad(mm)}`
              : `${d.toLocaleDateString()}${hasTime ? ` · ${pad(hh)}:${pad(mm)}` : ""}`;
            return (
              <p className="font-mono-brutal text-xs uppercase mt-1 opacity-70">{text}</p>
            );
          })()}
        </div>

        <div className="flex items-center gap-4">
          {info && (
            <div
              className="font-mono-brutal text-2xl md:text-3xl font-bold uppercase whitespace-nowrap px-4 py-2"
              style={badgeStyle}
            >
              {info.text}
            </div>
          )}
          {link && (() => {
            const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                aria-label="Abrir enlace"
                title={`Abrir ${href}`}
                className="flex items-center justify-center w-12 h-12 shadow-brutal-hover"
                style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
              >
                <ExternalLink className="w-5 h-5" strokeWidth={3} />
              </a>
            );
          })()}
          {completable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!canComplete) return;
                onDelete(id);
              }}
              disabled={!canComplete}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              aria-label={canComplete ? "Completar" : "Bloqueado"}
              title={canComplete ? "Completar" : "Solo el asignado o el propietario pueden completar"}
              className="flex items-center justify-center w-12 h-12 shadow-brutal-hover disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: bgColor, color: inkColor, border: `3px solid ${inkColor}` }}
            >
              <Check className="w-6 h-6" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {(() => {
        const nextInitial = getNextRecurrenceLabel(recurrenceDays, recurrenceIntervalDays, recurrenceAnchorDate, recurrenceType);
        const hasDesc = !!(description && description.trim() !== "");
        const hasAnyMeta = hasDesc || !!nextInitial || !!reminderAt || isTemplate;
        if (!hasAnyMeta) return null;
        return (
          <div
            className="mt-4 pt-4 flex items-start justify-between gap-3"
            style={{ borderTop: `3px solid ${inkColor}` }}
          >
            {hasDesc ? (
              <div
                lang="es"
                className="font-mono-brutal text-sm hyphens-auto flex-1 min-w-0 whitespace-pre-wrap break-words"
              >
                {description}
              </div>

            ) : (
              <div className="flex-1 min-w-0" />
            )}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {isTemplate && (
                <div
                  aria-label="Plantilla de repetición"
                  title="Esta es la plantilla que genera las repeticiones"
                  className="font-mono-brutal text-[10px] uppercase h-8 px-2 flex items-center whitespace-nowrap"
                  style={{ backgroundColor: bgColor, color: inkColor, border: `3px dashed ${inkColor}` }}
                >
                  Plantilla
                </div>
              )}
              {reminderAt && (
                <div
                  aria-label={`Recordatorio: ${new Date(reminderAt).toLocaleString("es-ES")}`}
                  title={`Recordatorio: ${new Date(reminderAt).toLocaleString("es-ES")}`}
                  className="font-mono-brutal text-[10px] uppercase h-8 px-2 flex items-center gap-1 whitespace-nowrap"
                  style={{ border: `3px solid ${inkColor}`, color: inkColor }}
                >
                  <Bell className="w-3 h-3" strokeWidth={3} />
                  {new Date(reminderAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {nextInitial && (
                <div
                  aria-label="Próxima recurrencia"
                  title="Próxima recurrencia"
                  className="font-mono-brutal text-xs font-bold uppercase h-8 min-w-8 px-2 flex items-center justify-center whitespace-nowrap"
                  style={{ backgroundColor: inkColor, color: bgColor, border: `3px solid ${inkColor}` }}
                >
                  {nextInitial}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {checklistItems.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: `3px solid ${inkColor}` }}>
          <ChecklistView
            items={checklistItems}
            onToggle={onToggleChecklist ?? (() => undefined)}
            inkColor={inkColor}
            bgColor={bgColor}
          />
        </div>
      )}

      {fileItems.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: `3px solid ${inkColor}` }}>
          <TaskFilesView files={fileItems} inkColor={inkColor} bgColor={bgColor} />
        </div>
      )}

      {table && table.columns.length > 0 && table.rows.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: `3px solid ${inkColor}` }}>
          <TaskTableView table={table} inkColor={inkColor} bgColor={bgColor} />
        </div>
      )}

      {(() => {
        const visible = customFields.filter((cf) => {
          const v = customValues[cf.id];
          if (v === null || v === undefined || v === "") return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        });
        if (visible.length === 0) return null;
        return (
          <div
            className="mt-3 pt-3 space-y-2"
            style={{ borderTop: `3px solid ${inkColor}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {visible.map((cf) => {
              const v = customValues[cf.id];
              const Icon = cf.icon ? (LucideIcons as any)[cf.icon] : null;
              const labelEl = (
                <span className="font-mono-brutal text-[10px] uppercase opacity-70 flex items-center gap-1 shrink-0">
                  {Icon ? <Icon className="w-3 h-3" strokeWidth={3} /> : null}
                  {cf.name}
                </span>
              );
              let valueEl: JSX.Element;
              if (cf.field_type === "image" && isStoredImageValue(v)) {
                return (
                  <div key={cf.id} className="space-y-1">
                    <div className="mb-1">{labelEl}</div>
                    <TaskImagePreview value={v} alt={cf.name} inkColor={inkColor} />
                    {Array.isArray(cf.widgets) && cf.widgets.length > 0 && (
                    <FieldWidgets
                        widgets={cf.widgets}
                        value={v}
                        fieldType={cf.field_type}
                        fieldId={cf.id}
                        taskId={id}
                        taskName={name}
                        listId={listId ?? null}
                        bgColor={bgColor}
                        inkColor={inkColor}
                      />
                    )}
                  </div>
                );
              } else if (cf.field_type === "file" && isStoredFileValue(v)) {
                return (
                  <div key={cf.id} className="space-y-1">
                    <div className="mb-1">{labelEl}</div>
                    <TaskFileAttachment value={v} inkColor={inkColor} bgColor={bgColor} />
                  </div>
                );
              } else if (cf.field_type === "color" && typeof v === "string") {
                valueEl = (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-5 h-5" style={{ backgroundColor: v, border: `2px solid ${inkColor}` }} />
                    <span className="font-mono-brutal text-xs uppercase">{v}</span>
                  </span>
                );
              } else if (cf.field_type === "checkbox") {
                valueEl = <span className="font-mono-brutal text-xs uppercase">{v ? "✓" : "—"}</span>;
              } else if (cf.field_type === "checklist" && Array.isArray(v)) {
                // Detect grouped format vs legacy flat array
                const isGrouped = v.length > 0 && v.every((g: any) => g && typeof g === "object" && Array.isArray(g.items));
                const groups = isGrouped
                  ? (v as any[]).map((g, i) => ({ name: typeof g.name === "string" ? g.name : "", items: g.items as any[] }))
                  : [{ name: "", items: v as any[] }];
                const totalAll = groups.reduce((s, g) => s + g.items.length, 0);
                const doneAll = groups.reduce((s, g) => s + g.items.filter((it: any) => !!it?.done).length, 0);
                const allPending: Array<{ label: string; group: string; key: string }> = [];
                groups.forEach((g, gi) => {
                  g.items.forEach((it: any, i: number) => {
                    if (!it?.done) {
                      allPending.push({
                        label: it?.label || `Elemento ${i + 1}`,
                        group: g.name || (groups.length > 1 ? `Lista ${gi + 1}` : ""),
                        key: `${gi}-${it?.id ?? i}`,
                      });
                    }
                  });
                });
                const visible = allPending.slice(0, 4);
                const hiddenPending = allPending.length - visible.length;
                valueEl = (
                  <div className="space-y-2">
                    <span className="font-mono-brutal text-[10px] uppercase opacity-70">{doneAll}/{totalAll} completados{groups.length > 1 ? ` · ${groups.length} listas` : ""}</span>
                    <ul className="space-y-0.5">
                      {visible.map((it) => (
                        <li key={it.key} className="font-mono-brutal text-xs flex items-center gap-2">
                          <span aria-hidden="true">☐</span>
                          <span className="break-words">
                            {it.group && <span className="opacity-60 mr-1">[{it.group}]</span>}
                            {it.label}
                          </span>
                        </li>
                      ))}
                      {hiddenPending > 0 && (
                        <li className="font-mono-brutal text-[10px] uppercase opacity-60">+{hiddenPending} pendientes…</li>
                      )}
                      {allPending.length === 0 && totalAll > 0 && (
                        <li className="font-mono-brutal text-[10px] uppercase opacity-60">Todo completado ✓</li>
                      )}
                    </ul>
                  </div>
                );
              } else if (cf.field_type === "daterange") {
                const label = formatDateRange(v);
                const days = dateRangeDays(v);
                valueEl = label ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-brutal text-xs uppercase px-2 py-1" style={{ border: `2px solid ${inkColor}` }}>{label}</span>
                    {days !== null && (
                      <span className="font-mono-brutal text-[10px] uppercase opacity-70">{days} día{days === 1 ? "" : "s"}</span>
                    )}
                  </span>
                ) : (
                  <span className="font-mono-brutal text-xs opacity-60">—</span>
                );
              } else if (cf.field_type === "counter") {
                valueEl = (
                  <TaskCounterField
                    taskId={id}
                    listId={listId ?? null}
                    fieldId={cf.id}
                    value={v}
                    bgColor={bgColor}
                    inkColor={inkColor}
                  />
                );


              } else if (cf.field_type === "stars") {
                const n = Number(v) || 0;
                valueEl = <span className="font-mono-brutal text-sm">{"★".repeat(n)}{"☆".repeat(Math.max(0, 5 - n))}</span>;

              } else if (cf.field_type === "relation" && Array.isArray(v)) {
                const names = v.map((id: string) => relatedTaskNames[id] ?? "?").filter(Boolean);
                valueEl = (
                  <span className="flex flex-wrap gap-1">
                    {names.map((n, i) => (
                      <span key={i} className="font-mono-brutal text-[10px] uppercase px-2 py-1" style={{ border: `2px solid ${inkColor}` }}>{n}</span>
                    ))}
                  </span>
                );
              } else if (cf.field_type === "multiselect" && Array.isArray(v)) {
                valueEl = (
                  <span className="flex flex-wrap gap-1">
                    {v.map((o: string, i: number) => (
                      <span key={i} className="font-mono-brutal text-[10px] uppercase px-2 py-1" style={{ border: `2px solid ${inkColor}` }}>{o}</span>
                    ))}
                  </span>
                );
              } else if (cf.field_type === "url" && typeof v === "string") {
                const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
                valueEl = <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono-brutal text-xs underline break-all">{v}</a>;
              } else if (cf.field_type === "email" && typeof v === "string") {
                valueEl = <a href={`mailto:${v}`} className="font-mono-brutal text-xs underline break-all">{v}</a>;
              } else if (cf.field_type === "phone" && typeof v === "string") {
                valueEl = <a href={`tel:${v}`} className="font-mono-brutal text-xs underline">{v}</a>;
              } else if (cf.field_type === "currency") {
                valueEl = <span className="font-mono-brutal text-xs">{v} {cf.validation?.currency ?? ""}</span>;
              } else if (cf.field_type === "percentage") {
                valueEl = <span className="font-mono-brutal text-xs">{v}%</span>;
              } else if (typeof v === "object") {
                valueEl = <span className="font-mono-brutal text-xs opacity-60">—</span>;
              } else {
                valueEl = <span className="font-mono-brutal text-xs break-words">{String(v)}</span>;
              }
              return (
                <div key={cf.id} className="space-y-1">
                  <div className="flex items-start gap-3">
                    {labelEl}
                    <div className="flex-1 min-w-0">{valueEl}</div>
                  </div>
                  {Array.isArray(cf.widgets) && cf.widgets.length > 0 && (
                  <FieldWidgets
                      widgets={cf.widgets}
                      value={v}
                      fieldType={cf.field_type}
                      fieldId={cf.id}
                      taskId={id}
                      taskName={name}
                      listId={listId ?? null}
                      bgColor={bgColor}
                      inkColor={inkColor}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </li>
  );
};
