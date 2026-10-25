import { Wordmark } from "@/components/ui";
import { useStore } from "@/design/store";
import type { DesignFile } from "@/design/types";
import { useState } from "react";

function fills(file: DesignFile) {
  const colors: string[] = [];
  for (const node of Object.values(file.nodes)) {
    if (node.fill && !colors.includes(node.fill)) colors.push(node.fill);
    if (colors.length === 4) break;
  }
  return colors.length ? colors : ["#2a2a2e"];
}

function ago(ts: number) {
  const minutes = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function Home() {
  const files = useStore((s) => s.files);
  const ready = useStore((s) => s.ready);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const ordered = [...files].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="h-dvh overflow-auto bg-bg text-fg">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <Wordmark />
        <button
          type="button"
          className="h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          onClick={() => useStore.getState().newFile()}
        >
          New file
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 pb-16">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Files</h1>
          <p className="mt-1 text-sm text-muted">Boards stay in this browser. Nothing is uploaded.</p>
        </div>
        {ordered.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-muted">No files yet. Start a blank frame and draw into it.</p>
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((file) => {
            const colors = fills(file);
            const layers = Object.keys(file.nodes).length;
            return (
              <li key={file.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
                <button type="button" className="flex flex-col gap-3 text-left" onClick={() => useStore.getState().openFile(file.id)}>
                  <span className="grid h-24 grid-cols-4 overflow-hidden rounded-xs">
                    {colors.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span>
                    <span className="block truncate text-sm font-medium">{file.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {layers} {layers === 1 ? "layer" : "layers"}
                      {ready ? ` · ${ago(file.updatedAt)}` : ""}
                    </span>
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-10 flex-1 rounded-sm border border-border text-sm text-muted hover:text-fg"
                    onClick={() => useStore.getState().duplicateFile(file.id)}
                  >
                    Duplicate
                  </button>
                  {confirmId === file.id ? (
                    <button
                      type="button"
                      className="h-10 flex-1 rounded-sm bg-danger text-sm font-medium text-fg"
                      onClick={() => {
                        useStore.getState().deleteFile(file.id);
                        setConfirmId(null);
                      }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="h-10 flex-1 rounded-sm border border-border text-sm text-muted hover:text-fg"
                      onClick={() => setConfirmId(file.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
