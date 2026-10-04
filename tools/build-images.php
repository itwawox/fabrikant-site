<?php
// Скрипт только для командной строки. Если его запросили по сети — притворяемся, что файла нет,
// и не тратим время сервера на кодирование картинок.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Сборка картинок галереи «Фотохроника».
//
//   php tools/build-images.php           нарезать недостающие копии и обновить data/gallery.build.php
//   php tools/build-images.php --prune   то же и удалить из assets/img/press/ файлы, которые больше не нужны
//   php tools/build-images.php --check   ничего не писать; код возврата 1, если сборка устарела или не хватает файлов
//
// Вход: data/gallery.php и исходники, на которые он ссылается.
// Выход: assets/img/press/{id}-{ширина}.{хэш}.{avif|webp|jpg} и data/gallery.build.php.
// Готовые файлы повторно не кодируются, поэтому второй запуск подряд ничего не делает.

// Рецепт сборки. Он входит в хэш в имени файла: поменяли здесь любое число — у всех копий
// появятся новые имена, и браузеры (картинки кэшируются на месяц) скачают их заново.
// Качество подобрано на глаз по трём снимкам (фасад, сад, пивная башня): при меньших значениях
// AVIF и WebP заметно замыливают листву и штукатурку.
const RECIPE = [
    'version' => 1,
    // Ширины лёгких копий. Копия в натуральную ширину исходника делается всегда, увеличения нет.
    'widths' => [480, 720],
    // Уменьшаем в sRGB, как это делает сам браузер, — тогда копии разных ширин выглядят одинаково.
    // После уменьшения — лёгкая резкость: радиус, сигма, сила, порог.
    'resize' => ['filter' => 'lanczos', 'unsharp' => [0, 0.6, 0.5, 0.01]],
    'avif' => ['quality' => 58, 'speed' => 3, 'chroma' => '420'],
    'webp' => ['quality' => 82, 'method' => 6],
    'jpg' => ['quality' => 82, 'sampling' => '4:2:0', 'progressive' => true],
];

const SIZES = ['lead', 'std', 'tall'];
const ID_PATTERN = '/^[a-z0-9-]{1,40}$/';
const PRESS_URL = '/assets/img/press';
const CATALOGUE = 'data/gallery.php';
const MANIFEST = 'data/gallery.build.php';

// Системные места, где обычно лежит профиль sRGB. Нужен только для исходников в другом цветовом
// пространстве (Display P3, Adobe RGB): без пересчёта цвета на сайте будут блёклыми.
const SRGB_PROFILES = [
    '/System/Library/ColorSync/Profiles/sRGB Profile.icc',
    '/usr/share/color/icc/colord/sRGB.icc',
    '/usr/share/color/icc/sRGB.icc',
    '/usr/share/color/icc/ghostscript/srgb.icc',
];

// Imagick подхватывает язык системы, и с русским языком дробные числа печатались бы через запятую.
// Рецепт и манифест должны получаться одинаковыми на любой машине.
setlocale(LC_NUMERIC, 'C');

try {
    exit(main(array_slice($argv, 1)));
} catch (Throwable $e) {
    fwrite(STDERR, 'Ошибка: ' . $e->getMessage() . "\n");
    exit(1);
}

function main(array $args): int
{
    $known = ['--prune', '--check', '--help'];
    $unknown = array_diff($args, $known);
    if ($unknown || in_array('--help', $args, true)) {
        $usage = "Использование: php tools/build-images.php [--prune | --check]\n"
            . "  --prune  удалить из assets/img/press/ файлы, которых нет в новом манифесте\n"
            . "  --check  ничего не писать; код возврата 1, если сборка устарела или не хватает файлов\n";
        if ($unknown) {
            fwrite(STDERR, 'Неизвестный параметр: ' . implode(' ', $unknown) . "\n" . $usage);
            return 2;
        }
        echo $usage;
        return 0;
    }
    $check = in_array('--check', $args, true);
    $prune = in_array('--prune', $args, true);
    if ($check && $prune) {
        fwrite(STDERR, "--check ничего не меняет на диске, поэтому вместе с --prune не работает.\n");
        return 2;
    }

    if (!extension_loaded('imagick')) {
        throw new RuntimeException('нужно расширение PHP Imagick.');
    }
    foreach (['AVIF', 'WEBP', 'JPEG'] as $format) {
        if (!Imagick::queryFormats($format)) {
            throw new RuntimeException('эта сборка ImageMagick не умеет ' . $format . '.');
        }
    }

    $root = realpath(dirname(__DIR__));
    $shots = readCatalogue($root);
    $old = readManifest($root . '/' . MANIFEST);

    return $check ? runCheck($root, $shots, $old) : runBuild($root, $shots, $old, $prune);
}

