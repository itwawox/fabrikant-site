<?php
// «О ресторане» — очерк в стиле газеты-меню. Шапка, рубрики, колонтитул и приглашение в конце —
// те же детали, что в галерее (press.css); своё у очерка — колонки текста, сорта пива,
// плашка «Своими руками» и объявление о работе (story.css).
require __DIR__ . '/inc/_press.php';
require __DIR__ . '/inc/_modules.php';
$gallery_build = require __DIR__ . '/data/gallery.build.php';

$about_phone = array('tel:+79788072001', '+7 978 807 20 01');
$about_mail = 'info@fabrikant-simf.ru';
// Маршрут в Яндекс Картах до ресторана — тот же, что на странице «Контакты»
$about_route = 'https://yandex.ru/maps/?rtext=~44.957436%2C34.109319&amp;rtt=auto';
// Сорта собственной пивоварни — как в печатном меню (страница 1, «Пиво собственного производства»)
$about_beers = array(
    'Пильзенское светлое' => 'алк. 4,8%',
    'Имбирное красное'    => 'алк. 5,6%',
    'Эль золотой'         => 'алк. 5,4%',
);
$about_rubrics = array(
    'pivovarnya' => 'Пивоварня',
    'kuhnya'     => 'Кухня',
    'atmosfera'  => 'Атмосфера',
    'rabota'     => 'Работа у нас',
);

$page_title = 'О ресторане | ФабрикантЪ - Ресторан с собственной пивоварней | Симферополь';
$page_description = 'Ресторан-пивоварня ФабрикантЪ в центре Симферополя: пиво собственной пивоварни по чешской технологии, кухня с крымским акцентом, интерьер начала прошлого века и летний сад.';
$page_image = '/assets/img/hero/hall.webp';
$page_hero = false; // кадр зала стоит прямо в разметке ниже
$page_css = array('/assets/css/gazette.css', '/assets/css/press.css', '/assets/css/story.css');
require __DIR__ . '/inc/_head.php';
?>
    <main>
    <!-- Первая полоса — как в галерее: кадр зала на тёмной плашке, заголовок «печатается» прокатом валика -->
    <section class="press-hero">
        <div class="press-hero__plate">
            <picture>
                <source media="(max-width: 767px)" srcset="/assets/img/hero/hall-m.webp" type="image/webp" width="900" height="600">
                <img src="/assets/img/hero/hall.webp" width="1920" height="735" alt="Зал ресторана ФабрикантЪ: кирпичные стены, абажуры над столами, медная пивоварня" fetchpriority="high">
            </picture>
        </div>
        <h1 class="press-hero__title">О ресторане</h1>
        <div class="press-hero__deck">
            <nav aria-label="Вы здесь">
                <ol class="press-hero__crumbs">
                    <li><a href="/">Главная</a></li>
                    <li aria-current="page">О ресторане</li>
                </ol>
            </nav>
            <p class="press-hero__lede">Островок уюта и комфорта в самом центре шумного города. Здесь всё настоящее: пиво из собственной пивоварни, вкуснейшее угощение, стильный интерьер.</p>
        </div>
        <p class="press-hero__running">Ресторан-пивоварня &bull; Симферополь, Киевская, 54 &bull; Каждый день с 11:00 до 23:00</p>
    </section>

    <section class="gazette press story">
        <div class="gazette__sheet">
            <nav class="gazette__running press__contents" aria-label="Рубрики">
                <div class="press__contents-list">
                    <span>В номере:</span>
<?php $n = 0; foreach ($about_rubrics as $rubric_id => $rubric_title): ?>
                    <?= $n++ ? '<span aria-hidden="true">&bull;</span> ' : '' ?><a href="#rubric-<?= $rubric_id ?>"><?= $rubric_title ?></a>
