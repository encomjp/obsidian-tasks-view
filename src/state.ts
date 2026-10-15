// The filter state of the panel and how it becomes a query. Pure logic.

import { addDays, mondayOf } from "./dates.ts";
import type { GroupKey } from "./query.ts";

export type DueFilter = "any" | "overdue" | "today" | "todayoverdue" | "upcoming" | "next7" | "thisweek" | "none";
export type StatusFilter = "any" | "open" | "done";
export type DoneFilter = "any" | "today" | "week";
export type SortChoice = "due" | "priority" | "description" | "path";
export type GroupChoice = GroupKey | "time" | "none";
export type PresetId = "today" | "upcoming" | "inbox" | "week" | "open" | "all";

export interface ViewState {
  status: StatusFilter;
  due: DueFilter;
  completed: DoneFilter;
  priority: "any" | "highest" | "high" | "medium" | "low" | "lowest" | "none";
  tag: string;
  sort: SortChoice;
  group: GroupChoice;
  search: string;
  raw: string;
}

export const DEFAULT_VIEW: ViewState = { status: "open", due: "todayoverdue", completed: "any", priority: "any", tag: "", sort: "due", group: "time", search: "", raw: "" };

export const PRESETS: { id: PresetId; label: string; apply: Partial<ViewState> }[] = [
  { id: "today", label: "Today", apply: { status: "open", due: "todayoverdue", sort: "due", group: "time" } },
  { id: "upcoming", label: "Upcoming", apply: { status: "open", due: "upcoming", sort: "due", group: "time" } },
  { id: "inbox", label: "Inbox", apply: { status: "open", due: "none", sort: "path", group: "filename" } },
  { id: "week", label: "Done this week", apply: { status: "done", due: "any", completed: "week", sort: "due", group: "filename" } },
  { id: "open", label: "All open", apply: { status: "open", due: "any", sort: "due", group: "time" } },
  { id: "all", label: "Everything", apply: { status: "any", due: "any", completed: "any", sort: "due", group: "filename" } },
];

/** The preset whose settings match the state, or null for a custom filter. */
export function activePreset(state: ViewState): PresetId | null {
  for (const preset of PRESETS) {
    const merged = { ...DEFAULT_VIEW, priority: "any" as const, tag: "", search: "", raw: "", completed: "any" as const, ...preset.apply };
    if (merged.status === state.status && merged.due === state.due && merged.completed === state.completed
      && state.priority === "any" && !state.tag && !state.search && !state.raw) return preset.id;
  }
  return null;
}

/** Query text for the state; the raw query box is appended so it can refine the controls. */
export function stateToQuery(state: ViewState, today: string): string {
  const q: string[] = [];
  if (state.status === "open") q.push("not done");
  if (state.status === "done") {
    q.push("done");
    if (state.completed === "today") q.push("done on today");
    if (state.completed === "week") q.push(`done after ${addDays(mondayOf(today), -1)}`);
  }
  const monday = mondayOf(today);
  switch (state.due) {
    case "overdue": q.push("not done", "due before today"); break;
    case "today": q.push("due today"); break;
    case "todayoverdue": q.push("due before tomorrow"); break;
    case "upcoming": q.push("due after today"); break;
    case "next7": q.push("due after today", `due before ${addDays(today, 8)}`); break;
    case "thisweek": q.push(`due after ${addDays(monday, -1)}`, `due before ${addDays(monday, 7)}`); break;
    case "none": q.push("no due date"); break;
  }
  if (state.priority !== "any") q.push(`priority is ${state.priority}`);
  if (state.tag) q.push(`tag ${state.tag.replace(/^#/, "")}`);
  if (state.search.trim()) q.push(`description includes ${state.search.trim()}`);
  q.push(`sort by ${state.sort}`);
  if (state.raw.trim()) q.push(state.raw);
  return q.join("\n");
}
