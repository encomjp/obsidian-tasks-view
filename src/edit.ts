// Writing a task back to a line. Edits rebuild the line in Starnote's canonical order:
//   title #tags 🔼 🔁 rule 🛫 start ⏳ scheduled 📅 due ✅ done ^block

import { HEAD, type Priority, type Task } from "./parse.ts";

export const PRIORITY_MARK: Record<Priority, string> = { highest: "🔺", high: "⏫", medium: "🔼", low: "🔽", lowest: "⏬" };

export interface TaskFields {
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
}

export function fieldsOf(task: Task): TaskFields {
  const { done, description, tags, priority, recurrence, start, scheduled, scheduledTime, due, dueTime, created, doneOn, blockId } = task;
  return { done, description, tags: [...tags], priority, recurrence, start, scheduled, scheduledTime, due, dueTime, created, doneOn, blockId };
}

export function buildLine(prefix: string, f: TaskFields): string {
  const parts: string[] = [f.description.trim()];
  for (const tag of f.tags) parts.push("#" + tag.replace(/^#/, ""));
  if (f.priority) parts.push(PRIORITY_MARK[f.priority]);
  if (f.recurrence) parts.push(`🔁 ${f.recurrence.trim()}`);
  if (f.created) parts.push(`➕ ${f.created}`);
  if (f.start) parts.push(`🛫 ${f.start}`);
  if (f.scheduled) parts.push(`⏳ ${f.scheduled}${f.scheduledTime ? " " + f.scheduledTime : ""}`);
  if (f.due) parts.push(`📅 ${f.due}${f.dueTime ? " " + f.dueTime : ""}`);
  if (f.done && f.doneOn) parts.push(`✅ ${f.doneOn}`);
  if (f.blockId) parts.push(`^${f.blockId}`);
  return `${prefix}[${f.done ? "x" : " "}] ${parts.filter(Boolean).join(" ")}`.replace(/\s+$/, "");
}

/** A brand-new open task line. */
export function newTaskLine(fields: Partial<TaskFields> & { description: string }): string {
  return buildLine("- ", {
    done: false, tags: [], priority: null, recurrence: null, start: null, scheduled: null, scheduledTime: null,
    due: null, dueTime: null, created: null, doneOn: null, blockId: null, ...fields,
  });
}

/** Index of the line to edit: the recorded line if it still matches, else the first exact match, else -1. */
export function findAnchor(lines: string[], line: number, raw: string): number {
  if (lines[line - 1] === raw) return line - 1;
  return lines.indexOf(raw);
}

export function isTaskLine(line: string): boolean {
  return HEAD.test(line);
}
