# Chrome 拡張の技術構成

## 1. 目的と前提

Search Lens の Chrome Manifest V3 実装を、次の条件を満たすように分割します。

- Google 検索本体を壊さず、失敗時は評価 UI だけを停止する。
- ユーザーの JEV トークンをページコンテキストや content script へ渡さない。
- 画面に近い検索結果だけを評価し、API 使用量を抑える。
- 英語と日本語の Google 検索結果に対応する。
- 評価軸のオン・オフを JEV の `questions` へ反映する。
- TypeSafe 固有の API 形式を adapter 内へ閉じ込める。

評価内容と rubric は [評価軸・JEV リクエスト設計](evaluation-design.md)、製品要件は [プロダクト検討メモ](product-plan.md) を参照します。

## 2. 全体構成

// 1. 以下のコード例で構成とデータの流れを確認する。
```text
┌──────────────────────────────────────────────────────────┐
│ Google search tab                                        │
│  content script                                          │
│  ├─ result extractor                                     │
│  ├─ MutationObserver / IntersectionObserver              │
│  ├─ annotation renderer                                  │
│  └─ message client ───────────────────────┐              │
└───────────────────────────────────────────│──────────────┘
                                            │ chrome.runtime
┌───────────────────────────────────────────▼──────────────┐
│ extension service worker                                 │
│  ├─ message router                                       │
│  ├─ evaluation orchestrator                              │
│  ├─ request queue / retry policy                         │
│  ├─ cache repository                                     │
│  └─ TypeSafe adapter ─────────── POST /v1/systemone      │
└──────────────────────────────────────────────────────────┘
                    │ chrome.storage.local
┌───────────────────▼──────────────────────────────────────┐
│ options page                                             │
│  ├─ JEV token input / deletion                           │
│  ├─ evaluation-axis toggles / presets                    │
│  ├─ language and usage limits                            │
│  └─ cache deletion                                       │
└──────────────────────────────────────────────────────────┘
```

## 3. ディレクトリ案

// 2. 以下のコード例で構成とデータの流れを確認する。
```text
extension/
├─ manifest.json
├─ src/
│  ├─ background/
│  │  └─ service-worker.ts
│  ├─ content/
│  │  └─ content-script.ts
│  ├─ domain/
│  │  ├─ search-result.ts
│  │  ├─ evaluation-axes.ts
│  │  ├─ questions.ts
│  │  └─ evaluation.ts
│  ├─ options/
│  │  ├─ options.html
│  │  ├─ options.ts
│  │  └─ options.css
│  └─ infrastructure/
│     └─ typesafe-client.ts
test/
├─ domain/
└─ infrastructure/
```

ソースは TypeScript で記述し、`pnpm build` で `build/extension/` に Chrome が実行する JavaScript と静的ファイルを生成します。型導入と軽量なドメイン境界の理由は [ADR 0002](adr/0002-typescript-build-boundary.md)、pnpm・Vite・Oxcを選んだ理由は [ADR 0003](adr/0003-pnpm-vite-and-oxc-tooling.md) に記録します。DOM fixture と i18n リソースは、その機能を実装する段階で追加します。

## 4. Manifest と権限

最初の manifest は必要最小限にします。

// 3. 以下のコード例で構成とデータの流れを確認する。
```json
{
  "manifest_version": 3,
  "name": "Search Lens",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.google.com/search*",
    "https://api.typesafe.ai/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.google.com/search*"],
      "js": ["src/content/content-script.js"],
      "css": ["content-script.css"]
    }
  ],
  "options_page": "options.html",
  "default_locale": "en"
}
```

### 地域対応

英語圏と日本で実際に使われる Google ホストを fixture 調査後に追加します。最初から `https://*.google.*/*` のような広すぎる権限は要求しません。対応ホストの追加時は、ストア上で権限変更がユーザーへどう通知されるかも確認します。

### 採用しない権限

- `tabs`: 現在の要件では不要。
- `webRequest`: TypeSafe API は通常の `fetch` で呼ぶ。
- `<all_urls>`: 検索結果と TypeSafe API 以外へアクセスしない。
- `scripting`: 静的 content script で足りる間は要求しない。

## 5. コンポーネントの責務

### 5.1 Content script

担当すること：