// Читает и проверяет каталог. Возвращает по фотографии: id, путь к исходнику, натуральный размер,
// хэш и список ширин. При ошибках печатает их все сразу и завершает работу — править удобнее списком.
function readCatalogue(string $root): array
{
    $file = $root . '/' . CATALOGUE;
    if (!is_file($file)) {
        throw new RuntimeException('нет файла ' . CATALOGUE . '.');
    }
    $catalogue = require $file;
    if (!is_array($catalogue) || !isset($catalogue['rubrics'], $catalogue['photos'])
        || !is_array($catalogue['rubrics']) || !is_array($catalogue['photos'])) {
        throw new RuntimeException(CATALOGUE . " должен возвращать массив с ключами 'rubrics' и 'photos'.");
    }

    $errors = [];
    foreach ($catalogue['rubrics'] as $key => $rubric) {
        if (!is_array($rubric) || !isset($rubric['title'], $rubric['lede'])) {
            $errors[] = "Рубрика «{$key}»: нужны поля title и lede.";
        }
    }

    $recipe = json_encode(RECIPE);
    $shots = [];
    $seen = [];
    foreach (array_values($catalogue['photos']) as $index => $photo) {
        $where = 'Фото №' . ($index + 1);
        if (!is_array($photo)) {
            $errors[] = $where . ': запись должна быть массивом.';
            continue;
        }
        $missing = [];
        foreach (['id', 'rubric', 'src', 'size', 'alt', 'caption'] as $field) {
            if (!isset($photo[$field]) || !is_string($photo[$field])) {
                $missing[] = $field;
            }
        }
        if ($missing) {
            $errors[] = $where . ': нет полей или они не строки — ' . implode(', ', $missing) . '.';
            continue;
        }
        $id = $photo['id'];
        $where .= ' (id «' . $id . '»)';
        $ok = true;

        if (!preg_match(ID_PATTERN, $id)) {
            $errors[] = $where . ': в id допустимы только строчные латинские буквы, цифры и дефис, от 1 до 40 знаков.';
            $ok = false;
        } elseif (isset($seen[$id])) {
            $errors[] = $where . ': такой id уже есть у фото №' . $seen[$id] . '.';
            $ok = false;
        } else {
            $seen[$id] = $index + 1;
        }
        if (!isset($catalogue['rubrics'][$photo['rubric']])) {
            $errors[] = $where . ': неизвестная рубрика «' . $photo['rubric'] . '». Есть: ' . implode(', ', array_keys($catalogue['rubrics'])) . '.';
            $ok = false;
        }
        if (!in_array($photo['size'], SIZES, true)) {
            $errors[] = $where . ': неизвестный size «' . $photo['size'] . '». Допустимы: ' . implode(', ', SIZES) . '.';
            $ok = false;
        }
        if (trim($photo['alt']) === '') {
            $errors[] = $where . ': пустой alt — опишите, что на снимке.';
            $ok = false;
        }

        // Исходник должен лежать внутри сайта: путь из каталога не должен увести к чужим файлам.
        $source = realpath($root . '/' . ltrim($photo['src'], '/'));
        if ($source === false || !is_file($source)) {
            $errors[] = $where . ': нет исходника ' . $photo['src'] . '.';
            continue;
        }
        if (!str_starts_with($source, $root . '/')) {
            $errors[] = $where . ': исходник ' . $photo['src'] . ' лежит вне папки сайта.';
            continue;
        }
        try {
            [$width, $height] = naturalSize($source);
        } catch (ImagickException $e) {
            $errors[] = $where . ': ' . $photo['src'] . ' не читается как картинка (' . $e->getMessage() . ').';
            continue;
        }
        if (!$ok) {
            continue;
        }

        $widths = array_values(array_filter(RECIPE['widths'], fn (int $w): bool => $w < $width));
        $widths[] = $width;
        sort($widths);
        $shots[] = [
            'id' => $id,
            'src' => $photo['src'],
            'source' => $source,
            'w' => $width,
            'h' => $height,
            // Хэш от содержимого и рецепта: новая картинка или новые настройки — новые имена файлов.
            'hash' => substr(sha1(file_get_contents($source) . $recipe), 0, 8),
            'widths' => $widths,
        ];
    }

    if ($errors) {
        fwrite(STDERR, 'В ' . CATALOGUE . " есть ошибки:\n  " . implode("\n  ", $errors) . "\n");
        exit(1);
    }
    return $shots;
}

