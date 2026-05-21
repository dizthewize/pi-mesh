import * as fs from "node:fs";
import * as path from "node:path";
import { readJSON, writeJSON, nowISO } from "../utils.js";
import { withFlock } from "./flock.js";
export class TaskBoard {
    boardPath;
    claimsDir;
    constructor(opts) {
        this.boardPath = path.join(opts.meshDir, "tasks", "board.json");
        this.claimsDir = path.join(opts.meshDir, "claims");
        fs.mkdirSync(path.dirname(this.boardPath), { recursive: true });
        fs.mkdirSync(this.claimsDir, { recursive: true });
    }
    readBoard() {
        return readJSON(this.boardPath) ?? [];
    }
    writeBoard(tasks) {
        writeJSON(this.boardPath, tasks);
    }
    add(task) {
        const lockFile = path.join(this.boardPath, "..", "..", ".lock");
        return withFlock(lockFile, () => {
            const tasks = this.readBoard();
            const id = `MESH-${String(tasks.length + 1).padStart(3, "0")}`;
            const full = {
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
    remove(taskId) {
        const lockFile = path.join(this.boardPath, "..", "..", ".lock");
        return withFlock(lockFile, () => {
            const tasks = this.readBoard();
            const idx = tasks.findIndex((t) => t.id === taskId);
            if (idx === -1)
                return false;
            tasks.splice(idx, 1);
            this.writeBoard(tasks);
            return true;
        });
    }
    list(filter) {
        let tasks = this.readBoard();
        if (filter?.status)
            tasks = tasks.filter((t) => t.status === filter.status);
        if (filter?.tag)
            tasks = tasks.filter((t) => t.tags?.includes(filter.tag));
        if (filter?.priority)
            tasks = tasks.filter((t) => t.priority === filter.priority);
        // Sort by priority
        const pMap = { critical: 0, high: 1, medium: 2, low: 3 };
        tasks.sort((a, b) => pMap[a.priority] - pMap[b.priority]);
        return tasks;
    }
    get(taskId) {
        return this.readBoard().find((t) => t.id === taskId) ?? null;
    }
    claim(taskId, agentId, agentName) {
        const lockFile = path.join(this.boardPath, "..", "..", ".lock");
        return withFlock(lockFile, () => {
            const tasks = this.readBoard();
            const task = tasks.find((t) => t.id === taskId);
            if (!task || task.status !== "open")
                return null;
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
    unclaim(taskId) {
        const lockFile = path.join(this.boardPath, "..", "..", ".lock");
        return withFlock(lockFile, () => {
            const tasks = this.readBoard();
            const task = tasks.find((t) => t.id === taskId);
            if (!task)
                return null;
            task.status = "open";
            task.claimedBy = undefined;
            task.claimedByName = undefined;
            task.claimedAt = undefined;
            this.writeBoard(tasks);
            try {
                fs.unlinkSync(path.join(this.claimsDir, `${taskId}.json`));
            }
            catch { /* ignore */ }
            return task;
        });
    }
    markDone(taskId, summary, agentId) {
        const lockFile = path.join(this.boardPath, "..", "..", ".lock");
        return withFlock(lockFile, () => {
            const tasks = this.readBoard();
            const task = tasks.find((t) => t.id === taskId);
            if (!task)
                return null;
            task.status = "complete";
            task.completedAt = nowISO();
            if (summary) {
                task.description += `\n\n[Done by ${agentId ?? task.claimedBy}] ${summary}`;
            }
            this.writeBoard(tasks);
            return task;
        });
    }
    markFailed(taskId, reason) {
        const lockFile = path.join(this.boardPath, "..", "..", ".lock");
        return withFlock(lockFile, () => {
            const tasks = this.readBoard();
            const task = tasks.find((t) => t.id === taskId);
            if (!task)
                return null;
            task.status = "failed";
            if (reason) {
                task.description += `\n\n[Failed] ${reason}`;
            }
            this.writeBoard(tasks);
            return task;
        });
    }
}
//# sourceMappingURL=tasks.js.map