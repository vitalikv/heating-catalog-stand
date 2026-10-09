# План доработки библиотеки перед новым проектом

Дата: 9 октября 2026.

**Состояние:** шаги 1–6 сделаны (п. 7, у каждого — раздел «Как сделано»). Остался шаг 7 (документы).
Проверка после каждого шага: `npm run typecheck`, `npm test`, `npm run build`; эталон
`tests/fixtures/gl2-reference.json` не меняется.

Каталог `gl2` перенесён целиком: 41 ID, 40 классов ([catalog-porting-plan.md](catalog-porting-plan.md)).
Код пока повторяет `gl2`: ID — имена функций, параметры — ключи `cdm`,
результат генератора — готовые объекты Three.js. Библиотека пойдёт в новый проект,
поэтому сейчас, до сборок `sborka/` и до подключения к редактору, закладывается база:

- имена, которые попадут в сохранённые проекты (ID, параметры, версия);
- результат генератора, пригодный для воркера;
- общий каркас генератора вместо повторяющегося кода;
- структура папок и узкий публичный API.

Геометрия при этом не меняется. Сверка с `gl2` (`tests/gl2Reference.test.ts`,
`scripts/gl2-compare.mjs`) должна проходить после каждого шага; старые имена
остаются только в слое соответствия `legacy/gl2`.

## 1. Что не так сейчас

| Проблема | Где | Чем плохо |
| --- | --- | --- |
| ID — имена функций `gl2`, разнобой: `st_mufta_1`, `createTubeWF_1`, `st_zagl_nr`, `pl_troinik_2` | все генераторы | ID попадут в данные проектов редактора |
| Параметры — ключи `cdm`: `r1`, `r2`, `r3`, `m1`, `m2`, `t1`, `h1`, `d`, `name`; коды `side: 'v'\|'n'`, `type: 'prh'\|'vsd'\|'zgl'` | все генераторы | Непонятны без `gl2`; внутри уже есть `ThreadSide` `'internal'\|'external'` — два словаря |
| Нет версии определения и параметров по умолчанию | контракт | Миграции и вставка детали в редактор не на что опереть |
| `GeneratedModel` содержит `Group`/`Mesh` с материалами | контракт, `MeshModel` | Не передаётся из воркера; генератор зависит от `MaterialLibrary` |
| Материалы — индексы групп: константы `THREAD = 1`, `VALVE_MATERIALS`, `MP_MATERIALS` и массив материалов в том же порядке | 20 файлов | Порядок легко рассогласовать |
| `validate → throw GeneratorParamsError` повторён | 39 файлов | Шаблонный код |
| Модель собирается вручную (`root`, `bounds`, `dispose`) мимо `MeshModel` | `SteelCoupling`, `SteelNipple`, `PpElbow`, `AluminiumRadiator`, `RadiatorPlug` | Два пути построения |
| Размеры после проверки достаются с `!` | 81 место | Проверка и расчёт разъединены |
| `up` разъёма задан вручную, а не через `ConnectorFrame` | 11 мест | Риск ошибки в опорном направлении |
| Одинаковые описания параметров (`side`, номиналы) скопированы | 9+ файлов | Расходятся подписи и границы |
| `generators/` — 50 файлов вперемешку с помощниками | `src/lib/generators` | Трудно ориентироваться |
| `index.ts` экспортирует внутренности (`MeshModel`, `MpPressEnd`, `ConnectorFrame`, классы генераторов) | `src/lib/index.ts` | Любой рефакторинг ломает потребителей |
| `GeneratorRegistry` хранит `ModelGenerator<unknown>` | реестр | Тип параметров теряется у потребителя |
| `Assembly` и наборы каталога лежат в стенде | `src/stand` | Это предметная логика и данные, редактору они тоже нужны |

## 2. Решения, которые нужно подтвердить до начала

1. **Формат ID** — `семейство.деталь`, латиница, kebab-case: `steel.coupling`, `pp.elbow-90`.
   Разделитель точка, чтобы семейство читалось без таблицы.
