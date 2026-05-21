import * as fs from "node:fs";
import * as path from "node:path";
import { readJSON, writeJSON, listJSONFiles } from "../utils.js";
import { withFlock } from "./flock.js";
export class ReservationStore {
    dir;
    constructor(opts) {
        this.dir = path.join(opts.meshDir, "reservations");
        fs.mkdirSync(this.dir, { recursive: true });
    }
    /**
     * Reserve files for an agent. Returns the successful reservation.
     * Throws on collision with existing reservation.
     */
    reserve(agentId, agentName, files, ttl = 600_000, taskId) {
        const lockFile = path.join(this.dir, "..", ".lock");
        return withFlock(lockFile, () => {
            // Check collisions
            const existing = this.listUnsafe();
            for (const file of files) {
                const collider = existing.find((r) => r.files.includes(file));
                if (collider) {
                    throw new Error(`File "${file}" is reserved by ${collider.agentName} (${collider.agentId})`);
                }
            }
            const entry = {
                agentId,
                agentName,
                files,
                claimedAt: Date.now(),
                ttl,
                taskId,
            };
            writeJSON(path.join(this.dir, `${agentId}.json`), entry);
            return entry;
        });
    }
    /**
     * Release all reservations for an agent, or specific files.
     */
    release(agentId, files) {
        const lockFile = path.join(this.dir, "..", ".lock");
        withFlock(lockFile, () => {
            const filePath = path.join(this.dir, `${agentId}.json`);
            const entry = readJSON(filePath);
            if (!entry)
                return;
            if (files && files.length > 0) {
                entry.files = entry.files.filter((f) => !files.includes(f));
                if (entry.files.length > 0) {
                    writeJSON(filePath, entry);
                    return;
                }
            }
            // Full release
            try {
                fs.unlinkSync(filePath);
            }
            catch { /* ignore */ }
        });
    }
    /**
     * Release reservations that have exceeded their TTL.
     */
    pruneExpired() {
        const lockFile = path.join(this.dir, "..", ".lock");
        return withFlock(lockFile, () => {
            let pruned = 0;
            for (const file of listJSONFiles(this.dir)) {
                const entry = readJSON(file);
                if (!entry)
                    continue;
                const age = Date.now() - entry.claimedAt;
                if (age > entry.ttl) {
                    try {
                        fs.unlinkSync(file);
                        pruned++;
                    }
                    catch { /* ignore */ }
                }
            }
            return pruned;
        });
    }
    /**
     * Release all reservations for a set of agent IDs.
     */
    releaseAll(agentIds) {
        for (const id of agentIds) {
            this.release(id);
        }
    }
    /**@returns all active reservations. */
    list() {
        return listJSONFiles(this.dir)
            .map((f) => readJSON(f))
            .filter(Boolean);
    }
    /** Check collision without reserving. */
    checkCollision(files) {
        const lockFile = path.join(this.dir, "..", ".lock");
        return withFlock(lockFile, () => {
            for (const r of this.listUnsafe()) {
                for (const f of files) {
                    if (r.files.includes(f))
                        return r;
                }
            }
            return null;
        });
    }
    listUnsafe() {
        return listJSONFiles(this.dir)
            .map((f) => readJSON(f))
            .filter(Boolean);
    }
}
//# sourceMappingURL=reservations.js.map