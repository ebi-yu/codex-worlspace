# Search Lens（仮称）

Google 検索結果を見ながら、各ページが「いまの調査目的にどれくらい役立ちそうか」を判断しやすくする Chrome 拡張の企画メモです。

現時点では、すぐ実装を固定するのではなく、次の仮説を小さく検証する段階です。

- 検索結果の横に **役立つ可能性** と、評価 rubric・確率分布を表示すると選択が速くなる。
- ひとつの総合順位よりも、「一次情報」「具体性」「新しさ」などの内訳がある方が信頼できる。
- ユーザーから受け取る JEV トークンは、拡張内で安全に扱い、検索ページやログへ露出させない。

詳細は次の設計資料を参照してください。

- [プロダクト検討メモ](docs/product-plan.md)
- [評価軸・JEV リクエスト設計](docs/evaluation-design.md)
- [初学者向け技術概要](docs/technical-overview.md)
- [Chrome 拡張の技術構成](docs/technical-architecture.md)

## 現時点の提案

最初の MVP は「検索結果の並べ替え」ではなく、元の Google の順序を維持したまま、各結果へ控えめな評価バッジを追加します。評価は `推定有用度 78/100` のような単独スコアだけでなく、該当 rubric と確信度も表示します。

> **重要:** JEV トークンはユーザー自身が用意する BYOK（Bring Your Own Key）方式です。こちらでトークンや無料枠を提供する収益モデルは採用しません。

## 次のアクション

1. unpacked extension を日英の Google 検索で試し、結果抽出 selector の fixture を作る。
2. 5〜8 人に実際の注釈 UI を使ってもらい、欲しい評価軸を確認する。
3. TypeSafe API の実レスポンスで rubric、確信度、エラー表示を校正する。
4. クリック率ではなく「目的の情報へ到達する時間」と評価納得度を計測する。

## ローカルで試す

必要なものは Node.js 20 以降と Google Chrome です。TypeScript ソースは、Chrome が実行できる JavaScript へビルドします。

```sh
pnpm install
pnpm test
pnpm check
pnpm build
pnpm validate
```

1. Chrome で `chrome://extensions` を開く。
2. 「デベロッパー モード」を有効にする。
3. 「パッケージ化されていない拡張機能を読み込む」から、ビルドで生成された `build/extension/` を選ぶ。
4. 開いた設定画面へ自分の JEV token を保存し、必要な評価軸をオンにする。
5. `google.com` または `google.co.jp` で検索する。

トークンは BYOK 方式です。実際の検索語、検索結果 URL、タイトル、スニペットが TypeSafe API へ送信されることを理解したうえで有効化してください。

実装上の判断理由は [ADR 0001](docs/adr/0001-domain-boundaries-and-browser-runtime.md) と [ADR 0002](docs/adr/0002-typescript-build-boundary.md)、[ADR 0003](docs/adr/0003-pnpm-vite-and-oxc-tooling.md) に記録しています。
