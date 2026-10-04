<?php
// Текущее меню (имя файлов, сезон, разделы на страницах) задано в data/menu.php — новое меню меняют там.
$menu = require __DIR__ . '/data/menu.php';
$menu_name  = $menu['name'];
$menu_pages = count($menu['pages']);
// Скачивают лёгкую копию PDF (php tools/build-menu-web.php, 3–5 МБ). Файл из типографии весит под 40 МБ —
// он остаётся в uploads/ на случай, если его попросят, но кнопка ведёт на него, только пока копии нет
$menu_pdf   = '/uploads/' . $menu_name . '-web.pdf';
if (!is_file(__DIR__ . $menu_pdf)) {
    $menu_pdf = '/uploads/' . $menu_name . '.pdf';
}
// Под этим именем файл сохранится у гостя: «Меню ФабрикантЪ, осень 2026.pdf», а не служебное имя
$menu_pdf_file = 'Меню ФабрикантЪ, ' . mb_strtolower($menu['season']) . '.pdf';
$menu_pdf_bytes = @filesize(__DIR__ . $menu_pdf);
$menu_pdf_size = $menu_pdf_bytes ? number_format($menu_pdf_bytes / 1048576, 1, ',', '') . ' МБ' : '';
$menu_phone = array('tel:+79788072001', '+7 978 807 20 01');

// Газете, которую листают (3D), нужны адреса страниц двух размеров: лёгкая копия и полная, для увеличения.
// Вместо {n} скрипт подставляет номер страницы. Если лёгких копий нет хотя бы у одной страницы — берём JPEG.
// Миниатюры для содержания (php tools/build-menu-thumbs.php) необязательны: без них в содержании одни подписи.
$menu_img = '/assets/img/menu/' . $menu_name . '-';
$menu_webp = true;
$menu_thumbs = true;
$menu_zoom = true;
for ($i = 1; $i <= $menu_pages; $i++) {
    if (!is_file(__DIR__ . $menu_img . $i . '.webp') || !is_file(__DIR__ . $menu_img . $i . '-1000.webp')) {
        $menu_webp = false;
    }
    if (!is_file(__DIR__ . $menu_img . $i . '-200.webp')) {
        $menu_thumbs = false;
    }
    // Копии 3200 px для окна увеличения (php tools/build-menu-web.php); без них увеличиваем обычные
    if (!is_file(__DIR__ . $menu_img . $i . '-3200.webp')) {
        $menu_zoom = false;
    }
}
$book_low  = $menu_img . '{n}' . ($menu_webp ? '-1000.webp' : '.jpg');
$book_high = $menu_img . '{n}' . ($menu_webp ? '.webp' : '.jpg');

// Разделы на страницах (data/menu.php, 'sections'): кадры на телефоне, оглавление и адреса вида #supy
require __DIR__ . '/inc/_menu.php';
$menu_by_page = array_fill(1, $menu_pages, array());
foreach (menu_sections($menu) as $sec) {
    $menu_by_page[$sec['page']][] = $sec;
}

// Прозрачная точка: её получает <picture> там, где картинка не видна (лист на телефоне, кадр на ПК), —
// так браузер не качает то, что всё равно скрыто
const MENU_BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Лист меню картинкой: WebP двух ширин (или JPEG); $blank — условие media, при котором грузить не нужно. */
function menu_picture($base, $webp, $sizes, $attrs, $blank)
{
    return '<picture>'
        . ($blank ? '<source media="' . $blank . '" srcset="' . MENU_BLANK . '">' : '')
        . ($webp ? '<source type="image/webp" srcset="' . $base . '-1000.webp 1000w, ' . $base . '.webp 1600w" sizes="' . $sizes . '">' : '')
        . '<img src="' . $base . '.jpg" ' . $attrs . '></picture>';
}

/** Рамка раздела на листе — переменными для стилей (доли листа). */
function menu_box_vars($x, $y, $w, $h)
{
    return sprintf('--x:%.3F;--y:%.3F;--w:%.3F;--h:%.3F', $x, $y, $w, $h);
}

