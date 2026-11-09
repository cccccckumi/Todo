export const BALL_WINDOW_SIZE = 68;
export const EXPANDED_SIZE = { width: 400, height: 324 };

export function clampAnchor(anchor, work) {
  return {
    x: Math.round(Math.min(Math.max(anchor.x, work.x), work.x + work.width - BALL_WINDOW_SIZE)),
    y: Math.round(Math.min(Math.max(anchor.y, work.y), work.y + work.height - BALL_WINDOW_SIZE)),
  };
}

export function floatingLayout(anchor, work, expanded) {
  const point = clampAnchor(anchor, work);
  if (!expanded) return {
    bounds: { ...point, width: 68, height: 68 },
    ball: { x: 8, y: 8, width: 52, height: 52 }, panel: null, bridge: null, expanded: false,
  };
  const left = point.x - work.x >= EXPANDED_SIZE.width - BALL_WINDOW_SIZE;
  const bounds = {
    x: left ? point.x - 332 : point.x,
    y: Math.min(point.y, work.y + work.height - EXPANDED_SIZE.height),
    ...EXPANDED_SIZE,
  };
  const ball = { x: left ? 340 : 8, y: point.y - bounds.y + 8, width: 52, height: 52 };
  const panel = { x: left ? 8 : 76, y: 8, width: 316, height: 308 };
  return { bounds, ball, panel, bridge: { x: left ? 324 : 60, y: ball.y + 12, width: 16, height: 28 }, expanded: true };
}

export function roundedRegion({ x, y, width, height }, radius) {
  const rects = [];
  for (let row = 0; row < height; row++) {
    const distance = row < radius ? radius - row - 0.5 : row >= height - radius ? row - (height - radius) + 0.5 : 0;
    const inset = distance > 0 ? Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - distance * distance))) : 0;
    rects.push({ x: x + inset, y: y + row, width: width - inset * 2, height: 1 });
  }
  return rects;
}

export function containsPoint(rect, x, y) {
  return rect && x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}
