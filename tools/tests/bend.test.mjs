// Проверка математики изгиба листа: node --test tools/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, fillLeaf, leafPoint, solveTurn, stackZ, orderTurns } from '../../assets/js/menu3d/bend.js';

const H = 2263 / 1600;
const COUNT = COLS * ROWS;
const TURNS = [0.02, 0.045, 0.1, 0.15, 0.25, 0.35, 0.5, 0.65, 0.75, 0.9, 0.98];
const FIELDS = [
    { vGrab: 0.12, back: false },
    { vGrab: 0.9, back: false },
    { vGrab: 0.5, back: true },
    { vGrab: 0, back: true },
];

function fill(t, o, z = 0.003) {
    const pos = new Float32Array(COUNT * 3);
    const nrm = new Float32Array(COUNT * 3);
    fillLeaf(pos, nrm, t, { h: H, z, ...o });
    return { pos, nrm };
}

test('t = 0: лист лежит плоско справа', () => {
    for (const o of FIELDS) {
        const { pos, nrm } = fill(0, o);
        for (let i = 0; i < COUNT; i++) {
            assert.ok(Math.abs(pos[3 * i] - (i % COLS) / (COLS - 1)) < 1e-5);
            assert.ok(Math.abs(pos[3 * i + 2] - 0.003) < 1e-6);
            assert.ok(Math.abs(nrm[3 * i + 2] - 1) < 1e-5);
        }
    }
});

test('t = 1: лист лежит плоско слева, лицом вниз', () => {
    for (const o of FIELDS) {
        const { pos, nrm } = fill(1, o);
        for (let i = 0; i < COUNT; i++) {
            assert.ok(Math.abs(pos[3 * i] + (i % COLS) / (COLS - 1)) < 1e-5);
            assert.ok(Math.abs(pos[3 * i + 2] - 0.003) < 1e-5);
            assert.ok(Math.abs(nrm[3 * i + 2] + 1) < 1e-5);
        }
    }
});

test('бумага не тянется: длина вдоль u сохраняется в пределах 1%', () => {
    for (const o of FIELDS) {
        for (const t of TURNS) {
            const { pos } = fill(t, o);
            for (let r = 0; r < ROWS; r++) {
                let length = 0;
                for (let c = 1; c < COLS; c++) {
                    const p = 3 * (r * COLS + c);
                    length += Math.hypot(pos[p] - pos[p - 3], pos[p + 2] - pos[p - 1]);
                }
                assert.ok(Math.abs(length - 1) < 0.01, 't=' + t + ' row=' + r + ' length=' + length);
            }
        }
    }
});

test('лист не уходит под стопку, нормали единичной длины', () => {
    for (const o of FIELDS) {
        for (const t of TURNS) {
            const { pos, nrm } = fill(t, o);
            for (let i = 0; i < COUNT; i++) {
                assert.ok(pos[3 * i + 2] >= 0.003 - 1e-6);
                assert.ok(Math.abs(Math.hypot(nrm[3 * i], nrm[3 * i + 1], nrm[3 * i + 2]) - 1) < 1e-4);
            }
        }
    }
});

test('обратное листание — зеркало прямого', () => {
    const fwd = leafPoint(0.8, 0.3, 0.3, { vGrab: 0.3, back: false }, [0, 0]);
    const bwd = leafPoint(0.8, 0.3, 0.7, { vGrab: 0.3, back: true }, [0, 0]);
    assert.ok(Math.abs(fwd[0] + bwd[0]) < 1e-9);
    assert.ok(Math.abs(fwd[1] - bwd[1]) < 1e-9);
});

test('solveTurn возвращает лист под указатель и монотонен', () => {
    for (const o of FIELDS) {
        for (const u of [0.3, 0.6, 0.9, 1]) {
            let before = -1;
            for (let x = u; x >= -u; x -= u / 25) {
                const t = solveTurn(x, u, o);
                assert.ok(t >= before - 1e-3, 'монотонность: x=' + x);
                before = t;
                if (t > 0 && t < 1) {
                    assert.ok(Math.abs(leafPoint(u, o.vGrab, t, o)[0] - x) < 0.004, 'u=' + u + ' x=' + x);
                }
            }
            assert.equal(solveTurn(u + 0.1, u, o), 0);
            assert.equal(solveTurn(-u - 0.1, u, o), 1);
        }
    }
});

test('solveTurn учитывает наклон луча зрения', () => {
    const o = { vGrab: 0.5, back: false, slope: -0.15 };
    const t = solveTurn(0.2, 0.9, o);
    const p = leafPoint(0.9, 0.5, t, o);
    assert.ok(Math.abs(p[0] - o.slope * p[1] - 0.2) < 0.004);
});

test('стопки: справа сверху первый лист, слева — последний', () => {
    assert.ok(stackZ(0, 4, 0, 0.0015) > stackZ(1, 4, 0, 0.0015));
    assert.ok(stackZ(3, 4, 1, 0.0015) > stackZ(2, 4, 1, 0.0015));
    assert.equal(stackZ(3, 4, 0, 0.0015), 0);
});

test('лист в повороте не опускается ниже стопки, на которой ещё лежит его корень', () => {
    const below = stackZ(1, 4, 0, 0.0015);
    for (const t of [0.1, 0.25, 0.4, 0.45]) {
        assert.ok(stackZ(0, 4, t, 0.0015) > below, 'вперёд, t=' + t);
    }
    // Последний лист возвращают слева направо: пока корень слева, он выше левой стопки
    const left = stackZ(2, 4, 1, 0.0015);
    for (const t of [0.9, 0.75, 0.6, 0.55]) {
        assert.ok(stackZ(3, 4, t, 0.0015, true) > left, 'назад, t=' + t);
    }
    assert.equal(stackZ(0, 4, 1, 0.0015), 0);
    assert.equal(stackZ(3, 4, 0, 0.0015, true), 0);
});

test('листы не проходят друг сквозь друга', () => {
    const forward = [{ x: 0.4, v: 1, target: 1 }, { x: 0.6, v: 3, target: 1 }, { x: 0, v: 0, target: 0 }];
    orderTurns(forward);
    assert.deepEqual(forward.map((leaf) => leaf.x), [0.4, 0.4, 0]);
    assert.equal(forward[1].v, 1);

    const backward = [{ x: 0.3, v: -3, target: 0 }, { x: 0.5, v: -1, target: 0 }, { x: 0.7, v: -1, target: 0 }];
    orderTurns(backward);
    assert.deepEqual(backward.map((leaf) => leaf.x), [0.7, 0.7, 0.7]);

    const pinned = [{ x: 0.2, v: 0, target: 1 }, { x: 0.6, v: 0, target: 0 }];
    orderTurns(pinned, 1);
    assert.deepEqual(pinned.map((leaf) => leaf.x), [0.6, 0.6]);

    const random = Array.from({ length: 6 }, (unused, i) => ({ x: (i * 0.37) % 1, v: 0, target: i < 3 ? 1 : 0 }));
    orderTurns(random);
    for (let i = 1; i < random.length; i++) {
        assert.ok(random[i].x <= random[i - 1].x);
    }
});
