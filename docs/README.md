# Документация стенда

Что читать и в каком порядке. Запуск проекта и команды — [README в корне](../README.md).

## Действующие документы

Описывают текущее состояние. При расхождении с историческими планами главные они; при расхождении
с кодом — проверить код и исправить описание.

| Документ | Когда читать |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Устройство библиотеки: контракт, единицы, разъёмы и словарь их ID, имена, как добавить генератор, сборки |
| [library-usage.md](library-usage.md) | Подключить библиотеку: построить деталь, обработать ошибки, загрузить текстуры, освободить ресурсы |
| [roadmap.md](roadmap.md) | Открытые задачи: статус, зависимости, критерий готовности |
| [catalog-expansion-plan.md](catalog-expansion-plan.md) | Реестр позиций 1–133, карточки моделей и чек-листы частей — перед новой моделью каталога |
| [transfer/README.md](transfer/README.md) | Пакет `@ingplan/heating-generators`: сборка, проверка, выпуск и установка в редактор |
| [`lib-package/README.md`](../lib-package/README.md) | README самого пакета: состав, импорт, узлы, текстуры, версии |
| [gl2-verification.md](gl2-verification.md) | Сверка перенесённых генераторов с `gl2`: тест по эталону, скрипты, обновление эталона |
| [gl2-differences.md](gl2-differences.md) | Журнал осознанных отличий от `gl2` |
| [benchmark.md](benchmark.md) | Замеры FPS: 5000 моделей и 1 000 000 экземпляров |

## Порядок чтения

- **Пользоваться библиотекой** (редактор, другой потребитель): [library-usage.md](library-usage.md),
  затем [ARCHITECTURE.md](ARCHITECTURE.md), п. 3–5, и README пакета.
- **Добавить модель в каталог:** [ARCHITECTURE.md](ARCHITECTURE.md) целиком, затем карточку и чек-лист
  позиции в [catalog-expansion-plan.md](catalog-expansion-plan.md), после — выпуск по
  [transfer/README.md](transfer/README.md), п. 6.
- **Править генератор, перенесённый из `gl2`:** то же и [gl2-verification.md](gl2-verification.md);
  отличие от `gl2` записать в [gl2-differences.md](gl2-differences.md).
- **Выбрать следующую задачу:** [roadmap.md](roadmap.md).

## История

Завершённые планы. Сохранены ради формул, таблиц `gl2`, снимков и причин решений;
в начале каждого — пометка и ссылки на действующие документы. Имена в первых двух — из `gl2`.

| Документ | Что в нём |
| --- | --- |
| [development-plan.md](development-plan.md) | Пилот 9 октября 2026: устройство `gl2`, первый контракт, формулы муфты, угла ПП и радиатора |
| [catalog-porting-plan.md](catalog-porting-plan.md) | Перенос всего каталога `gl2`: инвентаризация, порядок, решения по семействам |
| [library-refactoring-plan.md](library-refactoring-plan.md) | Переход на новые ID, параметры и результат-данные; таблица соответствия ID `gl2` новым |
| [joint-angle-ui-plan.md](joint-angle-ui-plan.md) | Угол стыка на стенде |
| [catalog-extensions.md](catalog-extensions.md) | Первая очередь моделей вне `gl2` (10 октября 2026) |
| [documentation-improvement-plan.md](documentation-improvement-plan.md) | Как приводилась в порядок эта документация |

Снимки моделей — [`img/`](img/). Документы редактора отопления — в skeleton-wf, `docs/heating/`
(начинать с `heating-editor.md`).
