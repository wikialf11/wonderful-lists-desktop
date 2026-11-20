import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/local/client";
import { toast } from "sonner";
import { getTimeRemaining } from "@/lib/timeRemaining";
import { Check } from "lucide-react";
import type { List } from "@/hooks/useLists";

type CalTask = {
  id: string;
  name: string;
  description: string | null;
  due_date: string;
  list_id: string;
  // When true, this entry is a virtual occurrence generated from a
  // weekly-recurring task that has no specific date. It cannot be
  // completed individually (we'd need a real instance row), so the UI
  // hides the complete button for these.
  virtual?: boolean;
  // The real DB id of the source task (for virtual occurrences).
  source_id?: string;
};

type RawTask = {
  id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  list_id: string;
  recurrence_days: number[] | null;
  recurrence_interval_days?: number | null;
  recurrence_parent_id?: string | null;
};

// How many days ahead we project weekly recurrences without a specific date.
const RECURRENCE_HORIZON_DAYS = 60;

type Props = {
  lists: List[];
  bgColor: string;
  inkColor: string;
};

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const formatTime = (d: Date) => {
  const hh = d.getHours();
  const mm = d.getMinutes();
  if (hh === 23 && mm === 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const CalendarView = ({ lists, bgColor, inkColor }: Props) => {
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [loading, setLoading] = useState(true);

  const listIds = lists.map((l) => l.id);
  const listMap = new Map(lists.map((l) => [l.id, l]));

  const load = useCallback(async () => {
    if (listIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, name, description, due_date, list_id, recurrence_days, recurrence_interval_days, recurrence_parent_id")
      .in("list_id", listIds)
      .is("completed_at", null);
    setLoading(false);
    if (error) {
      toast.error("Error al cargar el calendario");
      return;
    }

    // Fetch completed recurring instances to hide virtual occurrences
    // whose template already has a completed instance for that day.
    const { data: doneData } = await supabase
      .from("tasks")
      .select("recurrence_parent_id, completed_at, due_date")
      .in("list_id", listIds)
      .not("completed_at", "is", null)
      .not("recurrence_parent_id", "is", null);
    const completedKeys = new Set<string>();
    for (const r of (doneData ?? []) as Array<{ recurrence_parent_id: string; completed_at: string; due_date: string | null }>) {
      const ref = r.due_date ? new Date(r.due_date) : new Date(r.completed_at);
      completedKeys.add(`${r.recurrence_parent_id}::${dayKey(ref)}`);
    }

    const raw = (data ?? []) as RawTask[];
    const result: CalTask[] = [];

    // Real dated tasks (exclude 1970 anchor templates used for recurrences).
    for (const t of raw) {
      const isTemplate = !t.recurrence_parent_id &&
        ((t.recurrence_days?.length ?? 0) > 0 || (t.recurrence_interval_days ?? 0) > 0);
      if (isTemplate) continue;
      if (!t.due_date) continue;
      const d = new Date(t.due_date);
      if (d.getUTCFullYear() === 1970) continue;
      result.push({
        id: t.id,
        name: t.name,
        description: t.description,
        due_date: t.due_date,
        list_id: t.list_id,
      });
    }

    // Weekly-recurring tasks WITHOUT a specific date → expand as virtual
    // occurrences for the next RECURRENCE_HORIZON_DAYS days, on the
    // weekdays they recur (recurrence_days uses 0=Sunday … 6=Saturday).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const t of raw) {
      const days = t.recurrence_days ?? [];
      if (days.length === 0) continue;
      // Skip if it already has a real future-dated occurrence (non-anchor).
      const hasRealDate = t.due_date && new Date(t.due_date).getUTCFullYear() !== 1970;
      if (hasRealDate) continue;

      const set = new Set(days.map((n) => Number(n)));
      for (let i = 0; i < RECURRENCE_HORIZON_DAYS; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (!set.has(d.getDay())) continue;
        // Use 23:59 local so it sorts last and shows no time badge.
        d.setHours(23, 59, 0, 0);
        const occKey = `${t.id}::${dayKey(d)}`;
        if (completedKeys.has(occKey)) continue;
        result.push({
          id: occKey,
          source_id: t.id,
          name: t.name,
          description: t.description,
          due_date: d.toISOString(),
          list_id: t.list_id,
          virtual: true,
        });
      }
    }

    result.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    setTasks(result);
  }, [listIds.join(",")]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh when any task in any visible list changes
  useEffect(() => {
    if (listIds.length === 0) return;
    const channel = supabase
      .channel(`calendar-${listIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listIds.join(",")]);

  const handleComplete = async (id: string) => {
    const task = tasks.find((x) => x.id === id);
    if (!task) return;

    // Virtual recurring occurrence: create a real completed instance for that day.
    if (task.virtual && task.source_id) {
      const { data: tpl, error: tplErr } = await supabase
        .from("tasks")
        .select("user_id, list_id, name, description")
        .eq("id", task.source_id)
        .maybeSingle();
      if (tplErr || !tpl) {
        toast.error("No se pudo completar");
        return;
      }
      const now = new Date().toISOString();
      const { error: insErr } = await supabase.from("tasks").insert({
        user_id: tpl.user_id,
        list_id: tpl.list_id,
        name: tpl.name,
        description: tpl.description,
        due_date: task.due_date,
        completed_at: now,
        recurrence_parent_id: task.source_id,
        recurrence_days: [],
        recurrence_interval_days: 0,
      });
      if (insErr) {
        toast.error("No se pudo completar");
        return;
      }
      setTasks((t) => t.filter((x) => x.id !== id));
      return;
    }

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

  // Group tasks by day
  const groups = new Map<string, { date: Date; items: CalTask[] }>();
  for (const t of tasks) {
    const d = new Date(t.due_date);
    const key = dayKey(d);
    if (!groups.has(key)) {
      groups.set(key, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] });
    }
    groups.get(key)!.items.push(t);
  }

  // Build a continuous timeline from today (or earliest overdue day) to last task day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let firstDay = today;
  let lastDay = today;
  if (groups.size > 0) {
    const dates = Array.from(groups.values()).map((g) => g.date);
    const minTask = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxTask = new Date(Math.max(...dates.map((d) => d.getTime())));
    firstDay = minTask < today ? minTask : today;
    lastDay = maxTask > today ? maxTask : today;
  }

  const timeline: { date: Date; items: CalTask[] }[] = [];
  const cursor = new Date(firstDay);
  while (cursor <= lastDay) {
    const key = dayKey(cursor);
    timeline.push({
      date: new Date(cursor),
      items: groups.get(key)?.items ?? [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (loading) {
    return (
      <div className="p-10 text-center" style={{ border: `4px dashed ${inkColor}` }}>
        <p className="font-mono-brutal uppercase text-sm">Cargando calendario…</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-10 text-center" style={{ border: `4px dashed ${inkColor}` }}>
        <p className="font-mono-brutal uppercase text-sm">Sin tareas con fecha en ninguna lista.</p>
      </div>
    );
  }

  return (
    <section aria-label="Agenda calendario">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="display-font text-2xl uppercase">Agenda</h2>
        <span className="font-mono-brutal text-xs uppercase">[{tasks.length}]</span>
      </div>

      <ol className="relative">
        {timeline.map(({ date, items }) => {
          const isToday = date.getTime() === today.getTime();
          const isPast = date.getTime() < today.getTime();
          const dayLabel = WEEKDAYS[date.getDay()];
          const dayNum = date.getDate();
          const monthLabel = MONTHS[date.getMonth()];
          const yearLabel = date.getFullYear();

          return (
            <li key={dayKey(date)} className="flex gap-4 md:gap-6 mb-6">
              {/* Timeline rail with date marker */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="w-16 md:w-20 py-2 text-center font-mono-brutal"
                  style={{
                    backgroundColor: isToday ? inkColor : bgColor,
                    color: isToday ? bgColor : inkColor,
                    border: `3px solid ${inkColor}`,
                    opacity: isPast && !isToday ? 0.5 : 1,
                  }}
                >
                  <div className="text-[10px] uppercase tracking-widest">{dayLabel}</div>
                  <div className="display-font text-2xl md:text-3xl leading-none my-1">{dayNum}</div>
                  <div className="text-[10px] uppercase">{monthLabel}</div>
                  {isToday && <div className="text-[9px] uppercase mt-1">HOY</div>}
                </div>
                <div
                  className="flex-1 w-1 mt-2 min-h-[20px]"
                  style={{ backgroundColor: inkColor, opacity: isPast ? 0.3 : 1 }}
                />
              </div>

              {/* Day content */}
              <div className="flex-1 min-w-0 pt-1">
                {items.length === 0 ? (
                  <div
                    className="font-mono-brutal text-xs uppercase opacity-40 py-3"
                    style={{ borderBottom: `2px dashed ${inkColor}` }}
                  >
                    — sin tareas —
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {items.map((t) => {
                      const list = listMap.get(t.list_id);
                      const listBg = list?.bg_color ?? bgColor;
                      const listInk = list?.ink_color ?? inkColor;
                      const due = new Date(t.due_date);
                      const time = formatTime(due);
                      const remain = getTimeRemaining(t.due_date);
                      return (
                        <div
                          key={t.id}
                          className="p-4 shadow-brutal-sm shadow-brutal-hover"
                          style={{
                            backgroundColor: listBg,
                            color: listInk,
                            border: `3px solid ${listInk}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {time && (
                                  <span
                                    className="font-mono-brutal text-xs font-bold px-2 py-0.5"
                                    style={{
                                      backgroundColor: listInk,
                                      color: listBg,
                                    }}
                                  >
                                    {time}
                                  </span>
                                )}
                                <span className="font-mono-brutal text-[10px] uppercase tracking-widest opacity-70 truncate">
                                  {list?.name ?? "—"}
                                </span>
                                {t.virtual && (
                                  <span
                                    className="font-mono-brutal text-[10px] font-bold px-1.5 py-0.5"
                                    style={{
                                      backgroundColor: listInk,
                                      color: listBg,
                                    }}
                                  >
                                    SEMANAL
                                  </span>
                                )}
                                {remain.overdue && !t.virtual && (
                                  <span
                                    className="font-mono-brutal text-[10px] font-bold px-1.5 py-0.5"
                                    style={{
                                      backgroundColor: "hsl(var(--danger))",
                                      color: listBg,
                                    }}
                                  >
                                    VENCIDA
                                  </span>
                                )}
                              </div>
                              <h3
                                lang="es"
                                className="display-font text-xl md:text-2xl uppercase break-words hyphens-auto leading-tight"
                              >
                                {t.name}
                              </h3>
                              {t.description && t.description.trim() && (
                                <p className="font-mono-brutal text-xs mt-2 opacity-80 break-words hyphens-auto line-clamp-2">
                                  {t.description}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleComplete(t.id)}
                              aria-label="Completar"
                              className="flex items-center justify-center w-10 h-10 shrink-0 shadow-brutal-hover"
                              style={{
                                backgroundColor: listBg,
                                color: listInk,
                                border: `3px solid ${listInk}`,
                              }}
                            >
                              <Check className="w-5 h-5" strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
