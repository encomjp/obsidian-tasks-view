import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "../src/natural.ts";

const TODAY = "2026-10-15"; // Thursday

test("plain text stays a title", () => {
  const r = parseQuickAdd("Buy milk", TODAY);
  assert.deepEqual([r.description, r.due, r.dueTime, r.recurrence, r.priority, r.tags], ["Buy milk", null, null, null, null, []]);
});

test("tomorrow, time, tag and priority", () => {
  const r = parseQuickAdd("Call mum tomorrow at 6pm #home !high", TODAY);
  assert.equal(r.description, "Call mum");
  assert.equal(r.due, "2026-10-16");
  assert.equal(r.dueTime, "18:00");
  assert.equal(r.priority, "high");
  assert.deepEqual(r.tags, ["home"]);
});

test("weekday names and next week", () => {
  assert.equal(parseQuickAdd("Report friday", TODAY).due, "2026-10-16");
  assert.equal(parseQuickAdd("Report next monday", TODAY).due, "2026-10-19");
  assert.equal(parseQuickAdd("Plan next week", TODAY).due, "2026-10-19");
  assert.equal(parseQuickAdd("Thursday thing thursday", TODAY).due, "2026-10-22");
});

test("relative days, ISO dates and 24h times", () => {
  assert.equal(parseQuickAdd("Renew in 3 days", TODAY).due, "2026-10-18");
  assert.equal(parseQuickAdd("Renew in 2 weeks", TODAY).due, "2026-10-29");
  const r = parseQuickAdd("Standup 2026-11-02 09:30", TODAY);
  assert.deepEqual([r.description, r.due, r.dueTime], ["Standup", "2026-11-02", "09:30"]);
  assert.equal(parseQuickAdd("Bad 2026-02-31", TODAY).due, null);
});

test("recurrence", () => {
  const r = parseQuickAdd("Water plants every 2 weeks", TODAY);
  assert.deepEqual([r.description, r.recurrence, r.due], ["Water plants", "every 2 weeks", TODAY]);
  const w = parseQuickAdd("Gym every mon", TODAY);
  assert.deepEqual([w.recurrence, w.due], ["every monday", "2026-10-19"]);
  assert.equal(parseQuickAdd("Pay rent every month on 2026-11-01", TODAY).recurrence, "every month");
});

test("a time alone means today; am/pm edge cases", () => {
  assert.deepEqual([parseQuickAdd("Lunch at 12pm", TODAY).due, parseQuickAdd("Lunch at 12pm", TODAY).dueTime], [TODAY, "12:00"]);
  assert.equal(parseQuickAdd("Wake 12am", TODAY).dueTime, "00:00");
  assert.equal(parseQuickAdd("Meet 5:30 pm", TODAY).dueTime, "17:30");
});
