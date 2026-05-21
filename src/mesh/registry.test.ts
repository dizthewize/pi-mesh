import { describe, it } from "node:test";
import assert from "node:assert";
import { Registry } from "./registry.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "registry-test-"));
}

describe("Registry", () => {
  it("registers an agent", () => {
    const tmp = tmpDir();
    const reg = new Registry({ meshDir: tmp });
    const agent = reg.register({
      id: "a1",
      name: "swift-raven-42",
      model: "default",
      cwd: "/home/proj",
      sessionStartedAt: new Date().toISOString(),
      status: "idle",
      reservedFiles: [],
    });
    assert.strictEqual(agent.id, "a1");
    assert.ok(agent.lastSeenAt);
  });

  it("lists active agents", () => {
    const tmp = tmpDir();
    const reg = new Registry({ meshDir: tmp });
    reg.register({ id: "a1", name: "x", model: "m", cwd: "/a", sessionStartedAt: "", status: "idle", reservedFiles: [] });
    reg.register({ id: "a2", name: "y", model: "m", cwd: "/b", sessionStartedAt: "", status: "idle", reservedFiles: [] });
    const list = reg.list();
    assert.strictEqual(list.length, 2);
  });

  it("heartbeats update lastSeenAt", () => {
    const tmp = tmpDir();
    const reg = new Registry({ meshDir: tmp });
    const agent = reg.register({ id: "a1", name: "x", model: "m", cwd: "/a", sessionStartedAt: "", status: "idle", reservedFiles: [] });
    const before = agent.lastSeenAt;
    // wait a tick
    const start = Date.now();
    while (Date.now() - start < 50) {} // busy wait ms
    reg.heartbeat("a1");
    const after = reg.get("a1")?.lastSeenAt;
    assert.ok(after);
    assert.ok(new Date(after!).getTime() >= new Date(before).getTime());
  });

  it("removes an agent", () => {
    const tmp = tmpDir();
    const reg = new Registry({ meshDir: tmp });
    reg.register({ id: "a1", name: "x", model: "m", cwd: "/a", sessionStartedAt: "", status: "idle", reservedFiles: [] });
    reg.remove("a1");
    assert.strictEqual(reg.get("a1"), null);
  });

  it("prunes stale agents", () => {
    const tmp = tmpDir();
    const reg = new Registry({ meshDir: tmp, staleThresholdMs: 0 });
    reg.register({ id: "old", name: "x", model: "m", cwd: "/a", sessionStartedAt: "", status: "idle", reservedFiles: [] });
    // Override the registered agent's lastSeenAt to be in the past
    const agent = reg.get("old");
    if (agent) {
      agent.lastSeenAt = new Date(Date.now() - 1000).toISOString();
      fs.writeFileSync(
        path.join(tmp, "registry", "old.json"),
        JSON.stringify(agent, null, 2),
      );
    }
    const pruned = reg.prune();
    assert.deepStrictEqual(pruned, ["old"]);
    assert.strictEqual(reg.get("old"), null);
  });

  it("renames an agent", () => {
    const tmp = tmpDir();
    const reg = new Registry({ meshDir: tmp });
    reg.register({ id: "a1", name: "old", model: "m", cwd: "/a", sessionStartedAt: "", status: "idle", reservedFiles: [] });
    assert.strictEqual(reg.rename("a1", "new-name"), true);
    assert.strictEqual(reg.get("a1")?.name, "new-name");
    assert.strictEqual(reg.rename("ghost", "no"), false);
  });
});
