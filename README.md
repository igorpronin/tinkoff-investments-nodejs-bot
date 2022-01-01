# Бот для Тинькофф Инвестиции

#### Version 0.1.0

Бот отслеживает книгу заявок для выбранных активов, при достижении установленной в настройках для конкретного актива цены бот инициирует отправку рыночного или лимитного ордера.

### Какие проблемы решает бот?

- Использование бота для покупки/продажи активов удобнее, чем отслеживание цен и торговля в ручном режиме. Инвестор не может быть в рынке 24/7, инвестор не может следить за активами, которые торгуются то время, пока он не у компьютера/телефона, в том числе, например, ночью.
- Брокер/биржа не принимают заявки, существенно отклоняющиеся от текущей рыночной цены, поэтому инвестор не может поставить заявку, например, на 20% ниже чем текущая цена. С помощью бота можно установить любую интересующую цену.
- При окончании торгового дня (сессии) активные заявки снимаются брокером/биржей. При использовании бота нет необходимости перевыставлять заявку на следующий торговый день (торговую сессию). Бот следит за ценой и выставляет заявку именно тогда, когда нужно.
- Функционал бота можно воспроизвести с помощью стоп-лосс или тейк-профит ордеров, но их использование имеет ряд ограничений. При использовании стоп-лосс/тейк-профит ордеров для покупки брокер будет резервировать денежные средства под каждый ордер. Таким образом количество интересующих инвестора покупок ограничивается свободными средствами инвестора. С помощью бота можно выставить лоюбое количество возможных заявок, поскольку резервирование средств не требуется.

### Как использовать бота

1. Установите свежую версию NodeJS для вашей операционной системы с [официального сайта](https://nodejs.org/en/download/).
2. Из директории проекта установите зависимости: `npm i`.
3. Переименуйте файл .env.example в .env.
4. Создайте api-токен для доступа к api Тинькофф. [Тут инструкция](https://tinkoff.github.io/investAPI/token/).
5. Добавьте в переменную TINKOFF_TOKEN_SECRET значение api-токена для доступа к api Тинькофф.
6. Переименуйте файл deals.example.json в deals.json.
7. Добавьте активы и сделки в соответствии с примером в файле.
8. Запустите скрипт из корневой папки с проектом `node index.js`.

Для удобства использования арендуйте виртуальный сервер. Достаточно минимальной конфигурации. Цены на виртуальные серверы - от 2 долл. в месяц.

### Разработчику

https://github.com/tinkoff/invest-openapi/

https://tinkoff.github.io/invest-openapi/

https://tinkoff.github.io/invest-openapi/marketdata/

https://tinkoff.github.io/invest-openapi/swagger-ui/

https://www.npmjs.com/package/@tinkoff/invest-openapi-js-sdk

### Контакты

https://t.me/InvestorPronin

### Лицензия

Copyright 2021, Igor Pronin

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
