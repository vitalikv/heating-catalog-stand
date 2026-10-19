# Архитектура библиотеки генераторов

Библиотека `src/lib` строит параметрические модели отопления: фитинги, трубы, радиаторы,
краны, коллекторы и котельное оборудование. Генератор получает параметры и возвращает модель
как данные: геометрию, ключи материалов, разъёмы и габарит. Объект сцены собирает потребитель.

Это описание текущего устройства. При расхождении с другими документами главное — оно и код.
Как пользоваться библиотекой — [library-usage.md](library-usage.md), карта документов —
[README.md](README.md), открытые задачи — [roadmap.md](roadmap.md). Как к этому пришли —
[library-refactoring-plan.md](library-refactoring-plan.md); старые планы
([development-plan.md](development-plan.md), [catalog-porting-plan.md](catalog-porting-plan.md))
записаны в именах `gl2`.

## 1. Правила

- `src/lib` не обращается к `window`, `document`, рендереру и камере. Это проверяет
  `tsconfig.lib.json` (`npm run typecheck`), поэтому генераторы можно запускать в воркере.
- Потребители импортируют только `src/lib/index.ts` (в пакете — корень `@ingplan/heating-generators`).
  Тесты могут импортировать внутренние модули напрямую. Состав `index.ts` проверяет `tests/publicApi.test.ts`.
- Одинаковые параметры дают одинаковую модель: генератор не хранит состояние между вызовами
  и не меняет переданные параметры.
- Старые имена `gl2` встречаются только в `legacy/gl2.ts`, в `tests/fixtures/` и в эталоне сверки.
  `legacy/gl2.ts` в публичный API и пакет не входит.

## 2. Структура

```text
src/lib/
  index.ts        публичный API
  core/           contracts.ts — контракт; BaseGenerator, GeneratorParamsError,
                  connector() и ConnectorFrame — разъёмы, createMeshModel — модель из геометрии
  params/         ParamSchema — проверка, доступ по пути 'dimensions.y', умолчания добавленных
                  параметров; specs — общие описания параметров
  sizes/          ThreadSizes (резьба), PpPipeSizes, MpPipeSizes — таблицы размеров по номиналу
  geometry/       sleeves, spheres, shapes — построители кусков; PipePathBuilder — труба
                  по ломаной с гибами; MaterialGroupMerger; BoxProjectionUv
  materials/      MaterialLibrary — материал по ключу; MaterialTextures — список файлов
                  текстур и загрузчик loadMaterialTextures (главный поток и воркер)
  scene/          createModelObject — модель + материалы → Group
  assembly/       ConnectorMating — совместимость и стыковка (фасад), ConnectionRules — правила
                  систем соединения; Assembly — сборка по разъёмам;
                  recipes/ — готовые узлы ASSEMBLY_RECIPES
  catalog/        позиции каталога по семействам; extensions.ts (+ filters, instruments,
                  manifold) — позиции генераторов вне gl2; CATALOG — всё вместе
  generators/     steel/, pp/, mp/, radiator/, valve/, equipment/, manifold/ — по классу
                  на генератор и общие части семейств; StraightPipe — основа прямых труб;
                  ThreadedParts — обобщённые резьбовые концы новых моделей;
                  GeneratorRegistry — список всех генераторов
  legacy/gl2.ts   перевод ID и параметров gl2 в формат библиотеки — только для сверки
```

На 19 октября 2026 в реестре 88 генераторов, в каталоге 855 позиций, рецептов узлов — 7.
Списки ID и версий — `manifest.json` собранного пакета.

## 3. Контракт

Типы — в `core/contracts.ts`.

```ts
interface ModelGenerator<P> {
  readonly id: string;          // 'steel.coupling'
  readonly version: number;     // 1
  readonly title: string;       // 'Муфта стальная'
  readonly paramSpecs: readonly ParamSpec[];
  readonly defaults: P;
  validate(params: P): ValidationError[];
  build(params: P): GeneratedModel;   // неверные параметры → GeneratorParamsError
}

interface GeneratedModel {
  title: string;                       // 'Муфта 1/2(в)'
  geometry: BufferGeometry;            // неиндексированная; группа i — материал materials[i]
  materials: readonly MaterialKey[];
  connectors: Connector[];
  bounds: BoundsData;                  // габарит в локальных координатах
  warnings: string[];
  dispose(): void;                     // освобождает геометрию; повторный вызов безопасен
}
```

