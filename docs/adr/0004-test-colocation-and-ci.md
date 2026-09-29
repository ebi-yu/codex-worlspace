# ADR 0004: testの併置とCIによる継続検証

- 状態: 採用
- 日付: 2026-09-29

## 背景

これまでtestはrepository直下の`test/`にあり、実装との対応をdirectoryをまたいで探す必要がありました。また、local commandの説明だけでは、pull requestごとに同じ品質確認が実行されたことを保証できません。

## 決定

- `search-result.ts`と`search-result.test.ts`のように、testを対象実装と同じdirectoryへ置く。
- test fileは`*.test.ts`で識別し、Viteのruntime entryから参照しない。
- GitHub Actionsでpull requestと`main`へのpushを検証する。
- CIではOxfmt、Oxlint、TypeScript、Vitest、Vite buildを`pnpm validate`から同じ順序で実行する。
- CI権限はsourceの読み取りだけに制限し、同じbranchの古い実行はcancelする。

## 結果

- 実装を開いた場所で関連testを発見でき、変更時に追加・削除を判断しやすい。
- runtime sourceとtestは近接するが、Viteは明示した3つのentryだけをbundleするためtest codeを拡張へ含めない。
- localとCIが同じ`pnpm validate`を使い、確認項目のずれを減らす。
- 現在はlockfileがないためCIで`--no-frozen-lockfile`を指定する。registryへ接続できる環境でlockfileを生成した後、このoptionを削除する。
