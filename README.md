# Tasks View for Obsidian

Starnote's tasks feature as an Obsidian plugin. It collects every checkbox task in your vault into one
panel, with due dates, priorities, repeats, filters, reminders and a query language, and writes changes
back to the notes as plain Markdown. Works on desktop and mobile.

<a href="https://www.paypal.com/donate/?hosted_button_id=H4SCC24R8KS4A"><img src="https://img.shields.io/badge/%E2%98%95_Buy_Me_a_Coffee-PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="Buy me a coffee" height="36" /></a>

![The panel with quick add, counts on the Today and Inbox chips, and tasks grouped by time](docs/quick-add.png)

## Features

- **Task panel** with presets: Today, Upcoming, Inbox, Done this week, All open, Everything. Search, filter by
  status, due range, priority and tag, sort, and group by time, note, due date, priority, status, tag or heading.
- **Plain Markdown.** Tasks are normal `- [ ]` lines. Checking one in the panel edits the note atomically.
- **Dates and priority** using the common emoji marks: `📅` due, `⏳` scheduled, `🛫` start, `➕` created,
  `✅` done, `🔁` repeat; `🔺 ⏫ 🔼 🔽 ⏬` priority. Keyword forms `due:: 2026-10-20` and `@due(2026-10-20)` work
  too. Add a time after a due or scheduled date (`📅 2026-10-20 14:00`).
- **Repeats:** `every day`, `every 2 weeks`, `every other month`, `every weekday`, `every monday`, `every year`.
  Completing a repeating task adds the next copy, dated from the task's own date.
- **Reminders** for timed tasks: a notice and a system notification, plus a due count in the status bar.
- **Quick add** from the box at the top of the panel, in plain words: `call mum tomorrow 6pm every week !high #home`.
  Understands `today`, `tomorrow`, `next week`, `in 3 days`, weekday names, ISO dates, `5pm` / `17:30`,
  `every …` repeats, `!high` priorities and `#tags`.
- **Reschedule** from the right-click menu: due today, tomorrow, next week, push back a day, or remove the date.
  The Today and Inbox chips show how many tasks they hold.
- **Create and edit** tasks in a dialog (title, due, scheduled, start, repeat, priority, tags, note).
- **Query language**, one condition per line, in the panel's filter box:

  ```
  not done
  due before 2026-11-01
  tag work
  priority is high
  path includes Projects
  sort by due
  group by tag
  limit 20
  ```

  Also: `done`, `no due date`, `due today`, `due after`, `due on`, `done after`, `description includes`,
  `heading includes`, `happens`, `recurring`, and `heading|description|path regex matches /<regex>/`
  (or `regex does not match`), which takes a JavaScript regex with optional flags such as `/chores/i`.
- **Command** *Toggle task on this line* completes a task in the editor, stamping the done date and creating
  the next repeat.

![Filters expanded](docs/filters.png)

![The Today view](docs/today.png)

## Install

### Obsidian directory

Tasks View is listed in the official Obsidian plugin directory: [community.obsidian.md/plugins/tasks-view](https://community.obsidian.md/plugins/tasks-view). Install it from there, or from Settings → Community plugins → Browse once it appears for you.

### BRAT (installs and keeps it updated)

1. Install **BRAT** from Settings → Community plugins → Browse, and enable it.
2. Run **BRAT: Add a beta plugin for testing** and enter `encomjp/obsidian-tasks-view`, or click
   [this link](obsidian://brat?plugin=encomjp/obsidian-tasks-view) with BRAT installed.
3. Enable **Tasks View** under Settings → Community plugins.

### Manual

Copy `main.js`, `manifest.json` and `styles.css` from the latest release into
`<vault>/.obsidian/plugins/tasks-view/`, then enable the plugin. To build it yourself:

```bash
npm install
npm run build
```

## Settings

Default note for new tasks (`Tasks.md`), stamping the done date, reminders, and the status-bar count.

## Development

```bash
npm run dev     # rebuild main.js on change
npm run check   # type-check
npm test        # unit tests (node --test)
```

Tested in Obsidian 1.14.4 (Flatpak, Linux).

## Disclosures

- **Network use:** none.
- **Files outside your vault:** none. Reminders use Obsidian notices and, if you have allowed them, your system's notifications.
- **No** account, payment, ads, telemetry or self-updating. The plugin only reads and edits Markdown notes in your vault.

## Support

If this saves you time, you can [buy me a coffee](https://www.paypal.com/donate/?hosted_button_id=H4SCC24R8KS4A).

## Disclaimer

An independent project, ported from the tasks feature of Starnote. It is not affiliated with, endorsed by,
or supported by Dynalist Inc. (Obsidian) or the authors of any other task plugin. Provided "as is" under the
MIT license, without warranty; it edits your notes, so keep backups. See [LICENSE](LICENSE).


---

Made by [Adrian Kozlowski](https://adrian-kozlowski.de), IT specialist for systems integration and IT security in Mannheim. More projects on the [portfolio](https://adrian-kozlowski.de), and free browser games at [games.adrian-kozlowski.com](https://games.adrian-kozlowski.com).
