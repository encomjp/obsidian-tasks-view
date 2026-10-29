import test from "node:test";
import assert from "node:assert/strict";
import { groupTasks, parseQuery, runQuery } from "../src/query.ts";
import { parseNote, type Task } from "../src/parse.ts";

const TODAY = "2026-09-09";

const SAMPLE = [
  "- [ ] a 📅 2026-09-08",
  "- [ ] b 📅 2026-09-09",
  "- [ ] c 📅 2026-09-10",
  "- [ ] d",
  "- [x] e 📅 2026-09-01 ✅ 2026-09-02",
  "- [ ] f ⏫ #x",
  "- [ ] g 🔁 every day",
  "- [ ] h #a #b",
].join("\n");

const sample = (): Task[] => parseNote(SAMPLE, "notes/a.md");
const names = (tasks: Task[]) => tasks.map((t) => t.description);
const run = (query: string, tasks = sample()) => {
  const q = parseQuery(query, TODAY);
  return { out: names(runQuery(tasks, q)), warnings: q.warnings, q };
};

test("'not done' plus 'due before tomorrow' keeps only tasks due today or earlier", () => {
  assert.deepEqual(run("not done\ndue before tomorrow").out, ["a", "b"]);
});

test("'sort by due reverse' puts undated tasks first, then latest due first", () => {
  assert.deepEqual(run("sort by due reverse").out, ["d", "f", "g", "h", "c", "b", "a", "e"]);
});

test("'sort by due' puts undated tasks last", () => {
  assert.deepEqual(run("sort by due").out, ["e", "a", "b", "c", "d", "f", "g", "h"]);
});

test("a misspelled instruction becomes a warning and filters nothing", () => {
  const r = run("due befor 2026-09-20");
  assert.deepEqual(r.warnings, ["due befor 2026-09-20"]);
  assert.equal(r.q.filters.length, 0);
  assert.equal(r.out.length, 8);
});

test("an unknown sort key is a warning", () => {
  assert.deepEqual(run("sort by color").warnings, ["Can't sort by 'color'."]);
});

test("an unknown group key is a warning", () => {
  assert.deepEqual(run("group by color").warnings, ["Can't group by 'color'."]);
});

test("comments and blank lines are ignored", () => {
  const r = run("# a comment\n\n   \nnot done");
  assert.deepEqual(r.warnings, []);
  assert.equal(r.q.filters.length, 1);
});

test("'path includes' and 'description includes' match case-insensitively", () => {
  assert.deepEqual(run("path includes NOTES").out.length, 8);
  assert.deepEqual(run("description includes c").out, ["c"]);
  assert.deepEqual(run("description does not include a").out.length, 7);
});

test("'heading includes' matches the heading of the note", () => {
  const tasks = parseNote("# Plan\n- [ ] one\n## Chores\n- [ ] two\n", "a.md");
  assert.deepEqual(names(runQuery(tasks, parseQuery("heading includes chore", TODAY))), ["two"]);
});

test("'regex matches' and 'regex does not match' test a field against a JavaScript regex", () => {
  const tasks = parseNote("# Plan\n- [ ] one\n## Chores 2026\n- [ ] two\n- [ ] none\n", "a.md");
  const run = (query: string) => {
    const q = parseQuery(query, TODAY);
    return { out: names(runQuery(tasks, q)), warnings: q.warnings };
  };
  assert.deepEqual(run("heading regex matches /^Chores \\d{4}$/").out, ["two", "none"]);
  assert.deepEqual(run("heading regex matches /chores/").out, []);
  assert.deepEqual(run("heading regex matches /chores/i").out, ["two", "none"]);
  assert.deepEqual(run("heading regex does not match /chores/i").out, ["one"]);
  assert.deepEqual(run("description regex matches /^(one|two)$/").out, ["one", "two"]);
  assert.deepEqual(run("heading regex matches /a/g").out, ["one"]);
  const bad = run("heading regex matches /(/");
  assert.equal(bad.warnings.length, 1);
  assert.equal(bad.out.length, 3);
});

test("'tag' selects tasks carrying the tag, with or without #", () => {
  assert.deepEqual(run("tag x").out, ["f"]);
  assert.deepEqual(run("tag #a").out, ["h"]);
});

test("'priority is high' selects only high priority tasks", () => {
  assert.deepEqual(run("priority is high").out, ["f"]);
  assert.deepEqual(run("priority none").out, ["a", "b", "c", "d", "e", "g", "h"]);
});

test("'limit' keeps the first n results after sorting", () => {
  assert.deepEqual(run("sort by due\nlimit 2").out, ["e", "a"]);
});

test("'happens' matches due, scheduled or start on the given day, default today", () => {
  assert.deepEqual(run("happens").out, ["b"]);
  assert.deepEqual(run("happens tomorrow").out, ["c"]);
});

test("'due today' and 'no due date' select the expected tasks", () => {
  assert.deepEqual(run("due today").out, ["b"]);
  assert.deepEqual(run("no due date").out, ["d", "f", "g", "h"]);
});

test("'recurring' selects tasks with a recurrence", () => {
  assert.deepEqual(run("recurring").out, ["g"]);
});

test("'done after' and 'done before' use the completion date", () => {
  assert.deepEqual(run("done after 2026-09-01").out, ["e"]);
  assert.deepEqual(run("done before 2026-09-01").out, []);
});

test("sorting ties fall back to note order", () => {
  const tasks = parseNote("- [ ] one\n- [ ] two\n- [ ] three\n", "a.md");
  assert.deepEqual(names(runQuery(tasks, parseQuery("sort by path", TODAY))), ["one", "two", "three"]);
});

test("groupTasks by time puts buckets in Overdue, Today, Next 7 days, Later, Someday, Done order", () => {
  const tasks = parseNote(
    [
      "- [ ] later 📅 2026-10-30",
      "- [x] done 📅 2026-09-01 ✅ 2026-09-02",
      "- [ ] someday",
      "- [ ] soon 📅 2026-09-14",
      "- [ ] today 📅 2026-09-09",
      "- [ ] overdue 📅 2026-09-01",
    ].join("\n"),
    "a.md",
  );
  const groups = groupTasks(tasks, "time", TODAY);
  assert.deepEqual(groups.map((g) => g.title), ["Overdue", "Today", "Next 7 days", "Later", "Someday", "Done"]);
  assert.deepEqual(groups.map((g) => names(g.tasks)), [["overdue"], ["today"], ["soon"], ["later"], ["someday"], ["done"]]);
});

test("groupTasks by tag puts a multi-tag task in each tag group", () => {
  const groups = groupTasks(sample(), "tag", TODAY);
  const h = groups.filter((g) => names(g.tasks).includes("h")).map((g) => g.title);
  assert.deepEqual(h, ["#a", "#b"]);
});

test("groupTasks with no key returns one untitled group", () => {
  const groups = groupTasks(sample(), null, TODAY);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.tasks.length, 8);
});

test("groupTasks by due puts 'No due date' last", () => {
  const groups = groupTasks(sample(), "due", TODAY);
  assert.equal(groups[groups.length - 1]?.title, "No due date");
});
