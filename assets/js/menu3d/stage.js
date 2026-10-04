// Сцена: холст, камера, свет, тени и отрисовка «по требованию».
// Кадр рисуется только когда что-то изменилось; в покое не остаётся ни одного requestAnimationFrame.
import {
    AmbientLight, BufferAttribute, BufferGeometry, Color, DataTexture, DirectionalLight, LinearFilter, Mesh,
    MeshBasicMaterial, PCFShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';

export const FOV = 30;

const MAX_PIXELS = 3e6;
// Свет сверху слева. Доля рассеянного света задаёт глубину теней: в тени остаётся AMBIENT яркости.
const LIGHT = new Vector3(-0.4, 0.32, 1).normalize();
const AMBIENT = 0.6;
// Небольшой запас яркости: белая бумага должна остаться белой и после округлений
const GAIN = 1.02;
// Тень лежащей газеты на столе: насколько выходит за край листа и насколько темна
const SHADE = 0.16;
const SHADE_ALPHA = 0.62;

// Мягкая тень-рамка: посередине плотная, к краям сходит на нет. Натягивается на сетку 4 × 4
// («девять частей»), поэтому углы остаются круглыми при любой ширине газеты.
function shadeTexture() {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let j = 0, p = 3; j < size; j++) {
        for (let i = 0; i < size; i++, p += 4) {
            const dx = Math.max(0, Math.abs((i + 0.5) / size - 0.5) - 0.25) * 4;
            const dy = Math.max(0, Math.abs((j + 0.5) / size - 0.5) - 0.25) * 4;
            const fade = Math.max(0, 1 - Math.hypot(dx, dy));
            data[p] = 255 * SHADE_ALPHA * fade * fade * (3 - 2 * fade) * fade;
        }
    }
    const texture = new DataTexture(data, size, size);
    texture.magFilter = texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

/**
 * Создаёт сцену внутри el. h — высота страницы (ширина 1), lite — телефон (карта теней меньше).
 * hooks: frame(dt) → true, пока нужно продолжать; resize(); hide(); restore(); fail(причина).
 */
export function createStage(el, h, lite, hooks) {
    const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;outline:0;user-select:none;-webkit-user-select:none;'
        + '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent';
    canvas.setAttribute('role', 'img');

    // Цвет стола — тот же, что у подложки в CSS: холст появляется без вспышки
    const table = getComputedStyle(el).getPropertyValue('--gz-table').trim() || '#1c0a02';
    renderer.setClearColor(new Color(table), 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;

    const scene = new Scene();
    scene.matrixWorldAutoUpdate = false;
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 10);

    // Яркость подобрана так, чтобы лежащая страница показывала ровно цвета картинки:
    // у материала Ламберта отражение = цвет × (рассеянный + прямой × косинус) / π
    scene.add(new AmbientLight(0xffffff, Math.PI * AMBIENT * GAIN));
    const light = new DirectionalLight(0xffffff, Math.PI * (1 - AMBIENT) * GAIN / LIGHT.z);
    light.position.copy(LIGHT).multiplyScalar(3);
    light.castShadow = true;
    const shadow = light.shadow;
    shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
    shadow.radius = lite ? 3 : 6;
    shadow.bias = -0.0004;
    shadow.normalBias = 0.01;
    // Область теней — ровно газета с поднятым листом: все точки коробки в осях источника света
    const axisX = new Vector3(0, 1, 0).cross(LIGHT).normalize();
    const axisY = LIGHT.clone().cross(axisX);
    const box = { left: 9, right: -9, bottom: 9, top: -9, near: 9, far: -9 };
    for (let n = 0; n < 8; n++) {
        const p = new Vector3(n & 1 ? 1.03 : -1.03, (n & 2 ? 0.52 : -0.52) * h, n & 4 ? 1.05 : -0.01)
            .sub(light.position);
        box.left = Math.min(box.left, p.dot(axisX));
        box.right = Math.max(box.right, p.dot(axisX));
        box.bottom = Math.min(box.bottom, p.dot(axisY));
        box.top = Math.max(box.top, p.dot(axisY));
        box.near = Math.min(box.near, -p.dot(LIGHT));
        box.far = Math.max(box.far, -p.dot(LIGHT));
    }
    Object.assign(shadow.camera, box);
    shadow.camera.updateProjectionMatrix();
    scene.add(light, light.target);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();

    // Тень газеты на столе запечена в картинку: настоящая тень от лежащих листов стоила бы
    // карты теней в каждом кадре, а выглядела бы так же
    const shadeXs = [-1 - SHADE, -1, 1, 1 + SHADE];
    const shadeYs = [-h / 2 - SHADE, -h / 2, h / 2, h / 2 + SHADE];
    const shadePos = new Float32Array(48);
    const shadeUv = new Float32Array(32);
    const shadeIndex = [];
    for (let j = 0, i = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++, i++) {
            // Сдвиг вправо-вниз — от источника света
            shadePos.set([shadeXs[k] + 0.012, shadeYs[j] - 0.014, -0.004], 3 * i);
            shadeUv.set([[0, 0.25, 0.75, 1][k], [0, 0.25, 0.75, 1][j]], 2 * i);
            if (j < 3 && k < 3) {
                shadeIndex.push(i, i + 1, i + 5, i, i + 5, i + 4);
            }
        }
    }
    const shadeGeometry = new BufferGeometry();
    shadeGeometry.setIndex(shadeIndex);
    shadeGeometry.setAttribute('position', new BufferAttribute(shadePos, 3));
    shadeGeometry.setAttribute('uv', new BufferAttribute(shadeUv, 2));
    const shadeMap = shadeTexture();
    const shade = new Mesh(shadeGeometry, new MeshBasicMaterial({
        color: 0, map: shadeMap, transparent: true, depthWrite: false,
    }));
    shade.frustumCulled = false;
    scene.add(shade);

    const size = { w: 0, h: 0, ratio: 1 };
    let raf = 0;
    let last = 0;
    let frames = 0;
    let dirty = false;
    let onScreen = true;
    let lost = false;
    let losses = 0;
    let lostTimer = 0;
    let dead = false;
    let primed = false;

    function canDraw() {
        return !dead && !lost && onScreen && !document.hidden && size.w > 0 && size.h > 0;
    }

    function tick(now) {
        raf = 0;
        frames++;
        if (!canDraw()) {
            return;
        }
        const dt = last ? (now - last) / 1000 : 1 / 60;
        last = now;
        dirty = false;
        if (hooks.frame(dt)) {
            invalidate();
        } else {
            last = 0;
        }
    }

    /** Просит нарисовать кадр. Сколько бы раз ни вызвали — кадр будет один. */
    function invalidate() {
        dirty = true;
        if (!raf && canDraw()) {
            raf = requestAnimationFrame(tick);
        }
    }

    function measure() {
        const w = el.clientWidth;
        const hh = el.clientHeight;
        if (w === size.w && hh === size.h) {
            return;
        }
        size.w = w;
        size.h = hh;
        if (!w || !hh) {
            return;
        }
        // Больше двух пикселей на точку глаз не различает, а память и время кадра растут вчетверо
        size.ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (w * hh)));
        renderer.setPixelRatio(size.ratio);
        renderer.setSize(w, hh, false);
        camera.aspect = w / hh;
        hooks.resize();
        // Смена размера очищает холст; рисуем сразу, в том же кадре браузера, иначе он мигнёт
        if (canDraw()) {
            last = 0;
            hooks.frame(0);
        }
        invalidate();
    }

    const resizer = new ResizeObserver(measure);
    const watcher = new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (dirty) {
            invalidate();
        }
    }, { rootMargin: '120px' });

    function onVisibility() {
        if (dirty) {
            invalidate();
        }
    }

    function onLost(event) {
        event.preventDefault();
        lost = true;
        losses++;
        // Контекст теряется при нехватке памяти у видеокарты. Один раз ждём, что браузер его вернёт
        if (losses > 1) {
            hooks.fail('context');
        } else {
            lostTimer = setTimeout(() => hooks.fail('context'), 3000);
        }
    }

    function onRestored() {
        clearTimeout(lostTimer);
        lost = false;
        primed = false;
        hooks.restore();
        invalidate();
    }

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hooks.hide);
    el.append(canvas);
    resizer.observe(el);
    watcher.observe(el);

    return {
        renderer,
        scene,
        camera,
        canvas,
        size,
        invalidate,
        measure,

        /** Ставит камеру: смотрит в точку (x, y) стола с расстояния d под углом phi от вертикали. */
        view(x, y, d, phi) {
            camera.position.set(x, y - d * Math.sin(phi), d * Math.cos(phi));
            camera.lookAt(x, y, 0);
            // Узкий диапазон глубины: листы в стопке лежат в полутора тысячных друг от друга
            camera.near = Math.max(0.02, d - 1.3);
            camera.far = d + 1.6;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
        },

        /** Тень на столе под стопками: left и right — насколько (0…1) там лежит газета. */
        shade(left, right) {
            const xl = -left;
            const xr = right;
            const xs = [xl - SHADE, xl, xr, xr + SHADE];
            for (let i = 0; i < 16; i++) {
                shadePos[3 * i] = xs[i % 4] + 0.012;
            }
            shadeGeometry.attributes.position.needsUpdate = true;
        },

        /** Рисует кадр; shadows — пересчитать ли карту теней (нужно только когда лист двигался). */
        render(shadows) {
            // Самый первый кадр тоже с тенями: пока карты теней нет, three подставляет вместо неё
            // обычную текстуру, и видеокарта отказывается рисовать листы
            if (shadows || !primed) {
                primed = true;
                renderer.shadowMap.needsUpdate = true;
            }
            renderer.render(scene, camera);
        },

        /** Сколько раз браузер вызывал кадр — для проверки, что в покое их ноль. */
        frames() {
            return frames;
        },

        dispose() {
            dead = true;
            cancelAnimationFrame(raf);
            clearTimeout(lostTimer);
            resizer.disconnect();
            watcher.disconnect();
            canvas.removeEventListener('webglcontextlost', onLost);
            canvas.removeEventListener('webglcontextrestored', onRestored);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', hooks.hide);
            shadeGeometry.dispose();
            shadeMap.dispose();
            shade.material.dispose();
            renderer.dispose();
            // Браузер держит ограниченное число контекстов — отдаём свой сразу
            renderer.forceContextLoss();
            canvas.remove();
        },
    };
}
