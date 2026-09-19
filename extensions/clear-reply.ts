import { join } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULTS, loadSettings, parseSettings, readJevKey, saveSettings, type Settings } from "../lib/settings.ts";
import { editorPrompt, eligibleDraft, judge, parseEdited, textContent } from "../lib/review.ts";

type SettingsWeb = Awaited<ReturnType<typeof import("../lib/settings-web.ts").startSettingsWeb>>;

async function limited<T>(milliseconds: number, signal: AbortSignal, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const timeout = new AbortController();
  const combined = AbortSignal.any([signal, timeout.signal]);
  const timer = setTimeout(() => timeout.abort(), milliseconds);
  timer.unref();
  let onAbort: (() => void) | undefined;
  try {
    combined.throwIfAborted();
    return await Promise.race([
      run(combined),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(new Error("Reply processing cancelled or timed out"));
        combined.addEventListener("abort", onAbort, { once: true });
        if (combined.aborted) onAbort();
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) combined.removeEventListener("abort", onAbort);
  }
}

export default function clearReply(pi: ExtensionAPI) {
  const path = join(getAgentDir(), "clear-reply.json");
  let settings: Settings = { ...DEFAULTS };
  let key = "";
  let context: ExtensionContext | undefined;
  let lifetime = new AbortController();
  let web: SettingsWeb | undefined;
  let opening: Promise<SettingsWeb> | undefined;
  let warned = false;
  let configError = false;
  const copy = (en: string, zh: string) => settings.language === "zh-CN" ? zh : en;
  const active = () => settings.enabled && !configError && Boolean(key) && (settings.rewrite || settings.visuals);
  const closeSettings = () => {
    web?.close();
    web = undefined;
    const pending = opening;
    opening = undefined;
    void pending?.then(server => server.close(), () => {});
  };
  const reset = () => {
    lifetime.abort();
    lifetime = new AbortController();
    closeSettings();
    warned = false;
  };
  const chooseModel = (ctx: ExtensionContext, value: string) => {
    if (!value) return ctx.model;
    const slash = value.indexOf("/");
    return ctx.modelRegistry.find(value.slice(0, slash), value.slice(slash + 1));
  };

  pi.registerMarkdownTransformer((markdown, info) => {
    // ponytail: native Pi TUI only; custom transcript renderers and RPC consumers must buffer their own stream.
    return context?.mode === "tui" && active() && settings.hideDraft && info.messageType === "assistant" && info.isStreaming ? "" : markdown;
  });

  pi.on("session_start", async (_, ctx) => {
    reset();
    context = ctx;
    try { settings = await loadSettings(path); configError = false; }
    catch {
      configError = true;
      ctx.ui.notify("Clear Reply: cannot read settings. Existing files were not changed.", "warning");
    }
    try { key = await readJevKey(); }
    catch { key = ""; ctx.ui.notify("Clear Reply: Jev credentials could not be read. You can still open settings.", "warning"); }
  });
  pi.on("session_before_switch", () => { reset(); });
  pi.on("session_before_fork", () => { reset(); });
  pi.on("session_before_tree", () => { reset(); });
  pi.on("model_select", (_, ctx) => { context = ctx; });
  pi.on("session_shutdown", () => { lifetime.abort(); closeSettings(); });

  pi.on("message_end", async (event, ctx) => {
    context = ctx;
    const message = event.message;
    if (ctx.mode !== "tui" || !active() || message.role !== "assistant" || message.stopReason !== "stop"
      || message.content.some(part => part.type === "toolCall") || ctx.hasPendingMessages()) return;
    const draft = textContent(message.content);
    const userEntry = [...ctx.sessionManager.getBranch()].reverse().find(entry => entry.type === "message" && entry.message.role === "user");
    const request = userEntry?.type === "message" && userEntry.message.role === "user" ? textContent(userEntry.message.content).slice(0, 2000) : "";
    if (!eligibleDraft(draft, `${request}\n${settings.instructions}`)) return;
    const revision = settings;
    const current = { ...revision };
    const operation = lifetime;
    const signal = AbortSignal.any([operation.signal, ...(ctx.signal ? [ctx.signal] : [])]);
    try {
      const decision = await limited(current.reviewTimeoutMs, signal, child => judge(draft, request, current, key, child));
      if (/(?:不要|无需|不需要)(?:任何)?(?:图|表|可视化)|no (?:charts?|diagrams?|visuals?|tables?)/i.test(request)) decision.visual = "none";
      if (!decision.rewrite && decision.visual === "none") return;
      const model = chooseModel(ctx, current.rewriteModel);
      if (!model) throw new Error("Rewrite model is not available");
      const result = await limited(current.rewriteTimeoutMs, signal, child => ctx.modelRegistry.complete(model, {
        systemPrompt: editorPrompt(current, decision),
        messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify({ draft, user_request: request }) }], timestamp: Date.now() }],
      }, { signal: child, maxTokens: Math.min(model.maxTokens, 8192) }));
      signal.throwIfAborted();
      if (result.stopReason !== "stop" || result.content.some(part => part.type === "toolCall")) throw new Error("Incomplete editor response");
      const edited = parseEdited(textContent(result.content), draft, decision);
      if (operation !== lifetime || settings !== revision || !settings.enabled || ctx.hasPendingMessages()) return;
      // No drafts, credentials or model reasoning in diagnostics.
      pi.appendEntry("clear-reply", { rewrite: decision.rewrite, visual: decision.visual, model: `${model.provider}/${model.id}`, usage: result.usage });
      return { message: { ...message, content: [
        ...message.content.filter(part => part.type !== "text"),
        { type: "text" as const, text: edited },
      ] } };
    } catch {
      if (!signal.aborted && !warned) {
        warned = true;
        ctx.ui.notify(copy("Clear Reply could not finish checking this reply. The original was kept.", "回复检查未完成，已保留原回复。"), "warning");
      }
    }
  });

  async function openSettings(ctx: ExtensionContext) {
    context = ctx;
    if (ctx.mode !== "tui") { ctx.ui.notify("Clear Reply HTML settings require Pi interactive mode.", "warning"); return; }
    const operation = lifetime;
    try {
      try { key = await readJevKey(); } catch { key = ""; }
      if (!web || web.closed) {
        opening ??= (async () => {
          const { startSettingsWeb } = await import("../lib/settings-web.ts");
          return startSettingsWeb(() => {
            const current = context ?? ctx;
            return {
              settings, defaults: DEFAULTS, keyAvailable: Boolean(key), settingsError: configError,
              currentModel: current.model ? `${current.model.provider}/${current.model.id}` : "",
              models: current.modelRegistry.getAvailable().map(model => ({ id: `${model.provider}/${model.id}`, label: `${model.name} (${model.provider}/${model.id})` })),
            };
          }, async value => {
            if (configError) throw new TypeError("Repair clear-reply.json before saving");
            const next = parseSettings(value);
            if (next.rewriteModel && !chooseModel(context ?? ctx, next.rewriteModel)) throw new TypeError("Unknown rewrite model");
            await saveSettings(path, next);
            settings = next;
            configError = false;
            warned = false;
          }, () => settings.settingsIdleMinutes * 60000);
        })();
        const pending = opening;
        try {
          const server = await pending;
          if (operation !== lifetime || operation.signal.aborted) { server.close(); return; }
          web = server;
        } finally { if (opening === pending) opening = undefined; }
      }
      web.touch();
      const url = web.url;
      const result = process.platform === "darwin" ? await pi.exec("open", [url])
        : process.platform === "win32" ? await pi.exec("rundll32.exe", ["url.dll,FileProtocolHandler", url])
        : await pi.exec("xdg-open", [url]);
      if (result.code !== 0) ctx.ui.notify(copy(`Open locally: ${url}`, `请在本机打开：${url}`), "info");
    } catch {
      ctx.ui.notify(copy("Could not open settings. Check file permissions and try again.", "无法打开设置，请检查文件权限后重试。"), "error");
    }
  }

  pi.registerCommand("clear-reply", {
    description: "Open Clear Reply settings; or use on, off, status",
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (!action || action === "settings") { await openSettings(ctx); return; }
      if (action === "status") {
        ctx.ui.notify(copy(
          `Clear Reply: ${active() ? "enabled" : "inactive"}; Jev key ${key ? "configured" : "missing"}; model ${settings.rewriteModel || "current main model"}.`,
          `回复检查：${active() ? "已启用" : "未启用"}；Jev 密钥${key ? "已配置" : "缺失"}；模型：${settings.rewriteModel || "当前主模型"}。`,
        ), "info");
        return;
      }
      if (action !== "on" && action !== "off") { ctx.ui.notify("Usage: /clear-reply [settings|on|off|status]", "info"); return; }
      try {
        if (configError) throw new Error("Existing settings need repair");
        const next = { ...settings, enabled: action === "on" };
        await saveSettings(path, next);
        settings = next;
        if (!next.enabled) { lifetime.abort(); lifetime = new AbortController(); }
        ctx.ui.notify(copy(`Clear Reply ${action}.`, `回复检查已${action === "on" ? "开启" : "关闭"}。`), "info");
      } catch { ctx.ui.notify(copy("Settings were not saved. Check the configuration file.", "设置未保存，请检查配置文件。"), "error"); }
    },
  });
}
