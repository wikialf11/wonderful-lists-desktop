// Deterministic node-graph engine for custom fields.
// A graph defines (a) the UI of a field, (b) its computations, (c) its
// validations and (d) automations on change. Pure functions only — no
// network or randomness so the same inputs always produce the same outputs.

export type NodeId = string;
export type SocketId = string;

export type DataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "any"
  | "list"
  | "object";

export type NodeKind =
  // INPUT (UI) — exposed to the user when filling the field
  | "input.text"
  | "input.number"
  | "input.checkbox"
  | "input.select"
  | "input.date"
  | "input.checklist"
  // SOURCE — read other field values from the same task
  | "source.field"
  | "source.const"
  // LOGIC
  | "logic.if"
  | "logic.compare"
  | "logic.math"
  | "logic.concat"
  // VALIDATION
  | "validate.required"
  | "validate.regex"
  | "validate.range"
  // AUTOMATION (side-effects requested at save time)
  | "automation.notify"
  | "automation.markComplete"
  | "automation.setField"
  // OUTPUT — what gets persisted as the field's value
  | "output.value"
  // SUBGRAPH — an imported community blueprint used as a black box
  | "subgraph";

export type NodeSocket = {
  id: SocketId;
  label: string;
  type: DataType;
};

export type GraphNode = {
  id: NodeId;
  kind: NodeKind;
  label?: string;
  position: { x: number; y: number };
  // arbitrary configuration (constant value, regex pattern, options…)
  config: Record<string, any>;
  // for subgraph nodes only
  blueprintId?: string;
};

export type GraphEdge = {
  id: string;
  source: NodeId;
  sourceHandle: SocketId;
  target: NodeId;
  targetHandle: SocketId;
};

export type GraphDefinition = {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const emptyGraph = (): GraphDefinition => ({
  version: 1,
  nodes: [],
  edges: [],
});

// Runtime
export type RuntimeContext = {
  // values of OTHER custom fields on the same task, keyed by field id
  fieldValues: Record<string, any>;
  // user-entered values for input.* nodes, keyed by node id
  inputs: Record<NodeId, any>;
  // installed blueprints available for subgraph nodes
  blueprints?: Record<string, GraphDefinition>;
};

export type ValidationIssue = { nodeId: NodeId; message: string };
export type AutomationRequest =
  | { kind: "notify"; message: string }
  | { kind: "markComplete" }
  | { kind: "setField"; fieldId: string; value: any };

export type EvaluationResult = {
  // value produced by the (first) output.value node — what we persist
  value: any;
  // computed value for every node (for previews / debugging)
  nodeValues: Record<NodeId, any>;
  errors: ValidationIssue[];
  automations: AutomationRequest[];
};
