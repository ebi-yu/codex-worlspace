# ADR 0006: 意味を一意に読み取れる命名を優先

- 状態: 採用
- 日付: 2026-09-29

## 背景

`createHost`、`value`、`result`、`axes`のような短い名前は、記述量を減らす一方で、何を生成・保持・返却するのかを呼び出し側から判断できません。特にChrome拡張では、Google DOM、extension message、cache、TypeSafe responseという複数の境界に似た形のデータが存在するため、短い名前が取り違えを招きます。

## 決定

- 名前の短さより、対象と目的を一意に読み取れることを優先する。
- `create`、`build`、`handle`のような広い意味を持つ動詞を単独で使わず、変換元・変換先または処理対象を名前に含める。
- `value`、`data`、`result`、`item`のような汎用名をapplication内部の変数・fieldに使わない。
- 外部contractの`state.result`、HTML form controlの`.value`、Vite configの`output`など、所有していないAPI名は変更しない。
- domain factoryには入力の信頼状態を示す`fromUntrustedInput`または`fromUntrustedIds`を使う。
- 表示用fieldには`displayValue`、`rubricLabel`、`probabilityDistribution`のようにUI上の意味を含める。

## 主な変更例

| 変更前 | 変更後 |
|---|---|
| `createHost` | `createEvaluationAnnotationContainer` |
| `value` | `displayValue` / `searchResultMetadata` |
| `result` | `searchResult` / `evaluationDisplayModel` |
| `axes` | `evaluationAxes` / `axisEvaluations` |
| `buildQuestions` | `convertEvaluationAxesToTypeSafeQuestions` |
| `evaluate` | `requestSearchResultEvaluation` |
| `digest` | `calculateSha256HexDigest` |
| `load` | `loadStoredSettingsIntoForm` |

## 結果

- 呼び出し箇所だけで、引数と返却値の役割を推測しやすくなる。
- 名前は長くなるが、補完と検索によって記述負担を抑えられる。
- reviewでは「短く書けるか」ではなく「別の意味に解釈できないか」を確認する。
- 外部contract由来の汎用名を見つけた場合は、境界で具体的な内部名へ変換してから利用する。