// Размер исходника без полной распаковки. Снимки с телефона бывают записаны «лёжа» с пометкой о повороте —
// тогда ширина и высота меняются местами.
function naturalSize(string $source): array
{
    $image = new Imagick();
    $image->pingImage($source);
    $width = $image->getImageWidth();
    $height = $image->getImageHeight();
    $turned = in_array($image->getImageOrientation(), [
        Imagick::ORIENTATION_LEFTTOP, Imagick::ORIENTATION_RIGHTTOP,
        Imagick::ORIENTATION_RIGHTBOTTOM, Imagick::ORIENTATION_LEFTBOTTOM,
    ], true);
    $image->clear();
    return $turned ? [$height, $width] : [$width, $height];
}

// Прежний манифест. Нужен, чтобы помнить, какие AVIF в прошлый раз не пригодились (см. buildShot).
function readManifest(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    try {
        $manifest = require $file;
    } catch (Throwable) {
        return [];
    }
    return is_array($manifest) ? $manifest : [];
}

function variantName(array $shot, int $width, string $ext): string
{
    return $shot['id'] . '-' . $width . '.' . $shot['hash'] . '.' . $ext;
}

function ready(string $file): bool
{
    clearstatcache(true, $file);
    return is_file($file) && filesize($file) > 0;
}

// AVIF этой ширины в прошлый раз вышел не легче WebP и был отброшен. Узнаём это по прежнему манифесту
// (тот же хэш, WebP записан, AVIF нет), чтобы не кодировать его заново при каждом запуске.
function avifWasDropped(array $shot, int $width, array $old): bool
{
    $entry = $old[$shot['id']] ?? null;
    return is_array($entry)
        && ($entry['webp'][$width] ?? '') === PRESS_URL . '/' . variantName($shot, $width, 'webp')
        && !isset($entry['avif'][$width]);
}

function runBuild(string $root, array $shots, array $old, bool $prune): int
{
    $dir = $root . PRESS_URL;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        throw new RuntimeException('не удалось создать папку ' . PRESS_URL . '.');
    }

    $manifest = [];
    $totalBytes = 0;
    $totalFiles = 0;
    $totalNew = 0;
    foreach ($shots as $shot) {
        [$entry, $bytes, $files, $new] = buildShot($shot, $dir, $old);
        $manifest[$shot['id']] = $entry;
        $totalBytes += $bytes;
        $totalFiles += $files;
        $totalNew += $new;
        printf(
            "%-12s %4d×%-4d  avif %-12s webp %-12s jpg %-4d  %9s  %s\n",
            $shot['id'],
            $shot['w'],
            $shot['h'],
            implode(' ', array_keys($entry['avif'])) ?: '—',
            implode(' ', array_keys($entry['webp'])),
            $shot['w'],
            kilobytes($bytes),
            $new ? 'создано файлов: ' . $new : 'без изменений'
        );
    }

    $file = $root . '/' . MANIFEST;
    $text = renderManifest($manifest);
    if (is_file($file) && file_get_contents($file) === $text) {
        $state = 'без изменений';
    } else {
        // Сначала во временный файл, потом переименование: сайт никогда не увидит недописанный манифест.
        if (file_put_contents($file . '.part', $text) === false || !rename($file . '.part', $file)) {
            throw new RuntimeException('не удалось записать ' . MANIFEST . '.');
        }
        $state = 'записан';
    }

    echo 'Итого: фото — ' . count($shots) . ', файлов — ' . $totalFiles . ' (' . kilobytes($totalBytes) . '), создано — ' . $totalNew
        . '. ' . MANIFEST . ' ' . $state . ".\n";

    if ($prune) {
        $keep = [];
        foreach ($manifest as $entry) {
            foreach (array_merge($entry['avif'], $entry['webp'], [$entry['jpg']]) as $url) {
                $keep[basename($url)] = true;
            }
        }
        $removed = 0;
        foreach (scandir($dir) as $name) {
            // Файлы с точки (.htaccess и подобные) не наши — их не трогаем.
            if ($name[0] === '.' || isset($keep[$name]) || !is_file($dir . '/' . $name)) {
                continue;
            }
            unlink($dir . '/' . $name);
            echo 'Удалён лишний файл: ' . $name . "\n";
            $removed++;
        }
        echo $removed ? 'Удалено лишних файлов: ' . $removed . ".\n" : "Лишних файлов нет.\n";
    }
    return 0;
}

