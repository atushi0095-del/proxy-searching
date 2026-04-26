# EDINET API 連携メモ

このアプリでは、企業の有価証券報告書を安定して取得する入口として EDINET API v2 を使います。JPX/TDnet/企業IRページは招集通知やCG報告書の確認に有用ですが、役員属性・財務数値・ガバナンス情報の継続取得は EDINET API を優先します。

## 前提

- EDINET APIキーはリポジトリに保存しません。
- ローカル・GitHub Actions ともに `EDINET_API_KEY` 環境変数から読み込みます。
- 大量取得を避けるため、日付範囲・企業コード・件数上限・ディレイを指定できる設計にしています。

## ローカル実行例

PowerShell:

```powershell
$env:EDINET_API_KEY="取得したAPIキー"
npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --company=7203 --limit=3 --delay=2000
npm run edinet:download -- --limit=3 --type=1 --delay=2000
```

## コマンド

```bash
npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --company=7203 --limit=3
npm run edinet:download -- --limit=3 --type=1
```

`edinet:discover` は `data/companies.json` の証券コードを EDINET の `secCode` と照合し、docTypeCode `120`、つまり有価証券報告書だけを `data/generated/edinet_filings.json` に保存します。

`edinet:download` は発見済みの `doc_id` を使い、`data/generated/sources/edinet/` に文書を保存し、`data/generated/edinet_download_manifest.json` に取得履歴を残します。

## GitHub Actions で使う場合

1. GitHub の `Settings > Secrets and variables > Actions` に `EDINET_API_KEY` を登録します。
2. 既存の週次データ収集ワークフローに、必要に応じて以下を追加します。

```yaml
- name: Discover EDINET annual reports
  run: npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --limit=25 --delay=2000
  env:
    EDINET_API_KEY: ${{ secrets.EDINET_API_KEY }}

- name: Download EDINET documents
  run: npm run edinet:download -- --limit=10 --type=1 --delay=2000
  env:
    EDINET_API_KEY: ${{ secrets.EDINET_API_KEY }}
```

## 注意

- EDINET APIキーが未設定の場合、コマンドは取得処理を開始せずに停止します。
- 週次実行では `--limit` と `--delay` を必ず指定し、対象期間を絞ります。
- 有価証券報告書からのXBRL/PDF解析は次工程です。最終的には `financial_metrics.json`、`directors.json`、`company_governance_metrics.json`、`document_sources.json` に反映する想定です。
