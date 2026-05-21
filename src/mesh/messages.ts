import * as fs from "node:fs";
import * as path from "node:path";
import { MeshMessage } from "../types.js";
import { readJSON, writeJSON, nowISO, listJSONFiles } from "../utils.js";
import { withFlock } from "./flock.js";

export interface InboxOptions {
  meshDir: string;
}

export class Inbox {
  private dir: string;

  constructor(opts: InboxOptions) {
    this.dir = path.join(opts.meshDir, "inbox");
    fs.mkdirSync(this.dir, { recursive: true });
  }

  send(params: {
    from: string;
    fromName: string;
    to: string; // agent id or "all"
    body: string;
    type?: MeshMessage["type"];
    taskId?: string;
    priority?: MeshMessage["priority"];
  }): MeshMessage {
    const msg: MeshMessage = {
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
      writeJSON(
        path.join(this.dir, `${Date.now()}-${msg.id}.json`),
        msg
      );
    });

    return msg;
  }

  inbox(agentId: string): MeshMessage[] {
    const all = listJSONFiles(this.dir)
      .map((f) => readJSON<MeshMessage>(f))
      .filter(Boolean) as MeshMessage[];

    return all
      .filter(
        (m) => m.to === agentId || m.to === "all" || m.from === agentId
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  unreadFor(agentId: string): MeshMessage[] {
    return this.inbox(agentId).filter((m) => !m.read[agentId]);
  }

  markRead(messageId: string, agentId: string): void {
    const lockFile = path.join(this.dir, "..", ".lock");
    withFlock(lockFile, () => {
      for (const file of listJSONFiles(this.dir)) {
        const msg = readJSON<MeshMessage>(file);
        if (!msg) continue;
        if (msg.id === messageId) {
          msg.read[agentId] = true;
          writeJSON(file, msg);
          return;
        }
      }
    });
  }

  /** Delete messages older than maxAgeMs. */
  prune(maxAgeMs: number = 86_400_000): number {
    // default 24h
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const file of listJSONFiles(this.dir)) {
      const msg = readJSON<MeshMessage>(file);
      if (!msg) continue;
      if (new Date(msg.timestamp).getTime() < cutoff) {
        try {
          fs.unlinkSync(file);
          removed++;
        } catch { /* ignore */ }
      }
    }
    return removed;
  }
}
