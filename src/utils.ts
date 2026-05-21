import * as fs from "node:fs";
import * as path from "node:path";

export function mkdirpSync(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJSON<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeJSON(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  mkdirpSync(dir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function removeFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // best effort
  }
}

export function listJSONFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export function generateAgentName(): string {
  const adjectives = [
    "swift", "bold", "keen", "calm", "bright", "dark", "sharp", "wild", "silent", "quick",
    "lunar", "solar", "stellar", "quiet", "fierce", "gentle",
  ];
  const nouns = [
    "raven", "hawk", "deer", "fox", "owl", "wolf", "bear", "lynx", "crow", "falcon",
    "dust", "tree", "wave", "flame", "stone", "river",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${suffix}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isStale(lastSeenAt: string, thresholdMs = 60_000): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() > thresholdMs;
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}
