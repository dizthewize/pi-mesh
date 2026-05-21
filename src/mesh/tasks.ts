import * as fs from "node:fs";
import * as path from "node:path";
import { MeshTask } from "../types.js";
import { readJSON, writeJSON, nowISO } from "../utils.js";
import { withFlock } from "./flock.js";

export interface TaskBoardOptions {
  meshDir: string;
}

export class TaskBoard {
  private boardPath: string;
  private claimsDir: string;

  constructor(opts: TaskBoardOptions) {
    this.boardPath = path.join(opts.meshDir, "tasks", "board.json");
    this.claimsDir = path.join(opts.meshDir, "claims");
    fs.mkdirSync(path.dirname(this.boardPath), { recursive: true });
    fs.mkdirSync(this.claimsDir, { recursive: true });
  }

  private readBoard(): MeshTask[] {
    return readJSON<MeshTask[]>(this.boardPath) ?? [];
  }

  private writeBoard(tasks: MeshTask[]): void {
    writeJSON(this.boardPath, tasks);
  }

  add(task: Omit<MeshTask, "id" | "createdAt" | "status">): MeshTask {
    const lockFile = path.join(this.boardPath, "..", "..", ".lock");
    return withFlock(lockFile, () => {
      const tasks = this.readBoard();
      const id = `MESH-${String(tasks.length + 1).padStart(3, "0")}`;
      const full: MeshTask = {
        ...task,
        id,
        status: "open",
        createdAt: nowISO(),
      };
      tasks.push(full);
      this.writeBoard(tasks);
      return full;
    });
  }

  remove(taskId: string): boolean {
    const lockFile = path.join(this.boardPath, "..", "..", ".lock");
    return withFlock(lockFile, () => {
      const tasks = this.readBoard();
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx === -1) return false;
      tasks.splice(idx, 1);
      this.writeBoard(tasks);
      return true;
    });
  }

  list(filter?: {
    status?: MeshTask["status"];
    tag?: string;
    priority?: MeshTask["priority"];
  }): MeshTask[] {
    let tasks = this.readBoard();
    if (filter?.status) tasks = tasks.filter((t) => t.status === filter.status);
    if (filter?.tag) tasks = tasks.filter((t) => t.tags?.includes(filter.tag!));
    if (filter?.priority) tasks = tasks.filter((t) => t.priority === filter.priority);
    // Sort by priority
    const pMap = { critical: 0, high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => pMap[a.priority] - pMap[b.priority]);
    return tasks;
  }

  get(taskId: string): MeshTask | null {
    return this.readBoard().find((t) => t.id === taskId) ?? null;
  }

  claim(taskId: string, agentId: string, agentName: string): MeshTask | null {
    const lockFile = path.join(this.boardPath, "..", "..", ".lock");
    return withFlock(lockFile, () => {
      const tasks = this.readBoard();
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "open") return null;

      task.status = "claimed";
      task.claimedBy = agentId;
      task.claimedByName = agentName;
      task.claimedAt = nowISO();

      this.writeBoard(tasks);

      // Persist claim separately
      writeJSON(path.join(this.claimsDir, `${taskId}.json`), {
        agentId,
        agentName,
        claimedAt: task.claimedAt,
      });

      return task;
    });
  }

  unclaim(taskId: string): MeshTask | null {
    const lockFile = path.join(this.boardPath, "..", "..", ".lock");
    return withFlock(lockFile, () => {
      const tasks = this.readBoard();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      task.status = "open";
      task.claimedBy = undefined;
      task.claimedByName = undefined;
      task.claimedAt = undefined;

      this.writeBoard(tasks);

      try {
        fs.unlinkSync(path.join(this.claimsDir, `${taskId}.json`));
      } catch { /* ignore */ }

      return task;
    });
  }

  markDone(
    taskId: string,
    summary?: string,
    agentId?: string
  ): MeshTask | null {
    const lockFile = path.join(this.boardPath, "..", "..", ".lock");
    return withFlock(lockFile, () => {
      const tasks = this.readBoard();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      task.status = "complete";
      task.completedAt = nowISO();
      if (summary) {
        task.description += `\n\n[Done by ${agentId ?? task.claimedBy}] ${summary}`;
      }

      this.writeBoard(tasks);
      return task;
    });
  }

  markFailed(taskId: string, reason?: string): MeshTask | null {
    const lockFile = path.join(this.boardPath, "..", "..", ".lock");
    return withFlock(lockFile, () => {
      const tasks = this.readBoard();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      task.status = "failed";
      if (reason) {
        task.description += `\n\n[Failed] ${reason}`;
      }

      this.writeBoard(tasks);
      return task;
    });
  }
}