- 検索クエリと通常のオーガニック検索結果を抽出する。
- DOM の追加を監視し、新しい結果を登録する。
- viewport に近づいた結果の評価を service worker へ依頼する。
- 返された表示用データから Shadow DOM 内に注釈を描画する。
- ページ遷移、結果削除、重複 URL に追従する。

担当しないこと：

- JEV トークンの読み取りや保持。
- TypeSafe API への直接通信。
- API レスポンス形式の解釈。
- Google の検索順位変更。

### 5.2 Service worker

- content script からのメッセージを検証する。
- 最新設定とトークンを `chrome.storage.local` から読む。
- キャッシュを確認し、必要な評価だけキューへ入れる。
- TypeSafe adapter を通じて 1 結果ずつ評価する。
- `401`、`422`、`429`、`529` を分類する。
- ページへ返す前に API レスポンスを表示用 DTO へ変換する。

service worker は停止・再起動される前提にします。正しさに必要な状態をメモリだけへ置かず、設定と完了済みキャッシュは storage に保存します。進行中リクエストは再起動後に消えてよく、content script からの再要求を重複排除します。

### 5.3 Options page

- password 型フィールドから JEV トークンを登録・削除する。
- トークン自体を再表示せず、登録済みかだけを示す。
- 評価軸のトグルとプリセットを保存する。
- 1 セッションあたりの評価上限、キャッシュ TTL、表示言語を設定する。
- キャッシュと設定を個別に削除する。
- TypeSafe へ送るデータを保存前に説明する。

## 6. 検索結果の抽出

Google の class 名へ強く依存せず、検索結果候補から次を段階的に検証します。

1. `href` を持つ主リンクがある。
2. 見出し相当の要素と空でないタイトルがある。
3. Google 内部ナビゲーション、広告、動画カルーセル等の除外条件に一致しない。
4. URL を正規化後、同じページ内ですでに登録されていない。

抽出結果は次の最小形へ正規化します。

// 4. 以下のコード例で構成とデータの流れを確認する。
```ts
type SearchResultCandidate = {
  resultId: string;
  query: string;
  url: string;
  title: string;
  snippet?: string;
  locale: "en" | "ja";
};
```

### DOM 変更への耐性

- selector 群を `extract-results.ts` の一箇所へ集約する。
- 英語、日本語、desktop の HTML fixture を保存する。
- 一つの selector が失敗してもページ全体で例外を投げない。
- 抽出率が急に低下しても、Google の UI を隠したり移動したりしない。
- 検索結果コンテナへ `data-search-lens-result-id` を付け、二重描画を防ぐ。

## 7. スクロールとライフサイクル

// 5. 以下のコード例で構成とデータの流れを確認する。
```text
DOM result discovered
  → normalized and deduplicated
  → observed by IntersectionObserver
  → near viewport
  → request sent to service worker
  → cache hit OR queued API call
  → annotation rendered if resultId still matches
```

1. `MutationObserver` は追加ノードを 300〜500 ms の範囲でまとめて抽出する。
2. `IntersectionObserver` の `rootMargin` は初期値を `150% 0px` とし、表示前に評価を開始する。
3. content script は `query + normalizedUrl + enabledAxes` が同じ要求を送信中リストで重複排除する。
4. SPA 形式のページ遷移を検出したら observer と送信中リストを作り直す。
5. 非表示・削除済みの結果へレスポンスが戻っても描画しない。

observer の callback 内では DOM 抽出とキュー登録だけを行い、API 通信や重い描画は実行しません。

## 8. メッセージ境界

メッセージは discriminated union とし、受信側で必ず検証します。

// 6. 以下のコード例で構成とデータの流れを確認する。
```ts
type ContentToBackgroundMessage =
  | {
      type: "EVALUATE_RESULT";
      requestId: string;
      payload: SearchResultCandidate;
    }
  | { type: "GET_EXTENSION_STATE" };

type BackgroundToContentMessage =
  | {
      type: "EVALUATION_COMPLETE";
      requestId: string;
      payload: EvaluationViewModel;
    }
  | {
      type: "EVALUATION_UNAVAILABLE";
      requestId: string;
      reason: "not_configured" | "disabled" | "rate_limited" | "temporary_error";
    };
```

API キー、Authorization header、生の TypeSafe レスポンスはメッセージ型へ含めません。

## 9. 評価オーケストレーター