2. **Язык имён параметров** — английский camelCase, как поля `Connector`.
3. **Слияние вариантов** — три шаровых крана становятся одним генератором с параметром концов,
   труба делится на две (`pp.pipe`, `mp.pipe`) — номиналы разные, `when` с двумя ключами не нужен.
4. **Совместимость с `gl2`** — только в `legacy/gl2.ts`: ID и перевод параметров.
   Импорт старых проектов не планируется, слой нужен для сверки и наборов `start.js`.

Если решение другое — поправить таблицы п. 3 до работы.

Решения 1–4 приняты (9 октября 2026). Порядок групп `MaterialGroupMerger` (п. 4) —
порядок первого появления ключа: детерминирован при одинаковых параметрах и не требует сортировки.

## 3. Имена: ID и параметры

### Соглашения по параметрам

| Было | Стало | Когда |
| --- | --- | --- |
| `r1` (один номинал на все концы) | `nominal` | резьба или труба одного размера |
| `r1`, `r2`, `r3` по концам | `nominalLeft`, `nominalRight`, `nominalBranch` | суффикс — ID разъёма |
| номиналы трубы и резьбы в одной детали | `pipeNominal`, `threadNominal` | переходы, угол и тройник с резьбой |
| `side: 'v' \| 'n'` | `threadGender: 'internal' \| 'external'` | |
| `m1` | `length`, у углов — `armLength`, у крестовины — `size` | |
| `m2` | `branchLength` (тройник, коллектор), `unionLength` (сгон), `threadArmLength` (угол МП с резьбой) | |
| `t1` | `handleLength` | краны |
| `size: { x, y, z }` | `dimensions: { x, y, z }` | котельное, радиаторы |
| `count` | `sections` (радиатор), `outlets` (коллектор) | |

Значения номиналов не меняются: `'1/2'`, `'1 1/4'`, `'20'` — это данные таблиц размеров
и `Connector.nominal`. Единицы — метры, как сейчас.

### Таблица генераторов

