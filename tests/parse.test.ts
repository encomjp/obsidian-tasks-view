import test from "node:test";
import assert from "node:assert/strict";
import { parseNote, parseTaskLine } from "../src/parse.ts";

const task = (line: string) => parseTaskLine(line, "notes/a.md", 1, null);

test("parses every field of a full emoji task line", () => {
  const t = task("- [ ] Write report 🔺 📅 2026-09-09 ⏳ 2026-09-08 🚀 2026-09-07 🗓 2026-09-01 🔄 every week #work");
  assert.ok(t);
  assert.equal(t.done, false);
  assert.equal(t.description, "Write report");
  assert.equal(t.due, "2026-09-09");
  assert.equal(t.scheduled, "2026-09-08");
  assert.equal(t.start, "2026-09-07");
  assert.equal(t.created, "2026-09-01");
  assert.equal(t.priority, "highest");
  assert.equal(t.recurrence, "every week");
  assert.deepEqual(t.tags, ["work"]);
});

test("numbered list items parse and 🔘 is medium priority", () => {
  const t = task("1. [ ] Inbox 🔘 📅 2026-09-10");
  assert.ok(t);
  assert.equal(t.prefix, "1. ");
  assert.equal(t.priority, "medium");
  assert.equal(t.description, "Inbox");
  assert.equal(t.due, "2026-09-10");
});

test("keyword form due: and start emoji with ⏫", () => {
  const t = task("- [ ] Fly 🛫 2026-09-07 ⏫ due: 2026-09-11");
  assert.ok(t);
  assert.equal(t.priority, "high");
  assert.equal(t.start, "2026-09-07");
  assert.equal(t.due, "2026-09-11");
  assert.equal(t.description, "Fly");
});

test("@due() and scheduled: forms are recognised and removed from the description", () => {
  const t = task("- [ ] Call @due(2026-09-15) scheduled: 2026-09-14");
  assert.ok(t);
  assert.equal(t.description, "Call");
  assert.equal(t.due, "2026-09-15");
  assert.equal(t.scheduled, "2026-09-14");
});

test("a time after a date is captured as dueTime, and keyword times too", () => {
  const pay = task("- [ ] Pay rent 📅 2026-09-28 14:00");
  assert.ok(pay);
  assert.equal(pay.dueTime, "14:00");
  assert.equal(pay.description, "Pay rent");

  const standup = task("- [ ] Standup due: 2026-09-28 9:30");
  assert.ok(standup);
  assert.equal(standup.dueTime, "09:30");
  assert.equal(standup.description, "Standup");
});

test("an invalid time is left in the description and dueTime is null", () => {
  const t = task("- [ ] Weird 📅 2026-09-28 25:99");
  assert.ok(t);
  assert.equal(t.dueTime, null);
  assert.equal(t.due, "2026-09-28");
  assert.equal(t.description, "Weird 25:99");
});

test("only the first valid due mark is used; later ones stay in the description", () => {
  const t = task("- [ ] Twice 📅 2026-09-28 14:00 📅 2026-09-29 16:00");
  assert.ok(t);
  assert.equal(t.due, "2026-09-28");
  assert.equal(t.dueTime, "14:00");
});

test("a time that does not directly follow the date is not captured", () => {
  const t = task("- [ ] Pay rent 📅 2026-09-28 at 14:00 sharp");
  assert.ok(t);
  assert.equal(t.dueTime, null);
  assert.equal(t.description, "Pay rent at 14:00 sharp");
});

test("the priority mark and the date are removed from the description wherever they sit", () => {
  const t = task("- [ ] ⏫ 📅 2026-09-20 Buy milk ⏳ 2026-09-18");
  assert.ok(t);
  assert.equal(t.description, "Buy milk");
  assert.equal(t.priority, "high");
  assert.equal(t.due, "2026-09-20");
  assert.equal(t.scheduled, "2026-09-18");
});

test("a completed task records doneOn", () => {
  const t = task("- [x] Finished ✅ 2026-09-28");
  assert.ok(t);
  assert.equal(t.done, true);
  assert.equal(t.doneOn, "2026-09-28");
});

test("a done stamp with a time still yields the date and a clean description", () => {
  // Bug: the done stamp is parsed without a time, so " 14:00" stays in the description.
  // recur.ts's DONE_STAMP does accept a time after the done date, so the parser should too.
  const t = task("- [x] Finished ✅ 2026-09-28 14:00");
  assert.ok(t);
  assert.equal(t.done, true);
  assert.equal(t.doneOn, "2026-09-28");
  assert.equal(t.description, "Finished");
});

test("an impossible date such as 2026-02-30 is not a date and stays in the description", () => {
  const t = task("- [ ] Impossible 📅 2026-02-30");
  assert.ok(t);
  assert.equal(t.due, null);
  assert.equal(t.description, "Impossible 📅 2026-02-30");
});

test("a block id at the end is captured and removed from the description", () => {
  const t = task("- [ ] x ^blk1");
  assert.ok(t);
  assert.equal(t.blockId, "blk1");
  assert.equal(t.description, "x");
});

test("tags are collected without duplicates and without the leading #", () => {
  const t = task("- [ ] Plan #work #home #work");
  assert.ok(t);
  assert.deepEqual(t.tags, ["work", "home"]);
  assert.equal(t.description, "Plan");
});

test("the prefix keeps indentation and blockquote markers", () => {
  assert.equal(task("  - [ ] indented")?.prefix, "  - ");
  assert.equal(task("> - [ ] quoted 📅 2026-09-09")?.prefix, "> - ");
  assert.equal(task("> - [ ] quoted 📅 2026-09-09")?.description, "quoted");
});

test("non-task lines return null", () => {
  assert.equal(task("- text"), null);
  assert.equal(task("[ ] no marker"), null);
  assert.equal(task("# Heading"), null);
  assert.equal(task(""), null);
});

test("parseNote records 1-based line numbers and the current heading", () => {
  const tasks = parseNote("# Tasks\n\n- [ ] first\n- [ ] second\n- [ ] third\n", "a.md");
  assert.deepEqual(tasks.map((t) => t.line), [3, 4, 5]);
  assert.deepEqual(tasks.map((t) => t.heading), ["Tasks", "Tasks", "Tasks"]);
  assert.deepEqual(tasks.map((t) => t.path), ["a.md", "a.md", "a.md"]);
});

test("parseNote skips front matter and fenced code blocks", () => {
  const text = "---\ntitle: x\n---\n- [ ] fm\n```\n- [ ] code\n```\n- [ ] after\n";
  const tasks = parseNote(text, "a.md");
  assert.deepEqual(tasks.map((t) => [t.line, t.description]), [[4, "fm"], [8, "after"]]);
});

test("parseNote handles CRLF line endings", () => {
  const tasks = parseNote("- [ ] a\r\n- [ ] b\r\n", "a.md");
  assert.deepEqual(tasks.map((t) => [t.line, t.description]), [[1, "a"], [2, "b"]]);
});
