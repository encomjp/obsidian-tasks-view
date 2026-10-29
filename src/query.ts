// The query language behind the raw query box and the filter controls, after Starnote's TaskQuery.
// One instruction per line, `#` starts a comment:
//   not done | done | no due date | due today | recurring | happens [date]
//   due before|after <date> | done after <date> | path|description|heading includes <text>
//   path|description|heading regex matches|does not match /<regex>/<flags>
//   tag <name> | priority [is] <level> | sort by due|description|priority|path [reverse]
//   group by filename|due|priority|status|tag|heading | limit <n>
// <date> is today, tomorrow, yesterday or yyyy-MM-dd.

import { addDays, isValidDate } from "./dates.ts";
import type { Priority, Task } from "./parse.ts";

export type SortKey = "due" | "description" | "priority" | "path";
export type GroupKey = "filename" | "due" | "priority" | "status" | "tag" | "heading";

export interface Query {
  filters: ((task: Task) => boolean)[];
  sort: { key: SortKey; reverse: boolean }[];
  group: GroupKey | null;
  limit: number | null;
  warnings: string[];
}

const RANK: Record<Priority | "none", number> = { highest: 0, high: 1, medium: 2, none: 3, low: 4, lowest: 5 };
const SORTS: SortKey[] = ["due", "description", "priority", "path"];
const GROUPS: GroupKey[] = ["filename", "due", "priority", "status", "tag", "heading"];

function resolveDate(word: string, today: string): string | null {
  const w = word.trim().toLowerCase();
  if (w === "today") return today;
  if (w === "tomorrow") return addDays(today, 1);
  if (w === "yesterday") return addDays(today, -1);
  return isValidDate(w) ? w : null;
}

function fieldValue(t: Task, field: string): string {
  return field === "path" ? t.path : field === "heading" ? t.heading ?? "" : t.description;
}

export function parseQuery(text: string, today: string): Query {
  const q: Query = { filters: [], sort: [], group: null, limit: null, warnings: [] };
  for (const original of text.split(/\r?\n/)) {
    const line = original.replace(/^\s+|\s+$/g, "");
    if (!line || line.startsWith("#")) continue;
    const lower = line.toLowerCase();
    let m: RegExpExecArray | null;
    const date = (word: string) => resolveDate(word, today);

    if (lower === "not done") q.filters.push((t) => !t.done);
    else if (lower === "done") q.filters.push((t) => t.done);
    else if (lower === "no due date") q.filters.push((t) => !t.due);
    else if (lower === "has due date") q.filters.push((t) => !!t.due);
    else if (lower === "due today") q.filters.push((t) => t.due === today);
    else if (lower === "recurring") q.filters.push((t) => !!t.recurrence);
    else if ((m = /^happens(?:\s+(on\s+)?(\S+))?$/.exec(lower))) {
      const when = m[2] ? date(m[2]) : today;
      if (!when) q.warnings.push(line);
      else q.filters.push((t) => t.due === when || t.scheduled === when || t.start === when);
    } else if ((m = /^due\s+(before|after|on)\s+(\S+)$/.exec(lower))) {
      const when = date(m[2]!);
      if (!when) q.warnings.push(line);
      else if (m[1] === "before") q.filters.push((t) => !!t.due && t.due < when);
      else if (m[1] === "after") q.filters.push((t) => !!t.due && t.due > when);
      else q.filters.push((t) => t.due === when);
    } else if ((m = /^done\s+(before|after|on)\s+(\S+)$/.exec(lower))) {
      const when = date(m[2]!);
      const at = (t: Task) => t.doneOn ?? t.due;
      if (!when) q.warnings.push(line);
      else if (m[1] === "before") q.filters.push((t) => t.done && !!at(t) && at(t)! < when);
      else if (m[1] === "after") q.filters.push((t) => t.done && !!at(t) && at(t)! > when);
      else q.filters.push((t) => t.done && at(t) === when);
    } else if ((m = /^(path|description|heading)\s+regex\s+(matches|does not match)\s+\/(.+)\/([a-z]*)$/i.exec(line))) {
      const field = m[1]!.toLowerCase();
      const negate = m[2]!.toLowerCase() !== "matches";
      let re: RegExp;
      try {
        // Without g and y, test() keeps no state between tasks.
        re = new RegExp(m[3]!, m[4]!.replace(/[gy]/g, ""));
      } catch {
        q.warnings.push(`Invalid regex in '${line}'.`);
        continue;
      }
      q.filters.push((t) => re.test(fieldValue(t, field)) !== negate);
    } else if ((m = /^(path|description|heading)\s+(includes|does not include)\s+(.+)$/i.exec(line))) {
      const needle = m[3]!.toLowerCase();
      const field = m[1]!.toLowerCase();
      const negate = m[2]!.toLowerCase() !== "includes";
      q.filters.push((t) => fieldValue(t, field).toLowerCase().includes(needle) !== negate);
    } else if ((m = /^tag(?:\s+includes)?\s+#?(\S+)$/i.exec(line))) {
      const want = m[1]!.toLowerCase();
      q.filters.push((t) => t.tags.some((tag) => tag.toLowerCase() === want));
    } else if ((m = /^priority(?:\s+is)?\s+(highest|high|medium|low|lowest|none)$/.exec(lower))) {
      const want = m[1]!;
      q.filters.push((t) => (t.priority ?? "none") === want);
    } else if ((m = /^sort by\s+(\S+)(\s+reverse)?$/.exec(lower))) {
      if (SORTS.includes(m[1] as SortKey)) q.sort.push({ key: m[1] as SortKey, reverse: !!m[2] });
      else q.warnings.push(`Can't sort by '${m[1]}'.`);
    } else if ((m = /^group by\s+(\S+)$/.exec(lower))) {
      if (GROUPS.includes(m[1] as GroupKey)) q.group = m[1] as GroupKey;
      else q.warnings.push(`Can't group by '${m[1]}'.`);
    } else if ((m = /^limit\s+(\d+)$/.exec(lower))) q.limit = Number(m[1]);
    else q.warnings.push(line);
  }
  return q;
}

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "due": return (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99") || (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
    case "priority": return RANK[a.priority ?? "none"] - RANK[b.priority ?? "none"];
    case "description": return a.description.localeCompare(b.description, undefined, { sensitivity: "base", numeric: true });
    default: return a.path.localeCompare(b.path, undefined, { sensitivity: "base", numeric: true }) || a.line - b.line;
  }
}

