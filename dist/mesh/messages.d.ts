import { MeshMessage } from "../types.js";
export interface InboxOptions {
    meshDir: string;
}
export declare class Inbox {
    private dir;
    constructor(opts: InboxOptions);
    send(params: {
        from: string;
        fromName: string;
        to: string;
        body: string;
        type?: MeshMessage["type"];
        taskId?: string;
        priority?: MeshMessage["priority"];
    }): MeshMessage;
    inbox(agentId: string): MeshMessage[];
    unreadFor(agentId: string): MeshMessage[];
    markRead(messageId: string, agentId: string): void;
    /** Delete messages older than maxAgeMs. */
    prune(maxAgeMs?: number): number;
}
//# sourceMappingURL=messages.d.ts.map