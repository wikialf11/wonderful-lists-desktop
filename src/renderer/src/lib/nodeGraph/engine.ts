import type {
  AutomationRequest,
  EvaluationResult,
  GraphDefinition,
  GraphNode,
  NodeId,
  RuntimeContext,
  ValidationIssue,
} from "./types";

const isEmpty = (v: any) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const toNumber = (v: any): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const toBool = (v: any): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["true", "1", "yes", "sí", "si"].includes(v.toLowerCase());
  return !!v;
};

// Topological sort. Returns null on cycle.
const topoSort = (graph: GraphDefinition): NodeId[] | null => {
  const indeg = new Map<NodeId, number>();
  const adj = new Map<NodeId, NodeId[]>();
  graph.nodes.forEach((n) => { indeg.set(n.id, 0); adj.set(n.id, []); });
  graph.edges.forEach((e) => {
    if (!indeg.has(e.target) || !indeg.has(e.source)) return;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    adj.get(e.source)!.push(e.target);
  });
  const queue: NodeId[] = [];
  indeg.forEach((d, id) => { if (d === 0) queue.push(id); });
  const order: NodeId[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  return order.length === graph.nodes.length ? order : null;
};

const incomingValue = (
  graph: GraphDefinition,
  nodeId: NodeId,
  socketId: string,
  values: Record<NodeId, any>,
): any => {
  const edge = graph.edges.find((e) => e.target === nodeId && e.targetHandle === socketId);
  if (!edge) return undefined;
  const sourceVals = values[edge.source];
  if (sourceVals && typeof sourceVals === "object" && edge.sourceHandle in sourceVals) {
    return sourceVals[edge.sourceHandle];
  }
  // single-output convenience
  return sourceVals;
};

const evaluateNode = (
  node: GraphNode,
  graph: GraphDefinition,
  values: Record<NodeId, any>,
  ctx: RuntimeContext,
  errors: ValidationIssue[],
  automations: AutomationRequest[],
): any => {
  const cfg = node.config ?? {};
  const get = (sock: string) => incomingValue(graph, node.id, sock, values);

  switch (node.kind) {
    case "input.text":
      return { out: ctx.inputs[node.id] ?? cfg['default'] ?? "" };
    case "input.number":
      return { out: toNumber(ctx.inputs[node.id] ?? cfg['default'] ?? 0) };
    case "input.checkbox":
      return { out: toBool(ctx.inputs[node.id] ?? cfg['default'] ?? false) };
    case "input.select":
      return { out: ctx.inputs[node.id] ?? cfg['default'] ?? "" };
    case "input.date":
      return { out: ctx.inputs[node.id] ?? cfg['default'] ?? "" };
    case "input.checklist": {
      const items = (ctx.inputs[node.id] ?? cfg['items'] ?? []) as Array<{ done: boolean }>;
      const done = items.filter((i) => i?.done).length;
      return { out: items, done, total: items.length };
    }

    case "source.field":
      return { out: ctx.fieldValues[cfg['fieldId']] };
    case "source.const":
      return { out: cfg['value'] };

    case "logic.if":
      return { out: toBool(get("cond")) ? get("a") : get("b") };

    case "logic.compare": {
      const a = get("a"); const b = get("b");
      const op = cfg['op'] ?? "eq";
      let res = false;
      switch (op) {
        case "eq": res = a === b || String(a) === String(b); break;
        case "neq": res = String(a) !== String(b); break;
        case "gt": res = toNumber(a) > toNumber(b); break;
        case "lt": res = toNumber(a) < toNumber(b); break;
        case "gte": res = toNumber(a) >= toNumber(b); break;
        case "lte": res = toNumber(a) <= toNumber(b); break;
      }
      return { out: res };
    }

    case "logic.math": {
      const a = toNumber(get("a")); const b = toNumber(get("b"));
      const op = cfg['op'] ?? "add";
      let r = 0;
      switch (op) {
        case "add": r = a + b; break;
        case "sub": r = a - b; break;
        case "mul": r = a * b; break;
        case "div": r = b === 0 ? 0 : a / b; break;
      }
      return { out: r };
    }

    case "logic.concat": {
      const sep = cfg['separator'] ?? " ";
      const parts = ["a", "b", "c"].map(get).filter((v) => v !== undefined && v !== null && v !== "");
      return { out: parts.join(sep) };
    }

    case "validate.required": {
      const v = get("in");
      const ok = !isEmpty(v);
      if (!ok) errors.push({ nodeId: node.id, message: cfg['message'] ?? "Requerido" });
      return { ok };
    }

    case "validate.regex": {
      const v = String(get("in") ?? "");
      let ok = true;
      try { ok = new RegExp(cfg['pattern'] ?? ".*").test(v); }
      catch { ok = false; }
      if (!ok) errors.push({ nodeId: node.id, message: cfg['message'] ?? "Formato inválido" });
      return { ok };
    }

    case "validate.range": {
      const n = toNumber(get("in"));
      const min = cfg['min'] ?? -Infinity;
      const max = cfg['max'] ?? Infinity;
      const ok = n >= min && n <= max;
      if (!ok) errors.push({ nodeId: node.id, message: cfg['message'] ?? "Fuera de rango" });
      return { ok };
    }

    case "automation.notify":
      if (toBool(get("trigger"))) automations.push({ kind: "notify", message: cfg['message'] ?? "" });
      return {};
    case "automation.markComplete":
      if (toBool(get("trigger"))) automations.push({ kind: "markComplete" });
      return {};
    case "automation.setField":
      if (toBool(get("trigger")) && cfg['fieldId']) {
        automations.push({ kind: "setField", fieldId: cfg['fieldId'], value: get("value") });
      }
      return {};

    case "output.value":
      return { in: get("in") };

    case "subgraph": {
      const blueprint = ctx.blueprints?.[node.blueprintId ?? cfg['blueprintId']];
      if (!blueprint) return { out: undefined };
      // Run the sub-graph with its own input mapped from the outer "in" socket
      const subInput = get("in");
      const subCtx: RuntimeContext = {
        fieldValues: ctx.fieldValues,
        inputs: { __sub_input__: subInput },
        ...(ctx.blueprints ? { blueprints: ctx.blueprints } : {}),
      };
      const result = evaluateGraph(blueprint, subCtx);
      // Surface sub-validation errors with the parent node id
      result.errors.forEach((e) => errors.push({ nodeId: node.id, message: e.message }));
      result.automations.forEach((a) => automations.push(a));
      return { out: result.value };
    }
  }
};

export const evaluateGraph = (
  graph: GraphDefinition,
  ctx: RuntimeContext,
): EvaluationResult => {
  const values: Record<NodeId, any> = {};
  const errors: ValidationIssue[] = [];
  const automations: AutomationRequest[] = [];

  const order = topoSort(graph);
  if (!order) {
    return {
      value: undefined,
      nodeValues: {},
      errors: [{ nodeId: "__graph__", message: "El grafo contiene un ciclo" }],
      automations: [],
    };
  }

  for (const id of order) {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) continue;
    values[id] = evaluateNode(node, graph, values, ctx, errors, automations);
  }

  const outputNode = graph.nodes.find((n) => n.kind === "output.value");
  const value = outputNode ? values[outputNode.id]?.in : undefined;

  return { value, nodeValues: values, errors, automations };
};

// Initial input values derived from node defaults — used when first
// rendering a graph-based field.
export const initialInputs = (graph: GraphDefinition): Record<NodeId, any> => {
  const out: Record<NodeId, any> = {};
  for (const n of graph.nodes) {
    const cfg = n.config ?? {};
    if (n.kind.startsWith("input.")) {
      out[n.id] = n.kind === "input.checklist" ? (cfg['items'] ?? []) : (cfg['default'] ?? "");
    }
  }
  return out;
};
