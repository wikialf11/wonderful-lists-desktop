import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NODE_REGISTRY } from "@/lib/nodeGraph/registry";
import type { GraphNode } from "@/lib/nodeGraph/types";

type Props = {
  node: GraphNode;
  otherFields: Array<{ id: string; name: string }>;
  installedBlueprints: Array<{ id: string; name: string }>;
  onChange: (updates: Partial<GraphNode>) => void;
  onDelete: () => void;
};

export const NodePropertiesPanel = ({ node, otherFields, installedBlueprints, onChange, onDelete }: Props) => {
  const desc = NODE_REGISTRY[node.kind];
  const cfg = node.config ?? {};
  const setCfg = (patch: Record<string, any>) => onChange({ config: { ...cfg, ...patch } });

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-1">
            <span>{desc?.icon}</span>{desc?.label}
          </div>
          <p className="opacity-60 text-[10px] mt-0.5">{desc?.description}</p>
        </div>
        <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={onDelete}>Eliminar</Button>
      </div>

      <div>
        <Label className="text-[10px]">Etiqueta visible</Label>
        <Input className="h-7 text-xs" value={node.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder={desc?.label} />
      </div>

      {node.kind === "input.text" && (
        <>
          <Label className="text-[10px]">Placeholder</Label>
          <Input className="h-7 text-xs" value={cfg['placeholder'] ?? ""} onChange={(e) => setCfg({ placeholder: e.target.value })} />
          <Label className="text-[10px]">Valor por defecto</Label>
          <Input className="h-7 text-xs" value={cfg['default'] ?? ""} onChange={(e) => setCfg({ default: e.target.value })} />
        </>
      )}

      {node.kind === "input.number" && (
        <div className="grid grid-cols-3 gap-1">
          <div><Label className="text-[10px]">Min</Label><Input type="number" className="h-7 text-xs" value={cfg['min'] ?? ""} onChange={(e) => setCfg({ min: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          <div><Label className="text-[10px]">Max</Label><Input type="number" className="h-7 text-xs" value={cfg['max'] ?? ""} onChange={(e) => setCfg({ max: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          <div><Label className="text-[10px]">Default</Label><Input type="number" className="h-7 text-xs" value={cfg['default'] ?? 0} onChange={(e) => setCfg({ default: Number(e.target.value) })} /></div>
        </div>
      )}

      {node.kind === "input.checkbox" && (
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!cfg['default']} onChange={(e) => setCfg({ default: e.target.checked })} />Marcado por defecto</label>
      )}

      {node.kind === "input.select" && (
        <>
          <Label className="text-[10px]">Opciones (una por línea)</Label>
          <Textarea
            className="text-xs"
            rows={4}
            value={(cfg['options'] ?? []).join("\n")}
            onChange={(e) => setCfg({ options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
          />
        </>
      )}

      {node.kind === "input.checklist" && (
        <ChecklistEditor cfg={cfg} setCfg={setCfg} />
      )}

      {node.kind === "source.field" && (
        <>
          <Label className="text-[10px]">Campo del ítem</Label>
          <Select value={cfg['fieldId'] ?? ""} onValueChange={(v) => setCfg({ fieldId: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecciona un campo" /></SelectTrigger>
            <SelectContent>
              {otherFields.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}

      {node.kind === "source.const" && (
        <>
          <Label className="text-[10px]">Valor constante</Label>
          <Input className="h-7 text-xs" value={cfg['value'] ?? ""} onChange={(e) => setCfg({ value: e.target.value })} />
        </>
      )}

      {node.kind === "logic.compare" && (
        <Select value={cfg['op'] ?? "eq"} onValueChange={(v) => setCfg({ op: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="eq">A = B</SelectItem>
            <SelectItem value="neq">A ≠ B</SelectItem>
            <SelectItem value="gt">A &gt; B</SelectItem>
            <SelectItem value="lt">A &lt; B</SelectItem>
            <SelectItem value="gte">A ≥ B</SelectItem>
            <SelectItem value="lte">A ≤ B</SelectItem>
          </SelectContent>
        </Select>
      )}

      {node.kind === "logic.math" && (
        <Select value={cfg['op'] ?? "add"} onValueChange={(v) => setCfg({ op: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="add">Sumar</SelectItem>
            <SelectItem value="sub">Restar</SelectItem>
            <SelectItem value="mul">Multiplicar</SelectItem>
            <SelectItem value="div">Dividir</SelectItem>
          </SelectContent>
        </Select>
      )}

      {node.kind === "logic.concat" && (
        <>
          <Label className="text-[10px]">Separador</Label>
          <Input className="h-7 text-xs" value={cfg['separator'] ?? " "} onChange={(e) => setCfg({ separator: e.target.value })} />
        </>
      )}

      {(node.kind === "validate.required" || node.kind === "validate.regex" || node.kind === "validate.range" || node.kind === "automation.notify") && (
        <>
          <Label className="text-[10px]">Mensaje</Label>
          <Input className="h-7 text-xs" value={cfg['message'] ?? ""} onChange={(e) => setCfg({ message: e.target.value })} />
        </>
      )}

      {node.kind === "validate.regex" && (
        <>
          <Label className="text-[10px]">Patrón (regex)</Label>
          <Input className="h-7 text-xs font-mono" value={cfg['pattern'] ?? ""} onChange={(e) => setCfg({ pattern: e.target.value })} />
        </>
      )}

      {node.kind === "validate.range" && (
        <div className="grid grid-cols-2 gap-1">
          <div><Label className="text-[10px]">Min</Label><Input type="number" className="h-7 text-xs" value={cfg['min'] ?? 0} onChange={(e) => setCfg({ min: Number(e.target.value) })} /></div>
          <div><Label className="text-[10px]">Max</Label><Input type="number" className="h-7 text-xs" value={cfg['max'] ?? 100} onChange={(e) => setCfg({ max: Number(e.target.value) })} /></div>
        </div>
      )}

      {node.kind === "automation.setField" && (
        <>
          <Label className="text-[10px]">Campo destino</Label>
          <Select value={cfg['fieldId'] ?? ""} onValueChange={(v) => setCfg({ fieldId: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecciona campo" /></SelectTrigger>
            <SelectContent>
              {otherFields.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}

      {node.kind === "subgraph" && (
        <>
          <Label className="text-[10px]">Blueprint instalado</Label>
          <Select
            value={node.blueprintId ?? cfg['blueprintId'] ?? ""}
            onValueChange={(v) => onChange({ blueprintId: v, config: { ...cfg, blueprintId: v } })}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecciona un blueprint" /></SelectTrigger>
            <SelectContent>
              {installedBlueprints.length === 0 && <div className="text-[10px] opacity-60 px-2 py-1">Instala blueprints desde la galería</div>}
              {installedBlueprints.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
};

const ChecklistEditor = ({ cfg, setCfg }: { cfg: any; setCfg: (p: any) => void }) => {
  const items = (cfg.items ?? []) as Array<{ id: string; label: string; done: boolean }>;
  const [bulk, setBulk] = useState("10");
  const newId = () => Math.random().toString(36).slice(2, 9);
  const update = (next: typeof items) => setCfg({ items: next });
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Input type="number" className="h-7 text-xs w-16" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
          const n = Math.min(500, Math.max(0, parseInt(bulk) || 0));
          const start = items.length + 1;
          update([...items, ...Array.from({ length: n }, (_, i) => ({ id: newId(), label: `Elemento ${start + i}`, done: false }))]);
        }}>Generar N</Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => update([])}>Vaciar</Button>
      </div>
      <div className="max-h-40 overflow-auto space-y-1">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-1">
            <Input className="h-6 text-[11px]" value={it.label} onChange={(e) => update(items.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x))} />
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => update(items.filter((x) => x.id !== it.id))}>×</Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="h-7 text-[10px] w-full" onClick={() => update([...items, { id: newId(), label: `Elemento ${items.length + 1}`, done: false }])}>+ Añadir</Button>
    </div>
  );
};
