import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NODE_REGISTRY, NODE_KINDS } from "@/lib/nodeGraph/registry";
import {
  emptyGraph,
  evaluateGraph,
  initialInputs,
  type GraphDefinition,
  type GraphNode,
  type NodeKind,
} from "@/lib/nodeGraph";
import GraphNodeCard from "./GraphNodeCard";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import { Badge } from "@/components/ui/badge";

const nodeTypes = { card: GraphNodeCard } as const;

type Props = {
  value: GraphDefinition | null | undefined;
  onChange: (graph: GraphDefinition) => void;
  otherFields: Array<{ id: string; name: string }>;
  installedBlueprints: Array<{ id: string; name: string; graph: GraphDefinition }>;
};

const newId = () => Math.random().toString(36).slice(2, 10);

const toRfNodes = (graph: GraphDefinition): Node[] =>
  graph.nodes.map((n) => ({
    id: n.id,
    type: "card",
    position: n.position,
    data: { kind: n.kind, label: n.label },
  }));

const toRfEdges = (graph: GraphDefinition): Edge[] =>
  graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
    style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
  }));

const NodeGraphEditorInner = ({ value, onChange, otherFields, installedBlueprints }: Props) => {
  const [graph, setGraph] = useState<GraphDefinition>(value ?? emptyGraph());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { onChange(graph); }, [graph]);  // eslint-disable-line

  const rfNodes = useMemo(() => toRfNodes(graph), [graph]);
  const rfEdges = useMemo(() => toRfEdges(graph), [graph]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setGraph((g) => {
      const updated = applyNodeChanges(changes, toRfNodes(g));
      const removed = changes.filter((c) => c.type === "remove").map((c: any) => c.id);
      return {
        ...g,
        nodes: g.nodes
          .filter((n) => !removed.includes(n.id))
          .map((n) => {
            const u = updated.find((x) => x.id === n.id);
            return u ? { ...n, position: u.position } : n;
          }),
        edges: g.edges.filter((e) => !removed.includes(e.source) && !removed.includes(e.target)),
      };
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setGraph((g) => {
      const removed = changes.filter((c) => c.type === "remove").map((c: any) => c.id);
      return { ...g, edges: g.edges.filter((e) => !removed.includes(e.id)) };
    });
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return;
    setGraph((g) => {
      // Replace any existing connection on the same target socket (single-input convention)
      const filtered = g.edges.filter((e) => !(e.target === conn.target && e.targetHandle === conn.targetHandle));
      return {
        ...g,
        edges: [
          ...filtered,
          {
            id: newId(),
            source: conn.source!,
            sourceHandle: conn.sourceHandle!,
            target: conn.target!,
            targetHandle: conn.targetHandle!,
          },
        ],
      };
    });
  }, []);

  const addNode = useCallback((kind: NodeKind) => {
    const desc = NODE_REGISTRY[kind];
    const node: GraphNode = {
      id: newId(),
      kind,
      position: { x: 120 + Math.random() * 200, y: 80 + Math.random() * 200 },
      config: { ...(desc.defaultConfig ?? {}) },
    };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<GraphNode>) => {
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...updates, config: { ...n.config, ...(updates.config ?? {}) } } : n)) }));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    setSelectedId(null);
  }, []);

  // Live preview
  const preview = useMemo(() => {
    const blueprints: Record<string, GraphDefinition> = {};
    installedBlueprints.forEach((b) => { blueprints[b.id] = b.graph; });
    return evaluateGraph(graph, { fieldValues: {}, inputs: initialInputs(graph), blueprints });
  }, [graph, installedBlueprints]);

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;

  const grouped = useMemo(() => {
    const out: Record<string, NodeKind[]> = {};
    NODE_KINDS.forEach((k) => {
      const cat = NODE_REGISTRY[k].category;
      out[cat] = out[cat] ?? [];
      out[cat].push(k);
    });
    return out;
  }, []);

  const CAT_LABELS: Record<string, string> = {
    input: "Entradas (UI)", source: "Fuentes", logic: "Lógica",
    validate: "Validación", automation: "Automatización", output: "Salida", subgraph: "Subgrafos",
  };

  return (
    <div className="grid grid-cols-12 gap-2 h-[min(600px,65vh)]">
      {/* Palette */}
      <ScrollArea className="col-span-2 border rounded-md p-2">
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, kinds]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase opacity-60 mb-1">{CAT_LABELS[cat] ?? cat}</div>
              <div className="space-y-1">
                {kinds.map((k) => {
                  const d = NODE_REGISTRY[k];
                  return (
                    <button
                      key={k}
                      onClick={() => addNode(k)}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent flex items-center gap-1"
                    >
                      <span>{d.icon}</span><span className="truncate">{d.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Canvas */}
      <div className="col-span-7 border rounded-md overflow-hidden relative">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {/* Right panel: properties + preview */}
      <div className="col-span-3 space-y-2">
        <ScrollArea className="border rounded-md p-2 h-[300px]">
          {selectedNode ? (
            <NodePropertiesPanel
              node={selectedNode}
              otherFields={otherFields}
              installedBlueprints={installedBlueprints.map((b) => ({ id: b.id, name: b.name }))}
              onChange={(u) => updateNode(selectedNode.id, u)}
              onDelete={() => deleteNode(selectedNode.id)}
            />
          ) : (
            <p className="text-xs opacity-60">Selecciona un nodo para configurarlo, o añade uno desde la paleta.</p>
          )}
        </ScrollArea>

        <div className="border rounded-md p-2 h-[290px] overflow-auto text-xs">
          <div className="font-semibold mb-1 flex items-center gap-2">
            Vista previa
            <Badge variant="outline" className="text-[9px]">{graph.nodes.length} nodos</Badge>
          </div>
          <div className="opacity-70 text-[11px]">
            <div>Valor calculado: <span className="font-mono">{JSON.stringify(preview.value)}</span></div>
            {preview.errors.length > 0 && (
              <div className="mt-1 text-destructive">
                {preview.errors.map((e, i) => <div key={i}>⚠ {e.message}</div>)}
              </div>
            )}
            {preview.automations.length > 0 && (
              <div className="mt-1">
                {preview.automations.map((a, i) => <div key={i}>⚡ {JSON.stringify(a)}</div>)}
              </div>
            )}
            {graph.nodes.find((n) => n.kind === "output.value") == null && (
              <div className="mt-2 text-amber-600">Añade un nodo "Valor del campo" para definir la salida.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NodeGraphEditor = (props: Props) => (
  <ReactFlowProvider>
    <NodeGraphEditorInner {...props} />
  </ReactFlowProvider>
);
