/**
 * Pi Mesh Extension
 *
 * Zero-daemon agent mesh. Agents discover each other, reserve files,
 * claim tasks from a shared board, and send messages — all via files.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Registry } from "../mesh/registry.js";
import { ReservationStore } from "../mesh/reservations.js";
import { TaskBoard } from "../mesh/tasks.js";
import { Inbox } from "../mesh/messages.js";
import { ProjectStateStore } from "../mesh/project-state.js";
import { generateAgentName, truncate } from "../utils.js";
import type { MeshAction, PiMeshParams, PiMeshResult, MeshAgent } from "../types.js";

const MESH_DIR = path.join(os.homedir(), ".pi", "agent", "mesh");

const MeshActionEnum = Type.String({
  description: "Action: join, leave, list, status, rename, send, broadcast, challenge, inbox, reserve, release, claim, unclaim, task_list, task_show, task_done, project_state_get, project_state_set, contract_provide, contract_need, contract_list",
});

const PiMeshSchema = Type.Object({
  action: MeshActionEnum,
  name: Type.Optional(Type.String()),
  to: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  taskId: Type.Optional(Type.String()),
  paths: Type.Optional(Type.Array(Type.String())),
  ttl: Type.Optional(Type.Number()),
  status: Type.Optional(Type.String({ enum: ["idle", "working", "away"] })),
  summary: Type.Optional(Type.String()),
  tagFilter: Type.Optional(Type.String()),
  priorityFilter: Type.Optional(Type.String({ enum: ["critical", "high", "medium", "low"] })),
  ext: Type.Optional(Type.String()),
  data: Type.Optional(Type.Any()),
  item: Type.Optional(Type.String()),
  signature: Type.Optional(Type.String()),
});

type PiMeshType = Static<typeof PiMeshSchema>;

export default function piMeshExtension(pi: ExtensionAPI) {
  const heartbeatTimers = new Map<string, NodeJS.Timeout>();
  let myAgentId: string | null = null;

  const registry = new Registry({ meshDir: MESH_DIR });
  const reservations = new ReservationStore({ meshDir: MESH_DIR });
  const tasks = new TaskBoard({ meshDir: MESH_DIR });
  const inbox = new Inbox({ meshDir: MESH_DIR });

  // ── Bridge: respond to inter-extension mesh requests via EventBus ──
  pi.events.on("mesh:setProjectState:request", async (data) => {
    const { requestId, params, responseChannel } = data as any;
    try {
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(params.cwd ?? process.cwd());
      projectState.set(state, params.ext, params.data ?? {});
      projectState.save(state);
      pi.events.emit(responseChannel, { success: true, result: { set: true } });
    } catch (err) {
      pi.events.emit(responseChannel, { success: false, error: String(err) });
    }
  });

  pi.events.on("mesh:provideContract:request", async (data) => {
    const { requestId, params, responseChannel } = data as any;
    try {
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(params.cwd ?? process.cwd());
      const contracts: Record<string, unknown> = projectState.get(state, "contracts") ?? {};
      contracts[params.item] = {
        agentId: myAgentId ?? "bridge",
        name: myAgentId ? (registry.get(myAgentId)?.name ?? "unknown") : "bridge",
        signature: params.signature ?? "",
        ts: new Date().toISOString(),
      };
      projectState.set(state, "contracts", contracts);
      projectState.save(state);
      pi.events.emit(responseChannel, { success: true, result: { provided: params.item } });
    } catch (err) {
      pi.events.emit(responseChannel, { success: false, error: String(err) });
    }
  });

  pi.events.on("mesh:send:request", async (data) => {
    const { requestId, params, responseChannel } = data as any;
    try {
      inbox.send({
        from: myAgentId ?? "bridge",
        fromName: myAgentId ? (registry.get(myAgentId)?.name ?? "unknown") : "bridge",
        to: params.to,
        body: params.message,
        type: "dm",
      });
      pi.events.emit(responseChannel, { success: true, result: { sent: true } });
    } catch (err) {
      pi.events.emit(responseChannel, { success: false, error: String(err) });
    }
  });

  function getAgentId(ctx: ExtensionContext): string {
    return `${process.pid}-${ctx.sessionManager?.getSessionId?.() ?? crypto.randomUUID().slice(0, 8)}`;
  }

  function startHeartbeat(agentId: string) {
    if (heartbeatTimers.has(agentId)) return;
    const timer = setInterval(() => {
      registry.heartbeat(agentId);
    }, 15000);
    heartbeatTimers.set(agentId, timer);
    timer.unref?.();
  }

  function stopHeartbeat(agentId: string) {
    const timer = heartbeatTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      heartbeatTimers.delete(agentId);
    }
  }

  pi.registerTool({
    name: "pi_mesh",
    label: "Pi Mesh",
    description: `Agent mesh coordination: join, send messages, reserve files, claim tasks.

Usage:
  pi_mesh({ action: "join", name: "custom-name" })
  pi_mesh({ action: "list" })
  pi_mesh({ action: "send", to: "swift-raven-42", message: "auth done" })
  pi_mesh({ action: "broadcast", message: "standup now" })
  pi_mesh({ action: "reserve", paths: ["src/auth/"], ttl: 600 })
  pi_mesh({ action: "release", paths: ["src/auth/"] })
  pi_mesh({ action: "claim", taskId: "MESH-001" })
  pi_mesh({ action: "task_list", status: "open" })
  pi_mesh({ action: "task_done", taskId: "MESH-001", summary: "Done" })
  pi_mesh({ action: "inbox" })
  pi_mesh({ action: "leave" })`,
    parameters: PiMeshSchema,

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = rawParams as PiMeshType;
      const result = await handleMeshAction(params, ctx, {
        registry,
        reservations,
        tasks,
        inbox,
        getAgentId: () => getAgentId(ctx),
        myAgentId,
        setMyAgentId: (id: string) => { myAgentId = id; },
        startHeartbeat,
        stopHeartbeat,
      });
      return {
        content: [{ type: "text", text: result.message ?? JSON.stringify(result.data, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerCommand("mesh", {
    description: "Show mesh dashboard: /mesh [status|clear]",
    handler: async (args, _ctx) => {
      const { readMeshSnapshot, formatMeshDashboard, formatMeshCompact } = await import("../dashboard.js");
      const action = args[0] ?? "status";

      if (action === "clear") {
        // Prune stale agents and expired reservations
        const pruned = registry.prune();
        const expired = reservations.pruneExpired();
        pi.sendUserMessage(`Pruned ${pruned.length} stale agents, ${expired} expired reservations`);
        return;
      }

      const snap = readMeshSnapshot();
      if (snap.agents.length === 0 && snap.tasks.length === 0) {
        pi.sendUserMessage("Mesh is empty. Join with: pi_mesh({ action: \"join\" })");
        return;
      }

      const lines: string[] = [];
      lines.push("## Mesh Dashboard\n");
      lines.push("```");
      lines.push(formatMeshDashboard(snap));
      lines.push("```");
      pi.sendUserMessage(lines.join("\n"));
    },
  });

  pi.on("session_shutdown", async () => {
    if (myAgentId) {
      stopHeartbeat(myAgentId);
      // Release reservations
      reservations.releaseAll([myAgentId]);
      // Unclaim any tasks
      const board = tasks.list();
      for (const t of board) {
        if (t.claimedBy === myAgentId) {
          tasks.unclaim(t.id);
        }
      }
      registry.remove(myAgentId);
      myAgentId = null;
    }
  });
}

interface MeshDeps {
  registry: Registry;
  reservations: ReservationStore;
  tasks: TaskBoard;
  inbox: Inbox;
  getAgentId: () => string;
  myAgentId: string | null;
  setMyAgentId: (id: string) => void;
  startHeartbeat: (id: string) => void;
  stopHeartbeat: (id: string) => void;
}

async function handleMeshAction(
  params: PiMeshType,
  ctx: ExtensionContext,
  deps: MeshDeps
): Promise<PiMeshResult> {
  const { registry, reservations, tasks, inbox, getAgentId, myAgentId, setMyAgentId, startHeartbeat, stopHeartbeat } = deps;

  switch (params.action) {
    case "join": {
      const id = getAgentId();
      const name = params.name ?? generateAgentName();
      registry.register({
        id,
        name,
        model: (ctx as any).model ?? "default",
        cwd: ctx.cwd ?? process.cwd(),
        sessionStartedAt: new Date().toISOString(),
        status: "idle",
        reservedFiles: [],
      });
      setMyAgentId(id);
      startHeartbeat(id);
      return {
        status: "ok",
        message: `Joined mesh as "${name}" (${id}). Peers: ${registry.list().length}`,
        peers: registry.list().length,
      };
    }

    case "leave": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      stopHeartbeat(myAgentId);
      reservations.releaseAll([myAgentId]);
      // Unclaim tasks
      for (const t of tasks.list()) {
        if (t.claimedBy === myAgentId) tasks.unclaim(t.id);
      }
      registry.remove(myAgentId);
      return { status: "ok", message: "Left mesh" };
    }

    case "list": {
      const agents = registry.list();
      return { status: "ok", data: agents, peers: agents.length };
    }

    case "status": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      const me = registry.get(myAgentId);
      return { status: "ok", data: me };
    }

    case "rename": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.name) return { status: "error", message: "name required" };
      registry.rename(myAgentId, params.name);
      return { status: "ok", message: `Renamed to "${params.name}"` };
    }

    case "send": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.to || !params.message) return { status: "error", message: "to and message required" };
      const me = registry.get(myAgentId)!;
      inbox.send({
        from: myAgentId,
        fromName: me.name,
        to: params.to,
        body: params.message,
        type: "dm",
      });
      return { status: "ok", message: `Sent to ${params.to}` };
    }

    case "broadcast": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.message) return { status: "error", message: "message required" };
      const me = registry.get(myAgentId)!;
      inbox.send({
        from: myAgentId,
        fromName: me.name,
        to: "all",
        body: params.message,
        type: "broadcast",
      });
      return { status: "ok", message: "Broadcast sent" };
    }

    case "challenge": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.to || !params.message) return { status: "error", message: "to and message required" };
      const me = registry.get(myAgentId)!;
      const msg = inbox.send({
        from: myAgentId,
        fromName: me.name,
        to: params.to,
        body: params.message,
        type: "challenge",
        taskId: params.taskId,
        priority: "urgent",
      });
      return { status: "ok", message: `Challenged ${params.to}` };
    }

    case "inbox": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      const msgs = inbox.inbox(myAgentId);
      return {
        status: "ok",
        data: msgs,
        message: `${msgs.length} messages (${inbox.unreadFor(myAgentId).length} unread)`,
      };
    }

    case "reserve": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.paths?.length) return { status: "error", message: "paths required" };
      const me = registry.get(myAgentId)!;
      const res = reservations.reserve(myAgentId, me.name, params.paths, params.ttl ?? 600_000);
      return {
        status: "ok",
        message: `Reserved ${res.files.length} files`,
      };
    }

    case "release": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      reservations.release(myAgentId, params.paths);
      const me = registry.get(myAgentId)!;
      // Update agent reservedFiles
      const remaining = reservations.list().filter((r) => r.agentId === myAgentId);
      me.reservedFiles = remaining.flatMap((r) => r.files);
      return { status: "ok", message: "Released" };
    }

    case "claim": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const me = registry.get(myAgentId)!;
      const task = tasks.claim(params.taskId, myAgentId, me.name);
      if (!task) return { status: "error", message: "Task not available" };
      // Reserve files
      if (task.files?.length) {
        try {
          reservations.reserve(myAgentId, me.name, task.files, 600_000, task.id);
        } catch (err) {
          tasks.unclaim(params.taskId);
          return { status: "error", message: `Reservation failed: ${err}` };
        }
      }
      // Point C: auto-dispatch via pi-agent-roles if roleId is set
      if (task.roleId) {
        const roleStorePath = path.join(os.homedir(), ".pi", "agent", "roles.json");
        let role: any | null = null;
        try {
          const roles = JSON.parse(fs.readFileSync(roleStorePath, "utf-8"));
          role = roles.find((r: any) => r.id === task.roleId);
        } catch { /* ignore */ }
        if (role) {
          me.currentTaskId = task.id;
          registry.register({
            id: myAgentId,
            name: me.name,
            model: me.model,
            cwd: me.cwd,
            sessionStartedAt: me.sessionStartedAt,
            status: "working",
            reservedFiles: me.reservedFiles,
            currentTaskId: task.id,
          });
          inbox.send({
            from: "system",
            fromName: "system",
            to: myAgentId,
            body: `Auto-dispatch: your claimed task ${task.id} has role "${role.name}".\nRun: pi_roles({ action: "dispatch", roleId: "${task.roleId}", task: "${task.description.replace(/"/g, '\\"')}", mode: "blocking" })\nThen: pi_mesh({ action: "task_done", taskId: "${task.id}", summary: "..." })`,
            type: "system",
          });
          // Auto-dispatch via pi-agent-roles if roleId set
        }
      }
      return { status: "ok", data: task, message: `Claimed ${task.id}` };
    }

    case "unclaim": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const task = tasks.unclaim(params.taskId);
      if (task) reservations.release(myAgentId);
      return { status: "ok", message: task ? "Unclaimed" : "Task not found" };
    }

    case "task_list": {
      const list = tasks.list({
        status: params.status as any,
        tag: params.tagFilter,
        priority: params.priorityFilter as any,
      });
      return { status: "ok", data: list, message: `${list.length} tasks` };
    }

    case "task_show": {
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const task = tasks.get(params.taskId);
      if (!task) return { status: "error", message: "Task not found" };
      return { status: "ok", data: task };
    }

    case "task_done": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const task = tasks.markDone(params.taskId, params.summary, myAgentId);
      if (task) reservations.release(myAgentId, task.files);
      return { status: "ok", data: task, message: task ? "Done" : "Task not found" };
    }

    // ── Project State ──
    case "project_state_get": {
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(ctx.cwd ?? process.cwd());
      const extData = params.ext ? projectState.get(state, params.ext) : state.extensions;
      return { status: "ok", data: extData ?? null };
    }

    case "project_state_set": {
      if (!params.ext) return { status: "error", message: "ext required" };
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(ctx.cwd ?? process.cwd());
      projectState.set(state, params.ext, params.data ?? {});
      projectState.save(state);
      return { status: "ok", message: `Set ${params.ext} state` };
    }

    // ── Contract Sync ──
    case "contract_provide": {
      if (!myAgentId) return { status: "error", message: "Not joined" };
      if (!params.item) return { status: "error", message: "item required" };
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(ctx.cwd ?? process.cwd());
      const contracts: Record<string, { agentId: string; name: string; signature: string; ts: string }> = projectState.get(state, "contracts") ?? {};
      contracts[params.item] = {
        agentId: myAgentId,
        name: registry.get(myAgentId)?.name ?? "unknown",
        signature: params.signature ?? "",
        ts: new Date().toISOString(),
      };
      projectState.set(state, "contracts", contracts);
      projectState.save(state);
      return { status: "ok", message: `Provided contract: ${params.item}` };
    }

    case "contract_need": {
      if (!params.item) return { status: "error", message: "item required" };
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(ctx.cwd ?? process.cwd());
      const contracts: Record<string, { agentId: string; name: string; signature: string; ts: string }> = projectState.get(state, "contracts") ?? {};
      const found = contracts[params.item];
      if (!found) return { status: "error", message: `Contract "${params.item}" not yet provided` };
      return { status: "ok", data: found, message: `Contract "${params.item}" provided by ${found.name}` };
    }

    case "contract_list": {
      const projectState = new ProjectStateStore(MESH_DIR);
      const state = projectState.load(ctx.cwd ?? process.cwd());
      const contracts: Record<string, unknown> = projectState.get(state, "contracts") ?? {};
      return { status: "ok", data: contracts, message: `${Object.keys(contracts).length} contracts` };
    }

    default:
      return { status: "error", message: `Unknown action: ${params.action}` };
  }
}
