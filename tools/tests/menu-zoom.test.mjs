// Тесты масштаба, в котором открывается окно увеличения: node --test tools/tests/menu-zoom.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readingView } from '../../assets/js/menu3d/zoom.js';

// Вписанная страница: телефон 390 px (лист во всю ширину) и ПК 1200 × 760 (лист вписан по высоте)
const phone = { w: 390, h: 700, fw: 390, fh: 552, ox: 0, oy: 74 };
const desktop = { w: 1200, h: 760, fw: 537, fh: 760, ox: 331.5, oy: 0 };

// Где точка листа (доли) окажется на экране после масштаба и сдвига
const onScreen = (f, v, at) => ({
    x: v.x + v.scale * (f.ox + at.x * f.fw),
    y: v.y + v.scale * (f.oy + at.y * f.fh),
});

test('лист открывается шириной около 1000 px', () => {
    assert.ok(Math.abs(readingView(phone, { x: 0, y: 0 }).scale * phone.fw - 1000) < 1);
    assert.ok(Math.abs(readingView(desktop, { x: 0, y: 0 }).scale * desktop.fw - 1000) < 1);
});

test('точка, куда нажали, остаётся на месте', () => {
    for (const f of [phone, desktop]) {
        for (const at of [{ x: 0, y: 0 }, { x: .5, y: .5 }, { x: .83, y: .27 }, { x: 1, y: 1 }]) {
            const before = onScreen(f, { scale: 1, x: 0, y: 0 }, at);
            const after = onScreen(f, readingView(f, at), at);
            assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9, JSON.stringify(at));
        }
    }
});

test('масштаб не меньше 1 и не больше предела', () => {
    const huge = { w: 3000, h: 2000, fw: 1414, fh: 2000, ox: 793, oy: 0 };
    assert.equal(readingView(huge, { x: 0, y: 0 }).scale, 1);
    const tiny = { w: 200, h: 300, fw: 200, fh: 283, ox: 0, oy: 8 };
    assert.equal(readingView(tiny, { x: 0, y: 0 }).scale, 4);
    assert.equal(readingView(tiny, { x: 0, y: 0 }, 3).scale, 3);
});
