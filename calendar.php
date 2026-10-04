<?php
// Акции ресторана — в data/promos.php: оттуда же их берёт плашка «Сейчас действует» на странице меню.
// Общие для всех акций условия выводятся один раз внизу страницы
$promo_data = require __DIR__ . '/data/promos.php';
require __DIR__ . '/inc/_promos.php';
$promos = array_filter($promo_data['promos'], function ($p) {
    return empty($p['off']);
});

$page_title = 'Акции и спецпредложения - Ресторан с собственной пивоварней | Симферополь';
$page_heading = 'Акции в ресторане ФабрикантЪ';
$page_crumb = 'Акции';
$page_hero = 'stage';
$page_css = array('/assets/css/gazette.css');
$page_js = array('/assets/js/promos-now.js');
require __DIR__ . '/inc/_head.php';
?>
      <section class="gazette">
        <div class="gazette__sheet">
          <p class="gazette__running">Акции &bull; Ресторан с собственной пивоварней &bull; Симферополь</p>
          <h2 class="gazette__title">Акции и спецпредложения</h2>
          <hr class="gz-rule">

          <?= promo_bar($promo_data) ?>

          <div class="gazette__columns">
<?php foreach ($promos as $promo): ?>
            <article class="promo" id="<?= $promo['id'] ?>">
              <figure class="promo__photo">
                <span class="promo__photo-ink"><?= picture('/assets/img/akcii/' . $promo['photo'] . '.webp', '/assets/img/akcii/' . $promo['photo'] . '.jpg', 'width="800" height="600" alt="' . $promo['alt'] . '" loading="lazy"') ?></span>
              </figure>
              <h3 class="promo__title"><?= $promo['title'] ?></h3>
              <p class="gz-plaque promo__plaque">
                <span class="promo__discount">Скидка - <?= $promo['discount'] ?></span>
                <span class="promo__subject"><?= $promo['subject'] ?></span>
              </p>
              <dl class="gz-rows">
<?php foreach ($promo['rows'] as $label => $value): ?>
                <div class="gz-row"><dt><?= $label ?></dt><dd><?= $value ?></dd></div>
<?php endforeach; ?>
              </dl>
              <ul class="promo__terms">
<?php foreach ($promo['terms'] as $term): ?>
                <li><?= $term ?></li>
<?php endforeach; ?>
              </ul>
            </article>
<?php endforeach; ?>
          </div>

          <hr class="gz-rule">

          <div class="gazette__terms">
            <p>Акции не суммируются с другими акциями и скидками ресторана и действуют только на территории ресторана (на вынос не распространяются).</p>
          </div>

          <p class="gazette__strip">
            <span>Симферополь, ул. Киевская, 54.</span>
            <span>тел. <a href="tel:+79788072001">+7 978 807 20 01</a></span>
            <span><a href="/menu.php">Меню ресторана</a></span>
          </p>
        </div>
      </section>

<?php require __DIR__ . '/inc/_footer.php'; ?>
