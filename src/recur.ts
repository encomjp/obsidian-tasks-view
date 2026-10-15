// Recurrence and completion, after Starnote's ToggleLine: completing a recurring task writes the
// done line and a fresh copy below it with every date moved forward from its own date.

import { addDays, addMonths, addYears, isValidDate, weekday } from "./dates.ts";
import { HEAD, parseTaskLine } from "./parse.ts";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The date after `date` under a rule like "every 2 weeks", or null when the rule is unknown. */
export function advance(date: string, rule: string): string | null {
  const text = rule.trim().toLowerCase();
  if (/^every\s+weekday\b/.test(text)) {
    let next = addDays(date, 1);
    while (next && [0, 6].includes(weekday(next))) next = addDays(next, 1);
    return next;
  }
  const named = /^every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(text);
  if (named) {
    const want = WEEKDAYS.indexOf(named[1]!);
    let next = addDays(date, 1);
    for (let i = 0; i < 7 && next && weekday(next) !== want; i++) next = addDays(next, 1);
    return next;
  }
  const unit = /^every\s+(?:(\d+)\s+|(other)\s+)?(day|week|month|year)s?\b/.exec(text);
  if (!unit) return null;
  const step = unit[2] ? 2 : unit[1] ? Number(unit[1]) : 1;
  if (!Number.isInteger(step) || step < 1 || step > 3650) return null;
  switch (unit[3]) {
    case "day": return addDays(date, step);
    case "week": return addDays(date, step * 7);
    case "month": return addMonths(date, step);
    default: return addYears(date, step);
  }
}

const DONE_STAMP = /\s*(?:✅️?\s*\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2})?|\bdone\s*:{1,2}\s*\d{4}-\d{2}-\d{2})/giu;
const BLOCK = /\s\^[\w-]+\s*$/;

/** Moves due/scheduled/start dates (emoji, keyword or @form) with `fn`; reports whether any changed. */
function shiftDates(line: string, fn: (date: string) => string | null): { line: string; moved: boolean } {
  let moved = false;
  const shift = (all: string, head: string, date: string, tail: string): string => {
    const next = isValidDate(date) ? fn(date) : null;
    if (!next) return all;
    moved = true;
    return head + next + tail;
  };
  let out = line.replace(/((?:📅|⏳|🛫|🚀)\uFE0F?\s*)(\d{4}-\d{2}-\d{2})/gu, (all, head: string, date: string) => shift(all, head, date, ""));
  out = out.replace(/(\b(?:due|scheduled|start)\s*:{1,2}\s*)(\d{4}-\d{2}-\d{2})/gi, (all, head: string, date: string) => shift(all, head, date, ""));
  out = out.replace(/(@(?:due|scheduled)\()(\d{4}-\d{2}-\d{2})(\))/gi, (all, head: string, date: string, tail: string) => shift(all, head, date, tail));
  return { line: out, moved };
}

/** The lines that replace `raw` after toggling it: [done line, optional next occurrence], or [open line]. */
export function toggleLine(raw: string, today: string, stamp = true): string[] {
  const head = HEAD.exec(raw);
  if (!head) return [raw];
  if (head[2] !== " ") {
    // Uncheck: drop the stamp, keep the rest.
    return [raw.replace(/\[[xX]\]/, "[ ]").replace(DONE_STAMP, "").replace(/\s+$/, "")];
  }
  const task = parseTaskLine(raw);
  const block = BLOCK.exec(raw);
  const base = block ? raw.slice(0, block.index) : raw;
  const done = base.replace(/\[ \]/, "[x]").replace(DONE_STAMP, "").replace(/\s+$/, "") + (stamp ? ` ✅ ${today}` : "") + (block ? block[0] : "");
  if (!task?.recurrence) return [done];
  const rule = task.recurrence;
  const { line: next, moved } = shiftDates(base.replace(DONE_STAMP, ""), (date) => advance(date, rule));
  return moved ? [done, next.replace(/\[[xX]\]/, "[ ]").replace(/\s+$/, "")] : [done];
}
