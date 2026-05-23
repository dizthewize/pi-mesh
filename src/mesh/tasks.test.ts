import { TaskBoard } from "./tasks.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect } from "vitest";

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
    expect(task.id.startsWith("MESH-")).toBe(true);
    expect(task.status).toBe("open");
  });

  it("lists open tasks sorted by priority", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Low thing", description: "d", priority: "low" });
    board.add({ title: "Critical thing", description: "d", priority: "critical" });
    board.add({ title: "Medium thing", description: "d", priority: "medium" });
    const list = board.list({ status: "open" });
    expect(list[0].priority).toBe("critical");
    expect(list[1].priority).toBe("medium");
    expect(list[2].priority).toBe("low");
  });

  it("claims an open task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    const task = board.claim("MESH-001", "agent-1", "swift-raven");
    expect(task).toBeTruthy();
    expect(task!.status).toBe("claimed");
    expect(task!.claimedBy).toBe("agent-1");
  });

  it("returns null when claiming non-open task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    board.claim("MESH-001", "a1", "x");
    const second = board.claim("MESH-001", "a2", "y");
    expect(second).toBe(null);
  });

  it("unclaims a task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    board.claim("MESH-001", "a1", "x");
    const task = board.unclaim("MESH-001");
    expect(task!.status).toBe("open");
    expect(task!.claimedBy).toBe(undefined);
  });

  it("marks task done", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Auth", description: "d", priority: "high" });
    board.claim("MESH-001", "a1", "x");
    const done = board.markDone("MESH-001", "Done deal", "a1");
    expect(done!.status).toBe("complete");
    expect(done!.description.includes("Done deal")).toBe(true);
  });

  it("removes a task", () => {
    const tmp = tmpDir();
    const board = new TaskBoard({ meshDir: tmp });
    board.add({ title: "Temp", description: "d", priority: "low" });
    expect(board.remove("MESH-001")).toBe(true);
    expect(board.get("MESH-001")).toBe(null);
  });
});
