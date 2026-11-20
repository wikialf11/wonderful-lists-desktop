import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  evaluateGraph,
  initialInputs,
  type AutomationRequest,
  type GraphDefinition,
  type ValidationIssue,
} from "@/lib/nodeGraph";

type Props = {
  graph: GraphDefinition;
  value: Record<string, any> | null | undefined; // persisted: { inputs, value }
  fieldValues?: Record<string, any>;
  blueprints?: Record<string, GraphDefinition>;
  onChange: (next: { inputs: Record<string, any>; value: any }) => void;
  onValidation?: (errors: ValidationIssue[]) => void;
  onAutomations?: (a: AutomationRequest[]) => void;
};

export const NodeGraphFieldRenderer = ({
  graph, value, fieldValues = {}, blueprints = {}, onChange, onValidation, onAutomations,
}: Props) => {
  const [inputs, setInputs] = useState<Record<string, any>>(() => value?.['inputs'] ?? initialInputs(graph));

  const result = useMemo(() => evaluateGraph(graph, { inputs, fieldValues, blueprints }),
    [graph, inputs, fieldValues, blueprints]);

  useEffect(() => { onChange({ inputs, value: result.value }); }, [inputs, result.value]); // eslint-disable-line
  useEffect(() => { onValidation?.(result.errors); }, [result.errors]); // eslint-disable-line
  useEffect(() => { onAutomations?.(result.automations); }, [result.automations]); // eslint-disable-line

  const setInput = (id: string, v: any) => setInputs((s) => ({ ...s, [id]: v }));

  // Render every input.* node, in deterministic order (by node id for stability)
  const inputNodes = graph.nodes.filter((n) => n.kind.startsWith("input."));

  if (inputNodes.length === 0) {
    return <div className="text-xs opacity-60">Este campo no requiere entrada del usuario.</div>;
  }

  return (
    <div className="space-y-2">
      {inputNodes.map((n) => {
        const v = inputs[n.id];
        const cfg = n.config ?? {};
        const lbl = n.label || cfg['label'] || n.kind.replace("input.", "");
        if (n.kind === "input.text") {
          return (
            <div key={n.id}>
              <Label className="text-[10px]">{lbl}</Label>
              <Input className="h-8 text-sm" placeholder={cfg['placeholder']} value={v ?? ""} onChange={(e) => setInput(n.id, e.target.value)} />
            </div>
          );
        }
        if (n.kind === "input.number") {
          return (
            <div key={n.id}>
              <Label className="text-[10px]">{lbl}</Label>
              <Input type="number" className="h-8 text-sm" min={cfg['min'] ?? undefined} max={cfg['max'] ?? undefined} step={cfg['step'] ?? 1}
                value={v ?? ""} onChange={(e) => setInput(n.id, e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          );
        }
        if (n.kind === "input.checkbox") {
          return (
            <label key={n.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!v} onChange={(e) => setInput(n.id, e.target.checked)} />{lbl}
            </label>
          );
        }
        if (n.kind === "input.select") {
          const opts = (cfg['options'] ?? []) as string[];
          return (
            <div key={n.id}>
              <Label className="text-[10px]">{lbl}</Label>
              <Select value={v ?? ""} onValueChange={(x) => setInput(n.id, x)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          );
        }
        if (n.kind === "input.date") {
          return (
            <div key={n.id}>
              <Label className="text-[10px]">{lbl}</Label>
              <Input type="date" className="h-8 text-sm" value={v ?? ""} onChange={(e) => setInput(n.id, e.target.value)} />
            </div>
          );
        }
        if (n.kind === "input.checklist") {
          const items = (Array.isArray(v) ? v : (cfg['items'] ?? [])) as Array<{ id: string; label: string; done: boolean }>;
          const update = (next: typeof items) => setInput(n.id, next);
          const done = items.filter((i) => i.done).length;
          return (
            <div key={n.id}>
              <Label className="text-[10px]">{lbl} <span className="opacity-60">({done}/{items.length})</span></Label>
              <ul className="space-y-0.5 max-h-48 overflow-auto">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={it.done} onChange={(e) => update(items.map((x) => x.id === it.id ? { ...x, done: e.target.checked } : x))} />
                    <span className={it.done ? "line-through opacity-60" : ""}>{it.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })}

      {result.errors.length > 0 && (
        <div className="text-[11px] text-destructive space-y-0.5">
          {result.errors.map((e, i) => <div key={i}>⚠ {e.message}</div>)}
        </div>
      )}
    </div>
  );
};