/** Applies filters, sorting (stable; ties fall back to note order) and the limit. */
export function runQuery(tasks: Task[], q: Query): Task[] {
  let out = tasks.filter((t) => q.filters.every((f) => f(t)));
  const keys = q.sort.length > 0 ? q.sort : [];
  out = [...out].sort((a, b) => {
    for (const { key, reverse } of keys) {
      const c = compare(a, b, key);
      if (c !== 0) return reverse ? -c : c;
    }
    return a.path.localeCompare(b.path) || a.line - b.line;
  });
  return q.limit !== null ? out.slice(0, q.limit) : out;
}

export interface Group {
  title: string;
  tasks: Task[];
}

export function groupTasks(tasks: Task[], key: GroupKey | "time" | null, today: string): Group[] {
  if (key === null) return [{ title: "", tasks }];
  const buckets = new Map<string, Task[]>();
  const add = (title: string, task: Task) => {
    const list = buckets.get(title);
    if (list) list.push(task);
    else buckets.set(title, [task]);
  };
  const week = addDays(today, 7) ?? today;
  for (const task of tasks) {
    switch (key) {
      case "time": {
        const day = task.due ?? task.scheduled;
        if (task.done) add("Done", task);
        else if (!day) add("Someday", task);
        else if (day < today) add("Overdue", task);
        else if (day === today) add("Today", task);
        else if (day <= week) add("Next 7 days", task);
        else add("Later", task);
        break;
      }
      case "filename": add(task.path.replace(/\.md$/i, "").split("/").pop() ?? task.path, task); break;
      case "due": add(task.due ?? "No due date", task); break;
      case "priority": add(task.priority ? task.priority[0]!.toUpperCase() + task.priority.slice(1) : "No priority", task); break;
      case "status": add(task.done ? "Done" : "Open", task); break;
      case "heading": add(task.heading ?? "(no heading)", task); break;
      case "tag":
        if (task.tags.length === 0) add("No tag", task);
        else for (const tag of task.tags) add("#" + tag, task);
        break;
    }
  }
  const order = key === "time" ? ["Overdue", "Today", "Next 7 days", "Later", "Someday", "Done"] : null;
  const titles = [...buckets.keys()];
  if (order) titles.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  else if (key === "priority") {
    const names = ["Highest", "High", "Medium", "No priority", "Low", "Lowest"];
    titles.sort((a, b) => names.indexOf(a) - names.indexOf(b));
  } else if (key === "due") titles.sort((a, b) => (a === "No due date" ? 1 : b === "No due date" ? -1 : a.localeCompare(b)));
  else titles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  return titles.map((title) => ({ title, tasks: buckets.get(title)! }));
}
