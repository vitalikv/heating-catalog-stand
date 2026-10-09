# Архитектура библиотеки генераторов

Библиотека `src/lib` строит параметрические модели отопления: фитинги, трубы, радиаторы,
краны и котельное оборудование. Генератор получает параметры и возвращает модель как данные:
геометрию, ключи материалов, разъёмы и габарит. Объект сцены собирает потребитель.

Здесь описано, как библиотека устроена сейчас. Как к этому пришли — в
[library-refactoring-plan.md](library-refactoring-plan.md). Старые планы
([development-plan.md](development-plan.md), [catalog-porting-plan.md](catalog-porting-plan.md))
записаны в именах `gl2`.

## 1. Правила

- `src/lib` не обращается к `window`, `document`, рендереру и камере. Это проверяет
  `tsconfig.lib.json` (`npm run typecheck`), поэтому генераторы можно запускать в воркере.
- Потребители импортируют только `src/lib/index.ts`. Тесты могут импортировать внутренние модули
  напрямую. Состав `index.ts` проверяет `tests/publicApi.test.ts`.
- Одинаковые параметры дают одинаковую модель: генератор не хранит состояние между вызовами.
- Старые имена `gl2` встречаются только в `legacy/gl2.ts`, в `tests/fixtures/` и в эталоне сверки.

## 2. Структура

```text
src/lib/
  index.ts        публичный API
  core/           contracts.ts — контракт; BaseGenerator, GeneratorParamsError,
                  connector() и ConnectorFrame — разъёмы, createMeshModel — модель из геометрии
  params/         ParamSchema — проверка и доступ по пути 'dimensions.y'; specs — общие описания параметров
  sizes/          ThreadSizes (резьба), PpPipeSizes, MpPipeSizes — таблицы размеров по номиналу
  geometry/       sleeves, spheres, shapes — построители кусков; MaterialGroupMerger; BoxProjectionUv
  materials/      MaterialLibrary — материал по ключу
  scene/          createModelObject — модель + материалы → Group
  assembly/       ConnectorMating — совместимость и стыковка; Assembly — сборка по разъёмам
  catalog/        позиции каталога по семействам; CATALOG
  generators/     steel/, pp/, mp/, radiator/, valve/, equipment/ — по классу на генератор
                  и общие части семейств; StraightPipe — общая основа труб;
                  GeneratorRegistry — список всех генераторов
  legacy/gl2.ts   перевод ID и параметров gl2 в формат библиотеки — только для сверки
```

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

- **Деталь в данных проекта** — `{ generatorId, version, params }`. `version` растёт, когда меняются
  параметры или геометрия, чтобы старые проекты можно было мигрировать.
- **`defaults`** — параметры, с которыми деталь вставляется в редактор. Они проходят `validate()`.
- **`paramSpecs`** описывает все параметры. По схеме работает проверка (`ParamSchema.validate`)
  и строится интерфейс: панель стенда, позже — редактор. Виды: `choice`, `length` (метры,
  в интерфейсе — миллиметры), `integer`; `when` делает параметр условным.
- **Материалы** — ключи `MaterialKey` (`'metal'`, `'thread'`, `'plastic'`, …). Объекты материалов
  создаёт `MaterialLibrary`, с моделью их соединяет только `createModelObject(model, library)`.
  Поэтому материалы можно подменить без перестройки модели.
- **Результат без объектов сцены.** При подключении воркера атрибуты геометрии передаются как
  transferable-буферы, остальное — простые данные.

Типизированный реестр:

```ts
const registry = new GeneratorRegistry();
registry.get('steel.coupling');      // ModelGenerator<SteelCouplingParams>
registry.get(idFromProject);         // ModelGenerator<unknown> | undefined
```

`GeneratorId` и `GeneratorParamsMap` выводятся из списка генераторов в `GeneratorRegistry`,
вручную их не ведут.

## 4. Единицы и оси

- Длины и координаты — **метры**. Длина 30 мм — это `length: 0.03`.
- Номиналы — **строки**, как в таблицах размеров: резьба `'1/2'`, `'1 1/4'`; трубы ПП и МП —
  наружный диаметр в миллиметрах: `'20'`, `'16'`.
