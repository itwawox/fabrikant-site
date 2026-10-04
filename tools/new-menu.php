<?php
// Скрипт только для командной строки. Если его запросили по сети — притворяемся, что файла нет.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Новое меню ресторана из одного PDF — всё, что раньше делали руками по инструкции в data/menu.php.
//
//   php tools/new-menu.php ~/Downloads/menu.pdf menu_restaurant_fabrikant2026_zima "Зима 2026"
//
// Что делает:
//   1. Копирует PDF в uploads/{name}.pdf (из него делаются картинки и лёгкий PDF для гостей).
//   2. Рисует каждую страницу в assets/img/menu/{name}-{N}.jpg шириной 1600 px
//      и делает лёгкие копии {name}-{N}.webp и {name}-{N}-1000.webp.
//   3. Переписывает в data/menu.php имя, сезон и список страниц.
//      Если страниц столько же, сколько в прошлом меню, — подписи страниц и разметка разделов
//      остаются прежними, иначе ставятся «Страница N» и разделов нет. В обоих случаях их стоит
//      проверить: разделы — в окне php tools/menu-sections.php.
//   4. Запускает tools/build-menu-thumbs.php — миниатюры для содержания.
//   5. Запускает tools/build-menu-web.php — лёгкий PDF для кнопки «Скачать» (uploads/{name}-web.pdf)
//      и страницы 3200 px для окна увеличения.
//
// Старые файлы не трогает: после проверки нового меню их можно удалить (скрипт напишет, какие).
// Нужен poppler (pdftoppm, pdfinfo): brew install poppler

// Качество подобрано так же, как у осеннего меню 2026: мелкий шрифт цен читается при увеличении.
const PAGE_WIDTH = 1600;
const LOW_WIDTH = 1000;
const JPG_QUALITY = 85;
const WEBP_QUALITY = 82;
const NAME_PATTERN = '/^[a-z0-9_-]{1,80}$/';

$root = dirname(__DIR__);
require $root . '/inc/_menu.php';

function fail($message)
{
    fwrite(STDERR, $message . "\n");
    exit(1);
}

if ($argc !== 4) {
    fail("Как запускать:\n  php tools/new-menu.php файл.pdf имя_файлов \"Сезон\"\n"
        . "Например:\n  php tools/new-menu.php ~/Downloads/menu.pdf menu_restaurant_fabrikant2026_zima \"Зима 2026\"");
}
list(, $pdf, $name, $season) = $argv;
$season = trim($season);

if (!is_file($pdf)) {
    fail("Нет такого файла: $pdf");
}
if (!preg_match(NAME_PATTERN, $name)) {
    fail("Имя файлов — только латиница в нижнем регистре, цифры, «_» и «-»: $name");
}
if ($season === '') {
    fail('Сезон не задан, например "Зима 2026".');
}
if (!function_exists('imagewebp')) {
    fail('Нужен PHP с GD и поддержкой WebP.');
}
foreach (array('pdftoppm', 'pdfinfo') as $tool) {
    if (trim((string) shell_exec('command -v ' . $tool)) === '') {
        fail("Нет программы $tool. Установите: brew install poppler");
    }
}

$old = require $root . '/data/menu.php';
if ($old['name'] === $name) {
    echo "Имя совпадает с текущим меню — файлы будут перезаписаны.\n";
    echo "Помните: у посетителей картинки под старым именем держатся в кэше до месяца.\n";
}

// Число страниц
exec('pdfinfo ' . escapeshellarg($pdf), $info, $code);
if ($code !== 0 || !preg_match('/^Pages:\s+(\d+)/m', implode("\n", $info), $m) || (int) $m[1] < 1) {
    fail('Не получилось прочитать PDF — он точно не битый?');
}
$count = (int) $m[1];
echo "В PDF страниц: $count\n";

// 1. PDF
$pdf_dst = $root . '/uploads/' . $name . '.pdf';
if (realpath($pdf) !== realpath($pdf_dst) && !copy($pdf, $pdf_dst)) {
    fail("Не получилось скопировать PDF в $pdf_dst");
}
echo 'Готово: /uploads/' . $name . '.pdf (' . round(filesize($pdf_dst) / 1048576, 1) . " МБ)\n";

