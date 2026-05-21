import * as fs from "node:fs";
let lockFd = null;
/**
 * Acquires an advisory POSIX flock on the given file path.
 * Synchronous to simplify the surrounding async code.
 */
export function flockSync(lockFile) {
    if (lockFd !== null)
        return true; // already held in this process
    try {
        const exists = fs.existsSync(lockFile);
        if (!exists) {
            fs.writeFileSync(lockFile, "", "utf-8");
        }
        const fd = fs.openSync(lockFile, "r+");
        // Try non-blocking lock first
        try {
            fs.flockSync(fd, fs.constants.LOCK_EX | fs.constants.LOCK_NB);
        }
        catch {
            // Fallback: blocking lock
            fs.flockSync(fd, fs.constants.LOCK_EX);
        }
        lockFd = fd;
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Releases the flock if held.
 */
export function funlock() {
    if (lockFd === null)
        return;
    try {
        fs.flockSync(lockFd, fs.constants.LOCK_UN);
        fs.closeSync(lockFd);
    }
    catch { /* ignore */ }
    lockFd = null;
}
/**
 * Runs a synchronous function inside a flock-guarded critical section.
 */
export function withFlock(lockFile, fn) {
    flockSync(lockFile);
    try {
        return fn();
    }
    finally {
        funlock();
    }
}
/**
 * Runs an async function inside a flock-guarded critical section.
 */
export async function withFlockAsync(lockFile, fn) {
    flockSync(lockFile);
    try {
        return await fn();
    }
    finally {
        funlock();
    }
}
//# sourceMappingURL=flock.js.map