// Копии одной фотографии. Возвращает запись манифеста, общий вес её файлов, их число и число созданных сейчас.
function buildShot(array $shot, string $dir, array $old): array
{
    $master = null;
    // Исходник распаковывается только когда действительно есть что кодировать.
    $scaled = function (int $width) use (&$master, $shot): Imagick {
        $master ??= loadMaster($shot['source']);
        $image = clone $master;
        if ($width < $shot['w']) {
            $image->resizeImage($width, (int) round($shot['h'] * $width / $shot['w']), Imagick::FILTER_LANCZOS, 1);
            $image->unsharpMaskImage(...RECIPE['resize']['unsharp']);
        }
        return $image;
    };

    $entry = ['w' => $shot['w'], 'h' => $shot['h'], 'avif' => [], 'webp' => [], 'jpg' => ''];
    $bytes = 0;
    $files = 0;
    $new = 0;
    $add = function (string $file) use (&$bytes, &$files): void {
        clearstatcache(true, $file);
        $bytes += filesize($file);
        $files++;
    };

    foreach ($shot['widths'] as $width) {
        $image = null;

        $webp = $dir . '/' . variantName($shot, $width, 'webp');
        if (!ready($webp)) {
            $image ??= $scaled($width);
            encode($image, 'webp', $webp);
            $new++;
        }
        $entry['webp'][$width] = PRESS_URL . '/' . basename($webp);
        $add($webp);

        $avif = $dir . '/' . variantName($shot, $width, 'avif');
        if (!ready($avif) && !avifWasDropped($shot, $width, $old)) {
            $image ??= $scaled($width);
            encode($image, 'avif', $avif);
            // AVIF нужен только там, где он легче WebP: иначе браузер зря выбирал бы более тяжёлый файл.
            clearstatcache(true, $avif);
            if (filesize($avif) >= filesize($webp)) {
                unlink($avif);
            } else {
                $new++;
            }
        }
        if (ready($avif)) {
            $entry['avif'][$width] = PRESS_URL . '/' . basename($avif);
            $add($avif);
        }
    }

    // Один JPEG в полную ширину: запасной вариант для старых браузеров и адрес ссылки, когда скрипты выключены.
    $jpg = $dir . '/' . variantName($shot, $shot['w'], 'jpg');
    if (!ready($jpg)) {
        encode($scaled($shot['w']), 'jpg', $jpg);
        $new++;
    }
    $entry['jpg'] = PRESS_URL . '/' . basename($jpg);
    $add($jpg);

    return [$entry, $bytes, $files, $new];
}

// Исходник, готовый к нарезке: повёрнут как надо, без прозрачности, в sRGB и без служебных данных
// (EXIF, координаты съёмки, превью из Фотошопа) — посетителю они не нужны, а весят немало.
function loadMaster(string $source): Imagick
{
    $image = new Imagick($source . '[0]');
    $image->autoOrient();

    if ($image->getImageAlphaChannel()) {
        // В JPEG прозрачности нет; подкладываем белую «бумагу», на которой фото и стоит на странице.
        $image->setImageBackgroundColor('white');
        $image->setImageAlphaChannel(Imagick::ALPHACHANNEL_REMOVE);
    }

    $profile = in_array('icc', $image->getImageProfiles('*', false), true) ? (string) $image->getImageProperty('icc:description') : null;
    if ($profile !== null && stripos($profile, 'sRGB') === false) {
        $srgb = null;
        foreach (SRGB_PROFILES as $candidate) {
            if (is_file($candidate)) {
                $srgb = file_get_contents($candidate);
                break;
            }
        }
        if ($srgb === null) {
            throw new RuntimeException(basename($source) . ': цветовой профиль «' . $profile
                . '», а профиль sRGB в системе не найден. Сохраните исходник в sRGB.');
        }
        $image->profileImage('icc', $srgb);
    }
    if ($image->getImageColorspace() !== Imagick::COLORSPACE_SRGB) {
        $image->transformImageColorspace(Imagick::COLORSPACE_SRGB);
    }
    $image->stripImage();
    return $image;
}

