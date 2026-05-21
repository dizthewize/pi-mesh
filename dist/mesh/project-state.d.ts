export interface ProjectState {
    projectHash: string;
    cwd: string;
    updatedAt: string;
    extensions: Record<string, unknown>;
}
export declare class ProjectStateStore {
    private projectsDir;
    constructor(meshDir: string);
    private hashCwd;
    private statePath;
    /** Load or initialize project state. */
    load(cwd: string): ProjectState;
    /** Persist project state. */
    save(state: ProjectState): void;
    /** Get an extension's slice of state. */
    get<T = unknown>(state: ProjectState, ext: string): T | undefined;
    /** Set an extension's slice of state. */
    set<T>(state: ProjectState, ext: string, data: T): ProjectState;
    /** Remove an extension's slice. */
    remove(state: ProjectState, ext: string): ProjectState;
    /** List all tracked projects. */
    list(): ProjectState[];
}
//# sourceMappingURL=project-state.d.ts.map