<?php
// Скрипт только для командной строки. Если его запросили по сети — притворяемся, что файла нет.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Копии меню для сайта, которые делаются прямо из PDF типографии:
//   • лёгкий PDF для кнопки «Скачать PDF»: файл типографии (CMYK, под печать) весит под 40 МБ,
//     а гость скачивает меню с телефона — ему хватит 3–5 МБ;
//   • страницы шириной 3200 px для окна увеличения: копии 1600 px на телефоне с плотным экраном
//     при увеличении расплываются. Грузятся только когда гость увеличивает страницу.
//
//   php tools/build-menu-web.php          сделать недостающие или устаревшие копии
//   php tools/build-menu-web.php --force  сделать все заново
//   php tools/build-menu-web.php --check  ничего не писать; код возврата 1, если каких-то копий нет
//
// Вход: data/menu.php и uploads/{name}.pdf.
// Выход: uploads/{name}-web.pdf и assets/img/menu/{name}-{N}-3200.webp.
// Нужен poppler (pdftoppm, pdfinfo): brew install poppler

// Качество подобрано на глаз по самой плотной странице осеннего меню 2026 (горячее и гриль):
// при этих значениях граммовки и цены читаются без грязи вокруг букв.
// Лёгкий PDF: 1800 px по ширине листа A3 — около 150 точек на дюйм, страница около 550 КБ.
const PDF_WIDTH = 1800;
const PDF_JPG_QUALITY = 65;
// Увеличение: 3200 px — вдвое больше обычной копии, страница около 700 КБ
const ZOOM_WIDTH = 3200;
const ZOOM_WEBP_QUALITY = 70;

$root = dirname(__DIR__);
$menu = require $root . '/data/menu.php';
$check = in_array('--check', $argv, true);
$force = in_array('--force', $argv, true);

$pdf = $root . '/uploads/' . $menu['name'] . '.pdf';
$web_pdf = $root . '/uploads/' . $menu['name'] . '-web.pdf';
$base = $root . '/assets/img/menu/' . $menu['name'] . '-';
$count = count($menu['pages']);

if (!is_file($pdf)) {
    fwrite(STDERR, "Нет PDF меню: $pdf\n");
    exit(2);
}

// Устарела ли копия: её нет или она старше PDF типографии
$stale = function ($file) use ($pdf, $force) {
    return $force || !is_file($file) || filemtime($file) < filemtime($pdf);
};

$todo_zoom = array();
for ($n = 1; $n <= $count; $n++) {
    if ($stale($base . $n . '-' . ZOOM_WIDTH . '.webp')) {
        $todo_zoom[] = $n;
    }
}
$todo_pdf = $stale($web_pdf);

if ($check) {
    foreach ($todo_zoom as $n) {
        echo 'Устарела или нет: ' . substr($base, strlen($root)) . $n . '-' . ZOOM_WIDTH . ".webp\n";
    }
    if ($todo_pdf) {
        echo 'Устарел или нет: ' . substr($web_pdf, strlen($root)) . "\n";
    }
    exit($todo_zoom || $todo_pdf ? 1 : 0);
}

if (!$todo_zoom && !$todo_pdf) {
    echo "Копии меню для сайта уже готовы.\n";
    exit(0);
}
if (!function_exists('imagewebp')) {
    fwrite(STDERR, "Нужен PHP с GD и поддержкой WebP.\n");
    exit(2);
}
foreach (array('pdftoppm', 'pdfinfo') as $tool) {
    if (trim((string) shell_exec('command -v ' . $tool)) === '') {
        fwrite(STDERR, "Нет программы $tool. Установите: brew install poppler\n");
        exit(2);
    }
}
// Страница 3200 px в памяти GD — около 60 МБ
ini_set('memory_limit', '512M');

$tmp = sys_get_temp_dir() . '/menu-web-' . getmypid();
if (!is_dir($tmp) && !mkdir($tmp)) {
    fwrite(STDERR, "Не получилось создать временную папку $tmp\n");
    exit(2);
}
register_shutdown_function(function () use ($tmp) {
    array_map('unlink', glob($tmp . '/*') ?: array());
    @rmdir($tmp);
});

// Рисует страницу n из PDF в файл $out (без расширения, его добавит pdftoppm)
function render_page($pdf, $n, $width, $format, $out)
{
    $cmd = sprintf(
        'pdftoppm -f %1$d -l %1$d -singlefile %2$s -scale-to-x %3$d -scale-to-y -1 %4$s %5$s 2>&1',
        $n, $format, $width, escapeshellarg($pdf), escapeshellarg($out)
    );
    exec($cmd, $lines, $code);
    if ($code !== 0) {
        fwrite(STDERR, "Не получилось нарисовать страницу $n:\n" . implode("\n", $lines) . "\n");
        exit(1);
    }
}

