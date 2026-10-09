# План переноса каталога генераторов

Дата: 9 октября 2026.

Продолжение [development-plan.md](development-plan.md): пилот на пяти генераторах
закончен, контракт устоялся, дальше переносится весь каталог `gl2`.
Правила проекта, контракт (п. 4), таблицы размеров и журнал расхождений (п. 12) —
в `development-plan.md`; здесь только порядок работ и то, что нужно знать для
переноса. Журнал расхождений по-прежнему ведётся там.

## 1. Где мы сейчас

Шаги 1–3 выполнены 9 октября 2026. Перенесено 33 генератора: 5 пилотных и 28 из
очередей 1–6 — все фитинги, радиаторы и краны. Котельное оборудование, GLB-файлы и сборки `sborka/` в объём не входят (раздел 6).

Все наборы стенда (около 400) сверены с `gl2` автоматически (раздел 5): габариты —
до 1 мкм у всех, число разъёмов и названия — у всех, кроме сознательных отличий
из журнала. Число треугольников совпадает везде, где в `gl2` нет вырожденных
треугольников (журнал, п. 12). Снимки рядом: [сталь](img/steel-fittings-gl2-vs-stand.png),
[ПП](img/pp-fittings-gl2-vs-stand.png), [металлопластик](img/mp-fittings-gl2-vs-stand.png),
[радиаторы и краны](img/radiators-valves-gl2-vs-stand.png).

| Семейство | Генераторы и классы |
| --- | --- |
| Сталь | `st_mufta_1` `SteelCouplingGenerator`, `st_nippel_1` `SteelNippleGenerator`, `st_zagl_nr` `SteelPlugGenerator`, `st_pol_sgon_1` `SteelHalfUnionGenerator`, `st_ugol_90_1` `SteelElbowGenerator`, `st_ugol_45_1` `SteelElbow45Generator`, `st_troinik_1` `SteelTeeGenerator`, `st_krestovina_1` `SteelCrossGenerator`, `st_collector_1` `SteelCollectorGenerator`, `st_collector_2` `SteelValveCollectorGenerator` |
| ПП | `pl_ugol_90_1` `PpElbowGenerator`, `pl_ugol_45_1` `PpElbow45Generator`, `pl_ugol_90_rezba_1` `PpThreadElbowGenerator`, `pl_mufta_1` `PpCouplingGenerator`, `pl_perehod_rezba_1` `PpThreadAdapterGenerator`, `pl_troinik_1` `PpTeeGenerator`, `pl_troinik_2` `PpReducingTeeGenerator`, `pl_troinik_rezba_1` `PpThreadTeeGenerator`, `pl_krestovina_1` `PpCrossGenerator` |
| Металлопластик | `mpl_ugol_1` `MpElbowGenerator`, `mpl_ugol_rezba_1` `MpThreadElbowGenerator`, `mpl_perehod_1` `MpCouplingGenerator`, `mpl_perehod_rezba_1` `MpThreadAdapterGenerator`, `mpl_troinik_1` `MpTeeGenerator`, `mpl_troinik_rezba_1` `MpThreadTeeGenerator` |
| Радиаторы | `al_radiator_1` `AluminiumRadiatorGenerator`, `al_zagl_radiator_1` `RadiatorPlugGenerator`, `rad_vozduhotvod_1` `RadiatorVentGenerator`, `st_radiator_1` `SteelRadiatorGenerator` |
| Краны | `shar_kran_v_1`, `shar_kran_n_1`, `shar_kran_v_n_1` — один класс `BallValveGenerator` с вариантом концов; `shar_kran_sgon_1` `BallValveUnionGenerator`; `reg_kran_primoy_1` `RegulatingValveGenerator` |

Что есть в библиотеке (`src/lib`) и переиспользуется:

- `sizes/ThreadSizes` (`sizeRezba`), `sizes/PpPipeSizes` (`sizeTubePP`), `sizes/MpPipeSizes` (`sizeTubeMP`);
- `geometry/SleeveGeometryBuilder` (`crFormSleeve_1`: втулка, конус, поворот, сдвиг до
  поворота `offset` = `pos1`, сплошная, шестигранник через `outerSegments: 6`),
  `SphereGeometryBuilder` (`crSphere_2`), `ExtrudedShapeBuilder` (`arr_form_1`),
  `BoxProjectionUv` (`upUvs_5`), `MaterialGroupMerger` (`Geometry.merge(..., ind)`);
