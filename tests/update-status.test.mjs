import assert from 'node:assert/strict';
import { test } from 'node:test';

const moduleUrl = new URL('../public/js/update-status.js', import.meta.url);
const { formatUpdateStatusMessage } = await import(moduleUrl.href + `?case=${Date.now()}`);

test('update HTTP 404/401 errors are shown as a short public-release hint instead of raw headers', () => {
  const message = formatUpdateStatusMessage({
    status: 'error',
    message: 'Update check failed: HttpError: 404 Not Found\n"method: GET url: https://github.com/collectorscoveco-oss/blackjack-desktop-companion/releases/download/latest.yml double check that your authentication token is correct. Headers: { very long raw headers }"'
  });

  assert.equal(message, 'Could not reach the public update file. Try again, or open the release page.');
  assert.ok(message.length < 100);
  assert.doesNotMatch(message, /Headers|cookie|authentication token|github-request-id/i);
});

test('normal updater statuses keep their concise message', () => {
  assert.equal(
    formatUpdateStatusMessage({ status: 'current', message: 'You are on the latest available release.' }),
    'You are on the latest available release.'
  );
});
