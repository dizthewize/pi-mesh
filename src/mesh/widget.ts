/**
 * MeshWidget — Ambient mini widget for live mesh state.
 *
 * Auto-shows when agents are working. Dismisses when all idle.
 * Polls filesystem every 2s. Mirrors pi-workflows widget pattern.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { MeshAgent, MeshTask, MeshReservation } from "../types.js";

const MESH_DIR = path.join(os.homedir(), ".pi", "agent", "mesh");
const POLL_INTERVAL_MS = 2000;
const IDLE_DISMISS_MS = 300_000; // 5 minutes

interface Theme {
  fg(color: string, text: string): string;
}

interface TuiHandle {
  requestRender(): void;
}

export interface Component {
  render(width: number): string[];
  invalidate(): void;
}

interface MeshState {
  agents: MeshAgent[];
  tasks: MeshTask[];
  reservations: MeshReservation[];
}

export class MeshWidget implements Component {
  private theme: Theme;
  private tui: TuiHandle;
  private pollInterval: NodeJS.Timeout | null = null;
  private disposed = false;
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private version = 0;
  private cachedVersion = -1;
  private lastWorkAt = 0;

  constructor(
    tui: TuiHandle,
    theme: Theme,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.startPolling();
  }

  dispose(): void {
    this.disposed = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      if (this.disposed) return;
      this.version++;
      this.tui.requestRender();
    }, POLL_INTERVAL_MS);
  }

  invalidate(): void {
    this.version++;
  }

  /** Returns true if widget should be hidden (all idle for >5m) */
  shouldHide(): boolean {
    const state = this.readState();
    if (!state) return true;
    const working = state.agents.filter((a) => a.status === "working").length;
    if (working > 0) {
      this.lastWorkAt = Date.now();
      return false;
    }
    // All idle — hide if been idle for 5 minutes
    return Date.now() - this.lastWorkAt > IDLE_DISMISS_MS;
  }

  render(width: number): string[] {
    if (width === this.cachedWidth && this.cachedVersion === this.version) {
      return this.cachedLines;
    }

    const th = this.theme;
    const lines: string[] = [];
    const innerWidth = Math.max(4, width - 4);

    const state = this.readState();
    if (!state) {
      this.cache(lines, width);
      return lines;
    }

    const active = state.agents.filter((a) => !isStale(a.lastSeenAt, 60_000));
    const working = active.filter((a) => a.status === "working");
    const idle = active.filter((a) => a.status !== "working");

    if (working.length === 0) {
      this.cache(lines, width);
      return lines; // empty → hidden
    }

    // Header
    const title = `${th.fg("accent", "Mesh")}: ${active.length} peers │ ${th.fg("warning", `●${working.length}`)} ${th.fg("dim", `○${idle.length}`)}`;
    lines.push(this.border("top", innerWidth, title));

    // Working agents (up to 3)
    for (const agent of working.slice(0, 3)) {
      const task = state.tasks.find((t) => t.claimedBy === agent.id);
      const taskLabel = task ? task.id : "(no task)";
      const files = state.reservations
        .filter((r) => r.agentId === agent.id)
        .flatMap((r) => r.files)
        .map((f) => path.basename(f))
        .slice(0, 2)
        .join(", ") || "—";
      const dur = fmtRel(agent.lastSeenAt);
      const line = `  ${th.fg("warning", "●")} ${th.fg("accent", agent.name)}  ${th.fg("dim", taskLabel)}  ${th.fg("dim", files)}  ${th.fg("dim", dur)}`;
      lines.push(this.boxLine(line, innerWidth));
    }

    // Idle agents (first one only, truncated)
    if (idle.length > 0) {
      const first = idle[0];
      const rest = idle.length > 1 ? ` +${idle.length - 1} more` : "";
      const line = `  ${th.fg("dim", "○")} ${th.fg("dim", first.name)}${th.fg("dim", rest)}`;
      lines.push(this.boxLine(line, innerWidth));
    }

    lines.push(this.border("bottom", innerWidth));
    this.cache(lines, width);
    return lines;
  }

  private readState(): MeshState | null {
    try {
      const registryDir = path.join(MESH_DIR, "registry");
      const agents: MeshAgent[] = [];
      if (fs.existsSync(registryDir)) {
        for (const f of fs.readdirSync(registryDir)) {
          if (!f.endsWith(".json")) continue;
          try {
            const raw = fs.readFileSync(path.join(registryDir, f), "utf-8");
            agents.push(JSON.parse(raw) as MeshAgent);
          } catch { /* ignore corrupt */ }
        }
      }

      const tasksPath = path.join(MESH_DIR, "tasks", "board.json");
      let tasks: MeshTask[] = [];
      try {
        const raw = fs.readFileSync(tasksPath, "utf-8");
        tasks = JSON.parse(raw).tasks as MeshTask[];
      } catch { /* no tasks */ }

      const resDir = path.join(MESH_DIR, "reservations");
      let reservations: MeshReservation[] = [];
      if (fs.existsSync(resDir)) {
        for (const f of fs.readdirSync(resDir)) {
          if (!f.endsWith(".json")) continue;
          try {
            const raw = fs.readFileSync(path.join(resDir, f), "utf-8");
            reservations.push(JSON.parse(raw) as MeshReservation);
          } catch { /* ignore */ }
        }
      }

      return { agents, tasks, reservations };
    } catch {
      return null;
    }
  }

  private border(type: "top" | "bottom", width: number, title?: string): string {
    const th = this.theme;
    const dim = (s: string) => th.fg("borderMuted", s);
    if (type === "top") {
      const titlePart = title ? ` ${title} ` : "";
      const lineLen = width - 2;
      const pad = Math.max(0, lineLen - this.stripAnsi(titlePart).length);
      return dim(" ┌") + dim("─") + titlePart + dim("─".repeat(pad)) + dim("┐");
    }
    return dim(" └") + dim("─".repeat(width)) + dim("┘");
  }

  private boxLine(content: string, width: number): string {
    const th = this.theme;
    const visible = this.stripAnsi(content);
    const pad = Math.max(0, width - 2 - visible.length);
    return th.fg("borderMuted", " │") + content + " ".repeat(pad) + th.fg("borderMuted", "│");
  }

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B\[[0-9;]*m/g, "");
  }

  private cache(lines: string[], width: number): void {
    this.cachedLines = lines;
    this.cachedWidth = width;
    this.cachedVersion = this.version;
  }
}

function fmtRel(ts: string): string {
  const d = Date.now() - new Date(ts).getTime();
  const s = Math.floor(d / 1000);
  const m = Math.floor(s / 60);
  if (m > 9) return `${m}m`;
  if (m > 0) return `${m}:${String(s % 60).padStart(2, "0")}`;
  return `${s}s`;
}

function isStale(lastSeenAt: string, thresholdMs: number): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() > thresholdMs;
}