- **Деталь в данных проекта** — `{ generatorId, version, params }`. Правила версий — п. 7.
- **`defaults`** — параметры, с которыми деталь вставляется в редактор. Они проходят `validate()`.
- **`paramSpecs`** описывает все параметры. По схеме работает проверка (`ParamSchema.validate`)
  и строится интерфейс: панель стенда и редактор. Виды:
  - `choice` — выбор из `options` (строки или числа), подписи — `optionLabels`;
  - `length` — метры, в интерфейсе миллиметры; границы `min`, `max` включительно, шаг `step`;
  - `integer` — целое от `min` до `max`;
  - `path` — массив точек `Vector3Data` (ломаная трубы), от `minPoints` до `maxPoints`,
    каждая координата по модулю не больше `extent`.

  Общие поля: `key` (путь, `'dimensions.y'`), `label`, `when: { key, values }` — параметр нужен только
  при этих значениях другого параметра, `addedIn` — версия генератора, в которой параметр появился.
- **`addedIn`.** Параметры прежней версии, где такого ключа не было, дополняются значением из `defaults`
  (`ParamSchema.withAddedDefaults`) — и в `validate()`, и в `build()`. Параметры без `addedIn`
  обязательны: опечатка в ключе не подменяется умолчанием.
- **Ошибки** — `ValidationError { code, param, message }`. Коды схемы: `unknown_option`,
  `not_a_number`, `not_integer`, `out_of_range`; связи параметров — `too_short` и коды генераторов.
- **Материалы** — ключи `MaterialKey`: `metal`, `metalFlat`, `thread`, `plastic`, `plasticFlat`,
  `plasticGrey`, `bronze`, `bronzeFlat`, `bronzeThread`, `red`, `redFlat`, `blue`, `black`,
  `blackFlat`, `pipe`, `manometer`, `thermometer`, `thermomanometer`. Объекты материалов создаёт
  `MaterialLibrary`, с моделью их соединяет только `createModelObject(model, library)`. Поэтому
  материалы можно подменить без перестройки модели. Суффикс `Flat` — плоское затенение граней гаек.
- **Владение.** Геометрия принадлежит модели (`model.dispose()`), материалы и переданные текстуры —
  `MaterialLibrary` (`dispose()`), модели деталей сборки — `Assembly`. Подробно —
  [library-usage.md](library-usage.md), п. 5.

### Граница воркера

Генераторы выполняются без DOM, поэтому работают в web worker. `GeneratedModel` при этом —
не транспортный формат: в ней `BufferGeometry` и `dispose()`. Готовой сериализации модели
для передачи между потоками в библиотеке нет. Редактор её не требует: он строит и рисует
модели в одном воркере сцены. Что передавать, если строить и рисовать в разных потоках, —
[library-usage.md](library-usage.md), п. 8; это требование к будущему адаптеру, а не API.

Типизированный реестр:

```ts
const registry = new GeneratorRegistry();
registry.get('steel.coupling');      // ModelGenerator<SteelCouplingParams>
registry.get(idFromProject);         // ModelGenerator<unknown> | undefined
```

`GeneratorId` и `GeneratorParamsMap` выводятся из списка генераторов в `GeneratorRegistry`,
вручную их не ведут.

## 4. Единицы и оси

- Длины и координаты — **метры**. Длина 30 мм — это `length: 0.03`. Точки параметра `path` — тоже метры.
- Номиналы — **строки**, как в таблицах размеров: резьба `'1/2'`, `'1 1/4'`; трубы ПП и МП —
  наружный диаметр в миллиметрах: `'20'`, `'16'`; посадка термоголовки — `'M30x1.5'`.
- Объём бака — литры числом (`volume: 6`). Число секций, выходов — целые.
- Углы стыков в `AssemblyPart.attach.angle` и `Assembly.setAngle`, поворот явного положения
  `AssemblyPart.placement.rotation` — **градусы**; сдвиг `placement.at` — метры.
  `ConnectorMating.place` принимает радианы.
- Ось Y смотрит вверх, как в Three.js. Модель строится в своих локальных координатах:
  проход линейных деталей (муфта, кран, труба) идёт вдоль X, ответвление тройника — вверх (+Y),
  у котла выходы назад смотрят в −Z.

## 5. Разъёмы

