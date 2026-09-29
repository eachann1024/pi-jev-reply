<p align="center">
  <img src="https://raw.githubusercontent.com/eachann1024/pi-jev-reply/main/assets/hero.png" alt="Illustrative before-and-after plain-language rewrite" width="100%" />
</p>

*Illustrative rewrite: replace jargon with plain language. Failed or invalid edits keep the original.*

# Pi Jev Reply

**Less noise. More clarity.** A finishing touch for replies in the Pi terminal.

Plain-language rewrites, optional compact visuals, and your choice of model. If an edit fails, the original stays.

[中文](https://github.com/eachann1024/pi-jev-reply/blob/main/README.zh-CN.md)

## Start in a minute

```bash
pi install npm:@each1024/pi-jev-reply
```

Run `/reload` in Pi. On the **first interactive launch**, an English welcome page opens automatically. Click **Open settings**, choose your preferences, and save. Changes apply immediately.

- **English by default.** Chinese is available in settings. Existing language preferences are preserved.
- **Your model, by default.** No Jev key? The extension uses your current Pi model directly.
- **Quiet after setup.** The guide opens once. Reopen it with `/pi-jev-reply welcome`.

Requires Pi ≥ 0.85.1 and Node ≥ 22.18.0. Interactive TUI only; RPC and print modes never open a browser.

## From draft to clear reply

| Review | Refine | Return |
| --- | --- | --- |
| With a key, Jev decides whether an edit helps. | Your current or selected model clarifies wording and can add a small table, diagram, or text chart. | The revised reply appears. Failed or invalid edits leave the original intact. |

Without a Jev key, enabled rewrites go directly to your model. There is no second review loop. Structural checks reject edits that drop commands or paths, or alter numbers—not a guarantee of factual accuracy.

## Make it yours

<p align="center">
  <img src="https://raw.githubusercontent.com/eachann1024/pi-jev-reply/main/assets/settings.png" alt="Editing model and reply preferences — feature overview" width="720" />
</p>

*Feature overview, not a UI screenshot: use the current Pi model or choose another, then adjust rewrites, visuals, and instructions.*

```text
/pi-jev-reply             Open settings
/pi-jev-reply welcome     Reopen the welcome guide
/pi-jev-reply on | off    Enable or disable
/pi-jev-reply status      Check model and Jev-key status
```

Choose a model, control rewrites and visuals, and customize instructions. The local settings service starts for onboarding or on request, then closes after five idle minutes by default. `/clear-reply` remains an alias.

Settings live in `clear-reply.json` in your Pi agent directory (`PI_CODING_AGENT_DIR` is respected). Existing settings are not reset on upgrade. Switching language also retargets the built-in editing instructions; review custom instructions before saving.

## Privacy & cost

- **Optional Jev:** set `TYPESAFE_API_KEY`, or place the key in `~/.config/typesafe/api_key` (recommended permissions: `600`). Keep keys out of chats and source control.
- **What leaves your machine:** review receives the draft, up to 2,000 characters of the current request, and custom instructions—not the full conversation or model thinking. Editing sends the draft and request to your chosen model.
- **Calls:** one Jev review when configured, plus one model completion if an edit is needed. Without Jev, enabled rewrites use one model completion.
- **Local protection:** loopback-only settings, per-launch token, origin checks, and stale-save protection. Secret detection is best-effort, not a complete scanner.

Draft hiding works with Pi's native renderer; custom renderers may still show streamed drafts. Visuals are static Markdown/Mermaid/text, not interactive pages.

## Development

```bash
npm install
npm run check
npm test
```

MIT © eachann1024
