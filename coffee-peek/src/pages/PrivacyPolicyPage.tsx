import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import Button from '../components/Button';
import { Icons } from '../constants';
import { usePageTitle } from '../hooks/usePageTitle';
import { goBackOrHome, LEGAL_ROUTES } from '../constants/legalRoutes';
import { LEGAL, legalOperatorBlock } from '../constants/legal';

const PrivacyPolicyPage: React.FC = () => {
  usePageTitle('Политика конфиденциальности');
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
            Политика конфиденциальности
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
                Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок
                обработки и защиты персональных данных пользователей веб-сервиса {LEGAL.serviceName}{' '}
                ({LEGAL.siteUrl}, далее — «Сервис» / «Сайт») в соответствии с Законом Республики
                Беларусь от 7 мая 2021 г. № 99-З «О защите персональных данных» и иными актами
                законодательства Республики Беларусь.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                <strong>Оператор персональных данных:</strong> {legalOperatorBlock()}.
              </p>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Используя Сервис, регистрируясь или отмечая согласие в интерфейсе, вы подтверждаете,
                что ознакомились с Политикой. Если вы не согласны с условиями обработки данных,
                пожалуйста, не регистрируйтесь и ограничьте использование функций, требующих
                персональных данных.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                2. Какие данные мы обрабатываем
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                В зависимости от действий пользователя Сервис может обрабатывать:
              </p>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>
                  <strong>Учётные данные:</strong> адрес электронной почты, имя пользователя
                  (отображаемое имя), пароль в хешированном виде на стороне сервера; при входе через
                  Google — идентификатор и базовые сведения аккаунта Google, переданные провайдером
                  в рамках авторизации.
                </li>
                <li>
                  <strong>Профиль:</strong> описание («о себе»), фотография профиля (аватар).
                </li>
                <li>
                  <strong>Пользовательский контент:</strong> отзывы (текст, оценки, дата визита,
                  фотографии), чекины (заметки, статус публичный/приватный, оценки, фотографии),
                  избранные кофейни и обжарщики (в аккаунте пользователя).
                </li>
                <li>
                  <strong>Заявки на добавление кофейни:</strong> название, адрес, город, описание,
                  ценовой диапазон, контакты заведения (телефон, email, сайт, Instagram — если
                  указаны), расписание, сведения об оборудовании и ингредиентах, фотографии
                  заведения и меню. Эти данные относятся к заведению и могут содержать контактные
                  сведения, которые вы добровольно указываете.
                </li>
                <li>
                  <strong>Данные геолокации:</strong> приблизительные координаты устройства — только
                  если вы разрешили доступ браузеру (например, при указании адреса кофейни). Координаты
                  могут использоваться для подстановки адреса через сервис обратного геокодирования.
                </li>
                <li>
                  <strong>Технические данные:</strong> сведения, необходимые для работы Сайта
                  (токены доступа в localStorage, выбранная тема интерфейса, факт согласия на
                  обработку / использование локального хранилища, технические метрики производительности
                  и посещаемости на стороне хостинга).
                </li>
              </ul>
              <p className={`${textSecondaryClass} leading-relaxed mt-3`}>
                Номер телефона пользователя в профиле Сервисом в настоящее время не запрашивается.
                Телефон может указываться только как контакт кофейни в заявке на добавление.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                3. Цели и правовые основания обработки
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Персональные данные обрабатываются для:
              </p>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>создания и обслуживания аккаунта, аутентификации (в том числе через Google);</li>
                <li>предоставления функций карты, каталога кофеен, фильтров, отзывов и чекинов;</li>
                <li>модерации заявок на добавление кофеен и пользовательского контента;</li>
                <li>связи с вами по вопросам работы Сервиса (подтверждение email, сброс пароля);</li>
                <li>обеспечения безопасности, предотвращения злоупотреблений;</li>
                <li>улучшения стабильности и удобства Сервиса (техническая аналитика хостинга).</li>
              </ul>
              <p className={`${textSecondaryClass} leading-relaxed mt-3`}>
                Правовые основания: согласие субъекта персональных данных; необходимость исполнения
                договора (оказание услуг Сервиса); случаи, прямо предусмотренные законодательством
                Республики Беларусь.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                4. Карты, геолокация и сторонние сервисы
              </h2>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>
                  Карты отображаются с использованием картографических подложек (в том числе сервисов
                  на базе OpenStreetMap и/или CARTO). При загрузке тайлов карты ваш IP-адрес и
                  технические запросы могут обрабатываться соответствующими провайдерами согласно их
                  правилам.
                </li>
                <li>
                  Обратное геокодирование адреса может выполняться через сервис Nominatim
                  (OpenStreetMap). Передаются координаты, выбранные вами или полученные с согласия
                  на геолокацию.
                </li>
                <li>
                  Вход через Google осуществляется средствами Google Identity Services; обработка
                  данных Google регулируется политикой Google.
                </li>
                <li>
                  Клиентская часть Сайта размещается у провайдера {LEGAL.infra.frontend}. Это может
                  означать трансграничную передачу технических данных (в том числе IP-адреса,
                  сведения о запросах) за пределы Республики Беларусь в объёме, необходимом для
                  отдачи Сайта и работы инфраструктуры хостинга.
                </li>
                <li>
                  Серверная часть (API, учётные и прикладные данные Сервиса) размещается у провайдера{' '}
                  {LEGAL.infra.backend}.
                </li>
                <li>
                  Для диагностики сбоев используется {LEGAL.infra.errors}. В события могут попадать
                  технические сведения о запросе/устройстве; передача за пределы Республики Беларусь
                  возможна в объёме, необходимом для работы сервиса мониторинга.
                </li>
              </ul>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                5. Локальное хранилище браузера
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                Сервис использует localStorage (не обязательно HTTP-cookie) для:
              </p>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>токенов доступа и обновления сессии;</li>
                <li>настройки темы оформления;</li>
                <li>отметок о согласии на обработку данных / использование локального хранилища;</li>
                <li>выбранного города; избранные кофейни и обжарщики сохраняются на сервере для вашего аккаунта.</li>
              </ul>
              <p className={`${textSecondaryClass} leading-relaxed mt-3`}>
                Очистка данных сайта в браузере приведёт к выходу из аккаунта и сбросу локальных
                настроек. Баннер согласия информирует о использовании локального хранилища; отказ
                от баннера не отключает обязательные для авторизованного режима механизмы сессии,
                если вы уже вошли в аккаунт.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                6. Передача данных третьим лицам
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Мы не продаём персональные данные. Передача (в том числе с возможным размещением
                вне Республики Беларусь) возможна: провайдерам инфраструктуры — Vercel (фронтенд),
                Timeweb (бэкенд), Sentry (логи ошибок); провайдерам карт и геокодирования;
                провайдеру Google — при выборе входа через Google; сервисам отправки почты — если
                они используются для писем Сервиса; уполномоченным государственным органам
                Республики Беларусь — в случаях и порядке, установленных законодательством.
                Публичный контент (отзывы, публичные чекины, сведения о кофейнях после модерации)
                доступен другим пользователям Сервиса.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                7. Сроки хранения
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Данные аккаунта и связанный контент хранятся, пока аккаунт активен и пока это
                необходимо для целей обработки, либо до отзыва согласия / требования об удалении —
                с учётом сроков, установленных законодательством (в том числе для защиты прав
                оператора при спорах). Токены в браузере хранятся до выхода из системы, очистки
                хранилища или истечения срока действия. Логи и технические метрики хостинга —
                в сроки, принятые у провайдера инфраструктуры.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                8. Права субъекта персональных данных
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed mb-3`}>
                В соответствии с законодательством Республики Беларусь вы вправе:
              </p>
              <ul className={`list-disc list-inside space-y-2 ${textSecondaryClass} ml-4`}>
                <li>получать информацию об обработке ваших персональных данных;</li>
                <li>требовать внесения изменений в неточные или неполные данные;</li>
                <li>получать информацию о предоставлении данных третьим лицам (в установленных случаях);</li>
                <li>требовать прекращения обработки и/или удаления данных при отсутствии иных
                  законных оснований для обработки;</li>
                <li>отозвать согласие на обработку персональных данных;</li>
                <li>
                  обжаловать действия (бездействие) оператора в {LEGAL.pdAuthority} или в суд.
                </li>
              </ul>
              <p className={`${textSecondaryClass} leading-relaxed mt-3`}>
                Для реализации прав направьте запрос на{' '}
                <a className={linkClass} href={`mailto:${LEGAL.contactEmail}`}>
                  {LEGAL.contactEmail}
                </a>
                . Мы можем запросить подтверждение личности заявителя в разумных пределах.
                Часть данных профиля вы можете изменить самостоятельно в настройках аккаунта.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                9. Безопасность
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Применяются организационные и технические меры защиты (разграничение доступа,
                передача по защищённым каналам там, где это предусмотрено инфраструктурой, и др.).
                Абсолютная безопасность передачи данных в сети Интернет не гарантируется.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                10. Дети
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Сервис не предназначен для самостоятельной регистрации лиц младше 16 лет. Если вам
                меньше 16 лет, регистрация и предоставление персональных данных допускается только
                с согласия законного представителя в порядке, предусмотренном законодательством
                Республики Беларусь.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                11. Изменение Политики
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                Актуальная редакция всегда доступна по адресу{' '}
                <a className={linkClass} href={LEGAL_ROUTES.privacy}>
                  {LEGAL.siteUrl}
                  {LEGAL_ROUTES.privacy}
                </a>
                . Дата обновления указывается в начале документа. При существенных изменениях мы
                можем дополнительно уведомить пользователей через Сервис или по email.
              </p>
            </section>

            <section>
              <h2 className={`text-xl sm:text-2xl font-semibold ${textClass} mb-4`}>
                12. Контакты
              </h2>
              <p className={`${textSecondaryClass} leading-relaxed`}>
                По вопросам обработки персональных данных:{' '}
                <a className={linkClass} href={`mailto:${LEGAL.contactEmail}`}>
                  {LEGAL.contactEmail}
                </a>
                . Условия использования Сервиса:{' '}
                <a className={linkClass} href={LEGAL_ROUTES.terms}>
                  {LEGAL_ROUTES.terms}
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

export default PrivacyPolicyPage;
