// Шейдер растровой печати: так печатное меню воспроизводит фотографии — одной краской, точками разного размера.
// uProgress ведёт от печати к снимку: 0 — чёткие точки одной краской, дальше каждая точка
// окрашивается в цвета снимка под ней и разрастается, пока точки не сомкнутся в фотографию.
import { TUNING } from './progress.js';

// GLSL не принимает целое там, где ждёт дробное, поэтому числа пишем с точкой.
const stage = ([a, b]) => `smoothstep(${a.toFixed(3)}, ${b.toFixed(3)}, uProgress)`;

// Один треугольник накрывает весь холст — вершины считаются из номера, буферы не нужны.
export const VERT = `#version 300 es
void main() {
    gl_Position = vec4(float(gl_VertexID & 1) * 4.0 - 1.0, float(gl_VertexID >> 1) * 4.0 - 1.0, 0.0, 1.0);
}`;

export const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform vec2 uSize;       // размер холста, пиксели
uniform vec4 uCover;      // как снимок вписан в рамку (object-fit: cover): масштаб и сдвиг
uniform vec2 uRot;        // косинус и синус угла растра
uniform float uCell;      // шаг растра, пиксели холста
uniform float uLod;       // насколько размыть снимок, чтобы тон брался примерно с одной ячейки
uniform float uProgress;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec2 uCurve;      // кривая печати: степень и предел заливки
uniform float uPolarity;  // 1 — краска ложится на тёмное (бумага), 0 — на светлое (тёмная плашка)

out vec4 outColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
    // Считаем от левого верхнего угла, как на странице
    vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
    vec2 uv = px / uSize * uCover.xy + uCover.zw;

    float colour = ${stage(TUNING.colour)};
    float grow = ${stage(TUNING.grow)};
    float soften = ${stage(TUNING.soften)};

    // Тон берём с размытого снимка: размер точки отвечает за яркость целой ячейки, а не одного пикселя.
    float tone = dot(textureLod(uTex, uv, uLod).rgb, LUMA);
    float demand = mix(tone, 1.0 - tone, uPolarity);
    // Кривая печати: тени не заливаются сплошь (в них остаются просветы), а в светах точки пропадают совсем.
    demand = pow(demand, uCurve.x) * uCurve.y - 0.03;
    // Проявка: точки растут независимо от тона, пока не сомкнутся. Запас сверх единицы закрывает
    // и самые дальние от узлов сетки уголки, даже когда край точки уже мягкий.
    demand = mix(demand, 1.2, grow);

    // Порог растра — «холмы» с вершинами в узлах повёрнутой сетки. Где спрос на краску выше порога, там точка.
    vec2 g = mat2(uRot.x, -uRot.y, uRot.y, uRot.x) * px / uCell * 6.2831853;
    float spot = 0.5 - 0.25 * (cos(g.x) + cos(g.y));
    // Край точки шириной в пиксель — сглаживание; по мере роста точки край становится мягче.
    float edge = max(mix(fwidth(spot), 0.3, soften), 1e-4);
    float ink = clamp(0.5 + (demand - spot) / edge, 0.0, 1.0);

    // Точка сначала одной краской, потом — тем кусочком снимка, который под ней: фотография
    // проступает сквозь растр, а не накладывается на него.
    vec3 fill = mix(uInk, texture(uTex, uv, -0.5).rgb, colour);
    outColor = vec4(mix(uPaper, fill, ink), 1.0);
}`;
