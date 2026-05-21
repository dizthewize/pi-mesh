/**
 * Acquires an advisory POSIX flock on the given file path.
 * Synchronous to simplify the surrounding async code.
 */
export declare function flockSync(lockFile: string): boolean;
/**
 * Releases the flock if held.
 */
export declare function funlock(): void;
/**
 * Runs a synchronous function inside a flock-guarded critical section.
 */
export declare function withFlock<T>(lockFile: string, fn: () => T): T;
/**
 * Runs an async function inside a flock-guarded critical section.
 */
export declare function withFlockAsync<T>(lockFile: string, fn: () => Promise<T>): Promise<T>;
//# sourceMappingURL=flock.d.ts.map