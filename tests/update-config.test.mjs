import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('packaged app is configured to publish updates from GitHub Releases', () => {
  assert.equal(packageJson.dependencies['electron-updater'].startsWith('^'), true);
  assert.deepEqual(packageJson.build.publish, [
    {
      provider: 'github',
      owner: 'collectorscoveco-oss',
      repo: 'blackjack-desktop-companion'
    }
  ]);
});

test('Windows build artifact includes updater metadata files required by electron-updater', async () => {
  const workflow = await readFile(new URL('../.github/workflows/build-windows.yml', import.meta.url), 'utf8');

  assert.match(workflow, /dist\/\*\.exe/);
  assert.match(workflow, /dist\/latest\.yml/);
  assert.match(workflow, /dist\/\*\.exe\.blockmap/);
});

test('renderer exposes an update dropdown in the top toolbar', async () => {
  const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /id="update-menu-select"/);
  assert.match(appSource, /Check for updates/);
  assert.match(appSource, /Install downloaded update/);
});

test('preload exposes safe update methods to the renderer', async () => {
  const preloadSource = await readFile(new URL('../electron/preload.js', import.meta.url), 'utf8');

  assert.match(preloadSource, /checkForUpdates/);
  assert.match(preloadSource, /installUpdate/);
  assert.match(preloadSource, /onUpdateStatus/);
});
