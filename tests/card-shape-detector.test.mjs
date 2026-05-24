import assert from 'node:assert/strict';
import { test } from 'node:test';

const moduleUrl = new URL('../public/js/card-shape-detector.js', import.meta.url);
const { detectBrightCardShapes, summarizeCardShapeScan } = await import(moduleUrl.href + `?case=${Date.now()}`);

function makeImageData(width, height, rectangles = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = 20;
    data[i * 4 + 1] = 75;
    data[i * 4 + 2] = 50;
    data[i * 4 + 3] = 255;
  }
  for (const rect of rectangles) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const idx = (y * width + x) * 4;
        data[idx] = 235;
        data[idx + 1] = 235;
        data[idx + 2] = 225;
        data[idx + 3] = 255;
      }
    }
  }
  return { width, height, data };
}

test('detects separated bright card-shaped rectangles inside a selected region', () => {
  const imageData = makeImageData(180, 90, [
    { x: 12, y: 14, width: 42, height: 62 },
    { x: 72, y: 13, width: 43, height: 63 }
  ]);

  const shapes = detectBrightCardShapes(imageData);

  assert.equal(shapes.length, 2);
  assert.deepEqual(shapes.map((shape) => shape.bounds), [
    { x: 12, y: 14, width: 42, height: 62 },
    { x: 72, y: 13, width: 43, height: 63 }
  ]);
});

test('ignores tiny bright chips and text that are not card sized', () => {
  const imageData = makeImageData(160, 80, [
    { x: 8, y: 10, width: 8, height: 8 },
    { x: 40, y: 12, width: 35, height: 52 }
  ]);

  const shapes = detectBrightCardShapes(imageData);

  assert.equal(shapes.length, 1);
  assert.deepEqual(shapes[0].bounds, { x: 40, y: 12, width: 35, height: 52 });
});

test('summarizes player and dealer card-shape scan results for the UI', () => {
  assert.equal(
    summarizeCardShapeScan({ playerShapes: [{}, {}], dealerShapes: [{}] }),
    'Detected 2 player card shapes and 1 dealer card shape. Rank reading comes next.'
  );
});
