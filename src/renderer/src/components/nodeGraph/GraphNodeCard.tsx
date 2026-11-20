import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_REGISTRY } from "@/lib/nodeGraph/registry";
import type { NodeKind } from "@/lib/nodeGraph/types";

type Data = {
  kind: NodeKind;
  label?: string;
  selected?: boolean;
};

const SOCKET_COLORS: Record<string, string> = {
  string: "hsl(220 70% 60%)",
  number: "hsl(160 70% 45%)",
  boolean: "hsl(40 90% 55%)",
  date: "hsl(280 60% 60%)",
  list: "hsl(190 70% 50%)",
  object: "hsl(0 0% 50%)",
  any: "hsl(0 0% 70%)",
};

const NodeCard = ({ data, selected }: NodeProps) => {
  const d = data as Data;
  const desc = NODE_REGISTRY[d.kind];
  if (!desc) return null;
  return (
    <div
      className="rounded-lg border bg-card text-card-foreground shadow-xs min-w-[180px]"
      style={{ borderColor: selected ? "hsl(var(--primary))" : "hsl(var(--border))", borderWidth: selected ? 2 : 1 }}
    >
      <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/40 rounded-t-lg">
        <span className="text-base leading-none">{desc.icon}</span>
        <span className="text-xs font-semibold truncate">{d.label || desc.label}</span>
      </div>
      <div className="relative py-2">
        {/* Inputs (left) */}
        <div className="space-y-1.5">
          {desc.inputs.map((sock, i) => (
            <div key={sock.id} className="relative pl-4 pr-2 text-[10px] flex items-center gap-1">
              <Handle
                id={sock.id}
                type="target"
                position={Position.Left}
                style={{
                  background: SOCKET_COLORS[sock.type] ?? SOCKET_COLORS['any'],
                  width: 10, height: 10, top: 14 + i * 22,
                }}
              />
              <span className="opacity-70">{sock.label}</span>
            </div>
          ))}
        </div>
        {/* Outputs (right) */}
        <div className="space-y-1.5 mt-1">
          {desc.outputs.map((sock, i) => (
            <div key={sock.id} className="relative pr-4 pl-2 text-[10px] flex items-center justify-end gap-1">
              <span className="opacity-70">{sock.label}</span>
              <Handle
                id={sock.id}
                type="source"
                position={Position.Right}
                style={{
                  background: SOCKET_COLORS[sock.type] ?? SOCKET_COLORS['any'],
                  width: 10, height: 10, top: 14 + (desc.inputs.length * 22) + i * 22 + 8,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(NodeCard);