- общие части семейств в `generators/`: `ConnectorFrame` (направления и `up` выходов),
  `MeshModel` (модель из одного меша), `SteelCollectorPipe`, `PpThreadInsert`
  (резьбовая вставка ПП), `MpPressEnd` (пресс-конец и проход металлопластика),
  `BallValveParts` (корпус, шток с ручкой, сгон крана);
- `materials/MaterialLibrary`: `metal`, `metalFlat`, `thread`, `plastic`, `plasticFlat`,
  `plasticGrey`, `bronze`, `bronzeFlat`, `bronzeThread`, `red`, `blue`;
- `params/ParamSchema`: проверка по `paramSpecs`, `tooShort()` для связей длин;
- `assembly/ConnectorMating`: совместимость (`joint`, номинал, разный `gender`)
  и положение при стыковке: ввод на `min(depth)`, совпадение `up`, угол стыка.

Стенд: панель строится по `paramSpecs`, наборы — в `stand/presets.ts`,
сборки для проверки стыковки (в том числе с углом стыка) — в `stand/assemblies.ts`;
у разъёмов рисуется `up` (синий отрезок).

Чего не хватает (известно):

- интерфейса угла стыка на стенде — угол задаётся в описании сборки;
- труб как ответных частей раструба и пресса (`createTubeWF_1` — не деталь каталога).

## 2. Порядок работ

### Шаг 1. Инвентаризация каталога — сделано

Цель — до переноса знать, что каталог потребует от контракта, и выбрать порядок.

Для каждого генератора из `gl2/createObj/start.js` (список имён — в
`development-plan.md`, п. 3), кроме котельного оборудования (`kotel/`), записать
в таблицу (раздел 4 этого файла):

- файл и размер исходника, общие функции, от которых он зависит;
- параметры `cdm` и наборы из `start.js` (сколько, какие ключи);
- разъёмы: число, направления (по оси, 90°, 45°, вбок), `joint`,
  `gender`, номиналы; способы соединения (металлопластик — `mp-press`, раздел 6);
- материалы (`infProject.material.*`), которых ещё нет в `MaterialLibrary`;
- особенности: текстуры, DOM/UI в коде, выключенный или экспериментальный код.

Отдельно — функции `calculation_2.js` и др., которые ещё не перенесены
(`sizeTubeMP`, `crRing_2` и т. п.).

Итог шага: заполненная таблица, список изменений контракта, порядок переноса.
Если по таблице видно, что нужно новое поле контракта или новый `joint` —
сначала согласовать, потом переносить.

### Шаг 2. Опорное направление разъёма (`up`) — сделано

Для поворота вокруг оси разъёма у `Connector` нужен второй вектор —
единичный, перпендикулярный `direction` (рабочее имя `up`). Добавить его
**до** массового переноса, чтобы не возвращаться к каждому генератору.

- Поле в `contracts.ts`, проверка в тестах всех генераторов:
  `|up| = 1`, `up · direction = 0`.
- Заполнить у пяти перенесённых генераторов. Для деталей, симметричных
  вокруг оси (муфта, ниппель), `up` — любой фиксированный перпендикуляр,
  например `+Y`; у угольника — в плоскости угла.
- `ConnectorMating.place`: после совмещения направлений довернуть деталь
  вокруг оси так, чтобы `up` совпали (или задать угол поворота параметром стыка).
- Интерфейс поворота на стенде — можно позже; данные нужны сразу.

Как сделано:

- `Connector.up` в `contracts.ts`. Правило: у выходов вдоль ±X — `+Y`; выход вверх,
  вниз или под углом — левый выход (−X), повёрнутый вокруг Z, и `up` поворачивается
  вместе с ним: вверх (+Y) — `up` +X, вниз (−Y) — `up` −X, отвод 45° вверх — (√½, √½, 0).
  Направления и `up` — в `generators/ConnectorFrame`.
- `ConnectorMating.place(fixed, matrix, moving, angle = 0)`: направления навстречу,
  потом доворот вокруг оси стыка до совпадения `up` и ещё на `angle` (рад,
  против часовой стрелки, если смотреть навстречу `direction` неподвижного разъёма).
  Доворот заодно убирает произвольную ось `setFromUnitVectors` при одинаковых направлениях.
