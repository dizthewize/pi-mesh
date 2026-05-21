import { describe, it } from "node:test";
import assert from "node:assert";
import { Inbox } from "./messages.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
}

describe("Inbox", () => {
  it("sends a DM", () => {
    const tmp = tmpDir();
    const inbox = new Inbox({ meshDir: tmp });
    const msg = inbox.send({
      from: "a1",
      fromName: "swift",
      to: "a2",
      body: "auth is done",
    });
    assert.strictEqual(msg.to, "a2");
    assert.strictEqual(msg.body, "auth is done");
  });

  it("lists messages for recipient", () => {
    const tmp = tmpDir();
    const inbox = new Inbox({ meshDir: tmp });
    inbox.send({ from: "a1", fromName: "x", to: "a2", body: "hi" });
    inbox.send({ from: "a3", fromName: "y", to: "a1", body: "hey" });
    inbox.send({ from: "a1", fromName: "x", to: "all", body: "broadcast" });

    const a2Inbox = inbox.inbox("a2");
    assert.strictEqual(a2Inbox.length, 2); // dm + broadcast
    assert.ok(a2Inbox.some((m) => m.body === "hi"));
    assert.ok(a2Inbox.some((m) => m.body === "broadcast"));
  });

  it("tracks unread messages", () => {
    const tmp = tmpDir();
    const inbox = new Inbox({ meshDir: tmp });
    inbox.send({ from: "a1", fromName: "x", to: "a2", body: "hi" });
    assert.strictEqual(inbox.unreadFor("a2").length, 1);
    inbox.markRead(inbox.unreadFor("a2")[0].id, "a2");
    assert.strictEqual(inbox.unreadFor("a2").length, 0);
  });

  it("prunes old messages", () => {
    const tmp = tmpDir();
    const inbox = new Inbox({ meshDir: tmp });
    const msg = inbox.send({ from: "a1", fromName: "x", to: "a2", body: "old" });
    // Make the message file old by rewriting with an old timestamp
    const inboxDir = path.join(tmp, "inbox");
    const files = fs.readdirSync(inboxDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const p = path.join(inboxDir, file);
      const data = JSON.parse(fs.readFileSync(p, "utf-8"));
      data.timestamp = new Date(Date.now() - 1000).toISOString(); // 1 second old
      fs.writeFileSync(p, JSON.stringify(data, null, 2));
    }
    const removed = inbox.prune(0); // everything older than now
    assert.strictEqual(removed, 1);
    assert.strictEqual(inbox.inbox("a2").length, 0);
  });
});
