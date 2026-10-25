import { Canvas, cancelInteraction } from "@/components/editor/Canvas";
import { MobileDock, Shortcuts, syncSpaceCursor, ToolRail, TopBar } from "@/components/editor/Chrome";
import { LayersPanel, PropertiesPanel } from "@/components/editor/Panels";
import { Home } from "@/components/home/Home";
import { keys } from "@/design/keys";
import { useStore } from "@/design/store";
import type { Tool } from "@/design/types";
import { Layers, SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  h: "hand",
  f: "frame",
  r: "rect",
  o: "ellipse",
  l: "line",
  t: "text",
};

function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function App() {
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);

  useEffect(() => {
    useStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !typing(event.target)) {
        keys.space = true;
        syncSpaceCursor();
        event.preventDefault();
      }
      if (typing(event.target)) return;
      const state = useStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        if (state.shortcuts) state.setShortcuts(false);
        else if (state.panel) state.setPanel(null);
        else {
          cancelInteraction();
          state.setSelection([]);
          state.setTool("select");
        }
        return;
      }
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        state.setShortcuts(!state.shortcuts);
        return;
      }
      if (!mod && !event.altKey && TOOL_KEYS[key]) {
        event.preventDefault();
        state.setTool(TOOL_KEYS[key]);
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        state.duplicateSelection();
        return;
      }
      if (mod && key === "a") {
        event.preventDefault();
        state.selectAll();
        return;
      }
      if (mod && key === "c") {
        event.preventDefault();
        state.copy();
        return;
      }
      if (mod && key === "x") {
        event.preventDefault();
        state.cut();
        return;
      }
      if (mod && key === "v") {
        event.preventDefault();
        state.paste();
        return;
      }
      if (mod && key === "g") {
        event.preventDefault();
        if (event.shiftKey) state.ungroupSelection();
        else state.groupSelection();
        return;
      }
      if (mod && key === "0") {
        event.preventDefault();
        state.fit("all");
        return;
      }
      if (mod && key === "1") {
        event.preventDefault();
        state.zoom100();
        return;
      }
      if (event.key === "[") {
        event.preventDefault();
        state.reorderSelection(mod ? "back" : "backward");
        return;
      }
      if (event.key === "]") {
        event.preventDefault();
        state.reorderSelection(mod ? "front" : "forward");
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.removeSelection();
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") state.nudgeSelection(-step, 0);
      if (event.key === "ArrowRight") state.nudgeSelection(step, 0);
      if (event.key === "ArrowUp") state.nudgeSelection(0, -step);
      if (event.key === "ArrowDown") state.nudgeSelection(0, step);
      if (event.key.startsWith("Arrow")) event.preventDefault();
    };
    const clearSpace = () => {
      keys.space = false;
      syncSpaceCursor();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") clearSpace();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clearSpace);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clearSpace);
    };
  }, []);

  if (screen === "home") return <Home />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <LayersPanel className="hidden lg:flex" />
        <Canvas />
        <PropertiesPanel className="hidden lg:flex" />
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface px-2 lg:hidden">
        <button type="button" className="inline-flex h-11 items-center gap-2 px-2 text-sm text-muted" onClick={() => useStore.getState().setPanel("layers")}>
          <Layers className="size-4" />
          Layers
        </button>
        <button type="button" className="inline-flex h-11 items-center gap-2 px-2 text-sm text-muted" onClick={() => useStore.getState().setPanel("props")}>
          <SlidersHorizontal className="size-4" />
          Design
        </button>
      </div>
      <MobileDock />
      {panel && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => useStore.getState().setPanel(null)}>
          <div className="absolute inset-0 bg-ink/50" />
          <div className="sheet-enter absolute inset-x-0 bottom-0 flex h-[72%] flex-col overflow-hidden rounded-t-xl border border-border bg-surface" onClick={(event) => event.stopPropagation()}>
            {panel === "layers" ? <LayersPanel className="h-full w-full border-0" /> : <PropertiesPanel className="h-full w-full border-0" />}
          </div>
        </div>
      )}
      <Shortcuts />
    </div>
  );
}
