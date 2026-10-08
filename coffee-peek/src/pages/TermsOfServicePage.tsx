import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import Button from '../components/Button';
import { Icons } from '../constants';
import { usePageTitle } from '../hooks/usePageTitle';
import { goBackOrHome, LEGAL_ROUTES } from '../constants/legalRoutes';
import { LEGAL, legalOperatorBlock } from '../constants/legal';

const TermsOfServicePage: React.FC = () => {
  usePageTitle('Условия использования');
  const navigate = useNavigate();
  const { theme } = useTheme();

  const bgClass = theme === 'dark' ? 'bg-[#1A1412]' : 'bg-white';
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondaryClass = theme === 'dark' ? 'text-[#A39E93]' : 'text-gray-600';
  const borderClass = theme === 'dark' ? 'border-[#3D2F28]' : 'border-gray-200';
  const linkClass = 'text-[#EAB308] hover:underline font-medium';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Button variant="secondary" onClick={() => goBackOrHome(navigate)} className="mb-6">
          <Icons.Back className="w-5 h-5 inline mr-2" />
          Назад
        </Button>

        <div className={`${bgClass} rounded-lg border ${borderClass} p-6 sm:p-8 lg:p-12`}>
          <h1 className={`text-3xl sm:text-4xl font-bold ${textClass} mb-6 break-words`}>
            Условия использования
          </h1>

          <p className={`text-sm ${textSecondaryClass} mb-8`}>
            <strong>Дата последнего обновления:</strong> {LEGAL.updatedAt}
          </p>

          <div className={`space-y-6 ${textClass}`}>
            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                1. Общие положения
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Настоящие Условия использования (далее — «Условия») регулируют доступ к веб-сервису{' '}
                {LEGAL.serviceName} ({LEGAL.siteUrl}, далее — «Сервис») — информационной площадке о
                кофейнях (в первую очередь на территории Республики Беларусь, с фокусом на город
                Минск): каталог и карта заведений, фильтры, карточки кофеен, чекины,
                избранное, подача заявок на добавление кофеен.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Администрация Сервиса: {legalOperatorBlock()}.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Регистрируясь, входя в аккаунт (в том числе через Google) или используя Сервис, вы
                подтверждаете, что прочитали Условия и{' '}
                <a className={linkClass} href={LEGAL_ROUTES.privacy}>
                  Политику конфиденциальности
                </a>
                , поняли их и согласны соблюдать. К отношениям сторон применяется законодательство
                Республики Беларусь.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                2. Возраст и дееспособность
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Регистрация доступна лицам, достигшим 16 лет. Лица младше 16 лет вправе
                пользоваться Сервисом и предоставлять данные только с согласия законного
                представителя в порядке, установленном законодательством Республики Беларусь. Вы
                подтверждаете, что обладаете необходимой дееспособностью для принятия Условий.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                3. Регистрация и аккаунт
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Часть функций (чекины, заявка на добавление кофейни, настройки профиля и
                др.) доступна после создания аккаунта. Регистрация возможна по email и паролю (с
                подтверждением адреса электронной почты) либо через Google Sign-In при доступности
                этой функции.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>Вы обязуетесь:</p>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>указывать достоверные данные при регистрации и в профиле;</li>
                <li>сохранять конфиденциальность пароля и средств входа;</li>
                <li>незамедлительно сообщать о подозрении на несанкционированный доступ;</li>
                <li>не передавать аккаунт третьим лицам и не создавать аккаунты от чужого имени.</li>
              </ul>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                4. Описание Сервиса
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Сервис носит информационный характер и может включать, в том числе:
              </p>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>просмотр списка и карты кофеен, фильтры (город, статус «открыто», цена и др.);</li>
                <li>карточки заведений: адрес, контакты, расписание, фото, меню, теги;</li>
                <li>публичные и личные чекины с оценками пользователей;</li>
                <li>избранные кофейни и обжарщики в аккаунте пользователя;</li>
                <li>подачу заявки на добавление кофейни на модерацию;</li>
                <li>публичные страницы профилей пользователей в объёме, предусмотренном интерфейсом.</li>
              </ul>
              <p className={`${textSecondaryClass} leading-relaxed mt-3`}>
                Состав функций может изменяться. Сервис не является посредником при заказе еды или
                напитков и не заключает сделки от имени кофеен, если иное прямо не указано.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                5. Пользовательский контент
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Вы можете публиковать чекины, фотографии, сведения в заявках на кофейни и
                иной разрешённый контент. Вы гарантируете, что обладаете правами на материалы и что
                они не нарушают закон, права третьих лиц и Условия.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Запрещены, в частности: незаконный, оскорбительный, дискриминационный контент;
                спам; заведомо ложные сведения, вводящие в заблуждение; материалы, нарушающие
                авторские права; вредоносный код; массовый сбор данных без разрешения.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Публикуя контент, вы предоставляете администрации Сервиса неисключительную,
                безвозмездную лицензию на хранение, отображение, модерацию, адаптацию формата
                (сжатие изображений и т.п.) и распространение контента в рамках работы Сервиса на
                территории Республики Беларусь и в иных юрисдикциях, где доступен Сайт, на срок
                размещения материалов. Вы сохраняете права на свой контент в пределах закона.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                6. Заявки на добавление кофеен и модерация
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Заявки на добавление или изменение сведений о кофейнях проходят модерацию и могут
                быть одобрены, отклонены или изменены. Администрация вправе проверять, скрывать,
                отклонять или удалять пользовательский контент, а также ограничивать доступ к
                Сервису при нарушении Условий или требований законодательства — в том числе без
                предварительного уведомления, если это необходимо для защиты Сервиса или третьих лиц.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                7. Геолокация и карты
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Отдельные функции (например, подстановка адреса при добавлении кофейни) могут
                запрашивать доступ к геолокации устройства. Разрешение выдаётся средствами браузера
                и может быть отозвано в настройках устройства. Точность карт, адресов и статусов
                «открыто» зависит от данных пользователей, модерации и сторонних картографических
                сервисов и не гарантируется.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                8. Интеллектуальная собственность
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Дизайн, программный код, товарные обозначения, тексты и иные элементы Сервиса (за
                исключением пользовательского контента и материалов третьих лиц) принадлежат
                администрации Сервиса или используются на законных основаниях. Запрещается копировать,
                парсить или использовать Сервис способами, нарушающими закон или Условия, без
                письменного согласия администрации.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                9. Ограничение ответственности
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Сервис предоставляется «как есть». Администрация не гарантирует бесперебойную и
                безошибочную работу, актуальность адресов, цен, расписаний, чекинов и иных сведений.
                Решения, принятые пользователем на основе информации в Сервисе (выбор кофейни,
                маршрут и т.д.), пользователь принимает самостоятельно. В пределах, допускаемых
                законодательством Республики Беларусь, ответственность администрации ограничивается;
                не исключается ответственность за умысел и иные случаи, когда ограничение
                ответственности недопустимо.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                10. Прекращение доступа и удаление аккаунта
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Вы можете прекратить использование Сервиса в любой момент (выход из аккаунта,
                прекращение посещений). Для удаления аккаунта и связанных персональных данных
                направьте запрос на{' '}
                <a className={linkClass} href={`mailto:${LEGAL.contactEmail}`}>
                  {LEGAL.contactEmail}
                </a>
                . Администрация может приостановить или прекратить доступ при нарушении Условий,
                подозрении в злоупотреблениях или по требованию уполномоченных органов.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                11. Изменение Условий
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Актуальная редакция Условий публикуется на этой странице. Дата обновления указана
                выше. Продолжение использования Сервиса после публикации изменений означает согласие
                с новой редакцией, если иное не требуется законодательством.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                12. Применимое право и споры
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                К Условиям применяется законодательство Республики Беларусь. Споры подлежат
                разрешению путём переговоров, а при недостижении согласия — в порядке,
                установленном законодательством Республики Беларусь.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                13. Контакты
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                По вопросам Условий:{' '}
                <a className={linkClass} href={`mailto:${LEGAL.contactEmail}`}>
                  {LEGAL.contactEmail}
                </a>
                . Политика конфиденциальности:{' '}
                <a className={linkClass} href={LEGAL_ROUTES.privacy}>
                  {LEGAL_ROUTES.privacy}
                </a>
                .
              </p>
            </section>
          </div>

          <div className={`mt-8 pt-6 border-t ${borderClass}`}>
            <Button
              variant="secondary"
              onClick={() => goBackOrHome(navigate)}
              className="w-full sm:w-auto"
            >
              <Icons.Back className="w-5 h-5 inline mr-2" />
              Вернуться назад
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