- Сборки стенда: `attach.angle` в градусах. Тест `assemblies` проверяет, что
  `up` стыка совпадают с точностью до угла; `catalogModels` — что у всех разъёмов
  всех наборов `|direction| = |up| = 1`, `up ⟂ direction`.

### Шаг 3. Перенос по семействам — сделано

Порядок — от простого к сложному, внутри семейства сначала то, что даёт
ответные пары для стыковки. Решения по семействам — в разделе 6.

| Очередь | Семейство | Генераторы | Исходник | Что проверяет |
| --- | --- | --- | --- | --- |
| 1 | Сталь | `st_zagl_nr`, `st_pol_sgon_1`, `st_ugol_90_1`, `st_ugol_45_1`, `st_troinik_1`, `st_krestovina_1` | `st/*.js`, 76–224 стр. | Угол и 3–4 разъёма; поворот при стыковке |
| 2 | Сталь, коллекторы | `st_collector_1`, `st_collector_2` | `st/collector.js`, 419 стр. | N выходов |
| 3 | ПП | `pl_ugol_45_1`, `pl_ugol_90_rezba_1`, `pl_mufta_1`, `pl_perehod_rezba_1`, `pl_troinik_1`, `pl_troinik_2`, `pl_troinik_rezba_1`, `pl_krestovina_1` | `pl/*.js`, 91–272 стр. | Переход пайка ↔ резьба на одной детали |
| 4 | Металлопластик | `mpl_ugol_1`, `mpl_ugol_rezba_1`, `mpl_perehod_1`, `mpl_perehod_rezba_1`, `mpl_troinik_1`, `mpl_troinik_rezba_1` | `mpl/*.js`, 275–389 стр. | Новый способ соединения `mp-press`, `sizeTubeMP` |
| 5 | Радиаторы | `rad_vozduhotvod_1`, `st_radiator_1` | `radiator/*.js` | Стальной радиатор — порты обычной резьбой `thread` |
| 6 | Краны | `reg_kran_primoy_1`, `shar_kran_v_1`, `shar_kran_n_1`, `shar_kran_v_n_1`, `shar_kran_sgon_1` (+ `shar_kran_babochka_1`, `shar_kran_obj_sgon_1`, если есть в `start.js`) | `kran/*.js`, до 713 стр. | Разные концы; ручка — часть геометрии, без поворота |

Не переносятся: котельное оборудование (`kotel/*.js`) и сборки (`sborka/sbr_1.js`) —
см. раздел 6.

После каждого семейства — пересмотр контракта (как в `development-plan.md`,
п. 9) и запись в журнал п. 12.

## 3. Как переносить один генератор

Проверенный на пилоте порядок:

1. Прочитать исходник целиком, выписать формулы и параметры. Проверить,
   что код действительно вызывается (`if(1==2)`, `test.js` — не переносить).
2. Новый класс в `src/lib/generators/`, один файл — один класс, ID = имя функции
   в `gl2` (позиция каталога — ID + параметры `cdm` как есть).
3. `paramSpecs` с разумными пределами; связи между параметрами — в `validate()`
   (код `too_short` и т. п.). `title` модели = название из `gl2`.
4. Геометрия — через существующие построители; новое общее — новым классом
   в `geometry/`. UV и порядок поворотов — как в `gl2` (UV до поворота и сдвига).
5. Разъёмы: торец, `direction` наружу, `depth` = длина соединительного участка,
   `joint`, `gender`, `nominal`, (после шага 2) `up`. ID — по назначению.
6. Регистрация: `GeneratorRegistry`, экспорт в `src/lib/index.ts`,
   наборы из `start.js` в `stand/presets.ts` (тест `paramSchema` требует наборы
   для каждого генератора).
7. Тесты. Общие для всех генераторов на всех наборах стенда — `catalogModels`
   (буферы без `NaN`, группы материалов, `bounds`, разъёмы, повторный `dispose()`)
   и `gl2Reference` (габарит, разъёмы, название и треугольники — по эталону `gl2`).
   Своё у генератора — в тесте семейства (`steelFittings`, `ppFittings`, `mpFittings`,
   `radiatorsAndValves`): торцы, глубины и направления разъёмов по формулам и таблицам,
   не из результата генератора; ошибки параметров; `title`.
