/**
 * Core type definitions for pi-mesh.
 */
export interface MeshAgent {
    id: string;
    name: string;
    model: string;
    cwd: string;
    sessionStartedAt: string;
    lastSeenAt: string;
    status: "idle" | "working" | "away";
    reservedFiles: string[];
    currentTaskId?: string;
    metadata?: Record<string, unknown>;
}
export interface MeshTask {
    id: string;
    title: string;
    description: string;
    status: "open" | "claimed" | "in_progress" | "complete" | "failed";
    claimedBy?: string;
    claimedByName?: string;
    files?: string[];
    tags?: string[];
    priority: "critical" | "high" | "medium" | "low";
    createdAt: string;
    claimedAt?: string;
    completedAt?: string;
    roleId?: string;
}
export interface MeshReservation {
    agentId: string;
    agentName: string;
    files: string[];
    claimedAt: number;
    ttl: number;
    taskId?: string;
}
export interface MeshMessage {
    id: string;
    from: string;
    fromName: string;
    to: string;
    type: "dm" | "broadcast" | "challenge" | "system";
    body: string;
    taskId?: string;
    priority: "normal" | "urgent";
    timestamp: string;
    read: Record<string, boolean>;
}
export interface MeshState {
    registry: Map<string, MeshAgent>;
    reservations: Map<string, MeshReservation>;
    tasks: MeshTask[];
    inbox: MeshMessage[];
}
export type MeshAction = "join" | "leave" | "status" | "list" | "rename" | "send" | "broadcast" | "challenge" | "inbox" | "reserve" | "release" | "claim" | "unclaim" | "task_list" | "task_show" | "task_done" | "project_state_get" | "project_state_set" | "contract_provide" | "contract_need" | "contract_list";
export interface PiMeshParams {
    action: MeshAction;
    name?: string;
    to?: string;
    message?: string;
    taskId?: string;
    paths?: string[];
    ttl?: number;
    status?: "idle" | "working" | "away";
    summary?: string;
    tagFilter?: string;
    priorityFilter?: MeshTask["priority"];
    ext?: string;
    data?: unknown;
    item?: string;
    signature?: string;
}
export interface PiMeshResult {
    status: "ok" | "error";
    message?: string;
    data?: unknown;
    inboxCount?: number;
    peers?: number;
}
//# sourceMappingURL=types.d.ts.map