| ID `gl2` | Новый ID | Класс | Параметры: было → стало |
| --- | --- | --- | --- |
| `st_mufta_1` | `steel.coupling` | `SteelCouplingGenerator` | `r1, r2, m1` → `nominalLeft, nominalRight, length` |
| `st_nippel_1` | `steel.nipple` | `SteelNippleGenerator` | `r1, r2, m1` → `nominalLeft, nominalRight, length` |
| `st_zagl_nr` | `steel.plug` | `SteelPlugGenerator` | `r1, m1` → `nominal, length` |
| `st_pol_sgon_1` | `steel.half-union` | `SteelHalfUnionGenerator` | `r1, r2, m1` → `nutNominal, pipeNominal, length` |
| `st_ugol_90_1` | `steel.elbow-90` | `SteelElbowGenerator` | `side, r1, m1` → `threadGender, nominal, armLength` |
| `st_ugol_45_1` | `steel.elbow-45` | `SteelElbow45Generator` | `r1, m1` → `nominal, armLength` |
| `st_troinik_1` | `steel.tee` | `SteelTeeGenerator` | `side, r1, r2, r3, m1, m2` → `threadGender, nominalLeft, nominalBranch, nominalRight, length, branchLength` |
| `st_krestovina_1` | `steel.cross` | `SteelCrossGenerator` | `r1, m1` → `nominal, size` |
| `st_collector_1` | `steel.manifold` | `SteelManifoldGenerator` | `side, r1, r2, count, m1, m2` → `threadGender, nominal, outletNominal, outlets, length, branchLength` |
| `st_collector_2` | `steel.manifold-valves` | `SteelValveManifoldGenerator` | `r1, r2, count, m1, m2, color` → `nominal, outletNominal, outlets, length, branchLength, handleColor` |
| `pl_ugol_90_1` | `pp.elbow-90` | `PpElbowGenerator` | `r1, m1` → `nominal, armLength` |
| `pl_ugol_45_1` | `pp.elbow-45` | `PpElbow45Generator` | `r1, m1` → `nominal, armLength` |
| `pl_ugol_90_rezba_1` | `pp.elbow-90-thread` | `PpThreadElbowGenerator` | `side, r1, r2, m1` → `threadGender, pipeNominal, threadNominal, armLength` |
| `pl_mufta_1` | `pp.coupling` | `PpCouplingGenerator` | `r1, r2, m1` → `nominalLeft, nominalRight, length` |
| `pl_perehod_rezba_1` | `pp.thread-adapter` | `PpThreadAdapterGenerator` | `side, r1, r2, m1` → `threadGender, pipeNominal, threadNominal, length` |
| `pl_troinik_1` | `pp.tee` | `PpTeeGenerator` | `r1, m1` → `nominal, length` |
| `pl_troinik_2` | `pp.tee-reducing` | `PpReducingTeeGenerator` | `r1, r2, r3, m1, m2` → `nominalLeft, nominalBranch, nominalRight, length, branchLength` |
| `pl_troinik_rezba_1` | `pp.tee-thread` | `PpThreadTeeGenerator` | `side, r1, r2, m1` → `threadGender, pipeNominal, threadNominal, length` |
| `pl_krestovina_1` | `pp.cross` | `PpCrossGenerator` | `r1, m1` → `nominal, size` |
| `createTubeWF_1` (`type: 'pp'`) | `pp.pipe` | `PpPipeGenerator` | `ppSize, length` → `nominal, length` |
| `mpl_ugol_1` | `mp.elbow` | `MpElbowGenerator` | `r1, m1` → `nominal, armLength` |
| `mpl_ugol_rezba_1` | `mp.elbow-thread` | `MpThreadElbowGenerator` | `side, r1, r2, m1, m2` → `threadGender, pipeNominal, threadNominal, armLength, threadArmLength` |
| `mpl_perehod_1` | `mp.coupling` | `MpCouplingGenerator` | `r1, r3, m1` → `nominalLeft, nominalRight, length` |
| `mpl_perehod_rezba_1` | `mp.thread-adapter` | `MpThreadAdapterGenerator` | `side, r1, r2, m1` → `threadGender, pipeNominal, threadNominal, length` |
| `mpl_troinik_1` | `mp.tee` | `MpTeeGenerator` | `r1, r2, r3, m1, m2` → `nominalLeft, nominalBranch, nominalRight, length, branchLength` |
| `mpl_troinik_rezba_1` | `mp.tee-thread` | `MpThreadTeeGenerator` | `side, r1, r2, r3, m1, m2` → `threadGender, nominalLeft, threadNominal, nominalRight, length, branchLength` |
| `createTubeWF_1` (`type: 'mp'`) | `mp.pipe` | `MpPipeGenerator` | `mpSize, length` → `nominal, length` |
| `al_radiator_1` | `radiator.aluminium` | `AluminiumRadiatorGenerator` | `count, size, r1` → `sections, dimensions, nominal` |
| `st_radiator_1` | `radiator.steel` | `SteelRadiatorGenerator` | `size, r1` → `dimensions, nominal` |
| `al_zagl_radiator_1` | `radiator.port-fitting` | `RadiatorPortFittingGenerator` | `type: prh\|zgl\|vsd, r1, r2` → `kind: adapter\|plug\|vent, portNominal, outletNominal` |
| `rad_vozduhotvod_1` | `radiator.vent` | `RadiatorVentGenerator` | `type: vsd\|zgl, r1` → `kind: vent\|plug, nominal` |
| `shar_kran_v_1`, `shar_kran_n_1`, `shar_kran_v_n_1` | `valve.ball` | `BallValveGenerator` | `r1, m1, t1` + вариант → `ends: internal\|external\|internal-external, nominal, length, handleLength` |
| `shar_kran_sgon_1` | `valve.ball-union` | `BallValveUnionGenerator` | `r1, r2, m1, m2, t1` → `nominal, unionNominal, length, unionLength, handleLength` |
| `reg_kran_primoy_1` | `valve.regulating` | `RegulatingValveGenerator` | `head: cap\|termo, r1, r2, m1, m2` → `head: cap\|thermostatic, nominal, unionNominal, length, unionLength` |
| `cr_kotel_1` | `equipment.boiler` | `BoilerGenerator` | `size, r1, type` → `dimensions, nominal, connection` |
| `cr_zr_nasos_1` | `equipment.pump` | `CirculationPumpGenerator` | `r1` → `nominal` |
| `cr_gaika_nasos_1` | `equipment.pump-nut` | `PumpNutGenerator` | `r1, r2` → `pumpNominal, pipeNominal` |
| `filtr_kosoy_1` | `equipment.strainer` | `StrainerGenerator` | `r1, m1` → `nominal, length` |
| `cr_rash_bak_1` | `equipment.expansion-tank` | `ExpansionTankGenerator` | `d, h1, r1, name: '6л'…` → `diameter, height, nominal, volume: 6…` (литры числом) |
| `gr_bez_1` | `equipment.safety-group` | `SafetyGroupGenerator` | `size, r1` → `dimensions, nominal` |

