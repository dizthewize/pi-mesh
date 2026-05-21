import { describe, it } from "node:test";
import assert from "node:assert";
import { TaskBoard } from "./tasks.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tasks-test-"));
}

describe("TaskBoard", () => {
  it("adds a task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    const task = board.add({
      title: "Auth types",
      description: "Create auth types",
      priority: "high",
      files: ["src/auth/types.ts"],
    });
    assert.ok(task.id.startsWith("MESH-"));
    assert.strictEqual(task.status, "open");
  });

  it("lists open tasks sorted by priority", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Low thing", description: "d", priority: "low" });
    board.add({ title: "Critical thing", description: "d", priority: "critical" });
    board.add({ title: "Medium thing", description: "d", priority: "medium" });
    const list = board.list({ status: "open" });
    assert.strictEqual(list[0].priority, "critical");
    assert.strictEqual(list[1].priority, "medium");
    assert.strictEqual(list[2].priority, "low");
  });

  it("claims an open task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    const task = board.claim("MESH-001", "agent-1", "swift-raven");
    assert.ok(task);
    assert.strictEqual(task!.status, "claimed");
    assert.strictEqual(task!.claimedBy, "agent-1");
  });

  it("returns null when claiming non-open task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    board.claim("MESH-001", "a1", "x");
    const second = board.claim("MESH-001", "a2", "y");
    assert.strictEqual(second, null);
  });

  it("unclaims a task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    board.claim("MESH-001", "a1", "x");
    const task = board.unclaim("MESH-001");
    assert.strictEqual(task!.status, "open");
    assert.strictEqual(task!.claimedBy, undefined);
  });

  it("marks task done", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    board.claim("MESH-001", "a1", "x");
    const done = board.markDone("MESH-001", "Done deal", "a1");
    assert.strictEqual(done!.status, "complete");
    assert.ok(done!.description.includes("Done deal"));
  });

  it("removes a task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Temp", description: "d", priority: "low" });
    assert.strictEqual(board.remove("MESH-001"), true);
    assert.strictEqual(board.get("MESH-001"), null);
  });
});