// 1. Страницы для увеличения
foreach ($todo_zoom as $n) {
    render_page($pdf, $n, ZOOM_WIDTH, '-png', $tmp . '/zoom');
    $image = imagecreatefrompng($tmp . '/zoom.png');
    $dst = $base . $n . '-' . ZOOM_WIDTH . '.webp';
    imagewebp($image, $dst, ZOOM_WEBP_QUALITY);
    imagedestroy($image);
    unlink($tmp . '/zoom.png');
    echo 'Готово: ' . substr($dst, strlen($root)) . ' (' . round(filesize($dst) / 1024) . " КБ)\n";
}

// 2. Лёгкий PDF: каждая страница — одна картинка JPEG на весь лист, того же размера, что у типографии
if ($todo_pdf) {
    exec('pdfinfo ' . escapeshellarg($pdf), $info, $code);
    if ($code !== 0 || !preg_match('/^Page size:\s+([\d.]+) x ([\d.]+) pts/m', implode("\n", $info), $m)) {
        fwrite(STDERR, "Не получилось узнать размер листа PDF.\n");
        exit(1);
    }
    $sheet_w = (float) $m[1];

    $pages = array();
    for ($n = 1; $n <= $count; $n++) {
        render_page($pdf, $n, PDF_WIDTH, '-jpeg -jpegopt quality=' . PDF_JPG_QUALITY . ',optimize=y', $tmp . '/p' . $n);
        $pages[] = $tmp . '/p' . $n . '.jpg';
    }
    $title = 'Меню ресторана ФабрикантЪ, ' . mb_strtolower($menu['season']);
    // Пишем рядом и переименовываем: сайт не должен отдать недописанный файл
    write_image_pdf($pages, $sheet_w, $title, $web_pdf . '.part');
    rename($web_pdf . '.part', $web_pdf);
    printf("Готово: %s (%s МБ, было %s МБ)\n", substr($web_pdf, strlen($root)),
        number_format(filesize($web_pdf) / 1048576, 1, ',', ''), number_format(filesize($pdf) / 1048576, 1, ',', ''));
}

/**
 * PDF из картинок JPEG, по одной на страницу. Картинка встраивается как есть (DCTDecode),
 * без перекодирования. Ширина листа — $sheet_w пунктов, высота — по пропорциям картинки.
 */
function write_image_pdf($jpegs, $sheet_w, $title, $dst)
{
    $objects = array();
    $kids = array();
    // 1 — каталог, 2 — список страниц, 3 — сведения о файле; дальше по три объекта на страницу
    $id = 4;
    foreach ($jpegs as $file) {
        $size = getimagesize($file);
        $data = file_get_contents($file);
        $w = $size[0];
        $h = $size[1];
        $space = isset($size['channels']) && $size['channels'] === 1 ? '/DeviceGray' : '/DeviceRGB';
        $sheet_h = round($sheet_w * $h / $w, 2);
        $page = $id;
        $content = $id + 1;
        $image = $id + 2;
        $id += 3;
        $kids[] = "$page 0 R";
        $draw = sprintf('q %.2F 0 0 %.2F 0 0 cm /Im0 Do Q', $sheet_w, $sheet_h);
        $objects[$page] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $sheet_w $sheet_h]"
            . " /Resources << /XObject << /Im0 $image 0 R >> >> /Contents $content 0 R >>";
        $objects[$content] = '<< /Length ' . strlen($draw) . " >>\nstream\n$draw\nendstream";
        $objects[$image] = "<< /Type /XObject /Subtype /Image /Width $w /Height $h /ColorSpace $space"
            . ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($data) . " >>\nstream\n$data\nendstream";
    }
    $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . count($kids) . ' >>';
    // Название в UTF-16 с меткой порядка байтов — так PDF понимает кириллицу
    $objects[3] = '<< /Title <FEFF' . strtoupper(bin2hex(mb_convert_encoding($title, 'UTF-16BE', 'UTF-8'))) . '>'
        . ' /Producer (tools/build-menu-web.php) >>';
    ksort($objects);

    $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    $offsets = array();
    foreach ($objects as $n => $body) {
        $offsets[$n] = strlen($out);
        $out .= "$n 0 obj\n$body\nendobj\n";
    }
    $xref = strlen($out);
    $out .= 'xref' . "\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
    foreach ($offsets as $offset) {
        $out .= sprintf("%010d 00000 n \n", $offset);
    }
    $out .= 'trailer << /Size ' . (count($objects) + 1) . " /Root 1 0 R /Info 3 0 R >>\nstartxref\n$xref\n%%EOF\n";
    if (file_put_contents($dst, $out) === false) {
        fwrite(STDERR, "Не получилось записать $dst\n");
        exit(1);
    }
}
