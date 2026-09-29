# ADR 0003: pnpm、Vite、Oxcによる開発tool構成

- 状態: 採用
- 日付: 2026-09-29

## 背景

最初のTypeScript buildでは、`tsc`をshell commandで組み合わせました。拡張をcompileできることは確認できましたが、静的assetのpackage化がnpm scriptへ暗黙的に埋め込まれ、lintとformatのfeedbackもありませんでした。また、複数のlockfileを作らないよう、repositoryで使うpackage managerを1つに決める必要があります。

## 決定

- package managerをpnpm 10へ統一し、`packageManager`に想定versionを宣言する。
- service worker、content script、options pageをentryとするViteのmulti-entry buildを使う。
- `manifest.json`と`options.html`が参照する3つのentry filenameはruntime contractとして固定する。
- 汎用copy pluginを増やさず、小さなlocal Vite pluginで3つの静的assetをcopyする。
- ViteはTypeScriptをtranspileしても型検査しないため、Viteより先に`tsc --noEmit`を実行する。
- correctness、suspicious code、performanceの診断にOxlintを使う。
- formatterはOxfmtへ統一し、ESLintやPrettierを並行導入しない。
- 当初はNode.js標準test runnerを維持する。後のVitest採用判断は[ADR 0005](0005-vitest-test-runner.md)へ記録する。

## 結果

- contributorは`pnpm install`、`pnpm test`、`pnpm build`、`pnpm validate`を使う。
- Chromeが読み込む場所は引き続き`build/extension/`とし、runtime packageの配置は変えない。
- Viteは共有domain codeを`src/shared/`へ抽出でき、複数entry間の重複出力を減らせる。
- build configがcopy対象の明示的な一覧を管理する。静的runtime assetを増やす場合は`vite.config.mjs`も更新する。
- package registryへ接続できない環境でのbuild失敗は環境制約として報告し、回避策として生成物をcommitしない。
