import * as fs from "node:fs";
import * as path from "node:path";
import { readJSON, writeJSON, listJSONFiles, isStale } from "../utils.js";
import { withFlock } from "./flock.js";
export class Registry {
    dir;
    staleMs;
    autoPrune;
    constructor(opts) {
        this.dir = path.join(opts.meshDir, "registry");
        this.staleMs = opts.staleThresholdMs ?? 60_000;
        this.autoPrune = opts.autoPrune ?? true;
        fs.mkdirSync(this.dir, { recursive: true });
    }
    register(agent) {
        const full = {
            ...agent,
            lastSeenAt: new Date().toISOString(),
        };
        const lockFile = path.join(this.dir, "..", ".lock");
        return withFlock(lockFile, () => {
            if (this.autoPrune)
                this.pruneUnsafe();
            writeJSON(path.join(this.dir, `${full.id}.json`), full);
            return full;
        });
    }
    heartbeat(agentId) {
        const lockFile = path.join(this.dir, "..", ".lock");
        withFlock(lockFile, () => {
            const file = path.join(this.dir, `${agentId}.json`);
            const agent = readJSON(file);
            if (!agent)
                return;
            agent.lastSeenAt = new Date().toISOString();
            writeJSON(file, agent);
        });
    }
    remove(agentId) {
        const lockFile = path.join(this.dir, "..", ".lock");
        withFlock(lockFile, () => {
            const file = path.join(this.dir, `${agentId}.json`);
            try {
                fs.unlinkSync(file);
            }
            catch { /* ignore */ }
        });
    }
    list() {
        if (this.autoPrune)
            this.prune();
        return listJSONFiles(this.dir)
            .map((f) => readJSON(f))
            .filter(Boolean);
    }
    get(agentId) {
        return readJSON(path.join(this.dir, `${agentId}.json`));
    }
    /** Prune stale agents and release their reservations. Returns pruned ids. */
    prune() {
        const lockFile = path.join(this.dir, "..", ".lock");
        return withFlock(lockFile, () => this.pruneUnsafe());
    }
    pruneUnsafe() {
        const pruned = [];
        for (const file of listJSONFiles(this.dir)) {
            const agent = readJSON(file);
            if (!agent)
                continue;
            if (isStale(agent.lastSeenAt, this.staleMs)) {
                try {
                    fs.unlinkSync(file);
                    pruned.push(agent.id);
                }
                catch { /* ignore */ }
            }
        }
        return pruned;
    }
    rename(agentId, newName) {
        const lockFile = path.join(this.dir, "..", ".lock");
        return withFlock(lockFile, () => {
            const agent = this.get(agentId);
            if (!agent)
                return false;
            agent.name = newName;
            writeJSON(path.join(this.dir, `${agentId}.json`), agent);
            return true;
        });
    }
}
//# sourceMappingURL=registry.js.map