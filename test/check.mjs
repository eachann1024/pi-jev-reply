import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_INSTRUCTIONS, DEFAULTS, defaultInstructions, detectLanguage, loadOrCreateSettings, loadSettings, parseSettings, retargetInstructions, saveSettings } from '../lib/settings.ts';
import { eligibleDraft, localDecision, parseDecision, parseEdited } from '../lib/review.ts';
import { startSettingsWeb } from '../lib/settings-web.ts';

const temp = await mkdtemp(join(tmpdir(), 'pi-jev-reply-'));
const originalFetch = globalThis.fetch;
const oldDir = process.env.PI_CODING_AGENT_DIR;
const oldKey = process.env.TYPESAFE_API_KEY;
const oldLang = process.env.LANG;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const score = (rewrite = .98, visual = 'none') => ({ answers: {
  needs_rewrite: { type: 'noul', noul: rewrite },
  visual: { type: 'choice', choice: visual, confidence: .95, probabilities: { [visual]: .98 } },
} });
let web;
try {
  assert.equal(DEFAULTS.language, 'en');

  assert.equal(detectLanguage({ LANG: 'zh_CN.UTF-8' }), 'zh-CN');
  assert.equal(detectLanguage({ LANG: 'en_US.UTF-8' }), 'en');
  assert.equal(detectLanguage({ LC_ALL: 'C', LANG: 'zh_TW.UTF-8' }), 'en');
  assert.equal(detectLanguage({ LC_MESSAGES: 'zh-Hans.UTF-8' }), 'zh-CN');
  const firstPath = join(temp, 'first-run.json');
  const first = await loadOrCreateSettings(firstPath, { LANG: 'zh_CN.UTF-8' });
  assert.equal(first.firstRun, true);
  assert.equal(first.settings.language, 'en');
  assert.equal(first.settings.onboardingPending, true);
  assert.equal(first.settings.instructions, defaultInstructions('en'));
  assert.match(first.settings.instructions, /^英文润色。/);
  await saveSettings(firstPath, { ...first.settings, language: 'zh-CN', instructions: defaultInstructions('zh-CN') });
  assert.match(DEFAULTS.instructions, /^英文润色。/);
  assert.equal(DEFAULTS.instructions, DEFAULT_INSTRUCTIONS.en);
  assert.ok(DEFAULTS.instructions.length <= 2000);
  assert.equal(retargetInstructions(DEFAULT_INSTRUCTIONS.en, 'zh-CN'), DEFAULT_INSTRUCTIONS['zh-CN']);
  assert.equal(retargetInstructions('中文润色。保留术语 Foo。', 'en'), '英文润色。保留术语 Foo。');
  const settingsPage = await readFile(new URL('../lib/settings.html', import.meta.url), 'utf8');
  assert(settingsPage.includes(DEFAULT_INSTRUCTIONS.en));
  assert(settingsPage.includes(DEFAULT_INSTRUCTIONS['zh-CN']));
  const again = await loadOrCreateSettings(firstPath, { LANG: 'en_US.UTF-8' });
  assert.equal(again.firstRun, false);
  assert.equal(again.settings.language, 'zh-CN', 'existing language is kept');
  assert.equal(again.settings.instructions, defaultInstructions('zh-CN'));
  assert.equal(DEFAULTS.rewriteModel, '');
  assert.throws(() => parseSettings({ rewriteThreshold: NaN }));
  assert.throws(() => parseSettings({ settingsIdleMinutes: 0 }));
  assert.throws(() => parseSettings({ rewriteModel: 'loop' }));
  assert.throws(() => parseSettings({ unknown: true }));
  assert.equal(parseSettings({ rewriteModel: 'test/provider/model' }).rewriteModel, 'test/provider/model');
  const config = join(temp, 'clear-reply.json');
  await saveSettings(config, DEFAULTS);
  assert.deepEqual(await loadSettings(config), DEFAULTS);
  await writeFile(config, '{');
  await assert.rejects(loadSettings(config));
  assert.equal(await readFile(config, 'utf8'), '{');
  await saveSettings(config, DEFAULTS);
  assert(!eligibleDraft('{"hello":"world"}', 'Return JSON'));
  assert(!eligibleDraft('Use api_key=private-long-value in config.', ''));
  assert(!eligibleDraft('Some lengthy formatted response', '只输出 JSON'));
  assert.deepEqual(parseDecision(score(), DEFAULTS), { rewrite: true, visual: 'none' });
  assert.deepEqual(localDecision(DEFAULTS, ''), { rewrite: true, visual: 'none' });
  assert.deepEqual(localDecision({ ...DEFAULTS, rewrite: false, visuals: false }, 'please draw a flowchart'), { rewrite: false, visual: 'none' });
  assert.deepEqual(localDecision(DEFAULTS, 'please draw a flowchart'), { rewrite: true, visual: 'diagram' });
  assert.throws(() => parseDecision({ answers: {} }, DEFAULTS));
  const draft = 'The build took 30 seconds. The device has not been tested.';
  const text = 'Compilation took 30 seconds. Device testing has not been done.';
  const decision = { rewrite: true, visual: 'none' };
  assert.equal(parseEdited(JSON.stringify({ text, visual: '' }), draft, decision), text);
  assert.throws(() => parseEdited(JSON.stringify({ text: text.replace('30', '20'), visual: '' }), draft, decision));
  assert.throws(() => parseEdited(JSON.stringify({ text, visual: '<script>x</script>' }), draft, { ...decision, visual: 'diagram' }));
  assert.match(parseEdited(JSON.stringify({ text, visual: '```mermaid\nflowchart TD\nA[Build] --> B[Review]\n```' }), draft, { ...decision, visual: 'diagram' }), /flowchart/);
  assert.throws(() => parseEdited(JSON.stringify({ text: 'Removed command', visual: '' }), 'Run `npm run check`.', decision));

  // Exercise the real extension handlers without network, user configuration or a model service.
  process.env.PI_CODING_AGENT_DIR = temp;
  process.env.TYPESAFE_API_KEY = 'test-only-key';
  const { default: extension } = await import('../extensions/clear-reply.ts');
  const hooks = new Map(), commands = new Map(), notifications = [], entries = [];
  let transformer, chosen, completionCount = 0, calls = 0;
  const opened = [];
  let openCode = 0;
  const main = { provider: 'test', id: 'main', maxTokens: 8192 };
  const custom = { provider: 'test', id: 'other', maxTokens: 8192 };
  const ctx = {
    mode: 'tui', model: main, hasUI: true, signal: undefined,
    ui: { notify: text => notifications.push(text) }, hasPendingMessages: () => false,
    sessionManager: { getBranch: () => [{ type: 'message', message: { role: 'user', content: 'Explain the implementation results.' } }] },
    modelRegistry: {
      find: (provider, id) => provider === 'test' && id === 'other' ? custom : undefined,
      getAvailable: () => [main, custom],
      complete: async model => {
        completionCount++; chosen = model;
        return { stopReason: 'stop', content: [{ type: 'text', text: JSON.stringify({ text, visual: '' }) }], usage: {} };
      },
    },
  };
  extension({
    on: (name, fn) => hooks.set(name, fn), registerCommand: (name, command) => commands.set(name, command),
    registerMarkdownTransformer: fn => { transformer = fn; }, registerEntryRenderer: () => {}, appendEntry: (...entry) => entries.push(entry),
    exec: async (_, args) => { opened.push(args.at(-1)); if (openCode === -1) throw new Error('launcher unavailable'); return { code: openCode }; },
  });
  globalThis.fetch = async (_, options) => {
    calls++;
    const request = JSON.parse(options.body);
    assert(!JSON.stringify(request).includes('test-only-key'));
    return Response.json(score());
  };
  await hooks.get('session_start')({}, ctx);
  assert.equal(opened.length, 0, 'existing installs must not show onboarding');
  assert.equal(transformer('draft', { messageType: 'assistant', isStreaming: true }), '');
  assert.equal(transformer('final', { messageType: 'assistant', isStreaming: false }), 'final');
  const message = { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: draft }], usage: { output: 12 } };
  const result = await hooks.get('message_end')({ message }, ctx);
  assert.equal(result.message.content[0].text, text);
  assert.equal(chosen, main, 'current model is the default');
  assert.equal(calls, 1, 'one review only');
  assert.equal(completionCount, 1);
  assert.deepEqual(result.message.usage, message.usage);
  assert.equal(message.content[0].text, draft, 'original event not mutated by the handler');
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], 'pi-jev-reply');
  await saveSettings(config, { ...DEFAULTS, rewriteModel: 'test/other' });
  await hooks.get('session_start')({}, ctx);
  await hooks.get('message_end')({ message }, ctx);
  assert.equal(chosen, custom);
  const previous = calls;
  await hooks.get('message_end')({ message: { ...message, stopReason: 'error' } }, ctx);
  await hooks.get('message_end')({ message }, { ...ctx, mode: 'rpc' });
  assert.equal(calls, previous, 'errors and RPC skipped');
  globalThis.fetch = async () => { throw Error('offline'); };
  assert.equal(await hooks.get('message_end')({ message }, ctx), undefined);
  assert.equal(await hooks.get('message_end')({ message }, ctx), undefined);
  assert.equal(notifications.length, 1, 'failures keep original and notify once');

  // First-run waits through RPC, opens once in TUI, defaults to English and can be replayed.
  const freshDir = await mkdtemp(join(tmpdir(), 'pi-jev-reply-first-'));
  process.env.PI_CODING_AGENT_DIR = freshDir;
  process.env.LANG = 'zh_CN.UTF-8';
  delete process.env.TYPESAFE_API_KEY;
  const onboard = [];
  const onboardCtx = { ...ctx, ui: { notify: text => onboard.push(text) } };
  await hooks.get('session_start')({}, { ...onboardCtx, mode: 'rpc' });
  assert.equal(opened.length, 0, 'RPC must never open a browser');
  assert.equal((JSON.parse(await readFile(join(freshDir, 'clear-reply.json'), 'utf8'))).onboardingPending, true);
  openCode = -1;
  await hooks.get('session_start')({}, onboardCtx);
  assert.match(onboard[0], /Open locally:/);
  assert.equal((JSON.parse(await readFile(join(freshDir, 'clear-reply.json'), 'utf8'))).onboardingPending, true, 'failed launch is retryable');
  openCode = 0;
  await hooks.get('session_start')({}, onboardCtx);
  const created = JSON.parse(await readFile(join(freshDir, 'clear-reply.json'), 'utf8'));
  assert.equal(created.language, 'en');
  assert.equal(created.onboardingPending, false);
  assert.equal(opened.length, 2);
  assert.match(opened[1], /\/welcome#[a-f0-9]{48}$/);
  await hooks.get('session_start')({}, onboardCtx);
  assert.equal(opened.length, 2, 'subsequent sessions stay quiet');
  assert.ok(commands.has('pi-jev-reply'));
  await commands.get('pi-jev-reply').handler('welcome', onboardCtx);
  assert.equal(opened.length, 3, 'guide can be reopened explicitly');
  await hooks.get('session_shutdown')({}, onboardCtx);
  await rm(freshDir, { recursive: true, force: true });
  process.env.PI_CODING_AGENT_DIR = temp;
  process.env.TYPESAFE_API_KEY = '';
  await saveSettings(config, DEFAULTS);
  await hooks.get('session_start')({}, ctx);
  globalThis.fetch = async () => { throw new Error('jev must be skipped without a key'); };
  chosen = undefined;
  const noJev = await hooks.get('message_end')({ message }, ctx);
  assert.equal(noJev.message.content[0].text, text);
  assert.equal(chosen, main, 'without Jev, use the current model');
  const noMain = await hooks.get('message_end')({ message }, { ...ctx, model: undefined });
  assert.equal(noMain.message.content[0].text, text);
  assert.equal(chosen, custom, 'without a current model, use other');
  process.env.TYPESAFE_API_KEY = 'test-only-key';

  await hooks.get('session_shutdown')({}, ctx);
  globalThis.fetch = originalFetch;

  // Real loopback endpoint, authentication, validation and automatic shutdown.
  let settings = { ...DEFAULTS };
  let delaySave = false;
  web = await startSettingsWeb(() => ({ settings }), async input => {
    const next = parseSettings(input);
    if (delaySave) await sleep(180);
    settings = next;
  }, () => 120);
  const url = new URL(web.url);
  const headers = { Authorization: `Bearer ${url.hash.slice(1)}`, 'Content-Type': 'application/json' };
  const endpoint = `${url.origin}/settings`;
  const page = await originalFetch(url.origin);
  const html = await page.text();
  const guide = await originalFetch(web.welcomeUrl);
  assert.equal(guide.status, 200);
  const guideHtml = await guide.text();
  assert.match(guideHtml, /<html lang="en">/);
  assert.match(guideHtml, /Open settings/);
  assert.match(guide.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  new Function(guideHtml.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.equal((await originalFetch(url.origin + '/welcome', { headers: { Origin: 'https://example.com' } })).status, 403);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /zh-CN/);
  assert(!html.includes('setInterval('), 'no browser polling');
  new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.equal((await originalFetch(endpoint)).status, 403);
  assert.equal((await originalFetch(endpoint, { headers: { ...headers, Origin: 'https://example.com' } })).status, 403);
  assert.equal((await originalFetch(endpoint, { method: 'PUT', headers, body: '{' })).status, 400);
  const loaded = await originalFetch(endpoint, { headers });
  headers['If-Match'] = loaded.headers.get('ETag');
  delaySave = true;
  const saving = originalFetch(endpoint, { method: 'PUT', headers, body: JSON.stringify({ ...DEFAULTS, language: 'zh-CN' }) });
  await sleep(145);
  assert.equal(web.closed, false, 'idle expiry must not interrupt a save');
  const saved = await saving;
  assert.equal(saved.status, 200);
  assert.equal((await originalFetch(endpoint, { method: 'PUT', headers, body: JSON.stringify(DEFAULTS) })).status, 409, 'stale save cannot overwrite newer settings');
  assert.equal(settings.language, 'zh-CN');
  await sleep(220);
  assert.equal(web.closed, true);
  await assert.rejects(originalFetch(endpoint, { headers }));
  web.close();
  const reopened = await startSettingsWeb(() => ({ settings }), async () => {}, () => 5000);
  assert.notEqual(reopened.url, web.url);
  reopened.close();
  console.log('pi-jev-reply checks passed: model selection, preserved fallback, schema, HTTP security and idle shutdown.');
} finally {
  web?.close();
  globalThis.fetch = originalFetch;
  if (oldDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = oldDir;
  if (oldKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = oldKey;
  if (oldLang === undefined) delete process.env.LANG; else process.env.LANG = oldLang;
  await rm(temp, { recursive: true, force: true });
}
