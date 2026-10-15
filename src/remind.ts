// Reminders for timed tasks, after Starnote's Reminders.cs. Only tasks with a time of day fire.

import { toLocal } from "./dates.ts";
import type { Task } from "./parse.ts";

/** The moment a task should remind: its timed due, else its timed scheduled date (only when there is no due date). */
export function timedMoment(task: Task): Date | null {
  if (task.done) return null;
  if (task.due) return task.dueTime ? toLocal(task.due, task.dueTime) : null;
  if (task.scheduled && task.scheduledTime) return toLocal(task.scheduled, task.scheduledTime);
  return null;
}

/** Tasks whose moment falls in (last, now], oldest first. */
export function dueBetween(tasks: Task[], last: Date, now: Date): Task[] {
  const hits: { task: Task; at: number }[] = [];
  for (const task of tasks) {
    const at = timedMoment(task)?.getTime();
    if (at !== undefined && at > last.getTime() && at <= now.getTime()) hits.push({ task, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.task);
}

/** The same task at a new time is a new reminder. */
export function reminderKey(task: Task): string {
  const date = task.due ?? task.scheduled;
  const time = task.due ? task.dueTime : task.scheduledTime;
  return `${task.path}:${task.line}@${date} ${time}`;
}
