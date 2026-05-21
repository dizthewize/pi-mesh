import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { readJSON, writeJSON, mkdirpSync } from "../utils.js";

export interface ProjectState {
  projectHash: string;
  cwd: string;
  updatedAt: string;
  extensions: Record<string, unknown>;
}

export class ProjectStateStore {
  private projectsDir: string;

  constructor(meshDir: string) {
    this.projectsDir = path.join(meshDir, "projects");
    mkdirpSync(this.projectsDir);
  }

  private hashCwd(cwd: string): string {
    return crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  }

  private statePath(projectHash: string): string {
    return path.join(this.projectsDir, projectHash, "state.json");
  }

  /** Load or initialize project state. */
  load(cwd: string): ProjectState {
    const projectHash = this.hashCwd(cwd);
    const existing = readJSON<ProjectState>(this.statePath(projectHash));
    if (existing) return existing;
    return {
      projectHash,
      cwd,
      updatedAt: new Date().toISOString(),
      extensions: {},
    };
  }

  /** Persist project state. */
  save(state: ProjectState): void {
    const dir = path.join(this.projectsDir, state.projectHash);
    mkdirpSync(dir);
    state.updatedAt = new Date().toISOString();
    writeJSON(this.statePath(state.projectHash), state);
  }

  /** Get an extension's slice of state. */
  get<T = unknown>(state: ProjectState, ext: string): T | undefined {
    return state.extensions[ext] as T | undefined;
  }

  /** Set an extension's slice of state. */
  set<T>(state: ProjectState, ext: string, data: T): ProjectState {
    state.extensions[ext] = data;
    return state;
  }

  /** Remove an extension's slice. */
  remove(state: ProjectState, ext: string): ProjectState {
    delete state.extensions[ext];
    return state;
  }

  /** List all tracked projects. */
  list(): ProjectState[] {
    const result: ProjectState[] = [];
    try {
      const dirs = fs.readdirSync(this.projectsDir);
      for (const dir of dirs) {
        const s = readJSON<ProjectState>(path.join(this.projectsDir, dir, "state.json"));
        if (s) result.push(s);
      }
    } catch { /* ignore */ }
    return result;
  }
}
