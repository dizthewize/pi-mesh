import * as fs from "node:fs";
import * as path from "node:path";
import { MeshAgent } from "../types.js";
import { readJSON, writeJSON, listJSONFiles, isStale, generateAgentName } from "../utils.js";
import { withFlock } from "./flock.js";

export interface RegistryOptions {
  meshDir: string;
  staleThresholdMs?: number;
  autoPrune?: boolean;
}

export class Registry {
  private dir: string;
  private staleMs: number;
  private autoPrune: boolean;

  constructor(opts: RegistryOptions) {
    this.dir = path.join(opts.meshDir, "registry");
    this.staleMs = opts.staleThresholdMs ?? 60_000;
    this.autoPrune = opts.autoPrune ?? true;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  register(agent: Omit<MeshAgent, "lastSeenAt">): MeshAgent {
    const full: MeshAgent = {
      ...agent,
      lastSeenAt: new Date().toISOString(),
    };

    const lockFile = path.join(this.dir, "..", ".lock");
    return withFlock(lockFile, () => {
      if (this.autoPrune) this.pruneUnsafe();
      writeJSON(path.join(this.dir, `${full.id}.json`), full);
      return full;
    });
  }

  heartbeat(agentId: string): void {
    const lockFile = path.join(this.dir, "..", ".lock");
    withFlock(lockFile, () => {
      const file = path.join(this.dir, `${agentId}.json`);
      const agent = readJSON<MeshAgent>(file);
      if (!agent) return;
      agent.lastSeenAt = new Date().toISOString();
      writeJSON(file, agent);
    });
  }

  remove(agentId: string): void {
    const lockFile = path.join(this.dir, "..", ".lock");
    withFlock(lockFile, () => {
      const file = path.join(this.dir, `${agentId}.json`);
      try { fs.unlinkSync(file); } catch { /* ignore */ }
    });
  }

  list(): MeshAgent[] {
    if (this.autoPrune) this.prune();
    return listJSONFiles(this.dir)
      .map((f) => readJSON<MeshAgent>(f))
      .filter(Boolean) as MeshAgent[];
  }

  get(agentId: string): MeshAgent | null {
    return readJSON(path.join(this.dir, `${agentId}.json`));
  }

  /** Prune stale agents and release their reservations. Returns pruned ids. */
  prune(): string[] {
    const lockFile = path.join(this.dir, "..", ".lock");
    return withFlock(lockFile, () => this.pruneUnsafe());
  }

  private pruneUnsafe(): string[] {
    const pruned: string[] = [];
    for (const file of listJSONFiles(this.dir)) {
      const agent = readJSON<MeshAgent>(file);
      if (!agent) continue;
      if (isStale(agent.lastSeenAt, this.staleMs)) {
        try {
          fs.unlinkSync(file);
          pruned.push(agent.id);
        } catch { /* ignore */ }
      }
    }
    return pruned;
  }

  rename(agentId: string, newName: string): boolean {
    const lockFile = path.join(this.dir, "..", ".lock");
    return withFlock(lockFile, () => {
      const agent = this.get(agentId);
      if (!agent) return false;
      agent.name = newName;
      writeJSON(path.join(this.dir, `${agentId}.json`), agent);
      return true;
    });
  }
}