1. 機能が有効で、少なくとも一つの評価軸がオンか確認する。
2. URL、クエリ、locale、有効軸を正規化する。
3. キャッシュキーを作り、fresh な結果があれば即時返却する。
4. 同じキーの処理中 Promise があれば新規通信せず、その完了を共有する。
5. キューへ追加し、TypeSafe adapter を呼ぶ。
6. レスポンスを検証して `EvaluationViewModel` へ変換する。
7. キャッシュへ保存し、要求元へ返す。

// 7. 以下のコード例で構成とデータの流れを確認する。
```ts
type EvaluationViewModel = {
  normalizedUrl: string;
  evaluatedAt: string;
  axes: Array<{
    id: string;
    labelKey: string;
    value: number | string;
    confidence?: number;
    distribution?: Record<string, number>;
    status: "evaluated" | "unknown";
  }>;
};
```

## 10. キュー、上限、再試行

初期値は実測前の安全側の設定とし、コード内の定数ではなく設定オブジェクトへまとめます。

| 項目 | 初期案 |
|---|---:|
| 同時 API リクエスト | 2 |
| 1 ページの最大評価数 | 20 |
| 1 セッションの最大評価数 | 100 |
| 通常タイムアウト | 15 秒 |
| 最大再試行回数 | 3 |
| backoff | 1 秒、2 秒、4 秒 + jitter |

- `401`: 再試行せずトークンを要確認状態にする。
- `422`: 再試行せず adapter エラーとして扱う。
- `429`: `Retry-After` があれば尊重し、なければ指数バックオフする。
- `529`: 指数バックオフし、最大回数を超えたら一時エラーを返す。
- timeout / network error: 1 回だけ再試行し、検索ページはそのまま利用可能にする。

## 11. TypeSafe adapter

adapter の公開境界は TypeSafe の wire format を漏らさない形にします。

// 8. 以下のコード例で構成とデータの流れを確認する。
```ts
interface EvaluationProvider {
  evaluate(
    input: SearchResultCandidate,
    settings: EvaluationSettings,
    signal: AbortSignal,
  ): Promise<ProviderEvaluation>;
}
```

adapter 内で行うこと：

- 有効な軸から `questions` を構築する。
- `model: "jev-latest"` を含む request body を作る。
- `Authorization: Bearer <token>` を設定する。
- `fetch("https://api.typesafe.ai/v1/systemone")` を実行する。
- status と JSON body を検証する。
- `score`、`choice`、`noul` を内部型へ変換する。
- token usage を検索内容と分離したセッション集計へ加える。

## 12. Storage 設計

`chrome.storage.local` のキーを用途別に分けます。

// 9. 以下のコード例で構成とデータの流れを確認する。
```ts
type StoredSettings = {
  schemaVersion: 1;
  enabled: boolean;
  locale: "auto" | "en" | "ja";
  enabledAxes: string[];
  preset: "simple" | "learning" | "research" | "custom";
  cacheTtlMinutes: number;
  perSessionLimit: number;
};

type StoredSecrets = {
  jevApiKey?: string;
};
```

推奨キー：

- `settings`: 非機密のユーザー設定。
- `secrets`: JEV トークン。content script からは読み出さない。
- `evaluationCache`: サイズ上限付きの評価キャッシュ。
- `usageSession`: セッション単位の件数・token usage。

`chrome.storage.local` は暗号化された秘密保管庫ではありません。options page でその点を説明し、トークン削除を常に可能にします。ログ、キャッシュキー、エクスポート対象へトークンを含めません。

service worker の初期化時に storage の access level を trusted context へ制限し、content script から `chrome.storage.local` を直接読めないようにします。

// 10. 以下のコード例で構成とデータの流れを確認する。
```ts
await chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS",
});
```

content script が必要とする非機密設定は、検証済みの `GET_EXTENSION_STATE` メッセージへ service worker が必要最小限だけ返します。

## 13. キャッシュ

キャッシュキー：

// 11. 以下のコード例で構成とデータの流れを確認する。
```text
sha256(query + normalizedUrl + locale + axisSetVersion + sortedEnabledAxisIds)
```

各エントリに `createdAt`、`expiresAt`、`providerModel`、表示用評価だけを保存します。生の request、Authorization header、生の API response は保存しません。

TTL の初期案：

