// Quick add: "Call mum tomorrow at 6pm every week !high #home" → task fields.

import { addDays, isValidDate, mondayOf, normalizeTime, weekday } from "./dates.ts";
import type { Priority } from "./parse.ts";
import type { TaskFields } from "./edit.ts";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function cut(text: string, re: RegExp): { rest: string; match: RegExpExecArray | null } {
  const match = re.exec(text);
  if (!match) return { rest: text, match: null };
  return { rest: (text.slice(0, match.index) + " " + text.slice(match.index + match[0].length)), match };
}

/** The next date strictly after `today` that falls on weekday `want`. */
function nextWeekday(today: string, want: number): string {
  let d = addDays(today, 1) ?? today;
  for (let i = 0; i < 7 && weekday(d) !== want; i++) d = addDays(d, 1) ?? d;
  return d;
}

function dayIndex(word: string): number {
  return DAYS.findIndex((d) => d.startsWith(word.toLowerCase().slice(0, 3)));
}

export function parseQuickAdd(input: string, today: string): Pick<TaskFields, "description" | "tags" | "priority" | "recurrence" | "due" | "dueTime"> {
  let text = ` ${input} `;
  let m: RegExpExecArray | null;

  const tags: string[] = [];
  for (const t of text.matchAll(/\s#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu)) tags.push(t[1]!);
  text = text.replace(/\s#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu, " ");

  let priority: Priority | null = null;
  ({ rest: text, match: m } = cut(text, /\s!(highest|high|medium|low|lowest)(?=\s)/i));
  if (m) priority = m[1]!.toLowerCase() as Priority;

  let recurrence: string | null = null;
  ({ rest: text, match: m } = cut(text, /\bevery\s+(?:weekday|(?:other\s+|\d+\s+)?(?:day|week|month|year)s?|(?:sun|mon|tues?|wednes?|thur?s?|fri|sat)[a-z]*)(?=\s)/i));
  if (m) {
    recurrence = m[0].trim().toLowerCase().replace(/\s+/g, " ");
    const named = /^every ([a-z]+)$/.exec(recurrence);
    if (named) { const i = DAYS.findIndex((d) => d.startsWith(named[1]!.slice(0, 3)) && (d.startsWith(named[1]!) || named[1]!.length <= 4)); if (i >= 0 && named[1] !== "month") recurrence = `every ${DAYS[i]}`; }
  }

  let time: string | null = null;
  ({ rest: text, match: m } = cut(text, /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i));
  if (m) {
    let h = Number(m[1]);
    if (h >= 1 && h <= 12) { if (m[3]!.toLowerCase() === "pm" && h < 12) h += 12; if (m[3]!.toLowerCase() === "am" && h === 12) h = 0; time = normalizeTime(`${h}:${m[2] ?? "00"}`); }
  }
  if (!time) {
    ({ rest: text, match: m } = cut(text, /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i));
    if (m) time = normalizeTime(`${m[1]}:${m[2]}`);
  }

  let due: string | null = null;
  ({ rest: text, match: m } = cut(text, /\b(?:due\s+|on\s+)?(\d{4}-\d{2}-\d{2})\b/i));
  if (m && isValidDate(m[1]!)) due = m[1]!;
  else if (m) text += ` ${m[0]}`;
  if (!due) {
    ({ rest: text, match: m } = cut(text, /\b(?:due\s+|on\s+|by\s+)?(today|tonight|tomorrow|tmrw|next week|next month)\b/i));
    if (m) {
      const w = m[1]!.toLowerCase();
      if (w === "today" || w === "tonight") due = today;
      else if (w === "tomorrow" || w === "tmrw") due = addDays(today, 1);
      else if (w === "next week") due = addDays(mondayOf(today), 7);
      else due = addDays(today, 30);
    }
  }
  if (!due) {
    ({ rest: text, match: m } = cut(text, /\bin\s+(\d{1,3})\s+(day|week)s?\b/i));
    if (m) due = addDays(today, Number(m[1]) * (m[2]!.toLowerCase() === "week" ? 7 : 1));
  }
  if (!due) {
    ({ rest: text, match: m } = cut(text, /\b(?:due\s+|on\s+|by\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/i));
    if (m) due = nextWeekday(today, dayIndex(m[1]!));
  }
  if (!due && recurrence) {
    const named = /^every (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(recurrence);
    due = named ? nextWeekday(today, DAYS.indexOf(named[1]!)) : today;
  }
  if (!due && time) due = today;

  const description = text.replace(/\s+/g, " ").trim();
  return { description, tags, priority, recurrence, due, dueTime: due ? time : null };
}