// Описание страницы для незрячих и поисковиков: «Меню, страница 3: горячее и гриль»
function menu_alt($n, $title)
{
    return 'Меню ресторана ФабрикантЪ, страница ' . $n . ': ' . mb_strtolower($title);
}

$page_title = 'Меню | ФабрикантЪ - Ресторан с собственной пивоварней | Симферополь';
$page_description = 'Меню ресторана-пивоварни ФабрикантЪ в Симферополе, ' . mb_strtolower($menu['season'])
    . ': пиво собственного производства, закуски, горячее и гриль, десерты, коктейли и вино. Листайте онлайн или скачайте PDF.';
$page_image = $menu_img . '1.jpg';
$page_hero = false; // своя шапка ниже, фото не нужно — меню сразу в первом экране
$page_css = array('/assets/css/gazette.css', '/assets/css/book.css');
$page_js = array('/assets/js/menu.js', '/assets/js/promos-now.js');

// Плашка «Сейчас действует» под шапкой меню: акции из data/promos.php по времени Симферополя
$promo_data = require __DIR__ . '/data/promos.php';
require __DIR__ . '/inc/_promos.php';

// Карточка ресторана для поисковиков: ссылка на меню, адрес, телефон, часы (как на странице «Контакты»)
$site = 'https://' . $_SERVER['HTTP_HOST'];
$page_head = '    <script type="application/ld+json">' . json_encode(array(
    '@context' => 'https://schema.org',
    '@type' => 'Restaurant',
    'name' => 'ФабрикантЪ',
    'description' => 'Ресторан с собственной пивоварней',
    'url' => $site . '/',
    'image' => $site . '/assets/img/hero/hall.webp',
    'telephone' => '+79788072001',
    'servesCuisine' => array('Русская', 'Немецкая', 'Чешская', 'Австрийская'),
    'address' => array(
        '@type' => 'PostalAddress',
        'streetAddress' => 'ул. Киевская, 54',
        'addressLocality' => 'Симферополь',
    ),
    'openingHours' => 'Mo-Su 11:00-23:00',
    'acceptsReservations' => true,
    'hasMenu' => array(
        '@type' => 'Menu',
        'name' => 'Меню, ' . mb_strtolower($menu['season']),
        'url' => $site . '/menu.php',
        'inLanguage' => 'ru',
    ),
), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>' . "\n";

require __DIR__ . '/inc/_head.php';
require __DIR__ . '/inc/_modules.php';
?>
    <section class="section_menu-pages">
        <!-- Шапка на тёмном столе вместо фото: меню начинается в первом экране -->
        <header class="menu-head">
            <div class="menu-head__inner">
                <div class="menu-head__titles">
                    <ol class="menu-head__crumbs" aria-label="Вы здесь">
                        <li><a href="/">Главная</a></li>
                        <li>Меню</li>
                    </ol>
                    <h1 class="menu-head__title">Меню</h1>
                    <p class="menu-head__season"><?= $menu['season'] ?></p>
                </div>
                <div class="menu-head__actions">
                    <!-- На телефоне от кнопок остаются значок и короткое слово («PDF», «Бронь»), чтобы шапка
                         уместилась в одну строку с заголовком и меню начиналось в первом экране -->
                    <a class="menu-cta" href="<?= $menu_pdf ?>" download="<?= htmlspecialchars($menu_pdf_file) ?>" data-goal="menu_pdf"<?php if ($menu_pdf_size): ?> aria-label="Скачать PDF, <?= $menu_pdf_size ?>"<?php endif; ?>>
                        <svg class="menu-cta__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>
                        <span class="menu-cta__text"><span><span class="menu-cta__more">Скачать </span>PDF</span><?php if ($menu_pdf_size): ?><span class="menu-cta__note"><?= $menu_pdf_size ?></span><?php endif; ?></span>
                    </a>
                    <a class="menu-cta menu-cta--primary" href="<?= $menu_phone[0] ?>" data-goal="menu_call" aria-label="Забронировать стол по телефону <?= $menu_phone[1] ?>">
                        <span class="menu-cta__icon"><?= icon('phone') ?></span>
                        <span class="menu-cta__text"><span><span class="menu-cta__long">Забронировать стол</span><span class="menu-cta__short">Бронь</span></span><span class="menu-cta__note"><?= $menu_phone[1] ?></span></span>
                    </a>
                </div>
            </div>
        </header>

        <!-- Акции сегодня: «Сейчас, до 15:00 — Счастливые часы». Пересчитывает assets/js/promos-now.js -->
        <?= promo_bar($promo_data, 'promo-now--table') ?>


        <!-- Два вида одного меню. Скрипт menu3d/main.js выбирает один и ставит data-mode="book" или "flat";
             без скрипта остаётся меню для чтения -->
        <div class="menu-view">
            <!-- Гость раньше выбрал газету: пока она грузится, меню для чтения не показываем, чтобы оно не мелькнуло
                 (стили по data-want в book.css). Остальным оно видно сразу — это и есть первый экран -->
            <script>try { if (localStorage.getItem('fabrikant.menu.mode') === 'book' && !matchMedia('(max-width: 767px)').matches) document.currentScript.parentNode.dataset.want = 'book'; } catch (e) {}</script>
            <!-- Полоса над меню: переключатель вида, подсказка про лупу (в виде для чтения) и содержание
                 с миниатюрами (в газете; в виде для чтения его заменяют разделы слева). Переключатель
                 показывает скрипт, и только там, где газета может работать -->
            <div class="menu-view__bar">
                <div class="menu-view__switch" role="group" aria-label="Вид меню" hidden>
                    <button type="button" class="menu-view__mode" data-mode="flat" aria-pressed="true">Читать</button>
                    <button type="button" class="menu-view__mode" data-mode="book" aria-pressed="false">Листать газету</button>
                </div>
                <p class="menu-view__hint">Наведите на страницу — лупа покажет строки крупнее. Нажмите — страница откроется для чтения.</p>
                <nav class="menu-toc" aria-label="Содержание меню">
                    <!-- Стрелки показывает скрипт, а стили — только на ПК: на телефоне полосу листают пальцем -->
                    <button type="button" class="menu-toc__arrow menu-toc__arrow--prev" aria-label="Предыдущие разделы" tabindex="-1" hidden><?= icon('chevron-left') ?></button>
                    <ol class="menu-toc__list">
<?php foreach ($menu['pages'] as $i => $title): $n = $i + 1; ?>
                        <li><a class="menu-toc__link" href="#page-<?= $n ?>" data-page="<?= $n ?>"<?= $n === 1 ? ' aria-current="true"' : '' ?>>
<?php if ($menu_thumbs): // Содержание с миниатюрами видно только в газете — картинки ставит menu3d/main.js, когда её открывают (как и заставку газеты) ?>
                            <img class="menu-toc__thumb" src="<?= MENU_BLANK ?>" data-src="<?= $menu_img . $n ?>-200.webp" width="200" height="283" alt="" decoding="async">
<?php endif; ?>
                            <span class="menu-toc__name"><span class="sr-only">Страница <?= $n ?>: </span><?= $title ?></span>
                        </a></li>
<?php endforeach; ?>
                    </ol>
                    <button type="button" class="menu-toc__arrow menu-toc__arrow--next" aria-label="Следующие разделы" tabindex="-1" hidden><?= icon('chevron-right') ?></button>
                </nav>
            </div>

            <!-- Газета на тёмном столе: её можно листать как бумажную. Холст в .book__stage добавляет скрипт -->
            <div class="book" hidden
                 data-pages="<?= $menu_pages ?>"
                 data-page-w="1600" data-page-h="2263"
                 data-src-low="<?= $book_low ?>"
                 data-src-high="<?= $book_high ?>"<?php if ($menu_zoom): ?>

                 data-src-zoom="<?= $menu_img ?>{n}-3200.webp"<?php endif; ?><?php if ($menu_thumbs): ?>

                 data-src-tiny="<?= $menu_img ?>{n}-200.webp"<?php endif; ?>>
                <div class="book__stage" tabindex="0" role="group" aria-label="Меню ресторана. Стрелки влево и вправо листают страницы, плюс и минус меняют масштаб">
                    <!-- Пока газета загружается, на столе лежит первая страница обычной картинкой.
                         Газета открывается не сразу, а по выбору гостя, поэтому картинку ставит menu3d/main.js,
                         когда газету открывают: скрытую Chrome всё равно скачал бы, даже ленивую -->
                    <img class="book__poster" src="<?= MENU_BLANK ?>" data-src="<?= str_replace('{n}', '1', $book_low) ?>" width="1600" height="2263" alt="" decoding="async">
                    <!-- Подсказка: рука берёт страницу за край и тянет к корешку. Показывается, пока посетитель
                         сам не тронул газету (класс is-fresh ставит и снимает menu3d/ui.js).
                         Контур руки — Tabler Icons (MIT) -->
                    <div class="book__hand" aria-hidden="true">
                        <div class="book__hand-move">
                            <svg class="book__hand-icon" viewBox="0 0 24 24" focusable="false"><path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12"/><path d="M14 10.5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2 .208a6 6 0 0 1-5.012-2.7L7 19c-.312-.479-1.407-2.388-3.286-5.728a1.5 1.5 0 0 1 .536-2.022 1.867 1.867 0 0 1 2.28.28L8 13"/></svg>
                            <span class="book__hand-note">Потяните за край</span>
                        </div>
                    </div>
                </div>
                <div class="book__bar">
                    <p class="book__hint">Листайте, потянув страницу за край или нажав на её внешнюю треть. Двойное нажатие — увеличить.</p>
                    <!-- Кнопки выключены, пока газета загружается; включает их menu3d/ui.js -->
                    <div class="book__controls" role="group" aria-label="Управление газетой">
                        <button type="button" class="book__btn book__btn--prev" aria-label="Предыдущая страница" title="Предыдущая страница" disabled><?= icon('chevron-left') ?></button>
                        <p class="book__count" aria-live="polite">1 / <?= $menu_pages ?></p>
                        <button type="button" class="book__btn book__btn--next" aria-label="Следующая страница" title="Следующая страница" disabled><?= icon('chevron-right') ?></button>
                        <span class="book__sep" aria-hidden="true"></span>
                        <button type="button" class="book__btn book__btn--zoom-out" aria-label="Уменьшить" title="Уменьшить" disabled>
                            <svg class="book__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6"/></svg>
                        </button>
                        <button type="button" class="book__btn book__btn--zoom-in" aria-label="Увеличить" title="Увеличить" disabled>
                            <svg class="book__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6M10.5 7.5v6"/></svg>
                        </button>
                        <button type="button" class="book__btn book__btn--full" aria-label="На весь экран" title="На весь экран" disabled>
                            <svg class="book__glyph book__glyph--enter" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>
                            <svg class="book__glyph book__glyph--exit" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>
                        </button>
                    </div>
                    <!-- Совет рядом с кнопкой «На весь экран»; пропадает, когда газету развернули (menu3d/ui.js).
                         Указующая рука — старинный типографский знак, на узком экране кнопка не слева, и знак скрыт -->
                    <p class="book__tip"><span class="book__tip-mark" aria-hidden="true">&#9756;</span> Разверните меню на весь экран для более удобного просмотра</p>
                </div>
            </div>

            <!-- Меню для чтения: страницы одна под другой. Работает и без скрипта: ссылки разделов — якоря,
                 страница и кадр раздела — ссылки на крупную картинку (со скриптом открывается окно увеличения).
                 ПК: слева разделы, справа страницы целиком, на странице под курсором лупа (menu.js).
                 Телефон: сверху полоса разделов, вместо листа A3 — кадры разделов, вырезанные из той же картинки:
                 текст в них в 1,7–3,5 раза крупнее. Страница без разметки разделов показывается целиком -->
            <div class="menu-read">
                <nav class="menu-nav" aria-label="Разделы меню">
                    <ol class="menu-nav__pages">
<?php foreach ($menu['pages'] as $i => $title): $n = $i + 1; ?>
                        <li class="menu-nav__page<?= $menu_by_page[$n] ? ' has-secs' : '' ?>">
                            <a class="menu-nav__link menu-nav__link--page" href="#page-<?= $n ?>" data-goal="menu_section"><span class="menu-nav__num"><?= $n ?></span> <?= $title ?></a>
<?php if ($menu_by_page[$n]): ?>
                            <ol class="menu-nav__secs">
<?php foreach ($menu_by_page[$n] as $sec): ?>
                                <li><a class="menu-nav__link" href="#<?= $sec['id'] ?>" data-goal="menu_section"><?= $sec['title'] ?></a></li>
<?php endforeach; ?>
                            </ol>
<?php endif; ?>
                        </li>
<?php endforeach; ?>
                    </ol>
                </nav>

                <div class="menu-read__pages">
<?php $first_crop = true;
foreach ($menu['pages'] as $i => $title):
    $n = $i + 1;
    $secs = $menu_by_page[$n];
    $high = str_replace('{n}', $n, $book_high);
    // Первая страница — самая крупная картинка первого экрана на ПК, грузится первой.
    // На телефоне у страницы с разделами её место занимают кадры, и сама она не грузится
    $attrs = 'width="1600" height="2263" alt="' . menu_alt($n, $title) . '"' . ($n > 1 ? ' loading="lazy"' : ' fetchpriority="high"') . ' decoding="async"';
?>
                    <section class="menu-page<?= $secs ? ' has-secs' : '' ?>" id="page-<?= $n ?>" data-page="<?= $n ?>" aria-labelledby="page-<?= $n ?>-title">
                        <h2 class="menu-page__title" id="page-<?= $n ?>-title"><span class="menu-page__num">Страница <?= $n ?></span> <?= $title ?></h2>
                        <a class="menu-page__zoom" href="<?= $high ?>" data-page="<?= $n ?>" title="Увеличить">
                            <?= menu_picture($menu_img . $n, $menu_webp, '(max-width: 767px) 100vw, 1000px', $attrs, $secs ? '(max-width: 767px)' : '') ?>

                        </a>
<?php if ($secs): ?>
                        <div class="menu-page__secs">
<?php foreach ($secs as $sec): list($sx, $sy, $sw, $sh) = $sec['boxes'][0]; ?>
                            <section class="menu-sec" id="<?= $sec['id'] ?>" style="<?= menu_box_vars($sx, $sy, $sw, $sh) ?>" aria-labelledby="<?= $sec['id'] ?>-title">
                                <h3 class="menu-sec__title" id="<?= $sec['id'] ?>-title"><?= $sec['title'] ?></h3>
<?php foreach ($sec['boxes'] as $box):
    list($bx, $by, $bw, $bh) = $box;
    $crop_attrs = 'width="1600" height="2263" alt="Меню, ' . mb_strtolower($sec['title']) . '"'
        . ($first_crop ? ' fetchpriority="high"' : ' loading="lazy"') . ' decoding="async"';
    $first_crop = false;
    // Ширина кадра на экране телефона — ширина экрана без полей; картинка листа шире во столько раз,
    // во сколько кадр уже листа
    $crop_sizes = sprintf('calc((100vw - 24px) / %.3F)', $bw);
?>
                                <a class="menu-sec__crop" href="<?= $high ?>" data-page="<?= $n ?>" data-box="<?= implode(',', array_map(function ($v) { return sprintf('%.3F', $v); }, $box)) ?>" style="<?= menu_box_vars($bx, $by, $bw, $bh) ?>;aspect-ratio:<?= sprintf('%.4F', $bw * 1600 / ($bh * 2263)) ?>" title="Увеличить">
                                    <?= menu_picture($menu_img . $n, $menu_webp, $crop_sizes, $crop_attrs, '(min-width: 768px)') ?>

                                </a>
<?php endforeach; ?>
                            </section>
<?php endforeach; ?>
                            <a class="menu-page__whole" href="<?= $high ?>" data-page="<?= $n ?>">Страница <?= $n ?> целиком</a>
                        </div>
<?php endif; ?>
                    </section>
<?php endforeach; ?>
                </div>
            </div>
        </div>

        <!-- Телефон: бронь всегда под большим пальцем. Прячется, когда виден подвал с теми же контактами (menu.js) -->
        <div class="menu-dock">
            <a class="menu-dock__call" href="<?= $menu_phone[0] ?>" data-goal="menu_call">
                <span class="menu-dock__icon"><?= icon('phone') ?></span>
                <span class="menu-dock__text">Забронировать стол <span class="menu-dock__note"><?= $menu_phone[1] ?></span></span>
            </a>
        </div>
    </section>

    <!-- Окно увеличения страницы (menu3d/zoom.js): щипок, двойное нажатие, кнопки ±, перетаскивание -->
    <dialog class="menu-zoom" aria-label="Страница меню крупно">
        <div class="menu-zoom__stage">
            <img class="menu-zoom__img" alt="" draggable="false">
        </div>
        <div class="menu-zoom__bar" role="group" aria-label="Управление увеличением">
            <button type="button" class="book__btn menu-zoom__prev" aria-label="Предыдущая страница" title="Предыдущая страница"><?= icon('chevron-left') ?></button>
            <p class="book__count menu-zoom__count" aria-live="polite">1 / <?= $menu_pages ?></p>
            <button type="button" class="book__btn menu-zoom__next" aria-label="Следующая страница" title="Следующая страница"><?= icon('chevron-right') ?></button>
            <span class="book__sep" aria-hidden="true"></span>
            <button type="button" class="book__btn menu-zoom__out" aria-label="Уменьшить" title="Уменьшить">
                <svg class="book__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6"/></svg>
            </button>
            <button type="button" class="book__btn menu-zoom__in" aria-label="Увеличить" title="Увеличить">
                <svg class="book__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6M10.5 7.5v6"/></svg>
            </button>
            <button type="button" class="book__btn menu-zoom__close" aria-label="Закрыть" title="Закрыть"><?= icon('close') ?></button>
        </div>
    </dialog>

    <!-- Адреса модулей с метками версий; three загружается только вместе с газетой и сверяется по контрольной сумме -->
<?= module_tags('/assets/js/menu3d/main.js', array('/assets/js/menu3d', '/assets/js/lib'), array(
    'imports'   => array('three' => '/assets/vendor/three/0.185.1/three.module.min.js'),
    'integrity' => array(
        '/assets/vendor/three/0.185.1/three.module.min.js' => 'sha384-QHQk1LzjJlJYNdthXjKCmffpDRZL3EqJ7LfqBzyKyvGgjAYM2ZVuYtFGg42NcAJ/',
        '/assets/vendor/three/0.185.1/three.core.min.js'   => 'sha384-rx+KIp/9ptjArhnFAcpVoOc/ynktDsRtRJKIbC7YVKylEvFu8sgmzk9RmQ+CIV48',
    ),
    'preload'   => array('/assets/js/lib/env.js'),
)) ?>
    <!-- Галерею браузер подгружает заранее, когда посетитель наводит курсор на ссылку -->
    <script type="speculationrules">{"prefetch":[{"where":{"href_matches":"/gallery.php"},"eagerness":"moderate"}]}</script>

<?php require __DIR__ . '/inc/_footer.php'; ?>