- 通常軸: 24 時間。
- `freshness` を含む場合: 6 時間。
- `401`、`422`、一時エラー: キャッシュしない。

保存容量の上限を超えたら期限切れを先に削除し、その後 oldest-accessed entry を削除します。

## 14. UI の隔離とアクセシビリティ

- 注釈 UI は Shadow DOM に置き、Google の CSS と衝突させない。
- Google 側コンテナの幅や順位を変更せず、結果末尾へ追加する。
- スコアだけを色で表さず、テキストと数値を併記する。
- トグル、詳細開閉、再試行をキーボード操作可能にする。
- `aria-expanded`、`aria-live="polite"`、十分なコントラストを使う。
- motion を使う場合は `prefers-reduced-motion` を尊重する。
- API 待機中にレイアウトが大きく動かない固定最小領域を使う。

## 15. i18n

Chrome i18n の message key を表示 DTO の `labelKey` から参照します。API とキャッシュでは `official`、`introductory` などの安定した英語 ID を使い、表示時だけ翻訳します。

次を日本語・英語で用意します。

- options page の全ラベルと説明。
- 軸名、rubric、確信度、エラー表示。
- トークン登録と送信データの同意説明。
- スクリーンリーダー向けラベル。

未知の UI 言語では英語へ fallback します。検索クエリとスニペットは翻訳せず、そのまま TypeSafe へ送ります。

## 16. セキュリティ境界

### 必須

- token を DOM、data attribute、content script message、URL、ログへ出さない。
- `chrome.storage.local` の access level を `TRUSTED_CONTEXTS` にし、content script からの直接アクセスを防ぐ。
- page script からの `window.postMessage` を制御メッセージとして信用しない。
- content script から来る URL、文字列長、軸 ID を検証する。
- TypeSafe のレスポンス文字列を `innerHTML` へ渡さず、`textContent` で描画する。
- 外部画像、外部 script、eval、動的 code download を使わない。
- API エラー本文をそのままユーザーやログへ出さない。

### 脅威モデル上の限界

- 同じ Chrome profile へアクセスできるローカルユーザーや悪意ある拡張から、`chrome.storage.local` の秘密を完全には保護できない。
- 検索語、URL、タイトル、スニペットは TypeSafe へ送信される。
- この拡張はサイトの安全性、正確性、年齢適合性を保証しない。

## 17. テスト戦略

### Unit

- URL 正規化と tracking parameter 除去。
- 軸トグルからの `questions` 生成。
- `score` / `choice` / `noul` の response parser。
- キャッシュキー、TTL、eviction。
- retry と jitter の境界。
- 日英ラベルの完全性。

### DOM fixture

- Google 検索の英語・日本語 HTML。
- スニペットなし、重複 URL、リッチ結果、広告に近い構造。
- 追加読み込みと SPA 遷移。
- selector が一部欠けた壊れた fixture。

### Integration

- content script → service worker → mocked TypeSafe API → 注釈描画。
- 401 で設定導線が出て検索結果は残る。
- 429 / 529 で backoff し、同一要求を二重送信しない。
- トグル変更後に `questions` とキャッシュキーが変わる。
- service worker 再起動後にキャッシュを再利用する。

### Manual / browser

- Chrome へ unpacked extension として読み込む。
- 英語・日本語の実検索でスクロールと追加読み込みを確認する。
- DevTools で token が DOM、message、ログへ出ないことを確認する。
- キーボードとスクリーンリーダーで設定と注釈を操作する。

## 18. 実装順序

1. Manifest、options page、トークン保存・削除。
2. 保存済み HTML fixture を使う検索結果 extractor。
3. content script と service worker の型付きメッセージ。
4. mocked adapter による注釈 UI。
5. 軸トグル、question builder、キャッシュキー。
6. TypeSafe HTTP adapter とエラー処理。
7. キュー、上限、retry、usage 表示。
8. 日英 i18n、アクセシビリティ、ブラウザー統合テスト。
9. 実検索での限定的な検証後、対応 Google ホストを追加。

最初の縦切りでは「設定でトークンを保存 → 1 件の検索結果を抽出 → mocked evaluation を表示」までを作ります。TypeSafe 通信より前に DOM 抽出、メッセージ境界、UI 隔離を検証することで、外部 API と Google DOM の問題を切り分けられます。
