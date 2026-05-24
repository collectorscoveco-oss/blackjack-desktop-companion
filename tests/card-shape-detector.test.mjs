import assert from 'node:assert/strict';
import { test } from 'node:test';

const moduleUrl = new URL('../public/js/card-shape-detector.js', import.meta.url);
const {
  buildAutoRecognitionSuggestion,
  detectBrightCardShapes,
  detectCardRank,
  summarizeCardShapeScan
} = await import(moduleUrl.href + `?case=${Date.now()}`);

const TEST_RANK_GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  10: ['01010', '11010', '01010', '01010', '01010', '01010', '11110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001']
};

function paintRect(imageData, rect, color = [235, 235, 225]) {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) continue;
      const idx = (y * imageData.width + x) * 4;
      imageData.data[idx] = color[0];
      imageData.data[idx + 1] = color[1];
      imageData.data[idx + 2] = color[2];
      imageData.data[idx + 3] = 255;
    }
  }
}

function makeImageData(width, height, rectangles = []) {
  const data = new Uint8ClampedArray(width * height * 4);
  const imageData = { width, height, data };
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = 20;
    data[i * 4 + 1] = 75;
    data[i * 4 + 2] = 50;
    data[i * 4 + 3] = 255;
  }
  for (const rect of rectangles) paintRect(imageData, rect);
  return imageData;
}

function drawRank(imageData, rank, originX, originY, scale = 3) {
  const rows = TEST_RANK_GLYPHS[rank];
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      if (rows[y][x] === '1') {
        paintRect(imageData, { x: originX + x * scale, y: originY + y * scale, width: scale, height: scale }, [25, 25, 25]);
      }
    }
  }
}

function makeCardRegionWithRanks(cards) {
  const imageData = makeImageData(220, 90);
  cards.forEach((rank, index) => {
    const x = 12 + index * 62;
    paintRect(imageData, { x, y: 14, width: 42, height: 62 });
    drawRank(imageData, rank, x + 6, 19, 3);
  });
  return imageData;
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

test('detects small card shapes inside a wide black-padded capture preview', () => {
  const imageData = makeImageData(900, 120);
  for (let i = 0; i < imageData.width * imageData.height; i += 1) {
    imageData.data[i * 4] = 0;
    imageData.data[i * 4 + 1] = 4;
    imageData.data[i * 4 + 2] = 10;
  }
  paintRect(imageData, { x: 420, y: 8, width: 95, height: 104 }, [10, 100, 12]);
  paintRect(imageData, { x: 452, y: 34, width: 27, height: 47 });
  paintRect(imageData, { x: 485, y: 28, width: 28, height: 49 });

  const shapes = detectBrightCardShapes(imageData);

  assert.equal(shapes.length, 2);
  assert.deepEqual(shapes.map((shape) => shape.bounds), [
    { x: 452, y: 34, width: 27, height: 47 },
    { x: 485, y: 28, width: 28, height: 49 }
  ]);
});

test('summarizes empty scans with setup guidance instead of a dead-end zero count', () => {
  assert.equal(
    summarizeCardShapeScan({ playerShapes: [], dealerShapes: [] }),
    'No card shapes found. Try tighter boxes around only the cards, then Capture once and Scan cards again.'
  );
});

test('detects a simple dark corner rank from a bright card shape', () => {
  const imageData = makeCardRegionWithRanks(['A']);
  const [shape] = detectBrightCardShapes(imageData);

  const result = detectCardRank(imageData, shape);

  assert.deepEqual(result, { rank: 'A', confidence: 1 });
});

test('builds an auto recognition suggestion when all player and dealer ranks are readable', () => {
  const playerImageData = makeCardRegionWithRanks(['K', '6']);
  const dealerImageData = makeCardRegionWithRanks(['10']);
  const playerShapes = detectBrightCardShapes(playerImageData);
  const dealerShapes = detectBrightCardShapes(dealerImageData, { minAreaRatio: 0.015 });

  const suggestion = buildAutoRecognitionSuggestion({ playerImageData, dealerImageData, playerShapes, dealerShapes });

  assert.deepEqual(suggestion.playerCards, ['K', '6']);
  assert.equal(suggestion.dealerCard, '10');
  assert.equal(suggestion.summary, 'Auto-detected player K,6 vs dealer 10. Confirm to use this hand.');
});

test('does not build an auto suggestion when a rank is unreadable', () => {
  const playerImageData = makeCardRegionWithRanks(['K']);
  const dealerImageData = makeImageData(100, 80, [{ x: 12, y: 14, width: 42, height: 62 }]);
  const playerShapes = detectBrightCardShapes(playerImageData);
  const dealerShapes = detectBrightCardShapes(dealerImageData, { minAreaRatio: 0.015 });

  const suggestion = buildAutoRecognitionSuggestion({ playerImageData, dealerImageData, playerShapes, dealerShapes });

  assert.equal(suggestion, null);
});

test('summarizes player and dealer card-shape scan results for the UI', () => {
  assert.equal(
    summarizeCardShapeScan({ playerShapes: [{}, {}], dealerShapes: [{}] }),
    'Detected 2 player card shapes and 1 dealer card shape. Rank reading comes next.'
  );
});