8. Сверка с `gl2` (раздел 5): `scripts/gl2-compare.mjs` — габариты, треугольники,
   разъёмы; эталон для теста — `--fixture`; снимок рядом на сером фоне —
   `scripts/gl2-snapshot.mjs` в `docs/img/`.
9. Если есть ответные детали — сборка в `stand/assemblies.ts`
   (тест `assemblies` проверит её автоматически).
10. Отличия от `gl2` — в журнал `development-plan.md`, п. 12.

## 4. Таблица инвентаризации

Заполнена 9 октября 2026 (шаг 1). Наборы — из `start.js`; разъёмы: «в» — `internal`,
«н» — `external`, «по side» — сторона резьбы задаётся параметром. Общие для всех:
`sizeRezba`, `crFormSleeve_1`, `getBoundObject_1`, `cr_CenterPoint`, `assignObjParams`.

| Генератор | Файл, строк | Наборов | Разъёмы (число, `joint`, `gender`) | Новое для контракта | Зависимости | Заметки |
| --- | --- | --- | --- | --- | --- | --- |
| `st_zagl_nr` | `st/zaglushka.js`, 76 | 6 (+2 повтора в `rad_fiting_1`) | 1, `thread`, н | — | — | Сплошной шестигранник; `metal_1_edge` объявлен, но не используется |
| `st_pol_sgon_1` | `st/sgon.js`, 105 | 3 | 2, `thread`: гайка в (r1), патрубок н (r2) | — | `metal_1_edge` | Гайка левее начала координат |
| `st_ugol_90_1` | `st/ugol.js`, 224 | 9 (в 6, н 3) | 2 под 90°, `thread`, по side | `up` | `crSphere_2` | Кольцо за резьбой (в) или на ней (н) |
| `st_ugol_45_1` | `st/ugol.js` | 3 | 2 под 45°, `thread`, в | `up` | `crSphere_2` | Наклонное плечо через `pos1` — сдвиг до поворота |
| `st_troinik_1` | `st/troinik.js`, 141 | 15 | 3, `thread`, по side | `up` | конусные втулки | Ширина всех колец — по r1 |
| `st_krestovina_1` | `st/krestovina.js`, 111 | 4 | 4, `thread`, в | `up` | — | |
| `st_collector_1` | `st/collector.js`, 419 | 15 | 2 + N: слева в, справа н, выходы по side | ID `outlet-N` | `getBoundObject_1` (центровка выходов), `metal_1_edge` | Блок в `start.js` выключен (`1==2`), наборы каталожные; выходы — копии мешей |
| `st_collector_2` | `st/collector.js` | 16 | 2 + N, выходы н | Параметр `color` — материал gl2, у нас ключ `red` или `blue` | `BoxGeometry`, `red_1`, `blue_1` | Краны на выходах; блок выключен, как у `st_collector_1` |
| `pl_ugol_45_1` | `pl/ugol.js`, 268 | 6 | 2 под 45°, `pp-socket` | `up` | `crSphere_2` | |
| `pl_ugol_90_rezba_1` | `pl/ugol.js` | 12 (н 6, в 6) | `pp-socket` + `thread` по side | — | `white_1_edge`, `metal_1`, `rezba_1` | Пайка и резьба на одной детали; корпус вставки 12 граней |
| `pl_mufta_1` | `pl/mufta.js`, 212 | 20 | 2, `pp-socket` | — | — | Раструб 0,3 n, не меньше 12 мм |
| `pl_perehod_rezba_1` | `pl/mufta.js` | 12 | `pp-socket` + `thread` по side | — | как у `pl_ugol_90_rezba_1` | |
| `pl_troinik_1` | `pl/troinik.js`, 272 | 6 | 3, `pp-socket` | `up` | — | Отвод m1/2 |
| `pl_troinik_2` | `pl/troinik.js` | 15 | 3, `pp-socket`, разные номиналы | `up` | — | Отвод отсчитывается от стенки: торец на m2 + dc/2 |
| `pl_troinik_rezba_1` | `pl/troinik.js` | 12 | 2 `pp-socket` + `thread` по side | `up` | как у `pl_ugol_90_rezba_1` | |
| `pl_krestovina_1` | `pl/krestovina.js`, 91 | 5 | 4, `pp-socket` | `up` | — | |
| `mpl_ugol_1` | `mpl/ugol.js`, 282 | 5 | 2 под 90°, `mp-press` | `joint: 'mp-press'`, `sizeTubeMP` | `crSphere_2`, `bronz_1`, `red_1` | Гильза 0,9 n, не меньше 25 мм; втулка Ø n/2 |
| `mpl_ugol_rezba_1` | `mpl/ugol.js` | 14 | `mp-press` + `thread` по side | как у `mpl_ugol_1` | `bronz_1_edge`, `rezba_2` | |
| `mpl_perehod_1` | `mpl/perehod.js`, 275 | 11 | 2, `mp-press` | как у `mpl_ugol_1` | — | Ключи `r1`, `r3` — `r2` нет |
| `mpl_perehod_rezba_1` | `mpl/perehod.js` | 20 | `mp-press` + `thread` по side | как у `mpl_ugol_1` | — | Гильза от 20 мм; укорачивается, если до неё меньше 1 мм трубы |
| `mpl_troinik_1` | `mpl/troinik.js`, 389 | 23 | 3, `mp-press` | как у `mpl_ugol_1` | — | |
| `mpl_troinik_rezba_1` | `mpl/troinik.js` | 18 | 2 `mp-press` + `thread` по side | как у `mpl_ugol_1` | — | Резьба отвода 12 мм |
| `rad_vozduhotvod_1` | `radiator/al_radiator.js`, 592 | 1 | 1, `thread`, н | — | `arr_form_1` | `r2`, `m1` не влияют (код под `1==2`); название в gl2 зашито «1/2» |
| `st_radiator_1` | `radiator/st_radiator.js`, 259 | 60 | 4, `thread`, в | — | `PlaneGeometry`, `white_2` | Рёбра — 2 × N мешей; порты обычной резьбой (раздел 6) |
| `shar_kran_v_1` | `kran/shar_kran.js`, 713 | 6 | 2, `thread`, в | — | `shar_kran_babochka_1`, `red_1` | Ручка — часть меша |
| `shar_kran_n_1` | `kran/shar_kran.js` | 6 | 2, `thread`, н | — | то же | |
| `shar_kran_v_n_1` | `kran/shar_kran.js` | 6 | `thread` в + н | — | то же | |
| `shar_kran_sgon_1` | `kran/shar_kran.js` | 4 | `thread` в + н (на сгоне) | — | `shar_kran_obj_sgon_1` | Сгон — r2 на кране, r1 на конце |
| `reg_kran_primoy_1` | `kran/reg_kran.js`, 195 | 4 (2 + 2 с `termoreg`) | `thread` в + н (сгон) | Булев `termoreg` в `cdm` — у нас выбор `head` (`cap`, `termo`) | `shar_kran_obj_sgon_1`, `white_1_edge` | Одна модель, разная головка: колпачок или терморегулятор |

