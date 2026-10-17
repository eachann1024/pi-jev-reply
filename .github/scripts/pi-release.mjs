// Decide whether a push to main should publish this Pi package to npm, and with which version.
// Usage: RELEASE_PATHS="src package.json package-lock.json" node .github/scripts/pi-release.mjs
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const out = (key, value) => { console.log(`${key}=${value}`); if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); };
const parse = v => /^\d+\.\d+\.\d+$/.test(v ?? '') ? v.split('.').map(Number) : null;
const cmp = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const bump = v => { const [a, b, c] = parse(v); return `${a}.${b}.${c + 1}`; };

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!parse(pkg.version)) throw new Error(`package.json version must be X.Y.Z: ${pkg.version}`);
const paths = (process.env.RELEASE_PATHS ?? '').split(/\s+/).filter(Boolean);
if (!paths.length) throw new Error('RELEASE_PATHS is required');

const res = await fetch(`https://registry.npmjs.org/${pkg.name.replace('/', '%2F')}?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
if (!res.ok && res.status !== 404) throw new Error(`npm registry HTTP ${res.status}`);
const published = Object.keys((res.status === 404 ? {} : (await res.json()).versions) ?? {}).filter(parse).sort(cmp);
const tags = git('tag', '--list', 'v*').split('\n').map(t => t.slice(1)).filter(parse);
const highest = published.at(-1);
out('name', pkg.name);

// Strip version fields so a version-only change does not count as a source change.
const normalized = (ref, file) => {
  let text;
  try { text = ref ? git('show', `${ref}:${file}`) : readFileSync(file, 'utf8'); } catch { return null; }
  const json = JSON.parse(text);
  delete json.version;
  if (json.packages?.['']) delete json.packages[''].version;
  return JSON.stringify(json);
};
const changedSince = ref => {
  const files = git('diff', '--name-only', ref, 'HEAD', '--', ...paths).split('\n').filter(Boolean);
  return files.filter(file => !['package.json', 'package-lock.json'].includes(file) || normalized(ref, file) !== normalized(null, file));
};

if (highest && tags.includes(highest)) {
  const changed = changedSince(`refs/tags/v${highest}`);
  if (!changed.length) {
    console.log(`No release input changed since v${highest}; ${pkg.name}@${highest} is already on npm. Skip.`);
    out('action', 'skip');
    out('version', highest);
    process.exit(0);
  }
  console.log(`Changed since v${highest}: ${changed.join(', ')}`);
}

const taken = [...new Set([...published, ...tags])].sort(cmp);
let version = pkg.version;
if (taken.length && cmp(version, taken.at(-1)) <= 0) version = bump(taken.at(-1));
if (published.includes(version) || tags.includes(version)) throw new Error(`v${version} is already used`);
console.log(`${pkg.name}: package.json ${pkg.version}, npm highest ${highest ?? 'none'} -> publish ${version}`);
out('action', 'publish');
out('version', version);
out('bumped', String(version !== pkg.version));