```ts
interface Connector {
  id: string;              // по назначению: 'left', 'top', 'outlet-2'
  position: Vector3Data;   // центр торца — плоскость, где встречаются детали
  direction: Vector3Data;  // единичный, наружу
  up: Vector3Data;         // единичный, ⟂ direction — задаёт поворот вокруг оси
  depth: number;           // длина резьбы или раструба от торца внутрь, м
  nominal: string;
  joint: 'thread' | 'radiator-thread' | 'pp-socket' | 'mp-press' | 'mp-compression' | 'eurocone' | 'hose-barb' | 'valve-head';
  gender: 'internal' | 'external';
}
```

### Системы соединения

| `joint` | Что это | Номинал |
| --- | --- | --- |
| `thread` | дюймовая трубная резьба | `'1/2'` |
| `radiator-thread` | резьба портов алюминиевого радиатора; подходят только радиаторные переходники и пробки | `'1'` |
| `pp-socket` | раструб под пайку ПП-трубы | наружный диаметр трубы, мм |
| `mp-press` | пресс-фитинг МП; конец трубы МП — наружный `mp-press` | наружный диаметр трубы, мм |
| `mp-compression` | обжимной (цанговый) фитинг МП | наружный диаметр трубы, мм |
| `eurocone` | конусное соединение, не обычная резьба | резьба, `'3/4'` |
| `hose-barb` | штуцер под шланг | внутренний диаметр шланга, мм |
| `valve-head` | посадка термоголовки или привода на клапан: наружная у клапана, внутренняя у привода | `'M30x1.5'` |

**Совместимость** (`ConnectorMating.check`, правила — `ConnectionRules`): одна система соединения,
одинаковый номинал, разный `gender`. Разные системы стыкуются только парой из таблицы
`CROSS_SYSTEM`: сейчас это одна пара — наружный `mp-press` (конец трубы МП) входит во внутренний
`mp-compression`; пресс-фитинг с обжимным не стыкуется. Номинал сравнивают только внутри системы
или такой пары: `'20'` у ПП-раструба и у пресс-фитинга МП — разные соединения. При несовместимости
`check` возвращает причину: `joint`, `nominal` или `gender`.

**Посадка.** Все системы сейчас вставные (`ConnectionRules.seating` — `'insert'`): ответная деталь
входит внутрь на `e = min(depth₁, depth₂)`, у каждого разъёма `depth > 0`. Торцевые соединения
(стыковая сварка, фланцы) — отдельная посадка, появится вместе с ними ([roadmap.md](roadmap.md)).

**Стыковка** (`ConnectorMating.place`): направления противоположны, `up` совпадают, затем
деталь доворачивается на угол стыка вокруг оси. Торец ответной детали встаёт
в `position − direction × e` неподвижной.

**`up`** задаётся только через `ConnectorFrame`, вручную его не пишут:

| Рамка | `direction` | `up` |
| --- | --- | --- |
| `ConnectorFrame.right` | +X | +Y |
| `ConnectorFrame.left` | −X | +Y |
| `ConnectorFrame.top` | +Y | +X |
| `ConnectorFrame.bottom` | −Y | −X |
| `ConnectorFrame.back` | −Z | +Y |
| `ConnectorFrame.leftTurned(a)` | левый выход, повёрнутый вокруг Z на `a` рад | +Y, повёрнутый так же |

Выход вверх, вниз или под углом — это левый выход, повёрнутый вокруг Z, и `up` поворачивается
вместе с ним. Выход назад (котёл, манометр с осевым подключением) — рамка `back`.

Разъём создают помощником: `connector(id, frame, at, { depth, nominal, joint, gender })`.
`at` — расстояние от начала координат по оси выхода или готовая точка.

### Словарь ID разъёмов

Новый генератор берёт ID отсюда. Новое имя добавляют в таблицу, когда ни одно не подходит.
Таблица сверена 19 октября 2026 с разъёмами всех 855 позиций каталога.

