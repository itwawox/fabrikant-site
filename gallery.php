<?php
// Галерея «Фотохроника» — иллюстрированное приложение к газете-меню.
// Фотографии, рубрики и подписи правятся в data/gallery.php; размеры и адреса файлов — в data/gallery.build.php
// (его пишет tools/build-images.php). Здесь только разметка.
require __DIR__ . '/inc/_press.php';
require __DIR__ . '/inc/_modules.php';
$gallery = require __DIR__ . '/data/gallery.php';
$gallery_build = require __DIR__ . '/data/gallery.build.php';

// Рубрики с раскладкой по колонкам. Фото, для которого ещё не запускали сборку картинок, пропускаем.
// $gallery_shots — те же фото одним списком в порядке страницы: в этом порядке их листает окно просмотра.
$gallery_rubrics = array();
$gallery_shots = array();
foreach ($gallery['rubrics'] as $rubric_id => $rubric) {
    $photos = array();
    foreach ($gallery['photos'] as $photo) {
        if ($photo['rubric'] === $rubric_id && isset($gallery_build[$photo['id']])) {
            $photos[] = $photo;
        }
    }
    if (!$photos) {
        continue;
    }
    // Стороны чередуются: в каждой второй рубрике узкая колонка стоит слева
    $rubric['columns'] = press_columns($photos, $gallery_build, count($gallery_rubrics) % 2 === 1);
    foreach ($rubric['columns'] as $column) {
        foreach ($column['plates'] as $plate) {
            $plate['rubric'] = $rubric['title'];
            $gallery_shots[] = $plate;
        }
    }
    $gallery_rubrics[$rubric_id] = $rubric;
}

$page_title = 'Галерея | ФабрикантЪ - Ресторан с собственной пивоварней | Симферополь';
$page_description = 'Фотографии ресторана-пивоварни ФабрикантЪ в Симферополе: зал с кирпичными стенами и латунью, летний сад с фонтаном, медная пивная башня и блюда кухни.';
$page_image = '/assets/img/hero/stage.webp';
$page_hero = false; // кадр зала стоит прямо в разметке ниже, фоновая шапка не нужна
$gallery_phone = array('tel:+79788072001', '+7 978 807 20 01');
// Маршрут в Яндекс Картах до ресторана — тот же, что на странице «Контакты»
$gallery_route = 'https://yandex.ru/maps/?rtext=~44.957436%2C34.109319&amp;rtt=auto';
$page_css = array('/assets/css/gazette.css', '/assets/css/press.css');
require __DIR__ . '/inc/_head.php';
?>
    <main>
    <!-- Первая полоса: тёмная плашка под прозрачной шапкой сайта. Скрипт печатает кадр растром и проявляет его в цвет -->
    <section class="press-hero">
        <div class="press-hero__plate" data-press="hero">
            <picture>
                <source media="(max-width: 767px)" srcset="/assets/img/hero/stage-m.webp" type="image/webp" width="900" height="600">
                <img src="/assets/img/hero/stage.webp" width="1920" height="683" alt="Большой зал ресторана ФабрикантЪ: столы под жёлтыми абажурами, кирпичные стены" fetchpriority="high">
            </picture>
        </div>
        <h1 class="press-hero__title">Галерея</h1>
        <div class="press-hero__deck">
            <nav aria-label="Вы здесь">
                <ol class="press-hero__crumbs">
                    <li><a href="/">Главная</a></li>
                    <li aria-current="page">Галерея</li>
                </ol>
            </nav>
            <p class="press-hero__lede">Островок уюта и комфорта в самом центре шумного города. Здесь все настоящее: пиво из собственной пивоварни, вкуснейшее угощение, стильный интерьер.</p>
        </div>
        <p class="press-hero__running">Фотохроника &bull; Ресторан с собственной пивоварней &bull; Симферополь</p>
    </section>

    <section class="gazette press">
        <div class="gazette__sheet">
            <!-- Колонтитул с рубриками прилипает под шапкой сайта: отмечает рубрику на экране (gallery/contents.js),
                 а линейка под ним показывает, сколько номера уже пролистано -->
            <nav class="gazette__running press__contents" aria-label="Рубрики">
                <div class="press__contents-list">
                    <span>В номере:</span>
<?php $n = 0; foreach ($gallery_rubrics as $rubric_id => $rubric): ?>
                    <?= $n++ ? '<span aria-hidden="true">&bull;</span> ' : '' ?><a href="#rubric-<?= e($rubric_id) ?>"><?= e($rubric['title']) ?></a>
<?php endforeach; ?>
                </div>
            </nav>

