# Codex Cloudでpackage registryへ接続できない場合

## この環境で確認したこと

`pnpm`の設定先は`https://registry.npmjs.org/`であり、HTTP／HTTPS proxyにはCodex Cloudから提供された`http://proxy:8080`が設定されています。しかし、`curl`でもregistryへのCONNECTがEnvoyからHTTP 403で拒否されました。したがって、今回の失敗は`pnpm`、Vitest、repository内の`.npmrc`が原因ではなく、taskを実行しているCloud環境の外向きnetwork policyによるものです。

// 1. package managerとHTTP clientの両方で接続可否を切り分ける。
```sh
pnpm config get registry
pnpm view vitest version
curl -I https://registry.npmjs.org/vitest
```

## 解決方法

1. Codex Cloudのenvironment設定で、このrepositoryのtaskにinternet accessを許可する。
2. domain allowlist方式の場合は、少なくとも`registry.npmjs.org`へのHTTPS接続を許可する。
3. environmentを保存した後、新しいtaskまたは新しいcontainerで再実行する。起動済みcontainerへ設定が反映されない場合がある。
4. `pnpm install`を実行し、生成された`pnpm-lock.yaml`をcommitする。
5. `pnpm validate`でformat、lint、型検査、Vitest、Vite buildをまとめて確認する。

// 2. network policy変更後に依存関係と全検証を実行する。
```sh
pnpm install
pnpm validate
git add pnpm-lock.yaml
git commit -m "Add pnpm lockfile"
```

## 避ける対応

- proxyを無断で迂回する別registryをsourceへ固定しない。
- TLS検証を無効にしない。
- dependencyを手作業で`node_modules/`へcommitしない。
- 実際にはVitestを実行していないのに、`pnpm test`成功と報告しない。

network policyを変更できない場合、このsession内だけで正規の`pnpm install`を成功させることはできません。管理者にdomain許可を依頼するか、registryへ接続できるCI／local環境でlockfileを生成してください。
