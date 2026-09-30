<p align="center">
  <img src="https://raw.githubusercontent.com/eachann1024/pi-jev-reply/main/assets/hero.png" alt="Before and after a plain-language rewrite" width="100%" />
</p>

*Illustration only: jargon is rewritten in plain language. A failed or invalid edit keeps the original reply.*

# Pi Jev Reply

**Less noise. More clarity.** A finishing pass for replies in the Pi terminal.

It rewrites replies in plain language, can add a compact visual, and uses the model you choose. If an edit fails, the original reply stays.

[中文](https://github.com/eachann1024/pi-jev-reply/blob/main/README.zh-CN.md)

## Watch the demo

<video src="https://github.com/user-attachments/assets/78a21dfa-8221-49ff-9c81-cfe0682ce04b" controls muted playsinline width="100%"></video>

▶ 63-second demo (Chinese narration): [Watch the video](https://github.com/eachann1024/pi-jev-reply/blob/main/docs/media/pi-jev-reply-best-zh.mp4)

## Start in a minute

```bash
pi install npm:@each1024/pi-jev-reply
```

Run `/reload` in Pi. On the **first interactive launch**, an English welcome page opens automatically. Choose **Open settings**, set your preferences, and save. Changes apply immediately.

- **English by default.** Chinese is available in settings. An existing language preference is preserved.
- **Your current model by default.** Without a Jev key, the extension sends rewrites directly to your current Pi model.
- **Quiet after setup.** The guide opens once. Reopen it with `/pi-jev-reply-setting welcome`.

Requires Pi ≥ 0.85.1 and Node ≥ 22.18.0. The browser opens only in the interactive TUI, never in RPC or print mode.

## From draft to clear reply

| Review | Refine | Return |
| --- | --- | --- |
| With a key, Jev decides whether an edit would help. | Your current or selected model clarifies the wording and may add a small table, diagram, or text chart. | The revised reply replaces the draft. A failed or invalid edit leaves the original intact. |

Without a Jev key, an enabled rewrite goes directly to your model. There is no second review. Structural checks reject edits that drop commands or paths, or change numbers. They do not guarantee factual accuracy.

## Make it yours

<p align="center">
  <img src="https://raw.githubusercontent.com/eachann1024/pi-jev-reply/main/assets/settings.png" alt="Overview of model, rewrite, and visual preferences" width="720" />
</p>

*Feature overview, not a screenshot of the interface. Use the current Pi model or choose another, then adjust rewrites, visuals, and instructions.*

```text
/pi-jev-reply-setting             Open settings
/pi-jev-reply-setting welcome     Reopen the welcome guide
/pi-jev-reply-setting on | off    Enable or disable
/pi-jev-reply-setting status      Check the model and Jev key status
```

Choose a model, control rewrites and visuals, and customize the instructions. The local settings service starts for onboarding or when requested, then closes after five idle minutes by default. `/clear-reply` remains an alias.

Settings are stored in `clear-reply.json` in your Pi agent directory. `PI_CODING_AGENT_DIR` is respected, and existing settings are not reset on upgrade. Changing the language also changes the built-in editing instructions, so review any custom instructions before saving.

## Privacy and cost

- **Jev is optional.** Set `TYPESAFE_API_KEY`, or store the key in `~/.config/typesafe/api_key` with recommended permissions of `600`. Keep keys out of chats and source control.
- **What leaves your machine:** review receives the draft, up to 2,000 characters of the current request, and your custom instructions. It does not receive the full conversation or the model’s thinking. Editing sends the draft and request to your chosen model.
- **Calls:** one Jev review when a key is configured, plus one model completion when an edit is needed. Without Jev, an enabled rewrite uses one model completion.
- **Local protection:** loopback-only settings, a per-launch token, origin checks, and protection against saving over a newer version. Secret detection is best-effort, not a complete scan.

Draft hiding works with Pi’s native renderer. A custom renderer may still show the streamed draft. Visuals are static Markdown, Mermaid, or text, not interactive pages.

## Development

```bash
npm install
npm run check
npm test
```

MIT © eachann1024
