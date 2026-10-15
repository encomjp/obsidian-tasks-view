import { Notice, Plugin, PluginSettingTab, Setting, TFile, type App, type Editor } from "obsidian";
import { localToday } from "./dates.ts";
import { TaskModal } from "./modal.ts";
import { HEAD, type Task } from "./parse.ts";
import { dueBetween, reminderKey } from "./remind.ts";
import { toggleLine } from "./recur.ts";
import { DEFAULT_VIEW, type ViewState } from "./state.ts";
import { TaskStore } from "./store.ts";
import { TasksPanel, VIEW_TYPE } from "./view.ts";
import { parseQuery, runQuery } from "./query.ts";

interface Settings {
  defaultNote: string;
  stampDone: boolean;
  reminders: boolean;
  statusBar: boolean;
}

const DEFAULT_SETTINGS: Settings = { defaultNote: "Tasks.md", stampDone: true, reminders: true, statusBar: true };

export default class TasksViewPlugin extends Plugin {
  override settings: Settings = { ...DEFAULT_SETTINGS };
  view: ViewState = { ...DEFAULT_VIEW };
  store!: TaskStore;
  private statusEl: HTMLElement | null = null;
  private lastCheck = new Date();
  private readonly fired = new Set<string>();

  override async onload() {
    const saved = (await this.loadData()) as { settings?: Partial<Settings>; view?: Partial<ViewState> } | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved?.settings };
    this.view = { ...DEFAULT_VIEW, ...saved?.view };
    this.store = new TaskStore(this.app, () => this.settings.stampDone);

    this.registerView(VIEW_TYPE, (leaf) => new TasksPanel(leaf, this));
    this.addRibbonIcon("check-square", "Open tasks", () => void this.activate());
    this.addCommand({ id: "open-tasks", name: "Open tasks panel", callback: () => void this.activate() });
    this.addCommand({ id: "new-task", name: "New task…", callback: () => this.newTask() });
    this.addCommand({
      id: "toggle-task",
      name: "Toggle task on this line (done date and repeat)",
      editorCheckCallback: (checking, editor) => {
        const line = editor.getLine(editor.getCursor().line);
        if (!HEAD.test(line)) return false;
        if (!checking) this.toggleInEditor(editor);
        return true;
      },
    });

    if (this.settings.statusBar && !("isMobile" in this.app && (this.app as unknown as { isMobile: boolean }).isMobile)) {
      this.statusEl = this.addStatusBarItem();
      this.statusEl.addClass("mod-clickable");
      this.statusEl.addEventListener("click", () => void this.activate());
    }
    this.store.onChange(() => this.updateStatus());
    this.store.events((ref) => this.registerEvent(ref));
    this.addSettingTab(new TasksSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      await this.store.load();
      this.lastCheck = new Date();
      this.registerInterval(window.setInterval(() => this.remind(), 30_000));
    });
  }

  saveViewState() {
    void this.saveData({ settings: this.settings, view: this.view });
  }

  allTags(): string[] {
    const tags = new Set<string>();
    for (const task of this.store.all()) for (const tag of task.tags) tags.add(tag);
    return [...tags].sort((a, b) => a.localeCompare(b));
  }

  async activate() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  newTask() {
    new TaskModal(this.app, null, this.settings.defaultNote, {
      submit: ({ fields, path }) => void this.store.add(path ?? this.settings.defaultNote, fields).then(() => new Notice("Task added")),
    }).open();
  }

  editTask(task: Task) {
    new TaskModal(this.app, task, "", {
      submit: ({ fields }) => void this.store.update(task, fields),
      remove: () => void this.store.remove(task),
      open: () => {
        const file = this.app.vault.getAbstractFileByPath(task.path);
        if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file, { eState: { line: task.line - 1 } });
      },
    }).open();
  }

  private toggleInEditor(editor: Editor) {
    const at = editor.getCursor();
    const line = editor.getLine(at.line);
    const lines = toggleLine(line, localToday(), this.settings.stampDone);
    editor.replaceRange(lines.join("\n"), { line: at.line, ch: 0 }, { line: at.line, ch: line.length });
    editor.setCursor({ line: at.line, ch: Math.min(at.ch, lines[0]!.length) });
  }

  private updateStatus() {
    if (!this.statusEl) return;
    const today = localToday();
    const due = runQuery(this.store.all(), parseQuery("not done\ndue before tomorrow", today)).length;
    this.statusEl.setText(due > 0 ? `☑ ${due} due` : "☑ 0 due");
    this.statusEl.setAttr("aria-label", `${due} open task${due === 1 ? "" : "s"} due today or overdue`);
  }

  private remind() {
    const now = new Date();
    const last = this.lastCheck;
    // The window never runs backwards (clock changes) and never replays missed reminders.
    this.lastCheck = now > last ? now : last;
    if (!this.settings.reminders) return;
    for (const task of dueBetween(this.store.all(), last, now)) {
      const key = reminderKey(task);
      if (this.fired.has(key)) continue;
      this.fired.add(key);
      const time = task.due ? task.dueTime : task.scheduledTime;
      new Notice(`⏰ ${time ?? ""} ${task.description}`.trim(), 15000);
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(task.description, { body: `${time ?? ""} · ${task.path.replace(/\.md$/i, "")}` });
      } catch {
        // The in-app notice above is enough.
      }
    }
  }
}

class TasksSettingTab extends PluginSettingTab {
  private readonly plugin: TasksViewPlugin;
  constructor(app: App, plugin: TasksViewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  override display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = () => this.plugin.saveViewState();
    new Setting(containerEl).setName("Note for new tasks").setDesc("Where New task… adds tasks. Created if missing.").addText((t) => t.setValue(s.defaultNote).onChange((v) => { s.defaultNote = v.trim() || "Tasks.md"; save(); }));
    new Setting(containerEl).setName("Add a done date").setDesc("Completing a task appends ✅ yyyy-MM-dd. Repeating tasks always get their next occurrence.").addToggle((t) => t.setValue(s.stampDone).onChange((v) => { s.stampDone = v; save(); }));
    new Setting(containerEl).setName("Remind me when timed tasks are due").setDesc("Only tasks with a time, e.g. 📅 2026-10-20 14:00, while Obsidian is running.").addToggle((t) => t.setValue(s.reminders).onChange((v) => { s.reminders = v; save(); }));
    new Setting(containerEl).setName("Show due count in the status bar").setDesc("Takes effect after reloading the plugin.").addToggle((t) => t.setValue(s.statusBar).onChange((v) => { s.statusBar = v; save(); }));
  }
}