// 2. Страницы картинками
$base = $root . '/assets/img/menu/' . $name . '-';
for ($n = 1; $n <= $count; $n++) {
    $cmd = sprintf(
        'pdftoppm -f %1$d -l %1$d -singlefile -jpeg -jpegopt quality=%2$d,progressive=y -scale-to-x %3$d -scale-to-y -1 %4$s %5$s',
        $n, JPG_QUALITY, PAGE_WIDTH, escapeshellarg($pdf), escapeshellarg($base . $n)
    );
    $out = array();
    exec($cmd . ' 2>&1', $out, $code);
    if ($code !== 0 || !is_file($base . $n . '.jpg')) {
        fail("Не получилось нарисовать страницу $n:\n" . implode("\n", $out));
    }

    $image = imagecreatefromjpeg($base . $n . '.jpg');
    imagewebp($image, $base . $n . '.webp', WEBP_QUALITY);
    $low = imagescale($image, LOW_WIDTH, -1, IMG_BICUBIC);
    imagewebp($low, $base . $n . '-' . LOW_WIDTH . '.webp', WEBP_QUALITY);

    printf("Готово: страница %d (jpg %d КБ, webp %d КБ, webp-%d %d КБ)\n", $n,
        filesize($base . $n . '.jpg') / 1024, filesize($base . $n . '.webp') / 1024,
        LOW_WIDTH, filesize($base . $n . '-' . LOW_WIDTH . '.webp') / 1024);
}

// 3. data/menu.php: шапку с инструкцией оставляем, переписываем только сам массив.
// Меню выходит раз в пару месяцев и обычно сохраняет вёрстку, поэтому при том же числе страниц
// подписи страниц и разметка разделов переносятся из прошлого меню — их остаётся проверить
$keep_titles = count($old['pages']) === $count;
$pages = $keep_titles ? $old['pages'] : array_map(function ($n) {
    return 'Страница ' . $n;
}, range(1, $count));
$sections = $keep_titles && isset($old['sections']) ? $old['sections'] : array();

$config_file = $root . '/data/menu.php';
if (!menu_config_write($config_file, array('name' => $name, 'season' => $season, 'pages' => $pages, 'sections' => $sections))) {
    fail("Не получилось записать $config_file");
}
echo "Готово: data/menu.php (меню «{$name}», {$season}" . ($sections ? ', разделов из прошлого меню: ' . count($sections) : '') . ")\n";

// 4. Миниатюры для содержания
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/tools/build-menu-thumbs.php') . ' --force', $code);
if ($code !== 0) {
    fail('Миниатюры не собрались — см. сообщения выше.');
}

// 5. Лёгкий PDF и страницы для увеличения
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/tools/build-menu-web.php') . ' --force', $code);
if ($code !== 0) {
    fail('Лёгкий PDF или страницы для увеличения не собрались — см. сообщения выше.');
}

echo "\nОсталось:\n";
if ($keep_titles) {
    echo "  • Подписи страниц в data/menu.php взяты из прошлого меню — проверьте, что разделы не поменялись.\n";
} else {
    echo "  • Впишите в data/menu.php названия страниц вместо «Страница N» (что на каждой можно заказать).\n";
}
if ($sections) {
    echo "  • Разметка разделов перенесена из прошлого меню. Пролистайте страницы и поправьте съехавшие рамки:\n"
        . "      php tools/menu-sections.php\n";
} else {
    echo "  • Разметьте разделы (без них телефон показывает меню целыми страницами):\n"
        . "      php tools/menu-sections.php\n";
}
echo "  • Откройте /menu.php и пролистайте меню.\n";
if ($old['name'] !== $name) {
    echo "  • Когда всё в порядке, старые файлы можно удалить:\n";
    echo '      rm uploads/' . $old['name'] . '.pdf uploads/' . $old['name'] . '-web.pdf assets/img/menu/' . $old['name'] . "-*\n";
}