ID разъёмов (`left`, `right`, `top`, `bottom`, `branch`, `start`, `end`, `radiator`, `outlet`,
`top-right`…) остаются, но сводятся в словарь в `ARCHITECTURE.md` (шаг 7), чтобы новые
генераторы брали имена оттуда.

## 4. Новый контракт

### Генератор

```ts
interface ModelGenerator<P> {
  readonly id: string;          // 'steel.coupling'
  readonly version: number;     // 1; растёт при изменении параметров или геометрии
  readonly title: string;
  readonly paramSpecs: readonly ParamSpec[];
  readonly defaults: P;         // параметры для вставки в редактор
  validate(params: P): ValidationError[];
  build(params: P): GeneratedModel;
}
```

В данных проекта деталь хранится как `{ generatorId, version, params }`.

### Результат — данные, без материалов и `Object3D`

```ts
type MaterialKey = 'metal' | 'thread' | …;   // как сейчас в MaterialLibrary

interface GeneratedModel {
  title: string;
  /** Неиндексированная геометрия; группа i рисуется материалом materials[i]. */
  geometry: BufferGeometry;
  materials: readonly MaterialKey[];
  connectors: Connector[];
  bounds: { min: Vector3Data; max: Vector3Data };
  warnings: string[];
  dispose(): void;
}
```

Объект сцены собирает потребитель:

```ts
// src/lib/scene/ModelObject.ts — единственное место, где модель встречается с материалами
createModelObject(model: GeneratedModel, library: MaterialLibrary): Group
```

Что это даёт:

- генераторы не получают `MaterialLibrary` в конструкторе — реестр создаётся без аргументов;
- результат передаётся из воркера: атрибуты геометрии — transferable-буферы,
  остальное — простые данные (сериализацию сделать при подключении воркера, п. 11 плана разработки);
- материалы подменяются без перестройки (профиль рендера, выделение);
- одинаковые параметры дают одинаковый результат, поэтому редактор может кэшировать
  геометрию по ключу `id + version + params` и делить её между экземплярами.

### Куски геометрии — с ключом материала

`GeometryPart.materialIndex: number` → `material: MaterialKey`.
`SleeveOptions.materials` — тоже ключи: `{ outer: 'metalFlat', inner: 'thread' }`, по умолчанию
материал задаётся одним полем `material` у вызова. `MaterialGroupMerger.merge()` возвращает
`{ geometry, materials }`: порядок групп — порядок первого появления ключа. Константы индексов (`THREAD = 1`, `VALVE_MATERIALS`,
`MP_MATERIALS` и т. п.) удаляются.

## 5. Каркас генератора

Базовый класс в стиле текущего кода (классы, а не фабрики):

