// Печатный пресс: единственный на странице холст WebGL2. Он рисует растр для любой пластины
// и тут же копирует результат в её собственный 2D-холст. Один контекст на всех — потому что
// браузеры ограничивают число WebGL-контекстов, а пластин на странице больше десятка.
import { VERT, FRAG } from './halftone.glsl.js';
import { TUNING } from './progress.js';

const UNIFORMS = ['uTex', 'uSize', 'uCover', 'uRot', 'uCell', 'uLod', 'uProgress', 'uInk', 'uPaper', 'uCurve', 'uPolarity'];

/**
 * Создаёт пресс. colours — { ink, paper, table }, каждый цвет — три числа 0…1.
 * hooks.lost() — видеокарта отобрала контекст; hooks.restored() — вернула; hooks.dead() — отобрала второй раз.
 * Возвращает null, если аппаратного WebGL2 нет.
 */
export function createPress(colours, hooks) {
    const glc = document.createElement('canvas');
    // Программную отрисовку не берём: на ней растр тормозил бы прокрутку.
    const gl = glc.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true,
    });
    if (!gl) {
        return null;
    }

    const textures = new Map();   // адрес картинки → { tex, w, h, used }
    const angle = TUNING.angle * Math.PI / 180;
    let u = null;
    let lost = false;
    let losses = 0;
    let tick = 0;

    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    // Вызывается и при старте, и после возврата контекста: всё, что жило в видеокарте, приходится создавать заново.
    function build() {
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            return false;
        }
        gl.useProgram(program);
        u = {};
        for (const name of UNIFORMS) {
            u[name] = gl.getUniformLocation(program, name);
        }
        gl.uniform1i(u.uTex, 0);
        gl.uniform2f(u.uRot, Math.cos(angle), Math.sin(angle));
        // Цвета оставляем как в файле, без пересчёта: иначе проявленный кадр не совпадёт с <img> под холстом.
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        return true;
    }

    function drop(src) {
        gl.deleteTexture(textures.get(src).tex);
        textures.delete(src);
    }

    function onLost(event) {
        lost = true;
        textures.clear();
        losses += 1;
        if (losses > 1) {
            // Второй раз подряд — видеокарте не до нас. Не просим контекст обратно, страница остаётся цветной.
            hooks.dead();
            return;
        }
        event.preventDefault();   // без этого браузер контекст не вернёт
        hooks.lost();
    }

    function onRestored() {
        lost = !build();
        if (!lost) {
            hooks.restored();
        }
    }

    if (!build()) {
        return null;
    }
    glc.addEventListener('webglcontextlost', onLost);
    glc.addEventListener('webglcontextrestored', onRestored);

    return {
        /** Контекст сейчас потерян — рисовать нельзя. */
        get lost() {
            return lost;
        },

        /** Загружена ли уже фотография с таким адресом. */
        has(src) {
            return textures.has(src);
        },

        /**
         * Загружает в видеокарту уже раскодированный <img>. inUse(src) говорит, какие фотографии
         * сейчас нужны: остальные, начиная с давно не рисованных, выгружаются, когда память переполнена.
         */
        upload(src, img, inUse) {
            if (lost) {
                return false;
            }
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            } catch (error) {
                gl.deleteTexture(tex);
                return false;
            }
            // Уменьшенные копии нужны, чтобы брать средний тон ячейки растра одним обращением.
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            if (textures.has(src)) {
                drop(src);
            }
            textures.set(src, { tex, w: img.naturalWidth, h: img.naturalHeight, used: ++tick });

            let total = 0;
            for (const t of textures.values()) {
                total += t.w * t.h;
            }
            const spare = [...textures].filter(([key]) => key !== src && !inUse(key))
                .sort((a, b) => a[1].used - b[1].used);
            while (total > TUNING.texturesMax && spare.length) {
                const [key, t] = spare.shift();
                total -= t.w * t.h;
                drop(key);
            }
            return true;
        },

        /**
         * Печатает фотографию src в 2D-холст ctx размером w×h пикселей.
         * cell — шаг растра в пикселях холста, progress — 0…1, hero — светлые точки на тёмной плашке.
         * Возвращает false, если печать не состоялась (нет фотографии или контекста).
         */
        draw(ctx, w, h, src, cell, progress, hero) {
            const t = textures.get(src);
            if (lost || !t) {
                return false;
            }
            // Холст пресса только растёт: смена размера сбрасывает контекст, а пластины разного размера идут вперемешку.
            if (w > glc.width || h > glc.height) {
                glc.width = Math.max(w, glc.width);
                glc.height = Math.max(h, glc.height);
            }
            // Повторяем object-fit: cover — снимок заполняет рамку, лишнее обрезается поровну с двух сторон.
            const k = (w / h) / (t.w / t.h);
            const sx = Math.min(1, k);
            const sy = Math.min(1, 1 / k);
            // При угле 45° подгоняем шаг так, чтобы узлы растра попадали в целые пиксели:
            // тогда все точки одинаковые и по ровному тону не идёт рябь.
            const snapped = Math.max(2, Math.round(cell / Math.SQRT2)) * Math.SQRT2;

            gl.viewport(0, 0, w, h);
            gl.bindTexture(gl.TEXTURE_2D, t.tex);
            gl.uniform2f(u.uSize, w, h);
            gl.uniform4f(u.uCover, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
            gl.uniform1f(u.uCell, snapped);
            gl.uniform1f(u.uLod, Math.max(0, Math.log2(snapped * t.w * sx / w) - TUNING.detail));
            gl.uniform1f(u.uProgress, progress);
            gl.uniform3fv(u.uInk, colours.ink);
            gl.uniform3fv(u.uPaper, hero ? colours.table : colours.paper);
            gl.uniform2fv(u.uCurve, hero ? TUNING.toneHero : TUNING.tonePlate);
            gl.uniform1f(u.uPolarity, hero ? 0 : 1);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            // Копируем сразу же: к следующему кадру браузер вправе очистить холст WebGL.
            ctx.drawImage(glc, 0, glc.height - h, w, h, 0, 0, w, h);
            t.used = ++tick;
            return true;
        },

        /** Освобождает видеопамять и сам контекст. */
        destroy() {
            glc.removeEventListener('webglcontextlost', onLost);
            glc.removeEventListener('webglcontextrestored', onRestored);
            textures.clear();
            lost = true;
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) {
                ext.loseContext();
            }
        },
    };
}
