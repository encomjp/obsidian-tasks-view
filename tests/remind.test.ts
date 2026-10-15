import test from "node:test";
import assert from "node:assert/strict";
import { dueBetween, reminderKey, timedMoment } from "../src/remind.ts";
import { parseTaskLine, type Task } from "../src/parse.ts";

const task = (line: string, path = "notes/today.md", lineNo = 1): Task => {
  const t = parseTaskLine(line, path, lineNo, null);
  assert.ok(t, `not a task: ${line}`);
  return t;
};

const at = (h: number, m: number) => new Date(2026, 8, 28, h, m);

test("a due date with a time fires at that local time", () => {
  assert.deepEqual(timedMoment(task("- [ ] x 📅 2026-09-28 14:00")), at(14, 0));
});

test("a due date without a time never fires", () => {
  assert.equal(timedMoment(task("- [ ] x 📅 2026-09-28")), null);
});

test("a due date without a time does not fall back to a scheduled time", () => {
  assert.equal(timedMoment(task("- [ ] x 📅 2026-09-28 ⏳ 2026-09-27 10:00")), null);
});

test("a scheduled time fires only when there is no due date", () => {
  assert.deepEqual(timedMoment(task("- [ ] x ⏳ 2026-09-27 10:00")), new Date(2026, 8, 27, 10, 0));
});

test("done tasks never fire", () => {
  assert.equal(timedMoment(task("- [x] x 📅 2026-09-28 14:00")), null);
});

test("a task fires in the window (last, now] and not outside it", () => {
  const t = task("- [ ] x 📅 2026-09-28 14:00");
  assert.equal(dueBetween([t], at(13, 59), at(14, 0)).length, 1, "fires at the window end");
  assert.equal(dueBetween([t], at(14, 0), at(14, 1)).length, 0, "does not fire at the window start");
  assert.equal(dueBetween([t], at(13, 0), at(13, 59)).length, 0, "does not fire before the time");
});

test("results are sorted by time, oldest first", () => {
  const late = task("- [ ] late 📅 2026-09-28 15:00", "a.md", 1);
  const early = task("- [ ] early 📅 2026-09-28 14:00", "a.md", 2);
  const none = task("- [ ] none 📅 2026-09-28", "a.md", 3);
  const hits = dueBetween([late, none, early], at(13, 0), at(16, 0));
  assert.deepEqual(hits.map((t) => t.description), ["early", "late"]);
});

test("reminderKey names the note, line and moment", () => {
  assert.equal(reminderKey(task("- [ ] x 📅 2026-09-28 14:00")), "notes/today.md:1@2026-09-28 14:00");
});

test("reminderKey changes when the time changes", () => {
  const a = reminderKey(task("- [ ] x 📅 2026-09-28 14:00"));
  const b = reminderKey(task("- [ ] x 📅 2026-09-28 15:00"));
  assert.notEqual(a, b);
});
