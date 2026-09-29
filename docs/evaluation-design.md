# 評価軸・JEV リクエスト設計

## 1. 目的

Search Lens はサイトへ恒久的な点数を付けるのではなく、現在の検索クエリに対して、検索結果のタイトル、URL、スニペットから読み取れる範囲を評価します。

評価軸は Chrome 拡張の設定画面で個別にオン・オフできるようにします。製品の中心となる `usefulness`（今回の検索への有用度）も含めて切り替え可能にし、少なくとも一つの軸がオンになるようにします。

## 2. 推奨する初期構成

| 軸 ID | 表示名 | 初期値 | TypeSafe 型 | 役割 |
|---|---|---:|---|---|
| `usefulness` | 推定有用度 | オン | `score` | 今回の検索へどれくらい役立ちそうか |
| `prerequisite_level` | 必要な前提知識 | オン | `choice` | 入門、基礎、実務、中上級、専門家向けを推定する |
| `source_type` | 情報源の種類 | オン | `choice` | 公式、解説、コミュニティ、商用などを区別する |
| `primary_source` | 一次情報性 | オフ | `noul` | 公式文書や原典である可能性 |
| `specificity` | 具体性 | オフ | `score` | 手順、例、数値などが期待できる度合い |
| `freshness` | 新しさ | オフ | `score` | 日付情報がある場合だけ鮮度を評価する |
| `transparency` | 透明性 | オフ | `score` | 著者、出典、利害関係が明示されていそうか |
| `audience` | 想定読者 | オフ | `choice` | 子ども、一般、学生、実務家、専門家などの対象を推定する |
| `reading_effort` | 読む負担 | オフ | `choice` | 短い回答、標準的な記事、詳細資料などを推定する |
| `commercial_intent` | 商用性 | オフ | `score` | 購入・登録への誘導が中心である可能性 |

初期オンを増やしすぎない理由は、表示の複雑さと API の入力・出力 token usage を抑えるためです。設定画面には各軸が追加の評価コストを生むことを表示します。

## 3. 「対象年齢」の扱い

対象年齢は面白い軸ですが、検索結果メタデータだけから `12 歳向け` のような数値を断定するのは避けます。

- 年齢そのものより、必要な知識を表す `prerequisite_level` を優先する。
- 任意軸として `audience` を提供し、`children`、`general`、`student`、`practitioner`、`expert`、`unknown` から選ぶ。
- 年齢制限や安全性を保証する表示には使わない。
- スニペットに明示的な対象読者の記載がない場合は `unknown` を選べる rubric にする。
- 医療、金融、成人向けなどのセンシティブ分類とは分離する。

これにより、「初心者の自分でも読めそうか」という実用的な判断材料を出しつつ、年齢に関する過剰な推定を抑えます。

## 4. 軸ごとの rubric

### `usefulness` — 初期オン

// 1. 以下のコード例で構成とデータの流れを確認する。
```json
{
  "type": "score",
  "instructions": "How useful is `result` for answering `query`, based only on the supplied search-result metadata?",
  "criteria": [
    "Unlikely to help",
    "May contain a small amount of relevant information",
    "Relevant but incomplete",
    "Likely useful",
    "Highly likely to directly answer the query"
  ]
}
```

### `prerequisite_level` — 初期オンの面白軸

// 2. 以下のコード例で構成とデータの流れを確認する。
```json
{
  "type": "choice",
  "instructions": "What level of prior knowledge would a reader likely need to use `result`? Choose unknown when the metadata is insufficient.",
  "criteria": {
    "introductory": "No prior knowledge is expected",
    "basic": "Basic vocabulary or concepts are expected",
    "practical": "Some hands-on experience is expected",
    "advanced": "Strong domain knowledge is expected",
    "expert": "Specialist or research-level knowledge is expected",
    "unknown": "The required prior knowledge cannot be inferred"
  }
}
```

### `source_type` — 初期オン

// 3. 以下のコード例で構成とデータの流れを確認する。
```json
{
  "type": "choice",
  "instructions": "What kind of source does `result` appear to be?",
  "criteria": {
    "official": "Official documentation or a primary source",
    "editorial": "An article or explanatory secondary source",
    "community": "A forum, Q&A, or community discussion",
    "academic": "A research paper or scholarly publication",
    "commercial": "A commercial or transactional page",
    "unknown": "There is not enough evidence in the metadata"
  }
}
```

### オプション軸

| 軸 ID | 質問の要点 | rubric |
|---|---|---|
| `primary_source` | 結果は公式文書、原典、当事者による情報か | `noul` の yes/no。組織の知名度だけで判断しない |
| `specificity` | 手順、例、数値、参照先を含む具体的な回答が期待できるか | `score`: 抽象的 → 非常に具体的 |
| `freshness` | クエリに必要な鮮度を満たしそうか | `score`: 古い可能性 → 新しい可能性。日付不明なら未評価 |
| `transparency` | 著者、出典、広告・利害関係が明示されていそうか | `score`: 判断不能 → 十分に透明 |
| `audience` | 想定読者は誰か | `choice`: children / general / student / practitioner / expert / unknown |
| `reading_effort` | 読了・理解に必要な負担はどの程度か | `choice`: quick / standard / in_depth / reference / unknown |
| `commercial_intent` | 情報提供より購入・登録への誘導が中心か | `score`: 情報中心 → 強い商用意図 |

タイトル、URL、スニペットに判断材料がない軸は、低スコアではなく `unknown` または UI 上の `未評価` にします。特に新しさ、透明性、安全性をメタデータだけで断定しません。

## 5. トグル UI

設定画面に「評価軸」セクションを置きます。