| ID | Значение | Где |
| --- | --- | --- |
| `left`, `right` | концы прохода вдоль −X и +X | муфты, ниппели, тройники, краны, фильтры, сепаратор, насос, стальные коллекторы, переходы; у заглушки, `steel.cap` и `radiator.vent` — только `left`, у углов 90° — только `right` |
| `top` | выход вверх (+Y): ответвление тройника, второй выход угла 90° | тройники, крестовины, углы 90°, котёл, `valve.mixing` |
| `bottom` | выход вниз (−Y) | крестовины, котёл, расширительный бак, группа безопасности, `valve.mixing` |
| `branch` | косое ответвление | `steel.y-tee` |
| `start`, `end` | концы трубы (−X, +X) | `pp.pipe`, `mp.pipe`, `mp.pipe-path` |
| `outlet-1` … `outlet-N` | выходы стального коллектора слева направо, вверх | `steel.manifold`, `steel.manifold-valves` |
| `main`, `end` | вход (−X) и противоположный торец латунного коллектора | `manifold.brass` |
| `out-1` … `out-N` | выходы латунного коллектора вниз | `manifold.brass` |
| `head-1` … `head-N` | посадка термоголовки или привода над выходом (`valve-head`) | `manifold.brass` с термостатическими вставками |
| `vent`, `drain` | воздухоотводчик сверху и слив снизу | `manifold.brass` (концевой узел), `valve.vent-shutoff` (`vent`); `drain` — также промывной фильтр, сепаратор, группа безопасности бойлера |
| `top-left`, `top-right`, `bottom-left`, `bottom-right` | боковые порты радиатора; у котла — `bottom-left`, `bottom-right` | радиаторы, котёл |
| `below-outer`, `below-inner` | нижняя пара портов радиатора под H-блок: ближний к торцу и следующий | `radiator.steel`, `radiator.aluminium` (с версии 2, `connection: 'bottom'`) |
| `back-left`, `back-right` | выходы котла назад (−Z) | `equipment.boiler` |
| `radiator`, `outlet` | в порт радиатора и наружу | `radiator.port-fitting` |
| `nut`, `pipe` | гайка и патрубок | `steel.half-union`, `pp.nut-elbow`, `mp.nut-adapter`; у гайки насоса — `pump` и `pipe` |
| `pipe` | конец под трубу | также `mp.wall-outlet`, `mp.eurocone-adapter` |
| `eurocone` | конус адаптера | `mp.eurocone-adapter` |
| `inlet`, `outlet` | вход и выход; ID сохраняются при смене прямого/углового исполнения | `steel.union`, `steel.eurocone-elbow`, `valve.make-up` |
| `inlet`, `radiator` | трубопровод и полусгон к радиатору | термостатические клапаны (угловой, прямой, осевой), `valve.lockshield` |
| `head` | посадка термоголовки (`valve-head`) | термостатические клапаны |
| `valve` | посадка головки или привода на клапан | `valve.thermostatic-head`, `valve.thermoelectric-actuator` |
| `inlet` | единственный или входной разъём | `equipment.air-vent`, `valve.vent-shutoff`, `valve.gauge-tap`, `equipment.water-hammer-arrester`, `valve.drain` |
| `radiator-left`, `radiator-right`, `pipe-left`, `pipe-right` | две пары портов H-блока | `valve.radiator-h-block` |
| `radiator`, `supply`, `return` | к радиатору, подача и обратка | `valve.injector` |
| `inlet`, `hose` | резьбовой вход и штуцер под шланг | `valve.drain`; у `steel.hose-adapter` — `thread` и `hose` |
| `thread` | единственный резьбовой конец | `steel.locknut`, `steel.hose-adapter`, `mp.wall-outlet` |
| `socket` | раструб ПП | `pp.cap`, `pp.nut-elbow` |
| `locknut` | место контргайки на длинной резьбе сгона | `steel.running-nipple` |
| `gauge` | под манометр | `equipment.flush-filter`, `equipment.siphon-tube`, `valve.gauge-tap` |
| `connection` | штуцер прибора | `equipment.gauge` |
| `process` | в трубопровод | `equipment.thermowell`, `equipment.siphon-tube` |
| `service` | сервисный порт 1/2 снизу | `equipment.strainer-straight` |
| `sensor` | гнездо датчика | `valve.ball` (с версии 2, `sensorPort`) |
| `cold`, `boiler`, `drain` | холодная вода, к бойлеру, слив | `equipment.boiler-safety-group` |

У угла 45° второй выход тоже называется `left`, но это левый выход, повёрнутый на 45°
(`leftTurned`).

## 6. Имена

**ID генератора** — `семейство.деталь`, латиница, kebab-case: `steel.coupling`, `pp.elbow-90`,
`mp.tee-thread`. Семейства: `steel`, `pp`, `mp`, `radiator`, `valve`, `equipment`, `manifold`.
ID хранится в проектах, поэтому после выпуска его не меняют и из реестра не удаляют
(`tests/releasedIds.test.ts`). ID рецепта узла — `assembly.<узел>`.

**Класс** — `<Семейство><Деталь>Generator`, файл называется так же:
`generators/steel/SteelCouplingGenerator.ts`. Тип параметров — `<Семейство><Деталь>Params`.

**Параметры** — английский camelCase:

| Что | Имя |
| --- | --- |
| один номинал на все концы | `nominal` |
| номиналы по концам | `nominalLeft`, `nominalRight`, `nominalBranch` — суффикс по ID разъёма |
| труба и резьба в одной детали | `pipeNominal`, `threadNominal` |
| сторона резьбы | `threadGender: 'internal' \| 'external'` |
| длина детали | `length`; у углов — `armLength`, у крестовины — `size` |
| длина ответвления, сгона | `branchLength`, `unionLength` |
| ручка крана | `handleLength` |
| габарит корпуса | `dimensions: { x, y, z }` |
| количество | `sections`, `outlets` |
| вариант исполнения | понятное слово со строковыми значениями: `kind`, `ends`, `head`, `connection` |

Значения вариантов — английские слова (`'internal'`, `'thermostatic'`). Русские подписи для
интерфейса задают в `ParamSpec.optionLabels`.

## 7. Как добавить генератор или исполнение

### Новый генератор

1. **Класс.** Файл `generators/<семейство>/<Класс>.ts`: интерфейс параметров и класс
   `extends BaseGenerator<P, L>`. Задать `id`, `version = 1`, `title`, `paramSpecs`, `defaults`.
   Описания параметров собирают из `specs.*` (`threadNominal`, `ppNominal`, `mpNominal`,
   `threadGender`, `length`), чтобы подписи и границы совпадали с другими генераторами.
2. **Размеры — `layout(params)`.** Таблицы размеров читают через `ThreadSizes.require()`
   (и аналоги). `layout` вызывается только для параметров, прошедших схему. Нужен, когда одни
   и те же размеры требуются и проверке, и построению.
3. **Связи параметров — `relations(params, layout)`.** Например, длина должна быть больше суммы
   участков: `ParamSchema.tooShort('length', minimum)`. Явный `throw` в генераторе не нужен:
   его делает `build()`.
4. **Построение — `create(params, layout)`.** Куски геометрии строят общими построителями
   (`sleeves.build`, `spheres`, `shapes`, `PipePathBuilder`) с ключом материала и складывают
   в `MaterialGroupMerger`. Модель собирает `createMeshModel({ title, ...merger.merge(), connectors })`.
   Разъёмы создают через `connector()` и `ConnectorFrame`.
5. **Регистрация.** Добавить экземпляр в `createGenerators()` в `GeneratorRegistry.ts`, а тип
   параметров — в `index.ts`. `GeneratorParamsMap` обновится сам.
6. **Каталог.** Генератор без аналога в `gl2` — позиции в `catalog/extensions.ts` (или в подключённых
   к нему `filters.ts`, `instruments.ts`, `manifold.ts`) через `entry('<id>', [...])`. Эти позиции проходят
   общие проверки, но не требуют записи в `legacy/gl2.ts` и эталона: тесты `catalog`, `legacyGl2`
   и `gl2Reference` исключают генераторы `EXTENSION_CATALOG` из сверки с `gl2` и проверяют, что их
   нет в таблице `legacy`. Параметры позиций проверяются типом генератора.
7. **Тесты.** Без отдельной работы на новый генератор распространяются `generatorRegistry`
   (ключи схемы есть в `defaults`), `paramSchema` (каждая позиция каталога проходит схему),
   `catalogModels` (буферы, группы, габарит, разъёмы на всех позициях) и `catalog` (уникальные подписи).
   В тест семейства добавить проверку разъёмов по формулам (торцы, глубины, направления)
   и ошибок параметров. Если деталь стыкуется с другими — добавить сборку в `src/stand/assemblies.ts`.
8. **Деталь из `gl2`.** Вместо п. 6 — строки в `legacy/gl2.ts` (`GL2_IDS`, `FIELDS`, при необходимости
   `VALUES`), позиции в каталоге своего семейства, наборы в `tests/fixtures/gl2Presets.ts` и сверка по
   [gl2-verification.md](gl2-verification.md).
9. **Выпуск.** После выпуска пакета ID и версию дописывают в `tests/fixtures/released-ids.json`;
   в редакторе — описание семейства в `catalogDescriptions.ts` (тест `verify:heating` не даст забыть).

### Новое исполнение выпущенного генератора

