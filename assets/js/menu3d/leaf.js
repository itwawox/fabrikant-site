// Один лист газеты: две страницы на одной сетке вершин.
// Лицо и оборот — два меша с общими координатами и нормалями: один рисует только переднюю
// сторону треугольников, другой только заднюю. Глубина у них совпадает до бита, поэтому
// стороны не «дерутся» (нет ряби), а развёртка и затенение у каждой свои.
import {
    BackSide, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, FrontSide, Mesh, MeshLambertMaterial,
} from 'three';
import { COLS, ROWS, fillLeaf } from './bend.js';

const COUNT = COLS * ROWS;
// Насколько темнеет вогнутая сторона на самом крутом изгибе: туда попадает меньше рассеянного света
const HOLLOW = 0.16;

// Тень в корешке: узкая тёмная складка и широкий мягкий спад. Белая бумага остаётся белой уже
// в десятой доле ширины страницы от корешка.
function gutter(u) {
    return 0.3 * Math.exp(-u / 0.03) + 0.08 * Math.exp(-u / 0.1);
}

/** Создаёт лист высотой h (ширина 1). blank — белая текстура-заглушка, пока страница грузится. */
export function createLeaf(h, blank) {
    const pos = new Float32Array(COUNT * 3);
    const nrm = new Float32Array(COUNT * 3);
    const curv = new Float32Array(COUNT);
    const uvs = [new Float32Array(COUNT * 2), new Float32Array(COUNT * 2)];
    const tints = [new Float32Array(COUNT * 3), new Float32Array(COUNT * 3)];
    const index = [];
    for (let r = 0, i = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++, i++) {
            const u = c / (COLS - 1);
            // Картинки загружаются без переворота (flipY = false), поэтому верх страницы — v = 0.
            // На обороте страница читается слева направо от внешнего края к корешку.
            uvs[0].set([u, 1 - r / (ROWS - 1)], 2 * i);
            uvs[1].set([1 - u, 1 - r / (ROWS - 1)], 2 * i);
            if (r < ROWS - 1 && c < COLS - 1) {
                index.push(i, i + 1, i + COLS + 1, i, i + COLS + 1, i + COLS);
            }
        }
    }
    const position = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const normal = new BufferAttribute(nrm, 3).setUsage(DynamicDrawUsage);

    const sides = [FrontSide, BackSide].map((side, n) => {
        const geometry = new BufferGeometry();
        geometry.setIndex(index);
        geometry.setAttribute('position', position);
        geometry.setAttribute('normal', normal);
        geometry.setAttribute('uv', new BufferAttribute(uvs[n], 2));
        geometry.setAttribute('color', new BufferAttribute(tints[n], 3).setUsage(DynamicDrawUsage));
        // Тень от листа одна на обе стороны: её отбрасывает лицевой меш, считая обе стороны
        const material = new MeshLambertMaterial({ map: blank, vertexColors: true, side, shadowSide: DoubleSide });
        const mesh = new Mesh(geometry, material);
        // Лист гнётся, а границы three пересчитывать незачем: книга всегда в кадре
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.receiveShadow = true;
        return mesh;
    });

    let key = '';

    return {
        meshes: sides,

        /**
         * Ставит лист в положение t. o — параметры изгиба (см. fillLeaf), gutters = [лицо, оборот] —
         * сила тени в корешке, 0…1. Возвращает true, если лист действительно изменился.
         */
        update(t, o, gutters) {
            const next = [t, o.z, o.vGrab, o.back, gutters[0].toFixed(2), gutters[1].toFixed(2)].join();
            if (next === key) {
                return false;
            }
            key = next;
            o.h = h;
            o.curv = curv;
            fillLeaf(pos, nrm, t, o);
            position.needsUpdate = true;
            normal.needsUpdate = true;
            for (let n = 0; n < 2; n++) {
                const tint = tints[n];
                for (let i = 0; i < COUNT; i++) {
                    const hollow = Math.max(0, n ? -curv[i] : curv[i]);
                    const value = (1 - gutters[n] * gutter((i % COLS) / (COLS - 1))) * (1 - HOLLOW * hollow);
                    tint[3 * i] = tint[3 * i + 1] = tint[3 * i + 2] = value;
                }
                sides[n].geometry.attributes.color.needsUpdate = true;
            }
            return true;
        },

        /** Назначает картинку стороне: 0 — лицо, 1 — оборот. */
        setMap(n, texture) {
            sides[n].material.map = texture;
        },

        /** Тень отбрасывает только лист, оторванный от стопки. */
        cast(on) {
            if (sides[0].castShadow === on) {
                return false;
            }
            sides[0].castShadow = on;
            return true;
        },

        /** После восстановления контекста лист нужно залить заново. */
        reset() {
            key = '';
        },

        dispose() {
            sides.forEach((mesh) => {
                mesh.geometry.dispose();
                mesh.material.dispose();
            });
        },
    };
}
