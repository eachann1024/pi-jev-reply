import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const name of ['README.md', 'README.zh-CN.md']) {
  const readme = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  assert.match(readme, /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/, `${name}: keep the inline user-attachments video`);
  assert.doesNotMatch(readme, /https:\/\/(?:github\.com\/[^\s)"]*\/(?:raw|blob)|raw\.githubusercontent\.com)\/[^\s)"]*\.mp4/i, `${name}: must not link repository mp4 files`);
  assert.doesNotMatch(readme, /Watch the (?:guide )?video|观看(?:引导)?视频|点击观看|旁白版|English narration/, `${name}: no extra demo text links`);
}
console.log('README media checks passed.');
