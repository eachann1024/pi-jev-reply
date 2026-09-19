import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, detectLocale, loadSettings, onboardingNotice, parseSettings, saveSettings } from '../lib/settings.ts';
import { eligibleDraft, parseDecision, parseEdited } from '../lib/review.ts';
import { startSettingsWeb } from '../lib/settings-web.ts';

const temp = await mkdtemp(join(tmpdir(), 'pi-jev-reply-'));
const originalFetch = globalThis.fetch;
const oldDir = process.env.PI_CODING_AGENT_DIR;
const oldKey = process.env.TYPESAFE_API_KEY;
const localeKeys = ['LANG', 'LC_ALL', 'LC_MESSAGES'];
const oldLocale = Object.fromEntries(localeKeys.map(key => [key, process.env[key]]));
const restoreLocale = () => {
  for (const key of localeKeys) {
    if (oldLocale[key] === undefined) delete process.env[key];
    else process.env[key] = oldLocale[key];
  }
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const score = (rewrite = .98, visual = 'none') => ({ answers: {
  needs_rewrite: { type: 'noul', noul: rewrite },
  visual: { type: 'choice', choice: visual, confidence: .95, probabilities: { [visual]: .98 } },
} });
let web;
try {
  assert.equal(DEFAULTS.language, 'en');
  assert.equal(DEFAULTS.onboardingSeen, true);
  assert.equal(DEFAULTS.rewriteModel, '');
  assert.equal(detectLocale({}), 'en');
  assert.equal(detectLocale({ LANG: 'en_US.UTF-8' }), 'en');
  assert.equal(detectLocale({ LANG: 'de_DE' }), 'en');
  assert.equal(detectLocale({ LANG: 'C' }), 'en');
  assert.equal(detectLocale({ LANG: 'zh' }), 'zh-CN');
  assert.equal(detectLocale({ LANG: 'zh_CN.UTF-8' }), 'zh-CN');
  assert.equal(detectLocale({ LANG: 'zh-Hans' }), 'zh-CN');
  assert.equal(detectLocale({ LANG: 'zh_TW' }), 'zh-CN');
  assert.equal(detectLocale({ LC_ALL: 'C', LANG: 'zh_CN.UTF-8' }), 'en');
  assert.equal(detectLocale({ LC_ALL: '', LC_MESSAGES: 'zh_CN.UTF-8', LANG: 'en_US.UTF-8' }), 'zh-CN');
  assert.equal(detectLocale({ LC_MESSAGES: 'zh-Hans.UTF-8' }), 'zh-CN');
  assert.match(onboardingNotice('en', false), /No Typesafe\/Jev API key found/);
  assert.match(onboardingNotice('zh-CN', false), /未找到 Typesafe\/Jev API key/);
  assert.match(onboardingNotice('en', true), /\/clear-reply settings/);
  assert.throws(() => parseSettings({ rewriteThreshold: NaN }));
  assert.throws(() => parseSettings({ settingsIdleMinutes: 0 }));
  assert.throws(() => parseSettings({ rewriteModel: 'loop' }));
  assert.throws(() => parseSettings({ unknown: true }));
  assert.equal(parseSettings({ rewriteModel: 'test/provider/model' }).rewriteModel, 'test/provider/model');
  assert.equal(parseSettings({ language: 'en' }).onboardingSeen, true, 'legacy configs skip onboarding');
  const config = join(temp, 'clear-reply.json');
  await saveSettings(config, DEFAULTS);
  assert.deepEqual(await loadSettings(config), DEFAULTS);
  const firstRun = join(temp, 'first-run', 'clear-reply.json');
  delete process.env.LC_ALL;
  delete process.env.LC_MESSAGES;
  process.env.LANG = 'zh_CN.UTF-8';
  const created = await loadSettings(firstRun);
  assert.equal(created.language, 'zh-CN');
  assert.equal(created.onboardingSeen, false);
  assert.equal(JSON.parse(await readFile(firstRun, 'utf8')).language, 'zh-CN');
  process.env.LANG = 'en_US.UTF-8';
  const reread = await loadSettings(firstRun);
  assert.equal(reread.language, 'zh-CN', 'existing language is not overwritten');
  assert.equal(reread.onboardingSeen, false);
  const legacy = join(temp, 'legacy.json');
  await writeFile(legacy, `${JSON.stringify({ language: 'en', enabled: true })}\n`);
  const legacyLoaded = await loadSettings(legacy);
  assert.equal(legacyLoaded.language, 'en');
  assert.equal(legacyLoaded.onboardingSeen, true);
  assert.equal('onboardingSeen' in JSON.parse(await readFile(legacy, 'utf8')), false, 'legacy file stays untouched');
  await writeFile(config, '{');
  await assert.rejects(loadSettings(config));
  assert.equal(await readFile(config, 'utf8'), '{');
  await saveSettings(config, DEFAULTS);
  assert(!eligibleDraft('{"hello":"world"}', 'Return JSON'));
  assert(!eligibleDraft('Use api_key=private-long-value in config.', ''));
  assert(!eligibleDraft('Some lengthy formatted response', '只输出 JSON'));
  assert.deepEqual(parseDecision(score(), DEFAULTS), { rewrite: true, visual: 'none' });
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
    registerMarkdownTransformer: fn => { transformer = fn; }, appendEntry: (...entry) => entries.push(entry),
    exec: () => { throw Error('Settings were not requested'); },
  });
  globalThis.fetch = async (_, options) => {
    calls++;
    const request = JSON.parse(options.body);
    assert(!JSON.stringify(request).includes('test-only-key'));
    return Response.json(score());
  };
  await hooks.get('session_start')({}, ctx);
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
  await hooks.get('session_shutdown')({}, ctx);
  await rm(config, { force: true });
  delete process.env.LC_ALL;
  delete process.env.LC_MESSAGES;
  delete process.env.TYPESAFE_API_KEY;
  process.env.LANG = 'zh_CN.UTF-8';
  const beforeOnboarding = notifications.length;
  await hooks.get('session_start')({}, { ...ctx, mode: 'rpc' });
  assert.equal(notifications.length, beforeOnboarding, 'non-TUI first load does not welcome');
  assert.equal(JSON.parse(await readFile(config, 'utf8')).onboardingSeen, false);
  await hooks.get('session_start')({}, ctx);
  assert.equal(notifications.length, beforeOnboarding + 1, 'first TUI session shows onboarding once');
  assert.equal(notifications.at(-1), onboardingNotice('zh-CN', false));
  const welcomed = JSON.parse(await readFile(config, 'utf8'));
  assert.equal(welcomed.language, 'zh-CN');
  assert.equal(welcomed.onboardingSeen, true);
  await hooks.get('session_start')({}, ctx);
  assert.equal(notifications.length, beforeOnboarding + 1, 'completed onboarding does not repeat');
  await hooks.get('session_shutdown')({}, ctx);
  process.env.TYPESAFE_API_KEY = 'test-only-key';
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
  console.log('Clear Reply checks passed: model selection, preserved fallback, schema, HTTP security and idle shutdown.');
} finally {
  web?.close();
  globalThis.fetch = originalFetch;
  if (oldDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = oldDir;
  if (oldKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = oldKey;
  restoreLocale();
  await rm(temp, { recursive: true, force: true });
}
