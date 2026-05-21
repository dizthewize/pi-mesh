import { describe, it } from "node:test";
import assert from "node:assert";
import { ProjectStateStore } from "./project-state.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "proj-state-test-"));
}

describe("ProjectStateStore", () => {
  it("loads and saves project state", () => {
    const tmp = tmpDir();
    const store = new ProjectStateStore(tmp);
    const state = store.load("/home/user/my-project");
    assert.strictEqual(state.cwd, "/home/user/my-project");
    assert.ok(state.projectHash);

    store.set(state, "pi-workflows", { wave: 2, status: "complete" });
    store.save(state);

    const reloaded = store.load("/home/user/my-project");
    const wf = store.get(reloaded, "pi-workflows") as { wave: number };
    assert.strictEqual(wf.wave, 2);
  });

  it("isolates different projects", () => {
    const tmp = tmpDir();
    const store = new ProjectStateStore(tmp);
    const s1 = store.load("/home/user/project-a");
    store.set(s1, "test", { value: 1 });
    store.save(s1);

    const s2 = store.load("/home/user/project-b");
    store.set(s2, "test", { value: 2 });
    store.save(s2);

    assert.strictEqual(store.get(store.load("/home/user/project-a"), "test")?.value, 1);
    assert.strictEqual(store.get(store.load("/home/user/project-b"), "test")?.value, 2);
  });

  it("lists tracked projects", () => {
    const tmp = tmpDir();
    const store = new ProjectStateStore(tmp);
    store.save(store.load("/home/user/proj1"));
    store.save(store.load("/home/user/proj2"));
    const list = store.list();
    assert.strictEqual(list.length, 2);
  });

  it("removes extension slice", () => {
    const tmp = tmpDir();
    const store = new ProjectStateStore(tmp);
    const s = store.load("/home/user/proj");
    store.set(s, "x", { data: 1 });
    store.remove(s, "x");
    assert.strictEqual(store.get(s, "x"), undefined);
  });
});