```ts
abstract class BaseGenerator<P, L> implements ModelGenerator<P> {
  abstract readonly id: string;
  abstract readonly version: number;
  abstract readonly title: string;
  abstract readonly paramSpecs: readonly ParamSpec[];
  abstract readonly defaults: P;

  /** Размеры по параметрам; вызывается только для параметров, прошедших схему. */
  protected abstract layout(params: P): L;
  /** Связи параметров (длина больше суммы участков и т. п.). */
  protected relations(_params: P, _layout: L): ValidationError[] { return []; }
  protected abstract create(params: P, layout: L): GeneratedModel;

  validate(params: P): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    return errors.length > 0 ? errors : this.relations(params, this.layout(params));
  }

  build(params: P): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);
    return this.create(params, this.layout(params));
  }
}
```

- `layout()` — единственное место, где таблицы размеров дают `PartDiameters`; `!` остаются
  только в нём, ниже по коду — готовые числа. Для таблиц добавить `ThreadSizes.require()`,
  который бросает исключение вместо `null` — после схемы это означает ошибку в коде.
- Модель собирает `MeshModel.create()` (переименовать в `createMeshModel`) — без исключений,
  пять генераторов из таблицы п. 1 переводятся на него.
- Разъёмы — через помощник:

  ```ts
  connector('right', ConnectorFrame.right, distance, { depth, nominal, joint, gender })
  ```

  Ручных `up` не остаётся; `ConnectorFrame` получает `branch` (выход тройника) и `leftTurned`.
- Повторяющиеся описания параметров — фабрики в `params/specs.ts`:
  `specs.threadNominal(key, label)`, `specs.ppNominal(…)`, `specs.mpNominal(…)`,
  `specs.threadGender()`, `specs.length(key, label, min, max, step)`.
- Конструкторы геометрии без состояния (`SleeveGeometryBuilder`, `SphereGeometryBuilder`,
  `ExtrudedShapeBuilder`) — общие экземпляры модуля вместо `new` в каждом генераторе.

## 6. Структура и публичный API

```text
src/lib/
  core/           contracts.ts, BaseGenerator.ts, GeneratorParamsError.ts,
                  ConnectorFrame.ts, connector.ts, MeshModel.ts
  params/         ParamSchema.ts, specs.ts
  sizes/          ThreadSizes, PpPipeSizes, MpPipeSizes; общий интерфейс NominalTable
                  и выбор таблицы по ConnectorJoint
  geometry/       как сейчас
  materials/      MaterialLibrary.ts
  scene/          ModelObject.ts — модель + материалы → Group
  assembly/       ConnectorMating.ts, Assembly.ts (из src/stand, без DOM)
  catalog/        позиции каталога: generatorId + params (наборы start.js в новом формате)
  generators/
    steel/        муфта, ниппель, …, SteelManifoldPipe
    pp/           …, PpThreadInsert
    mp/           …, MpPressEnd
    radiator/
    valve/        …, BallValveParts
    equipment/
    GeneratorRegistry.ts
  legacy/
    gl2.ts        ID gl2 → новый ID, перевод параметров cdm → новые
  index.ts
```

`index.ts` экспортирует только:

- типы контракта и типы параметров генераторов;
- `GeneratorRegistry`, `MaterialLibrary`, `createModelObject`;
- `ConnectorMating`, `Assembly` и их типы;
- `ParamSchema`, таблицы размеров;
- каталог.

Классы генераторов, `MeshModel`, `ConnectorFrame`, общие части семейств наружу не выходят;
тесты, которым они нужны, импортируют их напрямую из `src/lib/...`.

Реестр — типизированный:

```ts
interface GeneratorParamsMap {
  'steel.coupling': SteelCouplingParams;
  …
}
registry.get<K extends keyof GeneratorParamsMap>(id: K): ModelGenerator<GeneratorParamsMap[K]>;
registry.get(id: string): ModelGenerator<unknown> | undefined;   // для данных из проекта
```

