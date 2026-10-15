import { Notice, TFile, type App, type EventRef } from "obsidian";
import { localToday } from "./dates.ts";
import { buildLine, findAnchor, newTaskLine, type TaskFields } from "./edit.ts";
import { parseNote, type Task } from "./parse.ts";
import { toggleLine } from "./recur.ts";

const MAYBE_TASKS = /\[[ xX]\]/;

/** Every task in the vault, kept current as notes change; also the only place that writes tasks back. */
export class TaskStore {
  private readonly byPath = new Map<string, Task[]>();
  private readonly listeners = new Set<() => void>();
  private timer: number | null = null;
  private readonly app: App;
  private readonly stampDone: () => boolean;

  constructor(app: App, stampDone: () => boolean) {
    this.app = app;
    this.stampDone = stampDone;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  all(): Task[] {
    return [...this.byPath.values()].flat();
  }

  async load() {
    await Promise.all(this.app.vault.getMarkdownFiles().map((file) => this.read(file)));
    this.notify();
  }

  /** Vault event handlers; the caller registers them so they unload with the plugin. */
  events(register: (ref: EventRef) => void) {
    const vault = this.app.vault;
    register(vault.on("modify", (f) => { if (f instanceof TFile && f.extension === "md") void this.read(f).then(() => this.notify()); }));
    register(vault.on("create", (f) => { if (f instanceof TFile && f.extension === "md") void this.read(f).then(() => this.notify()); }));
    register(vault.on("delete", (f) => { if (this.byPath.delete(f.path)) this.notify(); }));
    register(vault.on("rename", (f, old) => {
      this.byPath.delete(old);
      if (f instanceof TFile && f.extension === "md") void this.read(f).then(() => this.notify());
      else this.notify();
    }));
  }

  private async read(file: TFile) {
    const text = await this.app.vault.cachedRead(file);
    if (!MAYBE_TASKS.test(text)) {
      this.byPath.delete(file.path);
      return;
    }
    const tasks = parseNote(text, file.path);
    if (tasks.length > 0) this.byPath.set(file.path, tasks);
    else this.byPath.delete(file.path);
  }

  private notify() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      for (const fn of this.listeners) fn();
    }, 120);
  }

  private file(task: Task): TFile {
    const f = this.app.vault.getAbstractFileByPath(task.path);
    if (!(f instanceof TFile)) throw new Error(`Note not found: ${task.path}`);
    return f;
  }

  /** Replaces the task's line with `replace(line)`'s result, keeping the note's line endings. */
  private async rewrite(task: Task, replace: (line: string) => string[]) {
    const file = this.file(task);
    let missing = false;
    await this.app.vault.process(file, (data) => {
      const eol = data.includes("\r\n") ? "\r\n" : "\n";
      const lines = data.split(/\r?\n/);
      const at = findAnchor(lines, task.line, task.raw);
      if (at < 0) { missing = true; return data; }
      lines.splice(at, 1, ...replace(lines[at]!));
      return lines.join(eol);
    });
    if (missing) {
      new Notice("That task changed in its note. Refreshed; try again.");
      await this.read(file);
      this.notify();
    }
  }

  async toggle(task: Task) {
    await this.rewrite(task, (line) => toggleLine(line, localToday(), this.stampDone()));
  }

  async update(task: Task, fields: TaskFields) {
    await this.rewrite(task, () => [buildLine(task.prefix, fields)]);
  }

  async remove(task: Task) {
    await this.rewrite(task, () => []);
  }

  /** Appends a new task to a note (created if missing). */
  async add(path: string, fields: Partial<TaskFields> & { description: string }) {
    const line = newTaskLine(fields);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.process(existing, (data) => (data.endsWith("\n") || data === "" ? data : data + "\n") + line + "\n");
    } else {
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (folder && !(await this.app.vault.adapter.exists(folder))) await this.app.vault.createFolder(folder);
      await this.app.vault.create(path, line + "\n");
    }
  }
}
