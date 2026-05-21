import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { readJSON, writeJSON, mkdirpSync } from "../utils.js";
export class ProjectStateStore {
    projectsDir;
    constructor(meshDir) {
        this.projectsDir = path.join(meshDir, "projects");
        mkdirpSync(this.projectsDir);
    }
    hashCwd(cwd) {
        return crypto.createHash("sha256").update(cwd).digest("hex").slice(0, 16);
    }
    statePath(projectHash) {
        return path.join(this.projectsDir, projectHash, "state.json");
    }
    /** Load or initialize project state. */
    load(cwd) {
        const projectHash = this.hashCwd(cwd);
        const existing = readJSON(this.statePath(projectHash));
        if (existing)
            return existing;
        return {
            projectHash,
            cwd,
            updatedAt: new Date().toISOString(),
            extensions: {},
        };
    }
    /** Persist project state. */
    save(state) {
        const dir = path.join(this.projectsDir, state.projectHash);
        mkdirpSync(dir);
        state.updatedAt = new Date().toISOString();
        writeJSON(this.statePath(state.projectHash), state);
    }
    /** Get an extension's slice of state. */
    get(state, ext) {
        return state.extensions[ext];
    }
    /** Set an extension's slice of state. */
    set(state, ext, data) {
        state.extensions[ext] = data;
        return state;
    }
    /** Remove an extension's slice. */
    remove(state, ext) {
        delete state.extensions[ext];
        return state;
    }
    /** List all tracked projects. */
    list() {
        const result = [];
        try {
            const dirs = fs.readdirSync(this.projectsDir);
            for (const dir of dirs) {
                const s = readJSON(path.join(this.projectsDir, dir, "state.json"));
                if (s)
                    result.push(s);
            }
        }
        catch { /* ignore */ }
        return result;
    }
}
//# sourceMappingURL=project-state.js.map