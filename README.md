<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.1.2/assets/hero.png" alt="A reply passing through a clarity gate" width="100%" />
</p>

<h1 align="center">Pi Jev Reply</h1>

<p align="center">
  <strong>Make completed Pi replies clearer—only when wording is unclear.</strong><br />
  Jev decides; your chosen model rewrites when needed. No second-pass recheck.
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="#workflow">Workflow</a> · <a href="#settings">Settings</a> · <a href="#privacy--cost">Privacy</a> · <a href="README.zh-CN.md">中文</a>
</p>

> **What it is:** a Pi TUI extension that reviews an assistant's finished reply for jargon, unexplained abbreviations, and ambiguous phrasing. When useful, it can also add one small static visual.

## Install

```bash
npm_config_registry=https://registry.npmjs.org pi install npm:@each1024/pi-jev-reply
```

Run `/reload`, then `/clear-reply` to open settings. Requires Pi `>= 0.85.1`, Node `>= 22.18.0`, and a Jev API key.

On first install the extension creates `clear-reply.json` with a settings UI language guessed from your locale (`zh*` → `zh-CN`, otherwise `en`) and shows a one-time tip in the TUI (including a reminder if the Jev key is missing). Existing config files are never rewritten for language.

## Workflow

<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.1.2/assets/workflow.svg" alt="Two-stage reply clarity workflow" width="760" />
</p>

| Stage | Owner | Result |
| --- | --- | --- |
| **Review** | Jev | Decides whether clarity or a visual is warranted. |
| **Edit** | Main model by default | Rewrites the reply and/or adds a compact static visual, then shows it. |

The extension keeps the original draft if a call fails, times out, or produces an invalid edit. It does not retry itself into a loop. Structural checks still reject edits that drop paths/commands or change numbers.

## What changes—and what never does

| Can improve | Deliberately does not do |
| --- | --- |
| Black-box phrasing, unexplained acronyms, missing context, and vague conclusions | Invent facts, or silently replace a failed draft |
| A small Markdown table, Mermaid `flowchart TD`, or text data chart when it helps | Generate Canvas, HTML, SVG, JavaScript, external embeds, or interactive visuals |
| Wording with the current Pi model or a configured `provider/model` | Hardcode a provider or require a model named `loop` |

## Controls

```text
/clear-reply                 Open the local settings page
/clear-reply on | off        Toggle processing and save immediately
/clear-reply status          Show enabled state, Jev-key status, and active model
```

Settings apply immediately—no restart or `/reload` is needed after saving.

## Settings without background noise

<p align="center">
  <img src="https://unpkg.com/@each1024/pi-jev-reply@0.1.2/assets/settings.png" alt="On-demand local settings service" width="720" />
</p>

The bilingual (`en` / `zh-CN`) HTML settings page is served only on demand:

- binds to `127.0.0.1` with a per-launch token, host/origin validation, CSP, and a bounded request body;
- starts only from the settings command—no listener, polling, or heartbeat at idle;
- stops after five idle minutes by default and starts fresh next time;
- uses ETag/`If-Match` protection and atomic writes, so a stale tab cannot overwrite newer settings.

The UI language changes only the settings page; it never changes the reply language.

## Configuration

`clear-reply.json` lives in the Pi agent directory (honouring `PI_CODING_AGENT_DIR`). Defaults are configurable: enablement, chosen rewrite model, rewrite/visual switches, thresholds, Jev model, timeouts, draft hiding, idle timeout, and custom review instructions.

Jev credentials are read from, in order:

1. `TYPESAFE_API_KEY`
2. `~/.config/typesafe/api_key` (recommended mode: `600`)

Keep tokens out of prompts, examples, issues, and source control.

## Privacy & cost

For an eligible reply, Jev receives the draft, up to 2,000 characters of the current user request, and your custom instructions—not the full conversation or model thinking. Obvious credentials are skipped as a convenience, not as a complete secret scanner.

**Typical cost:** one Jev review; if editing is needed, one selected-model completion. Oversized drafts are skipped instead of truncated.

## Boundaries

- Pi **TUI sessions only**. JSON, RPC, and print modes are not changed.
- Draft hiding relies on Pi's native Markdown transformer. Custom transcript renderers, including mini-mode, can still expose the earlier streamed draft.
- The review is a clarity aid, not a factual, security, or safety guarantee.

## Develop

```bash
npm install
npm run check
npm test
```

MIT © eachann1024