<?php endforeach; ?>
                </div>
            </nav>

            <!-- Пивоварня -->
            <section class="rubric" id="rubric-pivovarnya" aria-labelledby="rubric-pivovarnya-title">
                <div class="rubric__head">
                    <span class="gz-rule" aria-hidden="true"></span>
                    <h2 class="rubric__title" id="rubric-pivovarnya-title">Пивоварня</h2>
                    <span class="gz-rule" aria-hidden="true"></span>
                </div>
                <p class="rubric__lede">Гордость Фабриканта — пиво, сваренное на собственной пивоварне.</p>
                <div class="story__spread">
                    <div class="story__text story__text--lead">
                        <p class="story__first">Во-первых, это вкусно: свежее пиво из хмеля и солода от лучших производителей, классический рецепт и чешская технология пивоварения.</p>
                        <p>Во-вторых, это оригинально: ФабрикантЪ угощает сортами, которые можно попробовать только здесь.</p>
                        <p>И, наконец, это просто красиво — сама пивоварня украшает просторный зал ресторана, а отличное пиво от Фабриканта украшает жизнь наших гостей.</p>
                    </div>
                    <aside class="story__side" aria-label="Сорта собственной пивоварни">
                        <figure class="story-photo">
                            <span class="story-photo__frame"><?= picture('/assets/img/info_img2.webp', '/assets/img/info_img2.jpg', 'width="640" height="349" alt="Барная стойка с пивными кранами и схемой пивоварения на стене" loading="lazy" decoding="async"') ?></span>
                        </figure>
                        <div class="story-beers">
                            <p class="story-beers__title">Нефильтрованное, непастеризованное</p>
                            <dl class="gz-rows">
<?php foreach ($about_beers as $beer => $strength): ?>
                                <div class="gz-row"><dt><?= $beer ?></dt><dd><?= $strength ?></dd></div>
<?php endforeach; ?>
                            </dl>
                            <p class="story-beers__note">Сезонные сорта — спросите у официанта.</p>
                        </div>
                    </aside>
                </div>
            </section>

            <!-- Кухня -->
            <section class="rubric" id="rubric-kuhnya" aria-labelledby="rubric-kuhnya-title">
                <div class="rubric__head">
                    <span class="gz-rule" aria-hidden="true"></span>
                    <h2 class="rubric__title" id="rubric-kuhnya-title">Кухня</h2>
                    <span class="gz-rule" aria-hidden="true"></span>
                </div>
                <p class="rubric__lede">Классические рецепты с лёгким крымским акцентом.</p>
                <div class="story__spread story__spread--flip">
                    <div class="story__text story__text--cols">
                        <p class="story__first">Мы взяли лучшее из традиций русской, немецкой, чешской и австрийской кухонь и адаптировали под местный колорит и привычные вкусы. Мясные блюда, черноморская рыба, богатый выбор салатов и закусок, нежные десерты и сезонные предложения — в меню Фабриканта есть блюда на любой вкус.</p>
                        <p>Крымские сыры, свежие овощи и зелень, выращенные на полуострове, сочные фрукты, созревшие под южным солнцем, — всё это в меню появилось не случайно. Мы готовим только из самого свежего и натурального, а гостям и жителям Крыма вкуснее то, что родилось на щедрой крымской земле.</p>
                    </div>
                    <aside class="story__side">
<?php if (isset($gallery_build['kare'])): ?>
                        <figure class="story-photo">
                            <span class="story-photo__frame"><?= press_picture($gallery_build['kare'], 'Каре ягнёнка с картофелем и печёным перцем', '(min-width: 1248px) 482px, (min-width: 700px) 40vw, 100vw') ?></span>
                            <figcaption class="story-photo__caption">Каре ягнёнка с картофелем и печёным перцем.</figcaption>
                        </figure>