// 4. 以下のコード例で構成とデータの流れを確認する。
```text
評価軸
  推定有用度       ON
  必要な前提知識   ON
  情報源の種類     ON
  一次情報性       OFF
  具体性           OFF
  新しさ           OFF
  透明性           OFF
  想定読者         OFF
  読む負担         OFF
  商用性           OFF
```

- トグル変更は `chrome.storage.local` の `evaluationAxes` に保存する。
- 最後の一つをオフにしようとした場合は、評価機能全体を停止するか確認する。
- 新しい設定は次の未評価結果から適用し、進行中のリクエストは中断しない。
- キャッシュキーへ `axisSetVersion` と有効な軸 ID のソート済み一覧を含める。
- 軸をオフにしたら、その軸を TypeSafe の `questions` から除外する。非表示にするだけの設計にはしない。
- すべてを一括で開閉するプリセットとして `シンプル`、`学習向け`、`調査向け` を用意する。

### プリセット

| プリセット | 有効な軸 |
|---|---|
| シンプル | `usefulness`, `source_type` |
| 学習向け | `usefulness`, `prerequisite_level`, `source_type` |
| 調査向け | `usefulness`, `source_type`, `primary_source`, `specificity`, `freshness`, `transparency` |

プリセット適用後も個別トグルを変更できます。変更後は `カスタム` と表示します。

## 6. JEV リクエストの組み立て

### 入力 state

// 5. 以下のコード例で構成とデータの流れを確認する。
```json
{
  "query": "chrome extension manifest v3 service worker",
  "result": {
    "title": "Example result",
    "url": "https://example.com/page",
    "snippet": "Example search snippet"
  }
}
```

### questions の動的生成

// 6. 以下のコード例で構成とデータの流れを確認する。
```ts
const questionFactories = {
  usefulness: () => ({
    type: "score",
    instructions:
      "How useful is `result` for answering `query`, based only on the supplied search-result metadata?",
    criteria: [
      "Unlikely to help",
      "May contain a small amount of relevant information",
      "Relevant but incomplete",
      "Likely useful",
      "Highly likely to directly answer the query",
    ],
  }),
  prerequisite_level: () => ({
    type: "choice",
    instructions:
      "What level of prior knowledge would a reader likely need to use `result`?",
    criteria: {
      introductory: "No prior knowledge is expected",
      basic: "Basic vocabulary or concepts are expected",
      practical: "Some hands-on experience is expected",
      advanced: "Strong domain knowledge is expected",
      expert: "Specialist or research-level knowledge is expected",
      unknown: "The required prior knowledge cannot be inferred",
    },
  }),
  source_type: () => ({
    type: "choice",
    instructions: "What kind of source does `result` appear to be?",
    criteria: {
      official: "Official documentation or a primary source",
      editorial: "An article or explanatory secondary source",
      community: "A forum, Q&A, or community discussion",
      academic: "A research paper or scholarly publication",
      commercial: "A commercial or transactional page",
      unknown: "There is not enough evidence in the metadata",
    },
  }),
} as const;

const enabledAxes = ["usefulness", "prerequisite_level", "source_type"] as const;
const questions = Object.fromEntries(
  enabledAxes.map((axis) => [axis, questionFactories[axis]()]),
);
```

上記は question の組み立て方を示します。有効な軸だけが `questions` に入るため、オフにした軸の評価と token usage は発生しません。

### HTTP リクエスト

// 7. 以下のコード例で構成とデータの流れを確認する。
```ts
const response = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    state,
    model: "jev-latest",
    questions,
  }),
});
```

トークンは service worker 内で `chrome.storage.local` から読み出し、`apiKey` を content script へ返しません。

## 7. レスポンスから UI への変換

| TypeSafe 回答 | UI 表示 |
|---|---|
| `score.score` | rubric の最小・最大で 0〜100 に正規化 |
| `score.legend` | 該当 rubric の説明 |
| `score.probabilities` | 詳細パネルの分布 |
| `score.confidence` | 数値と `低 / 中 / 高` の補助表示 |
| `choice.choice` | 翻訳済みのラベル |
| `choice.probabilities` | 詳細パネルの候補分布 |
| `choice.confidence` | 数値と `低 / 中 / 高` の補助表示 |
| `noul.noul` | `はい` の推定確率。事実の保証とは表示しない |

固定の choice key と rubric は英語のまま API とキャッシュで使用し、表示時だけ Chrome i18n の日本語・英語メッセージへ変換します。これにより言語を切り替えてもキャッシュを共有できます。

## 8. キャッシュとバージョン

// 8. 以下のコード例で構成とデータの流れを確認する。
```text
sha256(query + normalizedUrl + locale + axisSetVersion + sortedEnabledAxisIds)
```

- rubric を変更したら `axisSetVersion` を上げる。
- 軸の追加・削除時に、異なる質問構成のレスポンスを混ぜない。
- キャッシュには API キーを含めない。
- 同じ結果でも検索クエリが違えば `usefulness` が変わるため、query を必ず含める。
- `freshness` を使う場合は、長い TTL で古い評価を残さない。

## 9. 検証すること

1. 日英それぞれ最低 30 クエリで、同じ rubric が一貫して解釈されるか。
2. `prerequisite_level` がタイトルとスニペットだけで有用な判定になるか。
3. `unknown` が必要な場面で選ばれ、無理な推定を抑えられるか。
4. 軸数による token usage、待ち時間、レート制限への影響。
5. トグル変更後に古いキャッシュの軸が混在しないか。
6. 推定結果が年齢、専門性、サイト規模への不当なラベル付けになっていないか。
