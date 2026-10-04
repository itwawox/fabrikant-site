<?php
// Контакты ресторана. Данные заданы здесь один раз и подставляются в карточку ниже.
// Часы работы — как в карточке ресторана в Яндекс Картах; при изменении графика поправьте и здесь.
$contact_yandex = 'https://yandex.ru/maps/org/fabrikant/1324964934/';
$contact_rows = array(
    'Открыто'       => array('', 'ежедневно 11:00–23:00'),
    'Телефон'       => array('tel:+79788072001', '+7 978 807 20 01'),
    'Почта'         => array('mailto:info@fabrikant-simf.ru', 'info@fabrikant-simf.ru'),
    'PR-служба'     => array('mailto:pr@fabrikant-simf.ru', 'pr@fabrikant-simf.ru'),
    'ВКонтакте'     => array('https://vk.com/fabricantsimferopol', 'наша страница'),
    'Одноклассники' => array('https://ok.ru/group/54607657435147', 'наша группа'),
    'Яндекс Карты'  => array($contact_yandex, 'отзывы и фото'),
);
// Маршрут в Яндекс Картах до ресторана (широта, долгота точки из карточки)
$contact_route = 'https://yandex.ru/maps/?rtext=~44.957436%2C34.109319&amp;rtt=auto';

$page_title = 'Контакты | ФабрикантЪ - Ресторан с собственной пивоварней | Симферополь';
$page_hero = false; // главное фото стоит прямо в разметке ниже, предзагрузка фона шапки не нужна
$page_css = array('/assets/css/gazette.css');
require __DIR__ . '/inc/_head.php';
?>
    <div class="contact-hero">
        <!-- На телефоне — свой кадр: вход и зонты террасы. JPEG — запасной вариант для старых браузеров -->
        <picture>
            <source type="image/webp" media="(max-width: 767px)" srcset="/assets/img/hero/terrace-m.webp">
            <source type="image/webp" srcset="/assets/img/hero/terrace.webp">
            <img src="/assets/img/hero/terrace.jpg" width="1920" height="960" alt="Вход в ресторан ФабрикантЪ и летняя терраса" fetchpriority="high">
        </picture>
    </div>

    <section class="gazette contact">
        <div class="gazette__sheet">
            <div class="contact__card">
                <ol class="contact__crumbs">
                    <li><a href="/">Главная</a></li>
                    <li>Контакты</li>
                </ol>
                <h1 class="contact__title">Ждём вас в гости</h1>
                <address class="contact__address">Симферополь, улица Киевская, 54</address>
                <hr class="gz-rule">

                <dl class="gz-rows">
<?php foreach ($contact_rows as $label => $row): ?>
<?php   if ($row[0] === ''): ?>
                    <div class="gz-row"><dt><?= $label ?></dt><dd><?= $row[1] ?></dd></div>
<?php   else: ?>
                    <div class="gz-row"><dt><?= $label ?></dt><dd><a href="<?= $row[0] ?>"<?= strpos($row[0], 'http') === 0 ? ' target="_blank" rel="noopener"' : '' ?>><?= $row[1] ?></a></dd></div>
<?php   endif; ?>
<?php endforeach; ?>
                </dl>

                <div class="contact__actions">
                    <a class="gz-plaque contact__action" href="<?= $contact_rows['Телефон'][0] ?>">Позвонить</a>
                    <a class="gz-plaque contact__action" href="<?= $contact_route ?>" target="_blank" rel="noopener">Проложить маршрут</a>
                </div>
                <p class="contact__note">Вопрос управляющему, отзыв или пожелание — напишите нам на почту.</p>
            </div>

            <h2 class="contact__map-title">Как нас найти</h2>
            <hr class="gz-rule">
            <div class="contact__map">
                <iframe src="https://yandex.ru/map-widget/v1/org/fabrikant/1324964934/?ll=34.109319%2C44.957436&amp;z=16" loading="lazy" title="Карта проезда к ресторану ФабрикантЪ"></iframe>
            </div>
        </div>
    </section>

<?php require __DIR__ . '/inc/_footer.php'; ?>
