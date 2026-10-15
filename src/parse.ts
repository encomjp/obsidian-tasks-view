// The task line grammar, after Starnote's TaskIndex (and compatible with the common emoji format):
//   - [ ] Title #tag 🔼 🔁 every week 🛫 2026-09-07 ⏳ 2026-09-08 📅 2026-09-09 14:00 ✅ 2026-09-10 ^block

import { isValidDate, normalizeTime } from "./dates.ts";

export type Priority = "highest" | "high" | "medium" | "low" | "lowest";

export interface Task {
  /** Vault path of the note. */
  path: string;
  /** 1-based line. */
  line: number;
  /** The line exactly as in the file. */
  raw: string;
  /** Everything before the box, e.g. "  - " or "1. ". */
  prefix: string;
  done: boolean;
  description: string;
  tags: string[];
  priority: Priority | null;
  recurrence: string | null;
  start: string | null;
  scheduled: string | null;
  scheduledTime: string | null;
  due: string | null;
  dueTime: string | null;
  created: string | null;
  doneOn: string | null;
  blockId: string | null;
  heading: string | null;
}

export const HEAD = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s*(.*)$/;

const DATE = "(\\d{4}-\\d{2}-\\d{2})";
const PRIORITY_MARKS: [Priority, string[]][] = [
  ["highest", ["🔺"]],
  ["high", ["⏫"]],
  ["medium", ["🔼", "🔘"]],
  ["low", ["🔽", "🔻"]],
  ["lowest", ["⏬", "⬇️", "⬇"]],
];
const ALL_MARKS = "📅⏳🛫🚀➕🗓✅🔺⏫🔼🔘🔽🔻⬇⏬🔄🔁";

type Field = "due" | "scheduled" | "start" | "created" | "done";

const FIELD_FORMS: Record<Field, { emoji: string[]; keyword: string; at: boolean }> = {
  due: { emoji: ["📅"], keyword: "due", at: true },
  scheduled: { emoji: ["⏳"], keyword: "scheduled", at: true },
  start: { emoji: ["🛫", "🚀"], keyword: "start", at: false },
  created: { emoji: ["➕", "🗓"], keyword: "created", at: false },
  done: { emoji: ["✅"], keyword: "done", at: false },
};

interface Found {
  from: number;
  to: number;
  date: string;
  time: string | null;
}

/** The first valid mark of a field: emoji, `due::` keyword, or `@due(...)`. Later ones are left alone. */
function findField(text: string, field: Field, allowTime: boolean): Found | null {
  const forms = FIELD_FORMS[field];
  const candidates: { from: number; to: number; date: string }[] = [];
  // `lead`: the pattern may start with one extra character (a word-boundary check without lookbehind).
  const collect = (re: RegExp, lead = false) => {
    for (const m of text.matchAll(re)) {
      const date = m[1]!;
      const skip = lead && /^\W/.test(m[0]) ? 1 : 0;
      if (isValidDate(date)) candidates.push({ from: m.index! + skip, to: m.index! + m[0].length, date });
    }
  };
  collect(new RegExp(`(?:${forms.emoji.join("|")})\\uFE0F?\\s*${DATE}`, "gu"));
  collect(new RegExp(`(?:^|\\W)${forms.keyword}\\s*:{1,2}\\s*${DATE}`, "gi"), true);
  if (forms.at) collect(new RegExp(`@${forms.keyword}\\(${DATE}\\)`, "gi"));
  if (candidates.length === 0) return null;
  const first = candidates.reduce((a, b) => (b.from < a.from ? b : a));
  let { to } = first;
  let time: string | null = null;
  if (allowTime) {
    const tail = /^\s+(\d{1,2}:\d{2})(?![\w:])/.exec(text.slice(to));
    const parsed = tail ? normalizeTime(tail[1]!) : null;
    if (tail && parsed) {
      time = parsed;
      to += tail[0].length;
    }
  }
  return { from: first.from, to, date: first.date, time };
}

function cut(text: string, found: Found): string {
  return text.slice(0, found.from) + " " + text.slice(found.to);
}

const TAG = /(^|[^\w#])#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu;

/** Parses one line; null when it is not a task. */
export function parseTaskLine(raw: string, path = "", line = 1, heading: string | null = null): Task | null {
  const head = HEAD.exec(raw);
  if (!head) return null;
  let rest = head[3]!;
  let blockId: string | null = null;
  const block = /\s\^([\w-]+)\s*$/.exec(" " + rest);
  if (block) {
    blockId = block[1]!;
    rest = (" " + rest).slice(0, block.index).trim();
  }

  const tags: string[] = [];
  rest = rest.replace(TAG, (_all, lead: string, name: string) => {
    if (!tags.includes(name)) tags.push(name);
    return lead + " ";
  });

  let recurrence: string | null = null;
  const rec = new RegExp(`[🔄🔁]\\uFE0F?\\s*([^${ALL_MARKS}@]*)`, "u").exec(rest);
  if (rec) {
    recurrence = rec[1]!.trim() || null;
    rest = rest.slice(0, rec.index) + " " + rest.slice(rec.index + rec[0].length);
  }

  const take = (field: Field, allowTime: boolean) => {
    const found = findField(rest, field, allowTime);
    if (found) rest = cut(rest, found);
    return found;
  };
  const due = take("due", true);
  const scheduled = take("scheduled", true);
  const start = take("start", false);
  const created = take("created", false);
  const done = take("done", true);

  let priority: Priority | null = null;
  let priorityAt = Infinity;
  for (const [name, marks] of PRIORITY_MARKS) {
    for (const mark of marks) {
      const at = rest.indexOf(mark);
      if (at >= 0 && at < priorityAt) {
        priorityAt = at;
        priority = name;
      }
    }
  }
  if (priority) for (const [, marks] of PRIORITY_MARKS) for (const mark of marks) rest = rest.split(mark + "️").join(" ").split(mark).join(" ");

  return {
    path, line, raw,
    prefix: head[1]!,
    done: head[2] !== " ",
    description: rest.replace(/\s+/g, " ").trim(),
    tags, priority, recurrence,
    start: start?.date ?? null,
    scheduled: scheduled?.date ?? null,
    scheduledTime: scheduled?.time ?? null,
    due: due?.date ?? null,
    dueTime: due?.time ?? null,
    created: created?.date ?? null,
    doneOn: done?.date ?? null,
    blockId,
    heading,
  };
}

/** Every task of a note, skipping front matter and fenced code. */
export function parseNote(text: string, path: string): Task[] {
  const tasks: Task[] = [];
  const lines = text.split(/\r?\n/);
  let heading: string | null = null;
  let fence: string | null = null;
  let i = 0;
  if (/^﻿?---\s*$/.test(lines[0] ?? "")) {
    const end = lines.findIndex((l, n) => n > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const marker = /^\s*(```+|~~~+)/.exec(line);
    if (marker) {
      const kind = marker[1]![0]!;
      if (fence === null) fence = kind;
      else if (fence === kind) fence = null;
      continue;
    }
    if (fence) continue;
    const h = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { heading = h[1]!; continue; }
    const task = parseTaskLine(line, path, i + 1, heading);
    if (task) tasks.push(task);
  }
  return tasks;
}
