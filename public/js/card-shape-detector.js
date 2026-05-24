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

function isCardSized(bounds, imageData, minAreaRatio) {
  const area = bounds.width * bounds.height;
  const imageArea = imageData.width * imageData.height;
  const aspect = bounds.width / bounds.height;
  return area >= imageArea * minAreaRatio
    && bounds.width >= 18
    && bounds.height >= 28
    && aspect >= 0.38
    && aspect <= 0.95;
}

export function detectBrightCardShapes(imageData, options = {}) {
  if (!imageData?.data || !imageData.width || !imageData.height) return [];
  const { width, height, data } = imageData;
  const minAreaRatio = options.minAreaRatio ?? 0.025;
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
      if (isCardSized(bounds, imageData, minAreaRatio)) {
        shapes.push({ bounds, pixels: component.pixels });
      }
    }
  }

  return shapes.sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
}

export function summarizeCardShapeScan({ playerShapes = [], dealerShapes = [] } = {}) {
  const playerLabel = playerShapes.length === 1 ? '1 player card shape' : `${playerShapes.length} player card shapes`;
  const dealerLabel = dealerShapes.length === 1 ? '1 dealer card shape' : `${dealerShapes.length} dealer card shapes`;
  return `Detected ${playerLabel} and ${dealerLabel}. Rank reading comes next.`;
}