Тест реестра проверяет, что каждый `ParamSpec.key` есть в `defaults` — так ловятся опечатки
в ключах, которые типы не видят.

## 7. Порядок работ

Каждый шаг заканчивается `npm run typecheck`, `npm test`, `npm run build`; сверка с `gl2`
(`gl2Reference`) проходит без изменения эталона — геометрия не меняется.

### Шаг 1. Слой `legacy/gl2` — сделано

- `legacy/gl2.ts`: таблица `GL2_IDS` из п. 3, `gl2TargetId()` (труба делится по `cdm.type`),
  `fromGl2(id, cdm) → { generatorId, params }`. Пока новые имена не введены, она отображает
  старое в старое, но уже бросает исключение на ID вне таблицы.
- `stand/presets.ts`: `GL2_PRESETS` — наборы `start.js` в формате `gl2`; `STAND_PRESETS` —
  они же через `fromGl2`, сгруппированные по новому `generatorId`. Эталон
  `tests/fixtures/gl2-reference.json` остаётся в формате `gl2`; `gl2Reference.test.ts`
  и `scripts/gl2-compare.mjs` строят модели через `fromGl2`.
- `tests/legacyGl2.test.ts`: таблица покрывает реестр, наборы и эталон; новые ID в формате п. 2
  и уникальны, кроме `valve.ball`.
- Сборки `stand/assemblies.ts` не тронуты — переходят на новые ID сразу в шаге 4.

### Шаг 2. Результат-данные и материалы по ключам

Два подшага, каждый с полной проверкой:

- **2a — сделано.** `MaterialKey` перенесён в `contracts.ts`; `GeometryPart.material`; у `SleeveOptions`,
  `SphereOptions`, `ExtrudedShapeOptions` обязательное поле `material` (у втулки `materials` — переопределение
  частей), `SleeveShape` — втулка без материала для заготовок; `MaterialGroupMerger.merge()` →
  `{ geometry, materials }`, группы в порядке первого появления ключа. `MeshModel.create(options, library)`
  превращает ключи в материалы. Константы индексов (`THREAD`, `VALVE_MATERIALS`, `MP_MATERIALS`,
  `PP_THREAD_MATERIALS`, `COLLECTOR_MATERIALS`, `MpPressEnd.meshMaterials`) удалены.
  Попутно на `MeshModel` переведены `SteelCoupling`, `SteelNipple`, `PpElbow`, `RadiatorPlug` (п. 5);
  `AluminiumRadiator` остаётся из нескольких мешей с общей геометрией. Тест `materialGroupMerger.test.ts`;
  тесты групп сверяют материалы по ключам.
- **2b — сделано.** `GeneratedModel` по п. 4 (`geometry`, `materials`, `bounds: BoundsData`), без `root`;
  `src/lib/scene/ModelObject.ts` — `createModelObject(model, library)`. `AluminiumRadiator` сливает секции
  в одну геометрию (копии со сдвигом на шаг; треугольники и габарит как в `gl2`).
- Генераторы без `MaterialLibrary`; `GeneratorRegistry` без аргументов.
- Стенд (`main.ts`, `Assembly.ts`, `ModelInspector.ts`) — через `createModelObject`; деталь в сцене —
  `SceneModel { model, root }`, `Assembly` получает библиотеку материалов.
- Тесты групп материалов проверяют ключи, а не индексы; `scripts/gl2-compare.mjs` и `gl2-snapshot.mjs`
  читают данные модели (снимок — через `fromGl2` и `createModelObject`).

### Шаг 3. `BaseGenerator`, помощники, фабрики параметров — сделано

- `BaseGenerator`, `connector()`, `specs.*`, `ThreadSizes.require()`.
- Генераторы переводятся по семействам: сталь → ПП → МП → радиаторы → краны → котельное.
- В том же проходе — раскладка по папкам семейств (п. 6).

Как сделано:

