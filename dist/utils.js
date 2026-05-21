import * as fs from "node:fs";
import * as path from "node:path";
export function mkdirpSync(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
export function readJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    catch {
        return null;
    }
}
export function writeJSON(filePath, data) {
    const dir = path.dirname(filePath);
    mkdirpSync(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
export function removeFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    }
    catch {
        // best effort
    }
}
export function listJSONFiles(dir) {
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => path.join(dir, f));
    }
    catch {
        return [];
    }
}
export function generateAgentName() {
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
export function nowISO() {
    return new Date().toISOString();
}
export function isStale(lastSeenAt, thresholdMs = 60_000) {
    return Date.now() - new Date(lastSeenAt).getTime() > thresholdMs;
}
export function truncate(str, maxLen) {
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}
//# sourceMappingURL=utils.js.map