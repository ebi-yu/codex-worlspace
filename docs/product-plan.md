# Google 検索支援 Chrome 拡張：プロダクト検討メモ

## 1. 解く課題

検索順位が高いページが、ユーザーの目的に最も役立つとは限りません。SEO 記事、古い記事、一次情報、比較記事などが混在するため、リンクを開いて戻る操作が増えます。

この拡張の役割は「Google より正しい順位を決めること」ではなく、**ユーザーが自分で開く結果を短時間で判断できる材料を添えること**です。

## 2. 推奨する体験

### 検索結果ページ

- ページをスクロールし、新しい検索結果が DOM に追加された時点で順次評価する。
- 各結果の横に `推定有用度 78/100`、確信度、該当 rubric を表示する。
- 初期状態では Google の順位を変更しない。
- バッジを開くと評価軸の内訳を表示する。
- 「この評価は違う」でフィードバックできるようにする。

表示例：

// 1. 以下のコード例で構成とデータの流れを確認する。
```text
推定有用度 78/100  確信度: 0.81（中）
一次情報 ●●●○○ / 具体性 ●●●●○ / 新しさ ●●○○○
判定: 「役立つ可能性が高い」 / 種別: 「公式・一次情報」
```

「よいサイト」という曖昧なラベルではなく、**今回の検索意図に役立つ可能性**と表現します。同じサイトでも、検索目的によって評価が変わるためです。

## 3. 評価軸

最初から万能スコアを作らず、複数の軸を個別に扱います。軸の定義、表示、JEV の question 構成、設定トグルの仕様は [評価軸・JEV リクエスト設計](evaluation-design.md) に分離します。

| 軸 | 見るもの | 注意点 |
|---|---|---|
| 検索意図との一致 | クエリ、タイトル、スニペットの対応 | クエリ送信には明示的な同意が必要 |
| 一次情報性 | 公式文書、原典、著者・運営者 | 大手サイトを過大評価しない |
| 具体性 | 手順、数値、例、参照元 | 長文であるだけでは加点しない |
| 新しさ | 公開日・更新日 | 歴史資料など鮮度不要の意図もある |
| 透明性 | 著者、根拠、広告・利害関係 | 未取得を低評価と混同しない |
| 安全性 | HTTPS、疑わしい誘導など | 「安全保証」とは表示しない |

総合値を出す場合は、検索意図別に重みを変えます。たとえばエラー解決では一次情報性と具体性を重くし、ニュースでは新しさと情報源を重くします。

MVP では `usefulness`（今回の検索への有用度）と `prerequisite_level`（必要な前提知識）を初期オンにします。「対象年齢」はページ情報だけでは断定しにくく、年齢による不適切な決めつけにもつながるため、初期版では `audience`（想定読者）と `prerequisite_level` に分け、どちらも推定であることを表示します。すべての軸は設定画面で個別にオン・オフできます。

### スコアの扱い

- `%` は事実の確率ではなくモデル推定なので、「推定」と明記する。
- スコアと別に `高 / 中 / 低` の確信度を出す。
- 情報不足はゼロ点ではなく `未評価` にする。
- ドメイン単位の固定ブラックリスト／ホワイトリストから始めない。
- 該当 rubric と確率分布を必ず表示し、ユーザーが判定を検証できるようにする。

## 4. MVP の範囲

### 含める

1. 拡張の設定画面で、ユーザー自身の JEV トークンを登録・削除する（BYOK）。
2. `google.com/search` の検索結果を検出する。
3. 画面内に近づいた未評価の結果をキューへ入れ、同時実行数を制限して 1 件ずつ評価する。
4. バッジ、rubric の内訳、確率分布、確信度を表示する。
5. 同一クエリ・URL の評価を短期間キャッシュする。
6. API エラー時は検索を邪魔せず、評価欄だけを非表示または再試行可能にする。

### 後回し

- Google の検索結果そのものの並べ替え
- 自動でリンク先の全文を取得する機能
- ユーザー間の公開ランキング
- 恒久的な「よい／悪いサイト」認定
- 広告ブロックやマルウェア判定の代替

## 5. 技術構成案

Chrome Manifest V3 を前提としたコンポーネント、権限、メッセージ、スクロール検出、キュー、キャッシュ、セキュリティ、テスト方針は [Chrome 拡張の技術構成](technical-architecture.md) に分離します。

中核となる境界は次の三つです。

1. content script は Google 検索結果の抽出と UI 描画だけを担当し、JEV トークンを受け取らない。
2. service worker は TypeSafe API、キュー、再試行、キャッシュを担当する。
3. options page はトークン、評価軸、言語、利用上限の設定を担当する。

## 6. トークンとプライバシー

JEV トークンは運営側で発行・販売せず、ユーザー自身が用意する BYOK 方式にします。次を最低条件とします。