Параметр, которого не было, добавляют с `addedIn: <новая версия>` и поднимают `version`.
Умолчание в `defaults` должно сохранять прежнюю геометрию: старые параметры дополняются им,
и модель не меняется. У генераторов из `gl2` новые позиции каталога идут после позиций `gl2`
и задают параметры с `addedIn` — так `tests/catalog.test.ts` отличает их от наборов `start.js`,
а эталон `gl2` не меняется. Так появились, например, `radiator.steel` v2 (нижнее подключение)
и `valve.ball` v2 (гнездо датчика).

### Ограничения версий

- С выпуска 0.5.0 `tests/releasedIds.test.ts` запрещает менять версии выпущенных генераторов:
  редактор пока требует точного совпадения версии, и деталь другой версии открывается заглушкой.
  Поднять версию можно только вместе с правилом перевода параметров (`migrate`) — [roadmap.md](roadmap.md), п. 1.
- Изменение параметров, несовместимое со старыми проектами (переименование, другой смысл значения),
  требует шага перевода, а не только `addedIn`.

## 8. Сборки и готовые узлы

`Assembly` (`assembly/Assembly.ts`) ставит детали по описанию `AssemblyDefinition` и возвращает
модели и матрицы деталей; объекты сцены строит потребитель.

```ts
interface AssemblyDefinition {
  label: string;
  parts: AssemblyPart[];                 // по порядку установки
  closures?: AssemblyClosureDefinition[];
}
interface AssemblyPart {
  name: string;                          // уникальное имя в сборке
  generatorId: string;
  params: unknown;
  attach?: { connector: string; to: string; toConnector: string; angle?: number };
  placement?: { at: Vector3Data; rotation?: Vector3Data; relativeTo?: string };
}
```

- **Порядок.** Детали ставятся по порядку описания. `attach.to` и `placement.relativeTo` ссылаются
  на уже поставленную деталь — ту, что выше в списке.
- **Способ установки** — один из двух: `attach` (свой разъём `connector` к разъёму `toConnector`
  детали `to`, доворот `angle` в градусах) или `placement` (сдвиг в метрах, поворот в градусах по
  осям X, Y, Z в порядке `'XYZ'`, в координатах детали `relativeTo` или сборки). Деталь без обоих
  стоит в начале координат — так ставится первая. Оба сразу — ошибка описания.
- **Замыкания** (`closures`) — стык между деталями, которые уже поставлены другими стыками
  (второй порт H-блока, вторая труба контура). Деталь не переставляется: проверяются совместимость,
  зазор до места посадки и перекос осей; `closed` — в пределах `CLOSURE_TOLERANCE`
  (0,1 мм и 0,1°).
- **Что проверяется кодом.** В `errors` попадают: неизвестный генератор, параметры, не прошедшие
  `validate()` (такая деталь не строится), отсутствующая деталь или разъём, `attach` вместе
  с `placement`, `relativeTo` на не поставленную деталь. Несовместимый стык ставится всё равно —
  чтобы его было видно, — а в `joints` у него `check.compatible = false` с причиной. Это диагностика,
  а не строгая проверка: сборку с несовместимым стыком потребитель отклоняет сам.
- **Чего код не проверяет.** Уникальность имён (ищется первая деталь с именем; у рецептов её
  проверяет `tests/assemblyRecipes.test.ts`), пересечения деталей,
  направление потока. Связи не решаются: детали ставятся последовательно по дереву `attach`,
  замкнутый контур выражается замыканием и только проверяется, но не подгоняется.
- **`setAngle(part, degrees)`** меняет угол стыка детали и переставляет её и все детали после неё
  в описании (среди них — присоединённые к ней дальше и поставленные относительно неё); модели
  не перестраиваются, замыкания пересчитываются.
- **`bounds()`** — габарит сборки по габаритам деталей и их матрицам. **`dispose()`** освобождает
  модели всех деталей.

**Готовые узлы** — `ASSEMBLY_RECIPES` (`assembly/recipes/`): `{ id, version, title, variants?, build(key?) }`.
`build` отдаёт новое `AssemblyDefinition`; без ключа — первое исполнение, неизвестный ключ — ошибка.
Каждый рецепт — одна связанная группа: все детали присоединены друг к другу, явное положение —
только у первой; тест рецептов проверяет это вместе с отсутствием ошибок, несовместимых стыков
и незамкнутых замыканий у каждого исполнения. Поэтому в редакторе узел держится соединениями.
Имена деталей рецепта — часть его версии: по ним потребитель сопоставляет детали и свободные разъёмы.
Список узлов — [`lib-package/README.md`](../lib-package/README.md). Проверочные сборки стенда
(в том числе ошибочные) — `src/stand/assemblies.ts`, в библиотеку они не входят.
