function isBrightCardPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;
  const saturation = max - min;
  return brightness >= 150 && saturation <= 45;
}

function componentBounds(component) {
  return {
    x: component.minX,
    y: component.minY,
    width: component.maxX - component.minX + 1,
    height: component.maxY - component.minY + 1
  };
}

function isCardSized(bounds, imageData, options = {}) {
  const area = bounds.width * bounds.height;
  const imageArea = imageData.width * imageData.height;
  const aspect = bounds.width / bounds.height;
  const minAreaRatio = options.minAreaRatio ?? 0.025;
  const minArea = options.minArea ?? 900;
  return (area >= imageArea * minAreaRatio || area >= minArea)
    && bounds.width >= (options.minWidth ?? 18)
    && bounds.height >= (options.minHeight ?? 28)
    && aspect >= 0.38
    && aspect <= 0.95;
}

export function detectBrightCardShapes(imageData, options = {}) {
  if (!imageData?.data || !imageData.width || !imageData.height) return [];
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const shapes = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = y * width + x;
      if (visited[startIndex] || !isBrightCardPixel(data, startIndex * 4)) continue;

      const queue = [startIndex];
      visited[startIndex] = 1;
      const component = { minX: x, maxX: x, minY: y, maxY: y, pixels: 0 };

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        const cx = current % width;
        const cy = Math.floor(current / width);
        component.pixels += 1;
        component.minX = Math.min(component.minX, cx);
        component.maxX = Math.max(component.maxX, cx);
        component.minY = Math.min(component.minY, cy);
        component.maxY = Math.max(component.maxY, cy);

        const neighbors = [current - 1, current + 1, current - width, current + width];
        for (const next of neighbors) {
          if (next < 0 || next >= visited.length || visited[next]) continue;
          const nx = next % width;
          if ((next === current - 1 && nx !== cx - 1) || (next === current + 1 && nx !== cx + 1)) continue;
          if (!isBrightCardPixel(data, next * 4)) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }

      const bounds = componentBounds(component);
      if (isCardSized(bounds, imageData, options)) {
        shapes.push({ bounds, pixels: component.pixels });
      }
    }
  }

  return shapes.sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
}

const RANK_GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  10: ['01010', '11010', '01010', '01010', '01010', '01010', '11110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001']
};

function isDarkRankPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return (red + green + blue) / 3 <= 95;
}

function sampleRankGlyph(imageData, bounds) {
  const glyphWidth = 5;
  const glyphHeight = 7;
  const sampleX = bounds.x + Math.round(bounds.width * 0.14);
  const sampleY = bounds.y + Math.round(bounds.height * 0.08);
  const sampleWidth = Math.max(glyphWidth, Math.round(bounds.width * 0.36));
  const sampleHeight = Math.max(glyphHeight, Math.round(bounds.height * 0.34));
  const rows = [];

  for (let row = 0; row < glyphHeight; row += 1) {
    let textRow = '';
    for (let col = 0; col < glyphWidth; col += 1) {
      const x0 = sampleX + Math.floor((col * sampleWidth) / glyphWidth);
      const x1 = sampleX + Math.floor(((col + 1) * sampleWidth) / glyphWidth);
      const y0 = sampleY + Math.floor((row * sampleHeight) / glyphHeight);
      const y1 = sampleY + Math.floor(((row + 1) * sampleHeight) / glyphHeight);
      let dark = 0;
      let total = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) continue;
          total += 1;
          if (isDarkRankPixel(imageData.data, (y * imageData.width + x) * 4)) dark += 1;
        }
      }
      textRow += total > 0 && dark / total >= 0.28 ? '1' : '0';
    }
    rows.push(textRow);
  }

  return rows;
}

function scoreGlyph(sample, expected) {
  let matches = 0;
  let total = 0;
  for (let y = 0; y < expected.length; y += 1) {
    for (let x = 0; x < expected[y].length; x += 1) {
      total += 1;
      if (sample[y]?.[x] === expected[y][x]) matches += 1;
    }
  }
  return matches / total;
}

export function detectCardRank(imageData, shape, options = {}) {
  if (!imageData?.data || !shape?.bounds) return null;
  const minConfidence = options.minConfidence ?? 0.86;
  const sample = sampleRankGlyph(imageData, shape.bounds);
  if (!sample.join('').includes('1')) return null;

  const candidates = Object.entries(RANK_GLYPHS)
    .map(([rank, glyph]) => ({ rank, confidence: scoreGlyph(sample, glyph) }))
    .sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  if (!best || best.confidence < minConfidence) return null;
  return { rank: best.rank, confidence: Number(best.confidence.toFixed(2)) };
}

export function buildAutoRecognitionSuggestion({ playerImageData, dealerImageData, playerShapes = [], dealerShapes = [] } = {}) {
  const playerRanks = playerShapes.map((shape) => detectCardRank(playerImageData, shape)?.rank);
  const dealerRanks = dealerShapes.map((shape) => detectCardRank(dealerImageData, shape)?.rank);
  if (playerRanks.length === 0 || dealerRanks.length !== 1 || playerRanks.some((rank) => !rank) || !dealerRanks[0]) {
    return null;
  }
  return {
    playerCards: playerRanks,
    dealerCard: dealerRanks[0],
    summary: `Auto-detected player ${playerRanks.join(',')} vs dealer ${dealerRanks[0]}. Confirm to use this hand.`
  };
}

export function summarizeCardShapeScan({ playerShapes = [], dealerShapes = [], suggestion = null } = {}) {
  if (suggestion) return suggestion.summary;
  if (playerShapes.length === 0 && dealerShapes.length === 0) {
    return 'No card shapes found. Try tighter boxes around only the cards, then Capture once and Scan cards again.';
  }
  const playerLabel = playerShapes.length === 1 ? '1 player card shape' : `${playerShapes.length} player card shapes`;
  const dealerLabel = dealerShapes.length === 1 ? '1 dealer card shape' : `${dealerShapes.length} dealer card shapes`;
  return `Detected ${playerLabel} and ${dealerLabel}. Rank reading comes next.`;
}
