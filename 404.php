<?php
// Страница «не найдено». Её показывает сервер по любой несуществующей ссылке (ErrorDocument в .htaccess):
// с шапкой и подвалом сайта и с дорогой туда, куда чаще всего идут, — вместо голой ошибки Apache.
http_response_code(404);

$page_title = 'Страница не найдена | ФабрикантЪ - Ресторан с собственной пивоварней | Симферополь';
$page_heading = 'Страница не найдена';
$page_crumb = 'Ошибка 404';
$page_hero = 'hall';
$page_css = array('/assets/css/gazette.css');
// Поисковикам эту страницу в выдачу не брать
$page_head = '    <meta name="robots" content="noindex">' . "\n";
require __DIR__ . '/inc/_head.php';
?>
    <section class="gazette">
        <div class="gazette__sheet">
            <p class="gazette__running">Ошибка 404 &bull; Ресторан с собственной пивоварней &bull; Симферополь</p>
            <h2 class="gazette__title">Такой страницы у нас нет</h2>
            <hr class="gz-rule">
            <p class="gazette__lost">Возможно, ссылка устарела или в адресе опечатка. Зато меню, зал и пивоварня на месте.</p>
            <div class="contact__actions">
                <a class="gz-plaque contact__action" href="/menu.php">Меню ресторана</a>
                <a class="gz-plaque contact__action" href="/">На главную</a>
                <a class="gz-plaque contact__action" href="tel:+79788072001">Позвонить</a>
            </div>
        </div>
    </section>

<?php require __DIR__ . '/inc/_footer.php'; ?>
