import test from "node:test";
import assert from "node:assert/strict";
import { buildLine, fieldsOf, findAnchor, isTaskLine, newTaskLine } from "../src/edit.ts";
import { parseTaskLine } from "../src/parse.ts";

test("newTaskLine writes fields in the canonical order", () => {
  const line = newTaskLine({
    description: "Measure parallax angle",
    tags: ["astro", "#observing"],
    priority: "medium",
    recurrence: "every week",
    start: "2026-09-29",
    scheduled: "2026-09-30",
    scheduledTime: "08:05",
    due: "2026-10-02",
    dueTime: "14:00",
  });
  assert.equal(
    line,
    "- [ ] Measure parallax angle #astro #observing 🔼 🔁 every week 🛫 2026-09-29 ⏳ 2026-09-30 08:05 📅 2026-10-02 14:00",
  );
});

test("a done task with doneOn is written with the done stamp last", () => {
  const line = newTaskLine({ description: "Done", done: true, due: "2026-09-01", doneOn: "2026-09-02" });
  assert.equal(line, "- [x] Done 📅 2026-09-01 ✅ 2026-09-02");
});

test("buildLine keeps the prefix and block id on a parsed task", () => {
  const original = "\t1. [ ] Measure parallax angle #astro #observing 🔼 🔁 every week 🛫 2026-09-29 ⏳ 2026-09-30 08:05 📅 2026-10-02 14:00 ^r1";
  const t = parseTaskLine(original);
  assert.ok(t);
  assert.equal(buildLine(t.prefix, fieldsOf(t)), original);
});

test("buildLine round-trips a parsed done task", () => {
  const original = "- [x] Done 📅 2026-09-01 ✅ 2026-09-02";
  const t = parseTaskLine(original);
  assert.ok(t);
  assert.equal(buildLine(t.prefix, fieldsOf(t)), original);
});

test("fieldsOf copies the tags array so edits do not alias the task", () => {
  const t = parseTaskLine("- [ ] a #x");
  assert.ok(t);
  const f = fieldsOf(t);
  f.tags.push("y");
  assert.deepEqual(t.tags, ["x"]);
});

test("buildLine writes a tag with a leading # only once", () => {
  const line = buildLine("- ", { done: false, description: "a", tags: ["#x"], priority: null, recurrence: null, start: null, scheduled: null, scheduledTime: null, due: null, dueTime: null, created: null, doneOn: null, blockId: null });
  assert.equal(line, "- [ ] a #x");
});

test("findAnchor uses the recorded line when it still matches", () => {
  assert.equal(findAnchor(["a", "b", "c"], 2, "b"), 1);
});

test("findAnchor falls back to the first exact match when the line moved", () => {
  assert.equal(findAnchor(["a", "b", "c"], 3, "b"), 1);
});

test("findAnchor returns -1 when the line is gone", () => {
  assert.equal(findAnchor(["a"], 1, "z"), -1);
});

test("isTaskLine recognises task lines only", () => {
  assert.equal(isTaskLine("- [ ] a"), true);
  assert.equal(isTaskLine("1. [x] a"), true);
  assert.equal(isTaskLine("- text"), false);
});