- Раскладка по п. 6: `core/` (контракт, `BaseGenerator`, `connector`, `ConnectorFrame`, `createMeshModel`,
  `GeneratorParamsError`), `generators/<семейство>/`. `PipeGenerator` пока в корне `generators/` —
  делится на `pp.pipe` и `mp.pipe` в шаге 4. `NominalTable` и выбор таблицы по `ConnectorJoint`
  не понадобились — отложено до места, где таблицу выбирают по разъёму.
- `layout()` у `BaseGenerator` необязателен (по умолчанию размеров нет): он есть у генераторов,
  где связям и построению нужны одни и те же размеры. `require()` есть у всех трёх таблиц,
  `diameters(...)!` в генераторах не осталось.
- `connector(id, frame, at, end)`: `at` — расстояние по оси выхода или точка. `ConnectorFrame.back`
  (котёл); `branch` не нужен — выход тройника это `top`. Ручных `direction`/`up` в генераторах нет.
- `specs.threadSide()` пока даёт коды `gl2` (`'v' | 'n'`) и тип `ThreadSideCode` (перенесён в `params/specs.ts`);
  в шаге 4 станет `threadGender()`.
- Построители геометрии — общие экземпляры `sleeves`, `spheres`, `shapes`; `MpPressEnd`, `BallValveParts`,
  `SteelCollectorPipe` создаются без аргументов. `MeshModel.create` → `createMeshModel`.

### Шаг 4. Новые ID, параметры, версия, умолчания — сделано

- ID и параметры по таблице п. 3, `version = 1`, `defaults` — первый набор из `start.js`.
- Слияние `BallValveGenerator` в один ID с `ends`; разделение трубы на `pp.pipe` и `mp.pipe`;
  переименования классов из таблицы.
- `legacy/gl2.ts` переводит `cdm` в новые параметры (`side 'v'` → `threadGender 'internal'`,
  `name '6л'` → `volume 6` и т. д.).
- Сборки в `stand/assemblies.ts` — на новые ID и параметры.
- Типизированный реестр и тест `paramSpecs`/`defaults`.

Как сделано:

- `ThreadGender` (`'internal' | 'external'`) в контракте — один словарь для `Connector.gender`,
  параметра `threadGender` и `ThreadSizes`; `ThreadSide` и `ThreadSideCode` удалены, `specs.threadGender()`.
- Вариант выбора в `ParamSpec` может быть числом (`volume` бака: 6, 8…). `ParamSchema.tooShort` —
  сообщение `length: нужно больше 15.0 мм` (имя параметра без падежа).
- `GeneratorParamsMap` и `GeneratorId` выводятся из списка генераторов реестра (`id` и `defaults`
  классов), вручную не ведутся. `registry.get('steel.coupling')` типизирован; `get(string)` — для данных проекта.
- `defaults` — первый набор `start.js` каждого генератора после `fromGl2`.
- Трубы — `PpPipeGenerator` и `MpPipeGenerator` с общей `createStraightPipe` (`generators/StraightPipe.ts`).
- `fromGl2` переводит ключи и коды по таблице, неизвестный ключ `cdm` — исключение; ключи gl2 без
  влияния на модель (`r2`, `m1` воздухоотводчика, `m1` гайки насоса) отбрасываются.
- Подписи наборов шарового крана на стенде — с видом концов: три функции gl2 теперь один генератор.

### Шаг 5. `Assembly` и каталог в библиотеку — сделано

- `Assembly` из `src/stand` в `src/lib/assembly` (без DOM, корень — `Group` из `createModelObject`
  или только матрицы деталей — решить при переносе; для воркера удобнее матрицы).
- Наборы `start.js` — в `src/lib/catalog` в новом формате (через `fromGl2` один раз),
  стенд берёт их оттуда.

Как сделано:

- `src/lib/assembly/Assembly.ts` — без объектов сцены: детали `{ name, model, matrix }`, матрица — положение
  в координатах сборки (первая деталь в начале координат); `bounds()` → `BoundsData` (габариты деталей по
  матрицам). Конструктор без `MaterialLibrary`. Типы `AssemblyDefinition`, `AssemblyPart` (`params: unknown` —
  как данные проекта), `AssemblyJoint` — там же.
