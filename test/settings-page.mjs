import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { DEFAULTS } from '../lib/settings.ts';

// Execute the shipped page controller without a browser or model service.
const html = await readFile(new URL('../lib/settings.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    value: '', checked: false, type: ['enabled','rewrite','visuals','hideDraft'].includes(id) ? 'checkbox' : 'text',
    validity: {valid:true}, dataset:{}, textContent:'', className:'',
    setAttribute() {}, addEventListener() {}, setCustomValidity() {}, replaceChildren() {}, append() {},
  });
  return elements.get(id);
};
const snapshot = {settings:{...DEFAULTS, onboardingPending:true}, defaults:DEFAULTS, models:[], keyAvailable:false};
let calls = [], response = () => Promise.resolve({ok:true, headers:new Headers({ETag:'"v1"'}), json:async () => structuredClone(snapshot)});
const context = vm.createContext({
  document:{getElementById:element, documentElement:{}, querySelectorAll:() => [], querySelector: selector => element(selector), createElement:() => element(Symbol())},
  location:{hash:'#test-only',pathname:'/',search:''}, history:{replaceState() {}}, window:{addEventListener() {}},
  fetch:async (_, options) => {calls.push(options); return response();}, AbortSignal, confirm:() => true,
  setTimeout, clearTimeout,
});
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
const settle = () => new Promise(resolve => setImmediate(resolve));
await settle();
assert.equal(calls.length, 1, 'boot only reads');
assert.equal(run('dirty()'), false);
assert.equal(element('instructions').value, run("presetInstructions('en')"), 'empty instructions show the language default');
run("switchLanguage('zh-CN')");
assert.equal(run('dirty()'), true);
assert.equal(calls.length, 1, 'language changes wait for autosave');
assert.equal(element('instructions').value, run("presetInstructions('zh-CN')"));
let finish;
response = () => new Promise(resolve => {finish = resolve;});
const saving = run('save()');
await settle();
assert.equal(JSON.parse(calls[1].body).onboardingPending, true, 'full snapshot preserves onboarding state');
assert.equal(calls[1].headers['If-Match'], '"v1"');
assert.equal(element('settingsFields').disabled, false, 'autosave keeps the form editable');
await run('save()');
assert.equal(calls.length, 2, 'no overlapping save');
finish({ok:false,status:409});
await saving;
assert.equal(run('dirty()'), true, 'conflict retains edits');
assert.equal(run('conflict'), true);
assert.equal(element('reload').hidden, false);
await run('save()');
assert.equal(calls.length, 2, 'conflicted revision cannot save again');
response = () => Promise.resolve({ok:true,headers:new Headers({ETag:'"v2"'}),json:async()=>structuredClone(snapshot)});
await run('load()');
run("$('instructions').value = 'Keep this custom note'; notice = 'dirty'");
response = () => Promise.reject(new Error('offline'));
await run('save()');
assert.equal(element('instructions').value, 'Keep this custom note');
assert.equal(run('version'), '"v2"', 'uncertain save retains old version');
assert.equal(run('dirty()'), true);
assert.equal(element('settingsFields').disabled, false);
snapshot.settings.rewriteThreshold = 0;
response = () => Promise.resolve({ok:true,headers:new Headers({ETag:'"v3"'}),json:async()=>structuredClone(snapshot)});
await run('load()');
assert.equal(run('dirty()'), false);
element('rewriteThreshold').value = '';
assert.equal(run('dirty()'), true, 'empty numeric draft differs from saved zero');
console.log('Settings page checks passed: explicit saves, language, onboarding preservation, request locking, conflict and offline edits.');
