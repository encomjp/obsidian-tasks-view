import test from "node:test";
import assert from "node:assert/strict";
import { advance, toggleLine } from "../src/recur.ts";

const WATER = "- [ ] Water 📅 2026-09-08 ⏳ 2026-09-07 🚀 2026-09-06 🔄 every day";

test("completing a recurring task writes the done line first", () => {
  const [done] = toggleLine(WATER, "2026-09-09");
  assert.equal(done, "- [x] Water 📅 2026-09-08 ⏳ 2026-09-07 🚀 2026-09-06 🔄 every day ✅ 2026-09-09");
});

test("completing a recurring task writes the next occurrence with every date moved from its own date", () => {
  // Bug: shiftDates() passes the match offset as the `tail` argument for two-group regexes,
  // so the copy gets "2026-09-0912" instead of "2026-09-09".
  assert.deepEqual(toggleLine(WATER, "2026-09-09"), [
    "- [x] Water 📅 2026-09-08 ⏳ 2026-09-07 🚀 2026-09-06 🔄 every day ✅ 2026-09-09",
    "- [ ] Water 📅 2026-09-09 ⏳ 2026-09-08 🚀 2026-09-07 🔄 every day",
  ]);
});

test("every 2 days from due 2026-09-09 moves the copy's due date to 2026-09-11", () => {
  assert.equal(advance("2026-09-09", "every 2 days"), "2026-09-11");
});

test("the copy shifts due, start and @scheduled, and keeps created unchanged", () => {
  // Bug: same shiftDates() tail-argument bug as above, so the copy's dates are corrupted.
  const [, copy] = toggleLine(
    "- [ ] Ship created: 2026-09-01 due: 2026-09-08 start: 2026-09-06 @scheduled(2026-09-07) 🔄 every 2 days",
    "2026-09-09",
  );
  assert.equal(copy, "- [ ] Ship created: 2026-09-01 due: 2026-09-10 start: 2026-09-08 @scheduled(2026-09-09) 🔄 every 2 days");
});

test("the created date is not moved when the copy is written", () => {
  const [, copy] = toggleLine(
    "- [ ] Ship created: 2026-09-01 due: 2026-09-08 start: 2026-09-06 @scheduled(2026-09-07) 🔄 every 2 days",
    "2026-09-09",
  );
  assert.ok(copy?.includes("created: 2026-09-01"));
});

test("advance supports weekday, 'other', named weekdays, and clamps months", () => {
  assert.equal(advance("2026-10-02", "every weekday"), "2026-10-05");
  assert.equal(advance("2026-10-02", "every other week"), "2026-10-16");
  assert.equal(advance("2026-10-02", "every monday"), "2026-10-05");
  assert.equal(advance("2026-01-31", "every month"), "2026-02-28");
  assert.equal(advance("2026-09-09", "every month"), "2026-10-09");
  assert.equal(advance("2026-09-09", "every year"), "2027-09-09");
});

test("advance returns null for out-of-range results instead of throwing", () => {
  assert.equal(advance("9999-12-31", "every month"), null);
});

test("advance returns null for zero, too large, or unknown rules", () => {
  assert.equal(advance("2026-09-09", "every 0 days"), null);
  assert.equal(advance("2026-09-09", "every 4000 days"), null);
  assert.equal(advance("2026-09-09", "every foo"), null);
});

test("a rule with a month-end anchor moves a due date from its own date, not from today", () => {
  assert.equal(advance("2026-09-12", "every week"), "2026-09-19");
});

test("completing a weekly task writes a copy due a week later", () => {
  // Bug: same shiftDates() tail-argument bug; the copy's due date is written as "2026-09-1919".
  const [, copy] = toggleLine("- [ ] Water plants 📅 2026-09-12 🔁 every week", "2026-09-10");
  assert.equal(copy, "- [ ] Water plants 📅 2026-09-19 🔁 every week");
});

test("completing a weekly task writes the done line with the stamp", () => {
  const [done] = toggleLine("- [ ] Water plants 📅 2026-09-12 🔁 every week", "2026-09-10");
  assert.equal(done, "- [x] Water plants 📅 2026-09-12 🔁 every week ✅ 2026-09-10");
});

test("unchecking removes the done stamp", () => {
  assert.deepEqual(toggleLine("- [x] a ✅ 2026-09-09", "2026-09-10"), ["- [ ] a"]);
  assert.deepEqual(toggleLine("- [x] a 📅 2026-09-09 ✅ 2026-09-10 ^b1", "2026-09-10"), ["- [ ] a 📅 2026-09-09 ^b1"]);
});

test("an undated recurring task completes without a copy", () => {
  assert.deepEqual(toggleLine("- [ ] nodue 🔄 every day", "2026-09-09"), ["- [x] nodue 🔄 every day ✅ 2026-09-09"]);
});

test("the block id stays at the end of the done line and is not copied", () => {
  const lines = toggleLine("- [ ] Water 📅 2026-09-09 🔄 every 2 days ^blk", "2026-09-09");
  assert.equal(lines[0], "- [x] Water 📅 2026-09-09 🔄 every 2 days ✅ 2026-09-09 ^blk");
  assert.equal(lines.length, 2);
  assert.equal(lines[1]?.includes("^blk"), false);
});

test("a non-recurring task produces a single done line with the stamp", () => {
  assert.deepEqual(toggleLine("- [ ] plain 📅 2026-09-09", "2026-09-09"), ["- [x] plain 📅 2026-09-09 ✅ 2026-09-09"]);
});

test("stamp=false completes a task without writing the done date", () => {
  assert.deepEqual(toggleLine("- [ ] plain 📅 2026-09-09", "2026-09-09", false), ["- [x] plain 📅 2026-09-09"]);
});

test("completing a task with an impossible date does not move it", () => {
  // An impossible date is not a date the parser recognises, so nothing moves and there is no copy.
  const [, copy] = toggleLine("- [ ] a 📅 2026-02-30 🔁 every day", "2026-09-10");
  assert.equal(copy, undefined);
});

test("a line that is not a task is returned unchanged", () => {
  assert.deepEqual(toggleLine("not a task", "2026-09-10"), ["not a task"]);
});