<?php endif; ?>
                        <!-- Плашка, как «Метр пива» в меню: что в ресторане делают сами -->
                        <div class="story-plaque">
                            <p class="story-plaque__title">Своими руками</p>
                            <ul class="story-plaque__list">
                                <li>копчения и соления — в своём цеху</li>
                                <li>колбаски к пиву</li>
                                <li>варенье из свежего урожая</li>
                                <li>хлеб из собственной пекарни</li>
                            </ul>
                        </div>
                    </aside>
                </div>
                <p class="story__more"><a href="/menu.php">Открыть меню ресторана</a></p>
            </section>

            <!-- Атмосфера -->
            <section class="rubric" id="rubric-atmosfera" aria-labelledby="rubric-atmosfera-title">
                <div class="rubric__head">
                    <span class="gz-rule" aria-hidden="true"></span>
                    <h2 class="rubric__title" id="rubric-atmosfera-title">Атмосфера</h2>
                    <span class="gz-rule" aria-hidden="true"></span>
                </div>
                <p class="rubric__lede">Её в Фабриканте можно называть отдельным блюдом в меню.</p>
                <div class="story__pair">
                    <figure class="story-photo">
                        <span class="story-photo__frame"><?= picture('/assets/img/info_img.webp', '/assets/img/info_img.jpg', 'width="640" height="349" alt="Фасад ресторана вечером: светящаяся вывеска ФабрикантЪ над входом" loading="lazy" decoding="async"') ?></span>
                        <figcaption class="story-photo__caption">Вход с улицы Киевской.</figcaption>
                    </figure>
                    <figure class="story-photo">
                        <span class="story-photo__frame"><?= picture('/assets/img/info_img3.webp', '/assets/img/info_img3.jpg', 'width="640" height="349" alt="Отдельный зал: сервированный стол, обои с узором и старые фотографии на стенах" loading="lazy" decoding="async"') ?></span>
                        <figcaption class="story-photo__caption">Малый зал для компании.</figcaption>
                    </figure>
                </div>
                <div class="story__text story__text--narrow">
                    <p class="story__first">Интерьер выполнен в духе начала прошлого века — времени расцвета Крыма как курортной жемчужины. Здесь удобно в любое время года: стильный зимний зал и зелёная летняя площадка вмещают всех, кто хочет окунуться в атмосферу сдержанной роскоши, отведать лучшие блюда и свежайшее пиво.</p>
                </div>
                <div class="story__welcome">
                    <p class="story__welcome-text">Добро пожаловать в ресторан-пивоварню ФабрикантЪ!</p>
                    <?= picture('/assets/img/logo.webp', '/assets/img/logo.png', 'class="story__logo" width="700" height="260" alt="ФабрикантЪ — ресторан с собственной пивоварней" loading="lazy" decoding="async"') ?>
                </div>
            </section>

            <!-- Работа у нас: газетное объявление -->
            <section class="rubric" id="rubric-rabota" aria-labelledby="rubric-rabota-title">
                <div class="story-ad">
                    <h2 class="story-ad__title" id="rubric-rabota-title">Ищем в команду</h2>
                    <p class="story-ad__lede">Ярких и амбициозных людей, которые хотят работать и зарабатывать.</p>
                    <ul class="story-ad__list">
                        <li>Работа в известном ресторане, где есть место для творчества и роста.</li>
                        <li>Обучаем и продвигаем своих сотрудников.</li>
                        <li>Ценим команду и вкладываемся в неё.</li>
                    </ul>
                    <p class="story-ad__contact">Резюме присылайте на <a href="mailto:<?= $about_mail ?>?subject=<?= rawurlencode('Резюме') ?>" data-goal="about_job_mail"><?= $about_mail ?></a> или звоните: <a href="<?= $about_phone[0] ?>" data-goal="about_job_call"><?= $about_phone[1] ?></a>.</p>
                </div>
            </section>

            <!-- Чем заканчивается очерк: приходите -->
            <aside class="press-cta" aria-labelledby="press-cta-title">
                <h2 class="press-cta__title" id="press-cta-title">Ждём вас в гости</h2>
                <p class="press-cta__text">Симферополь, Киевская,&nbsp;54. Открыто каждый день с&nbsp;11:00 до&nbsp;23:00.</p>
                <div class="press-cta__actions">
                    <a class="press-cta__action press-cta__action--main" href="<?= $about_phone[0] ?>" data-goal="about_call">
                        <span>Забронировать стол</span>
                        <span class="press-cta__note"><?= $about_phone[1] ?></span>
                    </a>
                    <a class="press-cta__action" href="/gallery.php" data-goal="about_gallery">
                        <span>Смотреть галерею</span>
                        <span class="press-cta__note">зал, сад, пивоварня</span>
                    </a>
                </div>
                <p class="press-cta__route"><a href="<?= $about_route ?>" target="_blank" rel="noopener" data-goal="about_route">Проложить маршрут в Яндекс Картах</a></p>
            </aside>

            <p class="gazette__strip">
                <span>Симферополь, ул. Киевская, 54.</span>
                <span>тел. <a href="<?= $about_phone[0] ?>"><?= $about_phone[1] ?></a></span>
                <span><a href="/menu.php">Меню ресторана</a></span>
            </p>
        </div>
    </section>
    </main>

<?= module_tags('/assets/js/story/main.js', array('/assets/js/story', '/assets/js/gallery')) ?>

<?php require __DIR__ . '/inc/_footer.php'; ?>
