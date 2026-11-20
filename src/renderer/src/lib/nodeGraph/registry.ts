import type { DataType, NodeKind, NodeSocket } from "./types";

export type NodeDescriptor = {
  kind: NodeKind;
  label: string;
  category: "input" | "source" | "logic" | "validate" | "automation" | "output" | "subgraph";
  icon: string;
  description: string;
  inputs: NodeSocket[];
  outputs: NodeSocket[];
  defaultConfig?: Record<string, any>;
};

const s = (id: string, label: string, type: DataType): NodeSocket => ({ id, label, type });

export const NODE_REGISTRY: Record<NodeKind, NodeDescriptor> = {
  // ---------- INPUT ----------
  "input.text": {
    kind: "input.text", label: "Texto", category: "input", icon: "✍️",
    description: "Pide al usuario un texto.",
    inputs: [], outputs: [s("out", "Valor", "string")],
    defaultConfig: { placeholder: "", default: "" },
  },
  "input.number": {
    kind: "input.number", label: "Número", category: "input", icon: "🔢",
    description: "Pide un número.",
    inputs: [], outputs: [s("out", "Valor", "number")],
    defaultConfig: { min: null, max: null, step: 1, default: 0 },
  },
  "input.checkbox": {
    kind: "input.checkbox", label: "Casilla", category: "input", icon: "☑️",
    description: "Verdadero o falso.",
    inputs: [], outputs: [s("out", "Valor", "boolean")],
    defaultConfig: { default: false },
  },
  "input.select": {
    kind: "input.select", label: "Selector", category: "input", icon: "📋",
    description: "Lista de opciones.",
    inputs: [], outputs: [s("out", "Valor", "string")],
    defaultConfig: { options: ["Opción 1", "Opción 2"], default: "" },
  },
  "input.date": {
    kind: "input.date", label: "Fecha", category: "input", icon: "📅",
    description: "Selector de fecha.",
    inputs: [], outputs: [s("out", "Valor", "date")],
    defaultConfig: { default: "" },
  },
  "input.checklist": {
    kind: "input.checklist", label: "Checklist", category: "input", icon: "📝",
    description: "Lista de casillas marcables.",
    inputs: [], outputs: [s("out", "Lista", "list"), s("done", "Completados", "number"), s("total", "Total", "number")],
    defaultConfig: { items: [] as Array<{ id: string; label: string; done: boolean }> },
  },
  // ---------- SOURCE ----------
  "source.field": {
    kind: "source.field", label: "Otro campo", category: "source", icon: "🔗",
    description: "Lee el valor de otro campo del mismo ítem.",
    inputs: [], outputs: [s("out", "Valor", "any")],
    defaultConfig: { fieldId: "" },
  },
  "source.const": {
    kind: "source.const", label: "Constante", category: "source", icon: "🔒",
    description: "Valor fijo.",
    inputs: [], outputs: [s("out", "Valor", "any")],
    defaultConfig: { value: "" },
  },
  // ---------- LOGIC ----------
  "logic.if": {
    kind: "logic.if", label: "Si / Entonces", category: "logic", icon: "🔀",
    description: "Si la condición es verdadera devuelve A, si no B.",
    inputs: [s("cond", "Condición", "boolean"), s("a", "Entonces", "any"), s("b", "Si no", "any")],
    outputs: [s("out", "Resultado", "any")],
  },
  "logic.compare": {
    kind: "logic.compare", label: "Comparar", category: "logic", icon: "⚖️",
    description: "Compara dos valores.",
    inputs: [s("a", "A", "any"), s("b", "B", "any")],
    outputs: [s("out", "Resultado", "boolean")],
    defaultConfig: { op: "eq" }, // eq | neq | gt | lt | gte | lte
  },
  "logic.math": {
    kind: "logic.math", label: "Operación", category: "logic", icon: "➕",
    description: "Suma, resta, multiplica o divide.",
    inputs: [s("a", "A", "number"), s("b", "B", "number")],
    outputs: [s("out", "Resultado", "number")],
    defaultConfig: { op: "add" }, // add | sub | mul | div
  },
  "logic.concat": {
    kind: "logic.concat", label: "Unir texto", category: "logic", icon: "🔤",
    description: "Concatena varios textos.",
    inputs: [s("a", "A", "any"), s("b", "B", "any"), s("c", "C", "any")],
    outputs: [s("out", "Texto", "string")],
    defaultConfig: { separator: " " },
  },
  // ---------- VALIDATE ----------
  "validate.required": {
    kind: "validate.required", label: "Requerido", category: "validate", icon: "❗",
    description: "Falla si el valor está vacío.",
    inputs: [s("in", "Valor", "any")],
    outputs: [s("ok", "OK", "boolean")],
    defaultConfig: { message: "Este campo es obligatorio" },
  },
  "validate.regex": {
    kind: "validate.regex", label: "Patrón", category: "validate", icon: "🔍",
    description: "Valida con una expresión regular.",
    inputs: [s("in", "Texto", "string")],
    outputs: [s("ok", "OK", "boolean")],
    defaultConfig: { pattern: ".*", message: "Formato inválido" },
  },
  "validate.range": {
    kind: "validate.range", label: "Rango numérico", category: "validate", icon: "📏",
    description: "Comprueba que un número está en rango.",
    inputs: [s("in", "Número", "number")],
    outputs: [s("ok", "OK", "boolean")],
    defaultConfig: { min: 0, max: 100, message: "Fuera de rango" },
  },
  // ---------- AUTOMATION ----------
  "automation.notify": {
    kind: "automation.notify", label: "Notificar", category: "automation", icon: "🔔",
    description: "Muestra un aviso al guardar si la condición es verdadera.",
    inputs: [s("trigger", "Disparador", "boolean")],
    outputs: [],
    defaultConfig: { message: "Aviso" },
  },
  "automation.markComplete": {
    kind: "automation.markComplete", label: "Completar tarea", category: "automation", icon: "✅",
    description: "Marca el ítem como completado si el disparador es verdadero.",
    inputs: [s("trigger", "Disparador", "boolean")],
    outputs: [],
  },
  "automation.setField": {
    kind: "automation.setField", label: "Asignar a otro campo", category: "automation", icon: "✏️",
    description: "Escribe un valor en otro campo del mismo ítem.",
    inputs: [s("trigger", "Disparador", "boolean"), s("value", "Valor", "any")],
    outputs: [],
    defaultConfig: { fieldId: "" },
  },
  // ---------- OUTPUT ----------
  "output.value": {
    kind: "output.value", label: "Valor del campo", category: "output", icon: "🎯",
    description: "Lo que se guarda como valor del campo.",
    inputs: [s("in", "Valor", "any")],
    outputs: [],
  },
  // ---------- SUBGRAPH ----------
  "subgraph": {
    kind: "subgraph", label: "Subgrafo", category: "subgraph", icon: "📦",
    description: "Reutiliza un blueprint instalado como una caja negra.",
    inputs: [s("in", "Entrada", "any")],
    outputs: [s("out", "Salida", "any")],
    defaultConfig: { blueprintId: "" },
  },
};

export const NODE_KINDS = Object.keys(NODE_REGISTRY) as NodeKind[];
