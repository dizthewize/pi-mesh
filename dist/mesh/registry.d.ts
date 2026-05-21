import { MeshAgent } from "../types.js";
export interface RegistryOptions {
    meshDir: string;
    staleThresholdMs?: number;
    autoPrune?: boolean;
}
export declare class Registry {
    private dir;
    private staleMs;
    private autoPrune;
    constructor(opts: RegistryOptions);
    register(agent: Omit<MeshAgent, "lastSeenAt">): MeshAgent;
    heartbeat(agentId: string): void;
    remove(agentId: string): void;
    list(): MeshAgent[];
    get(agentId: string): MeshAgent | null;
    /** Prune stale agents and release their reservations. Returns pruned ids. */
    prune(): string[];
    private pruneUnsafe;
    rename(agentId: string, newName: string): boolean;
}
//# sourceMappingURL=registry.d.ts.map