`shar_kran_babochka_1` и `shar_kran_obj_sgon_1` — вспомогательные функции кранов, не позиции
каталога; перенесены в `BallValveParts`. `crRing_2` в переносимых файлах не используется;
`crCircle_2` и `crCild_2` — внутри `SleeveGeometryBuilder`.

Изменения контракта по таблице: `Connector.up` (шаг 2), `joint: 'mp-press'` (раздел 6) —
сделаны. Булев `termoreg` у `reg_kran_primoy_1` выражен выбором `head` — контракт не меняется.
Новые материалы — не контракт, а ключи `MaterialLibrary`: `metalFlat` (`metal_1_edge`),
`plasticGrey` (`white_2`), `bronze`, `bronzeFlat`, `bronzeThread` (`rezba_2`), `red`, `blue`.
Порядок переноса — как в шаге 3, менять не понадобилось.

## 5. Сверка с `gl2`

`gl2` открывается в OpenServer: `http://3d-stroyka/gl2/index.php`. Генераторы —
глобальные функции, вызываются как `window[funcName](cdm)`; модель —
бокс-обёртка, меш генератора — дочерний `Mesh` с массивом материалов,
точки разъёмов — остальные дочерние объекты (`PointObj`).

Headless Chrome по CDP (запускать отдельной командой, останавливать только
по PID своего запуска — `taskkill /IM chrome.exe` закроет браузер пользователя):

