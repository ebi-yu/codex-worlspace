# ADR 0001: Value Objectとブラウザー標準ランタイム

- 状態: [ADR 0002](0002-typescript-build-boundary.md)により置き換え
- 日付: 2026-09-29

## 背景

Search Lensには、小規模なChrome Manifest V3実装が必要です。価値を生むビジネスルールはDOM selectorそのものではなく、有効な検索結果とは何か、どの評価軸を有効にするか、どの質問を送るか、providerの回答を誤解のないUI値へどう変換するかです。

最初の縦切りを作る前からframework、DI container、repository階層、build pipelineを導入すると、拡張の読み込みとreviewが難しくなります。

## 決定

次の4つのdomain境界に限定した軽量DDDを採用します。

- `SearchResult`: 1件の検索結果を検証・正規化し、identityを管理する。
- `EvaluationAxes`: 選択された評価軸を検証・整列し、組み合わせを識別する。
- `convertEvaluationAxesToTypeSafeQuestions`: 選択された評価軸をTypeSafe API contractへ変換する。
- `Evaluation`: providerの回答を検証し、安全に表示できる値へ変換する。

service workerとoptions pageではブラウザー標準のJavaScript moduleを使います。Chromeのcontent scriptはbundlingなしではES moduleとして宣言できないため、依存を持たせません。決定的なtestに価値があるTypeSafe client境界に限って、`fetch`、`sleep`、乱数生成を注入します。

## 結果

- 当初のdomain testはNode.js標準test runnerで実行し、外部packageを必要としない。後のrunner変更はADR 0005へ記録する。
- buildなしでunpacked版の`extension/`を直接読み込める。
- DOM抽出を意図的に薄く保ち、Googleのmarkup変更時に交換できる。
- bundlerを追加しない代わりに、content scriptのUI labelには一部重複を許容する。
- UIが成長した場合は、具体的な必要性を確認してから別のADRでbuild toolを検討する。
