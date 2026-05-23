import * as fs from "node:fs";

let lockFd: number | null = null;

/**
 * Acquires an advisory POSIX flock on the given file path.
 * Synchronous to simplify the surrounding async code.
 */
export function flockSync(lockFile: string): boolean {
  if (lockFd !== null) return true; // already held in this process
  try {
    const exists = fs.existsSync(lockFile);
    if (!exists) {
      fs.writeFileSync(lockFile, "", "utf-8");
    }
    const fd = fs.openSync(lockFile, "r+");

    // Try non-blocking lock first
    try {
      // @ts-ignore — flockSync is a Unix-specific Node.js extension not in @types/node
      (fs as any).flockSync(fd, (fs.constants as any).LOCK_EX | (fs.constants as any).LOCK_NB);
    } catch {
      // Fallback: blocking lock
      // @ts-ignore
      (fs as any).flockSync(fd, (fs.constants as any).LOCK_EX);
    }

    lockFd = fd;
    return true;
  } catch {
    return false;
  }
}

/**
 * Releases the flock if held.
 */
export function funlock(): void {
  if (lockFd === null) return;
  try {
    // @ts-ignore
    fs.flockSync(lockFd, (fs.constants as any).LOCK_UN);
    fs.closeSync(lockFd);
  } catch { /* ignore */ }
  lockFd = null;
}

/**
 * Runs a synchronous function inside a flock-guarded critical section.
 */
export function withFlock<T>(lockFile: string, fn: () => T): T {
  flockSync(lockFile);
  try {
    return fn();
  } finally {
    funlock();
  }
}

/**
 * Runs an async function inside a flock-guarded critical section.
 */
export async function withFlockAsync<T>(lockFile: string, fn: () => Promise<T>): Promise<T> {
  flockSync(lockFile);
  try {
    return await fn();
  } finally {
    funlock();
  }
}