```text
chrome.exe --headless=new --remote-debugging-port=9223 --enable-unsafe-swiftshader
  --user-data-dir=<временная папка> about:blank
```

Скрипт выполнения выражения на странице (Node 22+, глобальный `WebSocket`):

```js
// node cdp-eval.mjs <url> <expression>
const [url, expression] = process.argv.slice(2);
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Page.navigate', { url }); await new Promise((r) => setTimeout(r, 6000));
const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(res.result.result?.value ?? res.result.exceptionDetails?.exception?.description));
await fetch(`http://127.0.0.1:9223/json/close/${target.id}`); ws.close();
```

- **gl2:** построить `window[fn](cdm)`, взять меш (`c.isMesh && Array.isArray(c.material)`),
  `new THREE.Box3().expandByObject(mesh)`, `mesh.geometry.faces.length`,
  позиции и `rotation.y` остальных дочерних объектов (старые точки разъёмов).
- **Стенд** (`npx vite --port 5199`): `await import('/src/lib/index.ts')`,
  `new lib.<Класс>(new lib.MaterialLibrary()).build(cdm)`, `model.bounds`,
  `position.count / 3`, `model.connectors`.
- Старая точка разъёма обычно — центр соединительного участка: торец ± `depth`/2.
- `scripts/gl2-compare.mjs` делает это для всех наборов стенда сразу и печатает
  расхождения по генераторам; параметры, которые у нас записаны иначе, чем в `cdm`
  (`color` коллектора, `head` регулировочного крана), он переводит обратно; `--fixture tests/fixtures/gl2-reference.json`
  перезаписывает эталон для теста `gl2Reference` (перезаписывать, только если
  изменился набор или осознанно изменилась модель — и записать причину в журнал).
- `scripts/gl2-snapshot.mjs <cases.json> <out.png>` — снимки рядом по списку моделей.
- Для снимков рядом: в обеих страницах отрендерить модель своим
  `WebGLRenderer` одинаковыми камерами в `toDataURL`, свет — как в каждом проекте;
  фон серый (`0x8a9099`) — белый пластик на белом фоне сливается.
  `three` на стенде импортировать по тому же URL, что загрузила страница
  (`performance.getEntriesByType('resource')`, `/deps/three.js`).

Известные отличия, которые не являются ошибками переноса: освещение и цвет
(стенд — свет редактора, управление цветом Three.js 0.182), вырожденные
треугольники `gl2` в сплошных втулках, `NaN`-отверстия `crCircle_2` при
`radius_vn = 0`, меньше треугольников у сфер и тонких втулок в `gl2` —
примитивы `Geometry` r116 проходят `mergeVertices` с точностью 0,1 мм.

## 6. Решения по семействам

Приняты 9 октября 2026.

- **Металлопластик.** Новый способ соединения `joint: 'mp-press'` — пресс-обжим:
  соединение фитинга с металлопластиковой трубой заданного размера. Номинал —
  размер трубы по `sizeTubeMP` (`'16'`, `'20'`, `'26'`, `'32'`, `'40'`), перенести
  `sizeTubeMP` в `sizes/` по образцу `PpPipeSizes`. Ответная часть — сама труба,
  как у ПП-раструба; фитинги `mpl_*_rezba_1` на другой стороне имеют обычную `thread`.
- **Стальной радиатор** `st_radiator_1`: порты — обычная трубная резьба
  `joint: 'thread'` (в отличие от алюминиевого с `radiator-thread`).
- **Краны.** Ручка — часть геометрии крана, в общем меше; без поворота,
  без параметра «открыт/закрыт».
- **Котельное оборудование** (`kotel/*.js`: котёл, фильтр, группа безопасности,
  бак, насос) — не переносится. GLB-файлы тоже не трогаем.
- **Сборки** `sborka/` — пока не используются и не переносятся. Понадобятся
  позже: для проверки стыков и как примеры для тестирования; тогда же решить,
  данные это (как `stand/assemblies.ts`) или генераторы.

## 7. Открытые вопросы

- **Интерфейс угла стыка на стенде** — сейчас угол задаётся в `stand/assemblies.ts`.
  План работы — [joint-angle-ui-plan.md](joint-angle-ui-plan.md).
