/**
 * Mesh Dashboard — inline status for pi-mesh
 *
 * Reads from the mesh filesystem and produces compact markdown
 * status blocks similar to pi-coordination's inline dashboard.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Registry } from "./mesh/registry.js";
import { ReservationStore } from "./mesh/reservations.js";
import { TaskBoard } from "./mesh/tasks.js";
import { Inbox } from "./mesh/messages.js";
import { ProjectStateStore } from "./mesh/project-state.js";
import type { MeshAgent, MeshTask, MeshMessage, MeshReservation } from "./types.js";

const MESH_DIR = path.join(os.homedir(), ".pi", "agent", "mesh");

function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

function fmtRel(ts: string): string {
  const d = Date.now() - new Date(ts).getTime();
  return fmtDur(d);
}

function pad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - s.length));
}

function truncateFile(p: string, maxLen: number): string {
  const base = path.basename(p);
  if (base.length <= maxLen) return base;
  return base.slice(0, maxLen - 1) + "…";
}

export interface MeshSnapshot {
  agents: MeshAgent[];
  tasks: MeshTask[];
  reservations: MeshReservation[];
  messages: MeshMessage[];
  contracts: Record<string, unknown>;
}

export function readMeshSnapshot(): MeshSnapshot {
  const registry = new Registry({ meshDir: MESH_DIR, staleThresholdMs: 60_000 });
  const tasks = new TaskBoard({ meshDir: MESH_DIR });
  const reservations = new ReservationStore({ meshDir: MESH_DIR });
  const inbox = new Inbox({ meshDir: MESH_DIR });
  const projectState = new ProjectStateStore(MESH_DIR);

  // Read all messages (pruned to recent)
  const allMsgs = inbox.inbox("all");
  const recentMsgs = allMsgs.slice(0, 20);

  // Read contracts from project state of current cwd
  const state = projectState.load(process.cwd());
  const contracts: Record<string, unknown> = (state.extensions?.contracts as Record<string, unknown>) ?? {};

  return {
    agents: registry.list(),
    tasks: tasks.list(),
    reservations: reservations.list(),
    messages: recentMsgs,
    contracts,
  };
}

/** Format compact inline status block for the mesh. */
export function formatMeshDashboard(snap: MeshSnapshot): string {
  const lines: string[] = [];

  // Header
  const active = snap.agents.filter((a) => !isStale(a.lastSeenAt, 60_000)).length;
  const total = snap.agents.length;
  const open = snap.tasks.filter((t) => t.status === "open").length;
  const claimed = snap.tasks.filter((t) => t.status === "claimed").length;
  const done = snap.tasks.filter((t) => t.status === "complete").length;
  const failed = snap.tasks.filter((t) => t.status === "failed").length;
  const reserved = snap.reservations.length;

  lines.push(`Mesh: ${active}/${total} agents │ ${open}○ ${claimed}● ${done}✓ ${failed}✗ │ ${reserved} reservations`);
  lines.push("─".repeat(58));

  // Agents
  if (snap.agents.length > 0) {
    lines.push(pad("Agent", 18) + pad("Status", 10) + pad("CWD", 20) + pad("Seen", 10));
    for (const a of snap.agents.slice(0, 6)) {
      const stale = isStale(a.lastSeenAt, 60_000);
      const icon = stale ? "○" : a.status === "working" ? "●" : "●";
      const statusColor = stale ? "idle (stale)" : a.status;
      const name = pad(a.name, 18);
      const status = pad(statusColor, 10);
      const cwd = pad(truncateFile(a.cwd, 20), 20);
      const seen = stale ? pad(`>${fmtRel(a.lastSeenAt)}`, 10) : pad(fmtRel(a.lastSeenAt) + " ago", 10);
      lines.push(`${name}${status}${cwd}${seen}`);
    }
    if (snap.agents.length > 6) {
      lines.push(`  ... and ${snap.agents.length - 6} more agents`);
    }
    lines.push("─".repeat(58));
  }

  // Task board
  if (snap.tasks.length > 0) {
    const priorityIcon = (p: string) => p === "critical" ? "🔴" : p === "high" ? "🟠" : p === "medium" ? "🟡" : "⚪";
    lines.push(pad("Task", 10) + pad("Title", 24) + pad("Status", 10) + pad("Claimed By", 14));
    for (const t of snap.tasks.slice(0, 8)) {
      const id = pad(t.id, 10);
      const title = pad(truncateFile(t.title ?? t.description.split("\n")[0] ?? "(no title)", 24), 24);
      const status = pad(t.status, 10);
      const claimed = pad(t.claimedByName ?? "—", 14);
      lines.push(`${priorityIcon(t.priority)} ${id}${title}${status}${claimed}`);
    }
    if (snap.tasks.length > 8) {
      lines.push(`  ... and ${snap.tasks.length - 8} more tasks`);
    }
    lines.push("─".repeat(58));
  }

  // File reservations
  if (snap.reservations.length > 0) {
    lines.push("Reservations:");
    for (const r of snap.reservations.slice(0, 6)) {
      const files = r.files.map((f) => truncateFile(f, 16)).join(", ");
      const age = fmtDur(Date.now() - r.claimedAt);
      lines.push(`  ${r.agentName} → ${files} (${age})`);
    }
    if (snap.reservations.length > 6) {
      lines.push(`  ... and ${snap.reservations.length - 6} more`);
    }
    lines.push("─".repeat(58));
  }

  // Recent messages
  if (snap.messages.length > 0) {
    lines.push("Messages:");
    for (const m of snap.messages.slice(0, 5)) {
      const rel = fmtRel(m.timestamp);
      const typeIcon = m.type === "broadcast" ? "✦" : m.type === "challenge" ? "⚡" : m.type === "system" ? "⚙" : "→";
      const preview = m.body.split("\n")[0].slice(0, 40);
      lines.push(`  +${rel} ${typeIcon} [${m.fromName}] ${preview}${m.body.length > 40 ? "…" : ""}`);
    }
    if (snap.messages.length > 5) {
      lines.push(`  ... and ${snap.messages.length - 5} more messages`);
    }
    lines.push("─".repeat(58));
  }

  // Contracts
  const contractKeys = Object.keys(snap.contracts);
  if (contractKeys.length > 0) {
    lines.push(`Contracts: ${contractKeys.join(", ")}`);
  }

  return lines.join("\n");
}

/** Single-line compact status. */
export function formatMeshCompact(snap: MeshSnapshot): string {
  const active = snap.agents.filter((a) => !isStale(a.lastSeenAt, 60_000)).length;
  const total = snap.agents.length;
  const open = snap.tasks.filter((t) => t.status === "open").length;
  const claimed = snap.tasks.filter((t) => t.status === "claimed").length;
  const done = snap.tasks.filter((t) => t.status === "complete").length;
  const failed = snap.tasks.filter((t) => t.status === "failed").length;
  const reserved = snap.reservations.length;
  return `Mesh: ${active}/${total} peers │ ${open}○ ${claimed}● ${done}✓ ${failed}✗ │ ${reserved} reserved`;
}

function isStale(lastSeenAt: string, thresholdMs: number): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() > thresholdMs;
}
