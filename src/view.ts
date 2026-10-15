import { ItemView, Menu, TFile, type WorkspaceLeaf } from "obsidian";
import { addDays, daysBetween, localToday, mondayOf } from "./dates.ts";
import { fieldsOf } from "./edit.ts";
import { parseQuickAdd } from "./natural.ts";
import type { Priority, Task } from "./parse.ts";
import { groupTasks, parseQuery, runQuery, type GroupKey } from "./query.ts";
import { activePreset, PRESETS, stateToQuery, type ViewState } from "./state.ts";
import type TasksViewPlugin from "./main.ts";

export const VIEW_TYPE = "tasks-view-panel";

const PRIORITY_LABEL: Record<Priority, string> = { highest: "Highest", high: "High", medium: "Medium", low: "Low", lowest: "Lowest" };

export class TasksPanel extends ItemView {
  private readonly plugin: TasksViewPlugin;
  private listEl!: HTMLElement;
  private controlsEl!: HTMLElement;
  private warnEl!: HTMLElement;
  private presetEl!: HTMLElement;
  private advanced = false;

  constructor(leaf: WorkspaceLeaf, plugin: TasksViewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Tasks"; }
  override getIcon() { return "check-square"; }

  override async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("tv-panel");
    const head = this.contentEl.createDiv({ cls: "tv-head" });
    this.presetEl = head.createDiv({ cls: "tv-presets" });
    const add = head.createEl("button", { cls: "tv-add", text: "+", attr: { "aria-label": "New task" } });
    add.addEventListener("click", () => this.plugin.newTask());
    const quick = this.contentEl.createEl("input", { type: "text", cls: "tv-quick", attr: { placeholder: "Quick add: call mum tomorrow 6pm every week !high #home" } });
    quick.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !quick.value.trim()) return;
      const fields = parseQuickAdd(quick.value, localToday());
      if (!fields.description) return;
      quick.value = "";
      void this.plugin.store.add(this.plugin.settings.defaultNote, fields);
    });
    this.controlsEl = this.contentEl.createDiv({ cls: "tv-controls" });
    this.warnEl = this.contentEl.createDiv({ cls: "tv-warn" });
    this.listEl = this.contentEl.createDiv({ cls: "tv-list" });
    this.register(this.plugin.store.onChange(() => this.renderList()));
    this.renderHead();
    this.renderList();
  }

  private get state(): ViewState { return this.plugin.view; }

  private change(patch: Partial<ViewState>) {
    Object.assign(this.plugin.view, patch);
    this.plugin.saveViewState();
    this.renderHead();
    this.renderList();
  }

  private renderHead() {
    const s = this.state;
    this.presetEl.empty();
    const current = activePreset(s);
    for (const preset of PRESETS.slice(0, 4)) {
      const b = this.presetEl.createEl("button", { text: preset.label, cls: "tv-chip" + (current === preset.id ? " is-active" : "") });
      if (preset.id === "today" || preset.id === "inbox") {
        const n = this.presetCount(preset.apply);
        if (n > 0) b.createSpan({ cls: "tv-chip-count", text: String(n) });
      }
      b.addEventListener("click", () => this.change({ ...preset.apply, priority: "any", tag: "", search: "", raw: "", completed: preset.apply.completed ?? "any" }));
    }
    const more = this.presetEl.createEl("button", { text: "More", cls: "tv-chip" + (current === "open" || current === "all" || current === null ? " is-active" : "") });
    more.addEventListener("click", (e) => {
      const menu = new Menu();
      for (const preset of PRESETS.slice(4)) menu.addItem((i) => i.setTitle(preset.label).setChecked(current === preset.id).onClick(() => this.change({ ...preset.apply, priority: "any", tag: "", search: "", raw: "" })));
      menu.showAtMouseEvent(e);
    });

    this.controlsEl.empty();
    const row1 = this.controlsEl.createDiv({ cls: "tv-row" });
    const search = row1.createEl("input", { type: "search", placeholder: "Search tasks…", cls: "tv-search" });
    search.value = s.search;
    search.addEventListener("input", () => { this.plugin.view.search = search.value; this.plugin.saveViewState(); this.renderList(); });
    const toggle = row1.createEl("button", { text: this.advanced ? "Less" : "Filters", cls: "tv-chip" });
    toggle.addEventListener("click", () => { this.advanced = !this.advanced; this.renderHead(); });
    if (!this.advanced) return;

    const row2 = this.controlsEl.createDiv({ cls: "tv-row tv-selects" });
    this.select(row2, "Status", s.status, { any: "Any status", open: "Open", done: "Done" }, (v) => this.change({ status: v as ViewState["status"] }));
    this.select(row2, "Due", s.due, { any: "Any due date", overdue: "Overdue", today: "Due today", todayoverdue: "Today & overdue", upcoming: "Upcoming", next7: "Next 7 days", thisweek: "This week", none: "No due date" }, (v) => this.change({ due: v as ViewState["due"] }));
    if (s.status === "done") this.select(row2, "Completed", s.completed, { any: "Any time", today: "Today", week: "This week" }, (v) => this.change({ completed: v as ViewState["completed"] }));
    this.select(row2, "Priority", s.priority, { any: "Any priority", highest: "Highest", high: "High", medium: "Medium", low: "Low", lowest: "Lowest", none: "No priority" }, (v) => this.change({ priority: v as ViewState["priority"] }));
    const tags: Record<string, string> = { "": "Any tag" };
    for (const tag of this.plugin.allTags()) tags[tag] = "#" + tag;
    this.select(row2, "Tag", s.tag, tags, (v) => this.change({ tag: v }));
    const row3 = this.controlsEl.createDiv({ cls: "tv-row tv-selects" });
    this.select(row3, "Sort", s.sort, { due: "Sort: due date", priority: "Sort: priority", description: "Sort: title", path: "Sort: note" }, (v) => this.change({ sort: v as ViewState["sort"] }));
    this.select(row3, "Group", s.group, { time: "Group: time", filename: "Group: note", tag: "Group: tag", priority: "Group: priority", heading: "Group: heading", status: "Group: status", none: "No grouping" }, (v) => this.change({ group: v as ViewState["group"] }));
    const raw = this.controlsEl.createEl("textarea", { cls: "tv-raw", attr: { rows: "3", placeholder: "Query, one line each, e.g.\ntag work\npriority is high\nsort by due reverse" } });
    raw.value = s.raw;
    raw.addEventListener("input", () => { this.plugin.view.raw = raw.value; this.plugin.saveViewState(); this.renderList(); });
  }

  private presetCount(apply: Partial<ViewState>): number {
    const today = localToday();
    const state: ViewState = { ...this.state, ...apply, priority: "any", tag: "", search: "", raw: "", completed: apply.completed ?? "any" };
    return runQuery(this.plugin.store.all(), parseQuery(stateToQuery(state, today), today)).length;
  }

  private select(parent: HTMLElement, label: string, value: string, options: Record<string, string>, on: (v: string) => void) {
    const el = parent.createEl("select", { cls: "dropdown", attr: { "aria-label": label } });
    for (const [key, text] of Object.entries(options)) el.createEl("option", { value: key, text });
    el.value = value in options ? value : Object.keys(options)[0]!;
    el.addEventListener("change", () => on(el.value));
  }

  renderList() {
    if (!this.listEl) return;
    const today = localToday();
    const s = this.state;
    const query = parseQuery(stateToQuery(s, today), today);
    const tasks = runQuery(this.plugin.store.all(), query);
    this.warnEl.empty();
    for (const w of query.warnings) this.warnEl.createDiv({ text: `Not understood: ${w}` });
    this.listEl.empty();
    if (tasks.length === 0) {
      this.listEl.createDiv({ cls: "tv-empty", text: this.plugin.store.all().length === 0 ? "No tasks yet. Write one as - [ ] Buy milk 📅 2026-10-20, or press +." : "Nothing matches." });
      return;
    }
    const groups = groupTasks(tasks, s.group === "none" ? null : (s.group as GroupKey | "time"), today);
    for (const group of groups) {
      const section = this.listEl.createDiv({ cls: "tv-group" });
      if (group.title) {
        const title = section.createDiv({ cls: "tv-group-title" });
        title.createSpan({ text: group.title });
        title.createSpan({ cls: "tv-count", text: String(group.tasks.length) });
        if (group.title === "Overdue") title.addClass("is-overdue");
      }
      for (const task of group.tasks) this.renderTask(section, task, today);
    }
  }

  private renderTask(parent: HTMLElement, task: Task, today: string) {
    const row = parent.createDiv({ cls: "tv-task" + (task.done ? " is-done" : "") + (task.priority ? ` p-${task.priority}` : "") });
    const box = row.createEl("input", { type: "checkbox", cls: "tv-box" });
    box.checked = task.done;
    box.addEventListener("click", (e) => { e.stopPropagation(); void this.plugin.store.toggle(task); });
    const body = row.createDiv({ cls: "tv-body" });
    body.createDiv({ cls: "tv-title", text: task.description || "(untitled)" });
    const meta = body.createDiv({ cls: "tv-meta" });
    const day = task.due ?? task.scheduled;
    if (day) {
      const time = task.due ? task.dueTime : task.scheduledTime;
      const overdue = !task.done && day < today;
      meta.createSpan({ cls: "tv-date" + (overdue ? " is-overdue" : day === today ? " is-today" : ""), text: `${task.due ? "" : "⏳ "}${dayLabel(day, today)}${time ? " " + time : ""}` });
    }
    if (task.recurrence) meta.createSpan({ cls: "tv-recur", text: "🔁 " + task.recurrence });
    if (task.priority) meta.createSpan({ cls: "tv-prio", text: PRIORITY_LABEL[task.priority] });
    for (const tag of task.tags) meta.createSpan({ cls: "tv-tag", text: "#" + tag });
    const note = meta.createSpan({ cls: "tv-note", text: task.path.replace(/\.md$/i, "").split("/").pop() });
    note.addEventListener("click", (e) => { e.stopPropagation(); void this.openNote(task); });
    row.addEventListener("click", () => this.plugin.editTask(task));
    row.addEventListener("contextmenu", (e) => {
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("Edit…").setIcon("pencil").onClick(() => this.plugin.editTask(task)));
      menu.addItem((i) => i.setTitle("Open in note").setIcon("file-text").onClick(() => void this.openNote(task)));
      menu.addItem((i) => i.setTitle(task.done ? "Mark open" : "Mark done").setIcon("check").onClick(() => void this.plugin.store.toggle(task)));
      if (!task.done) {
        menu.addSeparator();
        const to = (label: string, date: string | null) => menu.addItem((i) => i.setTitle(label).setIcon("calendar").onClick(() => void this.reschedule(task, date)));
        to("Due today", today);
        to("Due tomorrow", addDays(today, 1));
        to("Due next week", addDays(mondayOf(today), 7));
        if (task.due) {
          to("Push back one day", addDays(task.due, 1));
          to("Remove due date", null);
        }
      }
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Delete").setIcon("trash").onClick(() => void this.plugin.store.remove(task)));
      menu.showAtMouseEvent(e);
    });
  }

  private async reschedule(task: Task, date: string | null) {
    const fields = fieldsOf(task);
    fields.due = date;
    if (!date) fields.dueTime = null;
    await this.plugin.store.update(task, fields);
  }

  async openNote(task: Task) {
    const file = this.app.vault.getAbstractFileByPath(task.path);
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file, { eState: { line: task.line - 1 } });
  }
}

export function dayLabel(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const text = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC", ...(diff < -300 || diff > 300 ? { year: "numeric" } : {}) });
  return text;
}

