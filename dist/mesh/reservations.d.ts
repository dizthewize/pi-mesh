import { MeshReservation } from "../types.js";
export interface ReservationOptions {
    meshDir: string;
}
export declare class ReservationStore {
    private dir;
    constructor(opts: ReservationOptions);
    /**
     * Reserve files for an agent. Returns the successful reservation.
     * Throws on collision with existing reservation.
     */
    reserve(agentId: string, agentName: string, files: string[], ttl?: number, taskId?: string): MeshReservation;
    /**
     * Release all reservations for an agent, or specific files.
     */
    release(agentId: string, files?: string[]): void;
    /**
     * Release reservations that have exceeded their TTL.
     */
    pruneExpired(): number;
    /**
     * Release all reservations for a set of agent IDs.
     */
    releaseAll(agentIds: string[]): void;
    /**@returns all active reservations. */
    list(): MeshReservation[];
    /** Check collision without reserving. */
    checkCollision(files: string[]): MeshReservation | null;
    private listUnsafe;
}
//# sourceMappingURL=reservations.d.ts.map