- 設定画面の password 型入力からのみ受け取る。
- トークンを DOM、URL、例外メッセージ、分析ログへ書かない。
- `chrome.storage.sync` は避け、端末ローカル保存を基本にする。
- 権限は Google 検索ページと API の接続先だけに限定する。
- 送信対象（検索語、結果 URL、スニペット等）を保存前に説明し、機能を明示的に有効化してもらう。
- 削除ボタンと、キャッシュ／履歴を消す導線を用意する。

ただし `chrome.storage.local` は秘密保管庫ではありません。脅威モデル上より強い保護が必要なら、短命トークンを発行する中継バックエンドや OS 側の認証を検討します。自前バックエンドで恒久トークンを預かる設計は、運用責任が大きいため MVP では避けます。

## 7. JEV / TypeSafe AI API の採用方針と API 境界

### 基準資料

- [TypeSafe AI: Introduction](https://docs.typesafe.ai/introduction)
- [TypeSafe AI: SDK](https://docs.typesafe.ai/sdk)
- [TypeSafe AI: documentation index](https://docs.typesafe.ai/llms.txt)
- [TypeSafe AI: JavaScript SDK source (v0.6.0)](https://github.com/typesafe-ai/typesafe-sdk-js/tree/v0.6.0)

JEV は TypeSafe AI の評価モデルです。評価 API は `POST https://api.typesafe.ai/v1/systemone`、認証は `Authorization: Bearer <API_KEY>`、モデルには安定した別名 `jev-latest` を使います。

JavaScript SDK `@typesafe-ai/sdk` は Node.js 20 以降を要件としているため、Chrome Manifest V3 でそのまま動くとはみなしません。MVP は service worker から HTTP API を直接呼び、TypeSafe 固有の request / response は adapter に閉じ込めます。これにより Node.js polyfill を拡張へ追加せず、SDK や API の変更も検索結果の抽出・表示部分へ波及させません。

### TypeSafe のプリミティブと用途

| プリミティブ | API の返却値 | この拡張での用途 |
|---|---|---|
| `noul` | yes の確率（0〜1） | 一次情報か、検索意図に合うかなどの二値に近い軸 |
| `choice` | 選択肢、全選択肢の確率分布、確信度 | ページ種別（公式、解説、比較、フォーラム等） |
| `score` | レベル間の加重スコア、確率分布、確信度 | 総合的な有用度、具体性、新しさなどの段階評価 |

`choice` と `score` が返す `confidence` は 0〜1 の値なので、UI の確信度へ利用できます。一方、API の構造化回答には自由記述の「理由」が自動で含まれるわけではありません。MVP の根拠欄には、質問で定義した rubric の該当レベルと確率分布を表示し、モデルが返していない説明文を生成・捏造しません。

### リクエスト設計

1 件の検索結果を次のような構造化 `state` として渡し、複数の評価軸を `questions` にまとめます。

// 2. 以下のコード例で構成とデータの流れを確認する。
```json
{
  "state": {
    "query": "chrome extension manifest v3 service worker",
    "result": {
      "title": "Example result",
      "url": "https://example.com/page",
      "snippet": "Example search snippet"
    }
  },
  "model": "jev-latest",
  "questions": {
    "usefulness": {
      "type": "score",
      "instructions": "How useful is `result` for answering `query`, based only on the supplied search-result metadata?",
      "criteria": [
        "Unlikely to help",
        "May contain a small amount of relevant information",
        "Relevant but incomplete",
        "Likely useful",
        "Highly likely to directly answer the query"
      ]
    },
    "source_type": {
      "type": "choice",
      "instructions": "What kind of source does `result` appear to be?",
      "criteria": {
        "official": "Official documentation or a primary source",
        "editorial": "An article or explanatory secondary source",
        "community": "A forum, Q&A, or community discussion",
        "commercial": "A commercial or transactional page",
        "unknown": "There is not enough evidence in the metadata"
      }
    }
  }
}
```

日英で別々の question を作らず、入力言語を保持したまま同じ rubric の意味を使います。日本語表示では rubric の固定 UI 文言だけを翻訳します。日英の出力傾向に差が出る場合は、検証データを基に criteria を調整します。

検索結果を複数件まとめた `state` は、他結果との比較によってスコアが変わる恐れがあります。MVP では 1 結果を 1 評価単位にしてキャッシュし、通信の同時実行数だけを制限します。

### HTTP とエラー処理

| ステータス | 扱い |
|---|---|
| `401` | トークンが無効または不足。再試行せず、設定画面への導線を表示する |
| `422` | adapter のリクエスト不備。ユーザーには一般エラーを表示し、トークンや検索語を除いて診断情報を残す |
| `429` | レート上限。指数バックオフし、その間の新規評価をキューに留める |
| `529` | TypeSafe 側の過負荷。指数バックオフし、既存の検索表示は妨げない |

SDK には既定の再試行処理がありますが、HTTP を直接使う MVP では `429` と `529` の指数バックオフを adapter に実装します。`usage.input_tokens` と `usage.output_tokens` はトークン値や検索内容と結び付けず、端末内でセッション合計だけを表示できます。

### 拡張内部の型

// 3. 以下のコード例で構成とデータの流れを確認する。
```ts
type EvaluationRequest = {
  query: string;
  result: { url: string; title: string; snippet?: string };
};

type Evaluation = {
  url: string;
  usefulness: {
    score: number;
    confidence: number;
    probabilities: Record<string, number>;
    legend: Record<string, string>;
  };
  sourceType: {
    choice: "official" | "editorial" | "community" | "commercial" | "unknown";
    confidence: number;
    probabilities: Record<string, number>;
  };
  dimensions: {
    relevance?: { noul: number };
    primarySource?: { noul: number };
    specificity?: { score: number; confidence: number };
    freshness?: { score: number; confidence: number };
    transparency?: { score: number; confidence: number };
  };
  usage: { inputTokens: number; outputTokens: number };
};
```

表示用の `0〜100` は、TypeSafe の生の `score` を rubric の最小・最大レベルで正規化して adapter が算出します。確信度は API の 0〜1 を低・中・高へ丸めて隠さず、数値も詳細欄に残します。データ保持は adapter では制御できないため、TypeSafe AI 側の条件を設定画面でユーザーへ明示します。

## 8. 検証計画

### 先に確かめる仮説

| 仮説 | 方法 | 成功の目安 |
|---|---|---|
| 内訳がリンク選択に役立つ | 5〜8 人の操作テスト | 多くの参加者が rubric と確率分布を使って選べる |
| 表示が検索の邪魔にならない | バッジ有無の比較 | 誤クリックやレイアウト崩れが増えない |
| スコアを信じすぎない | 誤評価を混ぜたテスト | rubric・確信度を見て判断を修正できる |
| 待ち時間が許容される | 実ページで計測 | 画面内の評価が体感を阻害しない |

主要指標はクリック率ではなく、次を使います。

- 目的の情報に到達するまでの時間
- 開いてすぐ戻る回数
- 評価への納得度
- 誤評価の報告率
- 1 検索あたりの API 呼び出し数とコスト

## 9. リスク

- **Google DOM の変更:** 抽出処理を分離し、壊れても検索本体を妨げない。
- **過度な権威付け:** 「品質」「真実」ではなく、推定された有用性、rubric、確率分布を示す。
- **バイアス:** 大手、英語圏、長文を自動的に優遇していないか評価セットで確認する。
- **プライバシー:** 検索語は機微情報になり得る。送信前説明、最小化、保持期間を明確にする。
- **API コスト:** 遅延評価、キャッシュ、同時実行数とセッション上限を使う。
- **利用規約:** Google 検索ページへの挿入、リンク先取得、JEV へのデータ送信について各規約を実装前に確認する。

## 10. 決定事項と残る確認

### 決定事項

| 論点 | 決定 |
|---|---|
| JEV 連携 | TypeSafe AI の HTTP API を service worker から直接呼ぶ |
| トークン | ユーザーが自分の JEV トークンを入力する BYOK 方式 |
| 収益・無料枠 | トークンをこちらで用意しないため、MVP の収益化・無料枠は設けない |
| 対象地域 | 英語圏と日本 |
| 対応言語 | 英語と日本語。UI 文言、rubric、検索結果抽出 fixture を両言語で用意する |
| 評価材料 | MVP はタイトル、URL、スニペットまで。リンク先本文は取得しない |
| 表示 | 元順位を維持し、推定有用度、確信度、rubric と確率分布を注釈する |

### 実装スパイクで確認すること

1. `https://api.typesafe.ai/*` の host permission と拡張 CSP で service worker から API を呼べるか。
2. TypeSafe AI における入力データの保存期間、学習利用、削除方法。
3. 英語と日本語で同じ rubric を使えるか、言語別の校正が必要か。
4. 1 結果 1 リクエストの遅延と token usage が許容範囲か。
5. `google.com`、地域別 Google ドメイン、表示言語差による DOM 抽出の差分。

対象地域は国名の固定リストではなく、MVP では UI／評価を英語または日本語で提供できる市場と定義します。Chrome の UI 言語と検索ページの `hl` を判定に使い、未知の言語では評価を実行せず案内を表示します。

## 11. 推奨する意思決定

まずは **「技術的な調べもの」向け**に絞り、タイトル・URL・スニペットだけで評価する read-only MVP を推奨します。結果の並べ替えや本文取得は行わず、バッジ、rubric、確率分布だけを表示します。

この形なら価値仮説を早く試せ、プライバシー、サイト負荷、誤ランキングの影響を抑えられます。評価が実際にリンク選択を改善すると分かってから、ユーザーが明示的に選んだ場合に限り、並べ替えや本文評価を追加するのが安全です。
