# ADR 0005: test runnerにVitestを採用

- 状態: 採用
- 日付: 2026-09-29

## 背景

Node.js標準test runnerを使う構成では、TypeScriptを一度`build-tests/`へcompileしてから生成JavaScriptを実行していました。application buildにはViteを採用済みであり、testだけが別の変換経路を持つため、設定と一時生成物が増えていました。

## 決定

- TypeScriptのtest runnerにVitestを使う。
- testは引き続き対象実装と同じdirectoryへ`*.test.ts`として置く。
- `vitest.config.mjs`で対象を`extension/src/**/*.test.ts`へ限定し、Node.js環境で実行する。
- assertionは既存testの意図を変えないため、当面はNode.jsの`assert`を維持する。
- watchを必要としないCIでは`vitest run`を使う。

## 結果

- `build-tests/`とtest専用TypeScript configが不要になる。
- VitestがTypeScriptを直接変換するため、localとCIで同じtest探索・実行経路を使える。
- applicationのVite buildは明示したruntime entryだけを対象とするため、test codeをChrome拡張へ含めない。
- Vitest dependencyは増えるが、testのwatch、filter、reporterを将来追加するときに同じrunnerを拡張できる。