- Объём бака — литры числом (`volume: 6`). Число секций, выходов — целые.
- Углы стыков в `AssemblyPart.attach.angle` и `Assembly.setAngle` — **градусы**.
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
  joint: 'thread' | 'radiator-thread' | 'pp-socket' | 'mp-press';
  gender: 'internal' | 'external';
}
```

**Совместимость** (`ConnectorMating.check`): одинаковые `joint` и `nominal`, разные `gender`.
Номинал сравнивают только при одинаковом `joint`: `'20'` у ПП-раструба и у пресс-фитинга МП —
разные соединения.

**Стыковка** (`ConnectorMating.place`): направления противоположны, `up` совпадают, затем
деталь доворачивается на угол стыка вокруг оси. Ответная деталь входит на
`e = min(depth₁, depth₂)`: её торец встаёт в `position − direction × e` неподвижной детали.

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
вместе с ним.

Разъём создают помощником: `connector(id, frame, at, { depth, nominal, joint, gender })`.
`at` — расстояние от начала координат по оси выхода или готовая точка.

### Словарь ID разъёмов

Новый генератор берёт ID отсюда. Новое имя добавляют в таблицу, когда ни одно не подходит.

| ID | Значение | Где |
| --- | --- | --- |
| `left`, `right` | концы прохода вдоль −X и +X | муфты, ниппели, тройники, краны, фильтр, насос, коллекторы, соединители; у заглушки и воздухоотводчика — только `left` |
| `top` | выход вверх (+Y): ответвление тройника, второй выход угла 90° | тройники, крестовины, углы 90°, котёл |
| `bottom` | выход вниз (−Y) | крестовины, котёл, расширительный бак, группа безопасности |
| `start`, `end` | концы трубы (−X, +X) | `pp.pipe`, `mp.pipe` |
| `outlet-1` … `outlet-N` | выходы коллектора слева направо, вверх | `steel.manifold`, `steel.manifold-valves` |
| `top-left`, `top-right`, `bottom-left`, `bottom-right` | порты радиатора; у котла — `bottom-left`, `bottom-right` | радиаторы, котёл |
| `back-left`, `back-right` | выходы котла назад (−Z) | `equipment.boiler` |
| `radiator`, `outlet` | в порт радиатора и наружу | `radiator.port-fitting` |
| `nut`, `pipe` | гайка и патрубок | `steel.half-union`; у гайки насоса — `pump` и `pipe` |

У угла 45° второй выход тоже называется `left`, но это левый выход, повёрнутый на 45°
(`leftTurned`).

## 6. Имена

**ID генератора** — `семейство.деталь`, латиница, kebab-case: `steel.coupling`, `pp.elbow-90`,
`mp.tee-thread`. Семейства: `steel`, `pp`, `mp`, `radiator`, `valve`, `equipment`.
ID хранится в проектах, поэтому после выпуска его не меняют.

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

## 7. Как добавить генератор

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
   (`sleeves.build`, `spheres`, `shapes`) с ключом материала и складывают в `MaterialGroupMerger`.
   Модель собирает `createMeshModel({ title, ...merger.merge(), connectors })`.
   Разъёмы создают через `connector()` и `ConnectorFrame`.
5. **Регистрация.** Добавить экземпляр в `createGenerators()` в `GeneratorRegistry.ts`, а тип
   параметров — в `index.ts`. `GeneratorParamsMap` обновится сам.
6. **Каталог.** Добавить позиции в `catalog/<семейство>.ts` через `entry('<id>', [...])`.
   Параметры позиций проверяются типом генератора.
7. **Тесты.** Без отдельной работы на новый генератор распространяются `generatorRegistry`
   (ключи схемы есть в `defaults`), `paramSchema` (каждая позиция каталога проходит схему),
   `catalogModels` (буферы, группы, габарит, разъёмы на всех позициях) и `catalog` (уникальные подписи).
   В тест семейства добавить проверку разъёмов по формулам (торцы, глубины, направления)
   и ошибок параметров. Если деталь стыкуется с другими — добавить сборку в `src/stand/assemblies.ts`.
8. **Деталь из `gl2`.** Добавить строки в `legacy/gl2.ts` (`GL2_IDS`, `FIELDS`, при необходимости
   `VALUES`), наборы в `tests/fixtures/gl2Presets.ts` и сверку по
   [catalog-porting-plan.md](catalog-porting-plan.md), п. 5.

Изменение параметров или геометрии готового генератора: увеличить `version` и описать миграцию
вместе с подключением редактора.