function encode(Imagick $image, string $format, string $target): void
{
    $out = clone $image;
    $quality = RECIPE[$format]['quality'];
    // Качество задаём обоими способами: кодер AVIF читает одно значение, WebP и JPEG — другое,
    // а молча проигнорированная настройка даёт качество «по умолчанию».
    $out->setCompressionQuality($quality);
    $out->setImageCompressionQuality($quality);

    if ($format === 'avif') {
        $out->setImageFormat('avif');
        $out->setOption('heic:speed', (string) RECIPE['avif']['speed']);
        $out->setOption('heic:chroma', RECIPE['avif']['chroma']);
    } elseif ($format === 'webp') {
        $out->setImageFormat('webp');
        $out->setOption('webp:method', (string) RECIPE['webp']['method']);
    } else {
        $out->setImageFormat('jpeg');
        $out->setOption('jpeg:sampling-factor', RECIPE['jpg']['sampling']);
        // Прогрессивный JPEG проявляется целиком и постепенно уточняется, а не грузится полосой сверху вниз.
        $out->setInterlaceScheme(RECIPE['jpg']['progressive'] ? Imagick::INTERLACE_JPEG : Imagick::INTERLACE_NO);
    }

    // Пишем во временный файл и переименовываем: готовый файл повторно не кодируется,
    // поэтому оборванная запись не должна оставить под настоящим именем половину картинки.
    $part = $target . '.part';
    $out->writeImage(($format === 'jpg' ? 'jpeg' : $format) . ':' . $part);
    $out->clear();
    if (!ready($part) || !rename($part, $target)) {
        throw new RuntimeException('не удалось записать ' . basename($target) . '.');
    }
}

function renderManifest(array $manifest): string
{
    return "<?php\n"
        . "// Этот файл создаёт tools/build-images.php — руками его не правят: следующая сборка перепишет его заново.\n"
        . "// Здесь по id фотографии из data/gallery.php записаны её натуральный размер и адреса готовых копий.\n"
        . "// Обновить после замены фотографий:  php tools/build-images.php\n"
        . 'return ' . var_export($manifest, true) . ";\n";
}

// Проверка без записи: тот манифест, который получился бы сейчас, должен совпасть с лежащим на диске,
// и все файлы из него должны быть на месте.
function runCheck(string $root, array $shots, array $old): int
{
    $file = $root . '/' . MANIFEST;
    if (!is_file($file)) {
        fwrite(STDERR, 'Нет ' . MANIFEST . ". Запустите: php tools/build-images.php\n");
        return 1;
    }

    $problems = [];
    $manifest = [];
    $files = 0;
    foreach ($shots as $shot) {
        $entry = ['w' => $shot['w'], 'h' => $shot['h'], 'avif' => [], 'webp' => [], 'jpg' => ''];
        foreach ($shot['widths'] as $width) {
            $entry['webp'][$width] = PRESS_URL . '/' . variantName($shot, $width, 'webp');
            // Какие AVIF были отброшены как слишком тяжёлые, без кодирования не узнать — верим манифесту.
            $avif = PRESS_URL . '/' . variantName($shot, $width, 'avif');
            if (($old[$shot['id']]['avif'][$width] ?? '') === $avif) {
                $entry['avif'][$width] = $avif;
            }
        }
        $entry['jpg'] = PRESS_URL . '/' . variantName($shot, $shot['w'], 'jpg');
        $manifest[$shot['id']] = $entry;

        foreach (array_merge($entry['avif'], $entry['webp'], [$entry['jpg']]) as $url) {
            $files++;
            if (!ready($root . $url)) {
                $problems[] = 'нет файла ' . $url . ' (фото «' . $shot['id'] . '», исходник ' . $shot['src'] . ')';
            }
        }
    }
    if (file_get_contents($file) !== renderManifest($manifest)) {
        $problems[] = MANIFEST . ' устарел: изменились фотографии, их порядок или настройки сборки';
    }

    if ($problems) {
        fwrite(STDERR, "Сборка картинок не в порядке:\n  " . implode("\n  ", $problems) . "\nЗапустите: php tools/build-images.php\n");
        return 1;
    }
    echo 'Сборка картинок в порядке: фото — ' . count($shots) . ', файлов — ' . $files . ".\n";
    return 0;
}

function kilobytes(int $bytes): string
{
    return number_format($bytes / 1024, 1, ',', ' ') . ' КБ';
}
