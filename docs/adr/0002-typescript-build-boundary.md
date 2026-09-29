# ADR 0002: TypeScript sourceと明示的なbuild境界

- 状態: 一部を[ADR 0003](0003-pnpm-vite-and-oxc-tooling.md)により置き換え
- 日付: 2026-09-29

## 背景

最初のspikeでは拡張を直接読み込めるようにJavaScriptを使いました。一方、想定するmaintainerはChrome拡張に不慣れです。検索データ、有効な評価軸、provider response、Chrome messageが信頼境界を越える箇所ではcompilerのfeedbackが必要です。また、ChromeはTypeScriptを直接実行できません。

## 決定

applicationとtestのsourceをTypeScriptで記述し、`build/extension/`へcompileします。Chromeには生成したdirectoryだけを読み込ませます。domainのValue Objectには厳密な型を付けます。ただし、静的な型だけではDOM、storage、message、HTTP responseの正しさを保証できないため、browserとproviderの境界ではruntime validationも残します。一時的な`@ts-nocheck`は、明示的なcontract型が未導入の境界を示す印であり、未検証データをdomainへ渡す許可ではありません。

生成されたJavaScriptはcommitしません。source形式にはTypeScriptを使い、後続のpackage tool選定はADR 0003へ記録します。

## 結果

- contributorは拡張を読み込む前に`pnpm build`を実行する。
- source mapにより、生成JavaScriptのerrorをTypeScript sourceへ対応付けられる。
- domainの誤りはChrome起動前に検出し、外部入力は引き続きruntimeで検証する。
- build outputをversion管理しないため、review中に生成物だけが古くなることを防げる。
- 境界へcontract型を導入するたびに、該当する`@ts-nocheck`を削除する。
