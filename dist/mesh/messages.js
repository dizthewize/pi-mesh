import * as fs from "node:fs";
import * as path from "node:path";
import { readJSON, writeJSON, nowISO, listJSONFiles } from "../utils.js";
import { withFlock } from "./flock.js";
export class Inbox {
    dir;
    constructor(opts) {
        this.dir = path.join(opts.meshDir, "inbox");
        fs.mkdirSync(this.dir, { recursive: true });
    }
    send(params) {
        const msg = {
            id: crypto.randomUUID(),
            from: params.from,
            fromName: params.fromName,
            to: params.to,
            type: params.type ?? "dm",
            body: params.body,
            taskId: params.taskId,
            priority: params.priority ?? "normal",
            timestamp: nowISO(),
            read: {},
        };
        const lockFile = path.join(this.dir, "..", ".lock");
        withFlock(lockFile, () => {
            writeJSON(path.join(this.dir, `${Date.now()}-${msg.id}.json`), msg);
        });
        return msg;
    }
    inbox(agentId) {
        const all = listJSONFiles(this.dir)
            .map((f) => readJSON(f))
            .filter(Boolean);
        return all
            .filter((m) => m.to === agentId || m.to === "all" || m.from === agentId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    unreadFor(agentId) {
        return this.inbox(agentId).filter((m) => !m.read[agentId]);
    }
    markRead(messageId, agentId) {
        const lockFile = path.join(this.dir, "..", ".lock");
        withFlock(lockFile, () => {
            for (const file of listJSONFiles(this.dir)) {
                const msg = readJSON(file);
                if (!msg)
                    continue;
                if (msg.id === messageId) {
                    msg.read[agentId] = true;
                    writeJSON(file, msg);
                    return;
                }
            }
        });
    }
    /** Delete messages older than maxAgeMs. */
    prune(maxAgeMs = 86_400_000) {
        // default 24h
        const cutoff = Date.now() - maxAgeMs;
        let removed = 0;
        for (const file of listJSONFiles(this.dir)) {
            const msg = readJSON(file);
            if (!msg)
                continue;
            if (new Date(msg.timestamp).getTime() < cutoff) {
                try {
                    fs.unlinkSync(file);
                    removed++;
                }
                catch { /* ignore */ }
            }
        }
        return removed;
    }
}
//# sourceMappingURL=messages.js.map