<?php $first = true; foreach ($gallery_rubrics as $rubric_id => $rubric): ?>
            <section class="rubric" id="rubric-<?= e($rubric_id) ?>" aria-labelledby="rubric-<?= e($rubric_id) ?>-title">
                <div class="rubric__head">
                    <span class="gz-rule" aria-hidden="true"></span>
                    <h2 class="rubric__title" id="rubric-<?= e($rubric_id) ?>-title"><?= e($rubric['title']) ?></h2>
                    <span class="gz-rule" aria-hidden="true"></span>
                </div>
                <p class="rubric__lede"><?= e($rubric['lede']) ?></p>
                <div class="rubric__grid">
<?php   foreach ($rubric['columns'] as $column): ?>
                    <div class="rubric__col rubric__col--<?= $column['kind'] ?>">
<?php     foreach ($column['plates'] as $plate): ?>
                        <?= press_plate($plate, !$first) ?>

<?php       $first = false; ?>
<?php     endforeach; ?>
                    </div>
<?php   endforeach; ?>
                </div>
            </section>

<?php endforeach; ?>
            <!-- Чем заканчивается номер: посмотрели фото — приходите -->
            <aside class="press-cta" aria-labelledby="press-cta-title">
                <h2 class="press-cta__title" id="press-cta-title">Приходите посмотреть вживую</h2>
                <p class="press-cta__text">Симферополь, Киевская,&nbsp;54. Открыто каждый день с&nbsp;11:00 до&nbsp;23:00.</p>
                <div class="press-cta__actions">
                    <a class="press-cta__action press-cta__action--main" href="<?= $gallery_phone[0] ?>" data-goal="gallery_call">
                        <span>Забронировать стол</span>
                        <span class="press-cta__note"><?= $gallery_phone[1] ?></span>
                    </a>
                    <a class="press-cta__action" href="/menu.php" data-goal="gallery_menu">
                        <span>Открыть меню</span>
                        <span class="press-cta__note">пиво, кухня, вино</span>
                    </a>
                </div>
                <p class="press-cta__route"><a href="<?= $gallery_route ?>" target="_blank" rel="noopener" data-goal="gallery_route">Проложить маршрут в Яндекс Картах</a></p>
            </aside>

            <p class="gazette__strip">
                <span>Симферополь, ул. Киевская, 54.</span>
                <span>тел. <a href="tel:+79788072001">+7 978 807 20 01</a></span>
                <span><a href="/menu.php">Меню ресторана</a></span>
            </p>
        </div>
    </section>
    </main>

    <!-- Окно просмотра. Слайды уже в разметке: скрипт только открывает окно и листает ленту -->
    <!-- Окно просмотра. Слайды уже в разметке: скрипт только открывает окно и листает ленту.
         Сверху счётчик и кнопки, снизу лента миниатюр — по ней видно, сколько фото и где ты сейчас -->
    <dialog class="viewer" aria-label="Просмотр фотографий">
        <div class="viewer__top">
            <p class="viewer__count" aria-live="polite"><span class="viewer__current">1</span> / <?= count($gallery_shots) ?></p>
            <button type="button" class="viewer__btn viewer__btn--share" aria-label="Поделиться фотографией" title="Поделиться фотографией" hidden>
                <svg class="viewer__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M6 12H5v8h14v-8h-1"/></svg>
            </button>
            <button type="button" class="viewer__btn viewer__btn--close" aria-label="Закрыть" title="Закрыть" autofocus><?= icon('close') ?></button>
        </div>
        <div class="viewer__track">
<?php foreach ($gallery_shots as $plate): ?>
            <?= press_shot($plate) ?>

<?php endforeach; ?>
        </div>
        <button type="button" class="viewer__btn viewer__btn--prev" aria-label="Предыдущее фото" title="Предыдущее фото"><?= icon('chevron-left') ?></button>
        <button type="button" class="viewer__btn viewer__btn--next" aria-label="Следующее фото" title="Следующее фото"><?= icon('chevron-right') ?></button>
        <div class="viewer__strip" role="group" aria-label="Все фотографии">
<?php foreach ($gallery_shots as $i => $plate): ?>
            <?= press_thumb($plate, $i + 1) ?>

<?php endforeach; ?>
        </div>
        <p class="viewer__toast" role="status"></p>
    </dialog>

    <!-- Со страницы галереи чаще всего идут в меню — подгружаем его заранее, когда курсор задержался на ссылке -->
    <script type="speculationrules">{"prefetch":[{"urls":["/menu.php"],"eagerness":"moderate"}]}</script>
<?= module_tags('/assets/js/gallery/main.js', array('/assets/js/gallery', '/assets/js/lib'), array('preload' => array('/assets/js/lib/env.js', '/assets/js/gallery/viewer.js', '/assets/js/gallery/route.js', '/assets/js/gallery/contents.js'))) ?>

<?php require __DIR__ . '/inc/_footer.php'; ?>