- Стенд: `stand/AssemblyView.ts` строит объекты через `createModelObject` и переносит матрицы (`sync()`
  после `setAngle`). Описания сборок `stand/assemblies.ts` остались в стенде — это проверочные данные.
- `src/lib/catalog/` — по семействам (`steel.ts`, `pp.ts`, …), `CATALOG` в `catalog.ts`. Таблицы — в новых
  ключах и кодах (`'internal'`, `volume: 6`), позиции через `entry(id, items)`: параметры проверяются типом
  генератора. Каталог от `legacy/gl2` не зависит.
- Наборы `gl2` (`GL2_PRESETS`) перенесены из `stand/presets.ts` в `tests/fixtures/gl2Presets.ts`;
  `STAND_PRESETS` удалён. `tests/catalog.test.ts` сверяет `CATALOG` с `fromGl2(GL2_PRESETS)`: позиции,
  подписи и порядок внутри генератора. `scripts/gl2-compare.mjs` берёт наборы из фикстуры.
- `tests/assemblies.test.ts` проверяет матрицы; `Assembly.bounds()` сверяется с `Box3.setFromObject`
  объектов, поставленных по матрицам.

### Шаг 6. Узкий `index.ts` — сделано

- Экспорт по п. 6; тесты переходят на прямые импорты внутренних модулей.

Как сделано:

- `index.ts` по п. 6, сгруппирован по разделам. Значения: `GeneratorRegistry`, `GeneratorParamsError`
  (его бросает `build()` — часть контракта), `MaterialLibrary`, `createModelObject`, `Assembly`,
  `ConnectorMating`, `ParamSchema`, `ThreadSizes`, `PpPipeSizes`, `MpPipeSizes`, `CATALOG`. Типы: контракт
  (включая `MaterialKey`), `GeneratorId`/`GeneratorParamsMap`, параметры всех генераторов с их перечислениями
  (добавлены `PpCrossParams`, `PpTeeParams`), сборка, каталог, `PartDiameters`.
- Убраны классы генераторов, `createMeshModel`, `ConnectorFrame`, `MpPressEnd`, `EXPANSION_TANK_VOLUMES`.
  Тесты импортируют классы генераторов из `src/lib/generators/...`; публичное по-прежнему берут из `index.ts`.
- `tests/publicApi.test.ts` фиксирует список значений, которые экспортирует `index.ts`.

### Шаг 7. Документы

- `docs/ARCHITECTURE.md`: контракт, оси и `up`, единицы, словарь ID разъёмов, правила
  именования генераторов и параметров, как добавить генератор.
- В `development-plan.md` и `catalog-porting-plan.md` — пометка, что ID и параметры там
  в формате `gl2`, с ссылкой на этот план; устаревшие числа (33 генератора) исправить.
- README: структура `src/lib`.

## 8. Не входит

- Изменение геометрии, материалов (`DoubleSide`, Phong/Standard) и числа сегментов.
- Воркер и сериализация результата — только готовность к ним.
- Сборки `sborka/` — после этого плана, уже на новом контракте.
- Импорт проектов `gl2`.
- Названия моделей (`'Муфта 1/2(в)'`) остаются строкой генератора; локализацию решать
  вместе с интерфейсом редактора.

## 9. Готовность

- Все ID и параметры — по п. 3; старые имена встречаются только в `legacy/`, `tests/fixtures/gl2Presets.ts`
  (исходные наборы `start.js`) и эталоне `gl2`.
- Ни один генератор не импортирует `MaterialLibrary` и не создаёт `Mesh`/`Group`.
- В генераторах нет констант индексов материалов, ручных `up` и `throw GeneratorParamsError`.
- `tsconfig.lib.json` проверяет `src/lib` без DOM, включая `assembly/` и `catalog/`.
- Сверка с `gl2` проходит без изменения эталона; стенд показывает те же модели и сборки.
