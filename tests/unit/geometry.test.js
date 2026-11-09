import test from 'node:test';
import assert from 'node:assert/strict';
import { floatingLayout, roundedRegion, containsPoint, clampAnchor } from '../../electron/geometry.js';
test('四角、多显示器负坐标的展开均不越界，球的屏幕位置保持不变', () => {
  for (const work of [{ x: 0, y: 0, width: 1280, height: 720 }, { x: -1920, y: -200, width: 1920, height: 1040 }]) {
    for (const point of [{ x: work.x, y: work.y }, { x: work.x + work.width - 68, y: work.y + work.height - 68 }]) {
      const expanded = floatingLayout(point, work, true);
      assert.ok(expanded.bounds.x >= work.x && expanded.bounds.x + expanded.bounds.width <= work.x + work.width);
      assert.ok(expanded.bounds.y >= work.y && expanded.bounds.y + expanded.bounds.height <= work.y + work.height);
      assert.equal(expanded.bounds.x + expanded.ball.x, point.x + 8);
      assert.equal(expanded.bounds.y + expanded.ball.y, point.y + 8);
      assert.ok(containsPoint(expanded.bridge, expanded.bridge.x + 1, expanded.ball.y + 20));
    }
  }
  assert.deepEqual(clampAnchor({ x: 2000, y: -20 }, { x: 0, y: 0, width: 1000, height: 800 }), { x: 932, y: 0 });
});
test('圆球原生区域排除角落透明像素，中心可点击', () => {
  const rect = { x: 8, y: 8, width: 52, height: 52 };
  const regions = roundedRegion(rect, 26);
  assert.ok(regions.some((item) => containsPoint(item, 34, 34)));
  assert.ok(!regions.some((item) => containsPoint(item, 8, 8)));
});
