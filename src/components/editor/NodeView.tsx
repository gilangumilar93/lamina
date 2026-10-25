import { patchNode } from "@/design/ops";
import { useStore } from "@/design/store";
import { TEXT_LEADING, type DesignNode } from "@/design/types";
import { memo, type CSSProperties } from "react";

function shapeStyle(node: DesignNode): CSSProperties {
  if (node.type === "text" || node.type === "line" || node.type === "group") return {};
  return {
    background: node.fill ?? "transparent",
    borderRadius: node.type === "ellipse" ? "50%" : node.radius,
    border: node.stroke ? `${node.strokeWidth}px solid ${node.stroke}` : undefined,
    boxSizing: "border-box",
  };
}

export const NodeView = memo(function NodeView({ id }: { id: string }) {
  const node = useStore((s) => s.files.find((file) => file.id === s.activeId)?.nodes[id]);
  const editing = useStore((s) => s.editingId === id);
  if (!node?.visible) return null;

  return (
    <div
      data-node={id}
      className={node.type === "frame" ? "artboard absolute" : "absolute"}
      style={{
        left: node.x,
        top: node.y,
        width: Math.max(0, node.w),
        height: Math.max(0, node.h),
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        transformOrigin: "0 0",
        opacity: node.opacity / 100,
        pointerEvents: "none",
        overflow: node.type === "frame" ? "hidden" : "visible",
        ...shapeStyle(node),
      }}
    >
      {node.type === "line" && (
        <svg width={node.w} height={node.h} className="overflow-visible">
          <line
            x1={node.lineFrom === "tr" ? node.w : 0}
            y1={0}
            x2={node.lineFrom === "tr" ? 0 : node.w}
            y2={node.h}
            stroke={node.stroke ?? "#1c1c1f"}
            strokeWidth={node.strokeWidth || 2}
            strokeLinecap="round"
          />
        </svg>
      )}
      {node.type === "text" && !editing && (
        <div
          style={{
            color: node.fill ?? "#1c1c1f",
            fontSize: node.fontSize,
            fontWeight: node.fontWeight,
            textAlign: node.align,
            lineHeight: TEXT_LEADING,
            fontFamily: "Outfit, sans-serif",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
          }}
        >
          {node.text}
        </div>
      )}
      {node.type === "text" && editing && (
        <textarea
          autoFocus
          value={node.text}
          spellCheck={false}
          aria-label="Edit text"
          className="pointer-events-auto absolute inset-0 resize-none border-0 bg-transparent p-0 outline-none"
          style={{
            color: node.fill ?? "#1c1c1f",
            fontSize: node.fontSize,
            fontWeight: node.fontWeight,
            textAlign: node.align,
            lineHeight: TEXT_LEADING,
            fontFamily: "Outfit, sans-serif",
          }}
          onChange={(event) => {
            const value = event.target.value;
            useStore.getState().live((file) => patchNode(file, id, { text: value }));
          }}
          onBlur={() => useStore.getState().setEditing(null)}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      )}
      {node.children.map((child) => (
        <NodeView key={child} id={child} />
      ))}
    </div>
  );
});
