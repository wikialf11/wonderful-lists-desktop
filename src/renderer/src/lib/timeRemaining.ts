export type RemainingInfo = {
  text: string;
  overdue: boolean;
};

export function getTimeRemaining(dueDate: Date | string, now: Date = new Date()): RemainingInfo {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;

  // Normalize both dates to start of day for day-only comparison
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = dueDay.getTime() - today.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: "VENCIDA", overdue: true };
  if (days === 0) return { text: "HOY", overdue: false };
  if (days === 1) return { text: "1 DÍA", overdue: false };
  return { text: `${days} DÍAS`, overdue: false };
}
