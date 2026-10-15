import { Modal, Setting, TFile, type App } from "obsidian";
import { isValidDate, normalizeTime } from "./dates.ts";
import { fieldsOf, type TaskFields } from "./edit.ts";
import type { Priority, Task } from "./parse.ts";

const REPEATS = ["every day", "every weekday", "every week", "every 2 weeks", "every month", "every year"];

export interface EditResult {
  fields: TaskFields;
  /** Only when creating: the note the task is added to. */
  path: string | null;
}

export class TaskModal extends Modal {
  private readonly task: Task | null;
  private readonly fields: TaskFields;
  private path: string;
  private readonly onSubmit: (result: EditResult) => void;
  private readonly onDelete: (() => void) | null;
  private readonly onOpen2: (() => void) | null;

  constructor(app: App, task: Task | null, defaultPath: string, handlers: { submit: (r: EditResult) => void; remove?: () => void; open?: () => void }) {
    super(app);
    this.task = task;
    this.path = defaultPath;
    this.onSubmit = handlers.submit;
    this.onDelete = handlers.remove ?? null;
    this.onOpen2 = handlers.open ?? null;
    this.fields = task
      ? fieldsOf(task)
      : { done: false, description: "", tags: [], priority: null, recurrence: null, start: null, scheduled: null, scheduledTime: null, due: null, dueTime: null, created: null, doneOn: null, blockId: null };
  }

  override onOpen() {
    const f = this.fields;
    this.titleEl.setText(this.task ? "Edit task" : "New task");
    const { contentEl } = this;
    contentEl.addClass("tv-modal");

    new Setting(contentEl).setName("Task").addText((t) => {
      t.setPlaceholder("What needs doing?").setValue(f.description).onChange((v) => (f.description = v));
      t.inputEl.addClass("tv-wide");
      window.setTimeout(() => t.inputEl.focus(), 30);
      t.inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") this.save(); });
    });
    this.dateRow(contentEl, "Due", f.due, f.dueTime, (d, t) => { f.due = d; f.dueTime = t; });
    this.dateRow(contentEl, "Scheduled", f.scheduled, f.scheduledTime, (d, t) => { f.scheduled = d; f.scheduledTime = t; });
    this.dateRow(contentEl, "Start", f.start, null, (d) => { f.start = d; }, false);

    new Setting(contentEl).setName("Repeat").addDropdown((d) => {
      d.addOption("", "Does not repeat");
      const known = REPEATS.includes(f.recurrence ?? "");
      for (const r of REPEATS) d.addOption(r, r[0]!.toUpperCase() + r.slice(1));
      if (f.recurrence && !known) d.addOption(f.recurrence, f.recurrence);
      d.setValue(f.recurrence ?? "").onChange((v) => (f.recurrence = v || null));
    });
    new Setting(contentEl).setName("Priority").addDropdown((d) => {
      d.addOptions({ "": "None", highest: "🔺 Highest", high: "⏫ High", medium: "🔼 Medium", low: "🔽 Low", lowest: "⏬ Lowest" });
      d.setValue(f.priority ?? "").onChange((v) => (f.priority = (v || null) as Priority | null));
    });
    new Setting(contentEl).setName("Tags").setDesc("Separated by spaces.").addText((t) => {
      t.setPlaceholder("work home").setValue(f.tags.join(" ")).onChange((v) => (f.tags = v.split(/[\s,]+/).map((x) => x.replace(/^#/, "")).filter((x) => /\p{L}/u.test(x))));
    });
    if (!this.task) {
      new Setting(contentEl).setName("Note").setDesc("Where the task is added. Created if it does not exist.").addText((t) => {
        t.setValue(this.path).onChange((v) => (this.path = v.trim()));
        t.inputEl.addClass("tv-wide");
      });
    }

    const bar = new Setting(contentEl);
    if (this.task && this.onOpen2) bar.addButton((b) => b.setButtonText("Open in note").onClick(() => { this.close(); this.onOpen2!(); }));
    if (this.task && this.onDelete) bar.addButton((b) => b.setButtonText("Delete").onClick(() => { this.close(); this.onDelete!(); }).buttonEl.addClass("mod-warning"));
    bar.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    bar.addButton((b) => b.setButtonText(this.task ? "Save" : "Add task").setCta().onClick(() => this.save()));
  }

  private dateRow(parent: HTMLElement, name: string, date: string | null, time: string | null, set: (d: string | null, t: string | null) => void, withTime = true) {
    const s = new Setting(parent).setName(name);
    let d = date;
    let t = time;
    const dateEl = s.controlEl.createEl("input", { type: "date" });
    dateEl.value = d ?? "";
    const timeEl = withTime ? s.controlEl.createEl("input", { type: "time" }) : null;
    if (timeEl) { timeEl.value = t ?? ""; timeEl.addClass("tv-time"); }
    const push = () => {
      d = isValidDate(dateEl.value) ? dateEl.value : null;
      t = timeEl && d ? normalizeTime(timeEl.value) : null;
      set(d, t);
    };
    dateEl.addEventListener("input", push);
    timeEl?.addEventListener("input", push);
    s.addExtraButton((b) => b.setIcon("x").setTooltip("Clear").onClick(() => { dateEl.value = ""; if (timeEl) timeEl.value = ""; push(); }));
  }

  private save() {
    if (!this.fields.description.trim()) return;
    this.close();
    this.onSubmit({ fields: this.fields, path: this.task ? null : this.path || "Tasks.md" });
  }

  override onClose() {
    this.contentEl.empty();
  }
}

export function noteExists(app: App, path: string): boolean {
  return app.vault.getAbstractFileByPath(path) instanceof TFile;
}
