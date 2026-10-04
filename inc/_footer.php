<?php
// Конец страницы: подвал, кнопка «наверх», скрипты, счётчик.
// $page_js — дополнительные скрипты страницы (массив путей), необязательно.
$page_js = isset($page_js) ? $page_js : array();
?>
    <footer class="section_footer">
        <div class="container">
            <div class="row">
                <div class="col-sm-8">
                    <p class="footer_info">&#169; <?= date('Y') ?> Ресторан &quot;ФабрикантЪ&quot; Симферополь.</p>
                </div>
                <div class="col-sm-4">
                    <div class="soc-box">
                        <a target="_blank" rel="noopener" href="https://vk.com/fabricantsimferopol" title="Ресторан ФабрикантЪ Вконтакте"><?= icon('vk') ?></a>
                    </div>
                </div>
            </div>
        </div>
    </footer>
    <a href="#" id="back-to-top" aria-label="Наверх"><?= icon('chevron-up') ?></a>

    <script src="<?= asset('/assets/js/site.js') ?>" defer></script>
<?php foreach ($page_js as $js): ?>
    <script src="<?= asset($js) ?>" defer></script>
<?php endforeach; ?>

    <!-- Yandex.Metrika counter -->
    <script type="text/javascript" >
        (function (d, w, c) {
            (w[c] = w[c] || []).push(function() {
                try {
                    w.yaCounter26918373 = new Ya.Metrika({
                        id:26918373,
                        clickmap:true,
                        trackLinks:true,
                        accurateTrackBounce:true,
                        webvisor:true
                    });
                } catch(e) { }
            });

            var n = d.getElementsByTagName("script")[0],
                s = d.createElement("script"),
                f = function () { n.parentNode.insertBefore(s, n); };
            s.type = "text/javascript";
            s.async = true;
            s.src = "https://mc.yandex.ru/metrika/watch.js";

            if (w.opera == "[object Opera]") {
                d.addEventListener("DOMContentLoaded", f, false);
            } else { f(); }
        })(document, window, "yandex_metrika_callbacks");
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/26918373" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    <!-- /Yandex.Metrika counter -->
</body>
</html>
