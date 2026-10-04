<?php
// Скрипт только для командной строки. Если его запросили по сети — притворяемся, что файла нет.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Миниатюры страниц меню для содержания на странице «Меню».
//
//   php tools/build-menu-thumbs.php          нарезать недостающие миниатюры
//   php tools/build-menu-thumbs.php --force  нарезать все заново
//   php tools/build-menu-thumbs.php --check  ничего не писать; код возврата 1, если каких-то миниатюр нет
//
// Вход: data/menu.php и страницы assets/img/menu/{name}-{N}.jpg.
// Выход: assets/img/menu/{name}-{N}-200.webp.

// В содержании миниатюра шириной до 100 px, 200 — с запасом на экраны двойной плотности.
// Качество подобрано на глаз: ниже 55 полосы текста на миниатюре расплываются, выше — вес растёт быстрее, чем видно разницу.
const WIDTH = 200;
const QUALITY = 55;

$root = dirname(__DIR__);
$menu = require $root . '/data/menu.php';
$check = in_array('--check', $argv, true);
$force = in_array('--force', $argv, true);

if (!$check && !function_exists('imagewebp')) {
    fwrite(STDERR, "Нужен PHP с GD и поддержкой WebP.\n");
    exit(2);
}

$base = $root . '/assets/img/menu/' . $menu['name'] . '-';
$missing = 0;
foreach (array_keys($menu['pages']) as $i) {
    $n = $i + 1;
    $src = $base . $n . '.jpg';
    $dst = $base . $n . '-' . WIDTH . '.webp';
    if (!is_file($src)) {
        fwrite(STDERR, "Нет страницы: $src\n");
        $missing++;
        continue;
    }
    $fresh = is_file($dst) && filemtime($dst) >= filemtime($src);
    if ($fresh && !$force) {
        continue;
    }
    if ($check) {
        echo "Устарела или нет: $dst\n";
        $missing++;
        continue;
    }
    $image = imagecreatefromjpeg($src);
    $thumb = imagescale($image, WIDTH, -1, IMG_BICUBIC);
    imagewebp($thumb, $dst, QUALITY);
    echo 'Готово: ' . substr($dst, strlen($root)) . ' (' . round(filesize($dst) / 1024) . " КБ)\n";
}

exit($missing ? 1 : 0);
