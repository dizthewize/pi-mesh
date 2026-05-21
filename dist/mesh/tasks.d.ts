import { MeshTask } from "../types.js";
export interface TaskBoardOptions {
    meshDir: string;
}
export declare class TaskBoard {
    private boardPath;
    private claimsDir;
    constructor(opts: TaskBoardOptions);
    private readBoard;
    private writeBoard;
    add(task: Omit<MeshTask, "id" | "createdAt" | "status">): MeshTask;
    remove(taskId: string): boolean;
    list(filter?: {
        status?: MeshTask["status"];
        tag?: string;
        priority?: MeshTask["priority"];
    }): MeshTask[];
    get(taskId: string): MeshTask | null;
    claim(taskId: string, agentId: string, agentName: string): MeshTask | null;
    unclaim(taskId: string): MeshTask | null;
    markDone(taskId: string, summary?: string, agentId?: string): MeshTask | null;
    markFailed(taskId: string, reason?: string): MeshTask | null;
}
//# sourceMappingURL=tasks.d.ts.map