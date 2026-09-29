# 初めて Chrome 拡張を触る人のための技術概要

この文書は、Web 開発や Chrome 拡張の周辺知識がない状態から Search Lens のコードを読めるようにする入口です。詳細設計は [technical-architecture.md](technical-architecture.md)、判断理由は [ADR](adr/) を参照してください。

## 1. まず知る言葉

| 言葉 | このプロジェクトでの意味 |
|---|---|
| Chrome 拡張 | Chrome に追加する小さなアプリ。通常のWebサイトとは別の権限を持つ |
| Manifest V3 | `manifest.json` に権限や起動するファイルを書く、現在の拡張仕様 |
| content script | Google 検索ページ内で結果を読み、評価UIを追加するコード |
| service worker | ページから隔離された裏側のコード。JEV tokenを保持しTypeSafe APIを呼ぶ |
| options page | tokenと評価軸をユーザーが設定する画面 |
| message passing | content scriptからservice workerへ安全に依頼を渡す仕組み |
| TypeScript | JavaScriptに型検査を加えた開発用言語。Chromeが直接実行するのは変換後のJavaScript |
| compile/build | `.ts`をChromeが読める`.js`へ変換し、配布用フォルダを作る処理 |

## 2. なぜ3つに分けるのか

Googleページ内のcontent scriptからtokenへアクセスできる設計は、ページとの境界を誤ったときの漏えいリスクを大きくします。そのため、画面を読む役、秘密を扱う役、設定する役を分離します。

// 1. 以下のコード例で構成とデータの流れを確認する。
```text
Google検索ページ
  └─ content script ── 評価依頼（tokenなし）──▶ service worker
                                                ├─ chrome.storage.localからtokenを読む
                                                └─ TypeSafe APIを呼ぶ
  ◀──────────── 表示用の評価結果だけ ────────────┘

options page ── token・トグルを保存 ──▶ chrome.storage.local
```

`manifest.json` の `permissions` と `host_permissions` は、拡張が使える能力と接続先です。権限を増やすほど影響範囲も広がるため、Search Lensはstorage、Google検索、TypeSafe APIだけを宣言します。

## 3. TypeScriptと配布物

編集するのは `extension/src/**/*.ts` です。`pnpm build` はTypeScriptを型検査し、Viteで `build/extension/` を作ります。`build/` は生成物なのでGitへコミットせず、Chromeにはこの生成済みフォルダを読み込ませます。

// 2. 以下のコード例で構成とデータの流れを確認する。
```sh
pnpm install
pnpm test         # 価値あるドメイン/API契約テストを実行
pnpm check        # ファイルを生成せず型検査
pnpm build         # 型検査してbuild/extension/を作成
pnpm lint          # Oxlintで問題を検査
pnpm format:check  # Oxfmtの整形差分を検査
pnpm validate      # 上記とテストをまとめて実行
```

Chromeでの確認手順:

1. `chrome://extensions` を開く。
2. 右上の「デベロッパー モード」をオンにする。
3. 「パッケージ化されていない拡張機能を読み込む」を押す。
4. リポジトリ直下ではなく **`build/extension/`** を選ぶ。
5. コード変更後は `pnpm build` を再実行し、拡張カードの更新ボタンを押す。

## 4. コードを読む順番

1. `extension/manifest.json`: Chromeが何を起動し、どこへ接続するか。
2. `domain/search-result.ts`: 1件の検索結果を正規化するValue Object。
3. `domain/evaluation-axes.ts`: 有効な評価軸と順序を守るValue Object。
4. `domain/questions.ts`: トグルをJEVの質問へ変換するビジネスルール。
5. `infrastructure/typesafe-client.ts`: HTTP、認証、再試行という外部接続。
6. `background/service-worker.ts`: 保存、キャッシュ、API呼び出しの調整。
7. `content/content-script.ts`: Google DOMの検出と画面表示。

ドメインはChrome APIを知らないため、小さくテストできます。一方、DOM selectorやChromeイベントは変化しやすい境界として薄く保ちます。これは「全部をDDDにする」のではなく、プロダクト価値を決めるルールだけをValue Objectへ集約するためです。

## 5. 最低限学ぶ順番

1. JavaScriptの`object`、`array`、`Promise`、`async/await`
2. TypeScriptの`type`、`interface`、union、`unknown`からの絞り込み
3. HTML DOMの`querySelector`とイベント
4. Chrome Manifest V3のcontent script、service worker、storage、messaging
5. HTTPのPOST、Bearer認証、401/429などのstatus code
6. テストのArrange–Act–Assertと、失敗→成功→リファクタのTDDサイクル

最初からReact、複雑なDDD、Chrome Web Store公開、暗号化を同時に学ぶ必要はありません。まずローカルでbuild、unpacked load、mockテストまでを一周するのが最短です。

## 6. セキュリティ上の注意

- tokenをcontent script、DOM、ログ、エラーメッセージへ渡さない。
- tokenをソースコードやテストfixtureへ書かない。
- 新しい権限をmanifestへ足す前に、なぜ必要かADRへ残す。
- 「ローカル保存」は絶対安全という意味ではない。端末やChrome profileへアクセスできる人から守る仕組みではない。
- 実検索では、検索語、URL、タイトル、スニペットがTypeSafeへ送られる。
