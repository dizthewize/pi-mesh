export declare function mkdirpSync(dir: string): void;
export declare function readJSON<T>(filePath: string): T | null;
export declare function writeJSON(filePath: string, data: unknown): void;
export declare function removeFile(filePath: string): void;
export declare function listJSONFiles(dir: string): string[];
export declare function generateAgentName(): string;
export declare function nowISO(): string;
export declare function isStale(lastSeenAt: string, thresholdMs?: number): boolean;
export declare function truncate(str: string, maxLen: number): string;
//# sourceMappingURL=utils.d.ts.map