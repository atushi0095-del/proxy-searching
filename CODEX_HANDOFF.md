# Codex 引き継ぎ書 - 議決権行使反対パターン推定 Web アプリ

最終更新: 2026-04-26

## 目的

SR/IR実務で使う分析支援アプリ。投資家別の議決権行使ガイドライン、過去行使結果、企業FACTデータを横断し、「どの投資家が、どの企業の、どの基準で反対し得るか」を FACT / GUIDELINE / INFERENCE に分けて表示する。

断定ではなく、反対可能性・推定根拠・未確認点を明示する設計。

## 技術構成

- Framework: Next.js 16 App Router + TypeScript + Tailwind CSS
- Data: `data/*.json` と `data/generated/*.json`
- Runtime: npm
- 開発サーバー: `npm run dev:proxy` で `http://127.0.0.1:3010`
- 主要画面:
  - `/` ホーム、投資家・企業・基準サマリー
  - `/investors/[investorId]` 投資家別ルール、行使先一覧、詳細条件分析、ボーダー分析
  - `/companies/[companyCode]?year=2025` 企業別FACT、投資家別判定
  - `/issues/[issueType]` 論点別分析

## 主要データ

- `data/investors.json`: 投資家マスター
- `data/guideline_rules.json`: 投資家別ガイドラインルール
- `data/guideline_sources.json`: ガイドライン・行使結果ソースURL
- `data/companies.json`: 企業マスター
- `data/financial_metrics.json`: ROE/PBR等の財務指標
- `data/directors.json`: 取締役候補者属性
- `data/company_governance_metrics.json`: 取締役会構成等
- `data/document_sources.json`: 招集通知・CG報告書等の企業別ソース
- `data/generated/download_manifest.json`: 取得済み・ローカル投入済みソース一覧
- `data/generated/*_vote_cases.json`: 投資家別の中間ケースデータ
- `data/generated/investor_opposition_records.json`: UIで使う統合行使結果
- `data/generated/investor_opposition_summary.json`: ホーム表示用の軽量サマリー
- `data/generated/opposition_records_by_investor/*.json`: 投資家詳細ページ用の投資家別分割レコード
- `data/generated/opposition_focus_companies.json`: 反対重点企業集計

## 現在の投資家データ状況

登録投資家は12社。

- BlackRock
- 三菱UFJ信託銀行
- 野村アセットマネジメント
- りそなアセットマネジメント
- 三井住友トラスト・アセットマネジメント
- アセットマネジメントOne
- 大和アセットマネジメント
- アモーヴァ・アセットマネジメント
- 三菱UFJアセットマネジメント
- ニッセイアセットマネジメント
- ゴールドマン・サックス・アセット・マネジメント
- フィディリティ投信

今回、ユーザーがDownloads配下に置いたExcel/XLSをローカルソースとして反映済み。

- `C:\Users\atush\Downloads\野村アセットマネジメント`: 8ファイル、2024Q1-2025Q4
- `C:\Users\atush\Downloads\三菱UFJ信託銀行`: 7ファイル、2024/6および2024Q3-2025Q4
- `C:\Users\atush\Downloads\りそな`: 8ファイル、2024Q1-2025Q4
- `C:\Users\atush\Downloads\大和`: 23ファイル、2024/1-2025/11

反映結果:

- ローカル投入ファイル: 46件
- `investor_opposition_records.json`: 519,969件
- 野村アセットマネジメントの統合レコード: 43,671件（反対4,817件、賛成38,854件）
- `opposition_focus_companies.json`: 1,562社

補足: `C:\Users\atush\Downloads\FIJ_DisclosureReport_1Q2024.zip` は指定場所に存在しなかったため未反映。

## ローカル行使結果ファイルの投入手順

新規スクリプト:

```bash
npm run import:local-votes
```

処理内容:

1. Downloads配下の投資家別フォルダからExcel/XLS/CSVを読む
2. `data/generated/sources/` にコピー
3. `data/generated/download_manifest.json` に `discovery_method: local_user_upload` として登録

対象フォルダは `scripts/import-local-vote-files.mjs` の `LOCAL_FOLDERS` で管理。

その後、解析と統合を実行する。

```bash
npm run analyze:nomura-votes
npm run analyze:resona-votes
npm run analyze:daiwa-votes
npm run analyze:mufg-votes
npm run analyze:structured-votes
npm run build:opposition-records
npm run split:opposition-records
npm run build:opposition-focus
```

必要に応じて最後に:

```bash
npm run validate
npm run build
```

## 解析スクリプト

- `scripts/analyze-nomura-vote-excel.mjs`: 野村AM
- `scripts/analyze-resona-vote-excel.mjs`: りそなAM
- `scripts/analyze-daiwa-vote-excel.mjs`: 大和AM
- `scripts/analyze-mufg-vote-excel.mjs`: 三菱UFJ信託銀行
  - 今回、`download_manifest.json` のローカル投入ファイルも読むように修正済み。
- `scripts/analyze-structured-vote-files.mjs`: SMTAM、アモーヴァAM、三菱UFJAM、ニッセイAM、フィディリティ投信等の共通解析
- `scripts/analyze-blackrock-vote-pdf.mjs`: BlackRock PDF解析
- `scripts/build-investor-opposition-records.mjs`: 投資家別ケースJSONをUI用の統合レコードに変換
- `scripts/build-opposition-focus-companies.mjs`: 反対重点企業を集計

## 注意点

### 1. 三井住友トラストAM CSVのヘッダー差異

三井住友トラストAMの `2023Q4`、`2024Q1`、`2024Q2` CSVは、ヘッダー列名の違いにより現状0件になる可能性がある。

対応方針:

- `scripts/analyze-structured-vote-files.mjs` の `HEADER_ALIASES` を拡張する
- 対象CSVを1ファイルずつ開き、以下の列に対応する実際のヘッダー名を追加する
  - 証券コード
  - 会社名
  - 総会日
  - 議案番号
  - 議案種類/議案名
  - 賛否
  - 反対理由
- 解析後、`npm run analyze:structured-votes` と `npm run build:opposition-records` を再実行する

### 2. 三菱UFJ信託銀行の重複

三菱UFJ信託銀行は既存registry取得分とローカル投入分が一部重複する。  
`build-investor-opposition-records.mjs` では、投資家・企業・総会日・議案・候補者・行使・理由で重複排除しているためUI統合レコードでは大きな二重計上は避けられる。

ただし、`mufg_vote_summary.json` は解析元レコード合計のため重複が含まれ得る。集計の厳密化が必要なら、`analyze-mufg-vote-excel.mjs` 側にも同じ重複排除キーを入れること。

### 3. 招集通知リンク

招集通知リンクは `data/document_sources.json` に登録されたものだけを使う。  
IRBank等の推測URLは掲載切れやエラーが多いため、現在は使わない方針。

### 4. BlackRock / AM-One PDF

PDF保護や編集不可PDFは、暗号解除・改変・制限回避をしない。  
テキスト抽出できる公開PDFのみ処理し、難しい場合は目視確認・手動入力を前提にする。

### 5. 予想ROE

過去行使分析は実績ROEを優先する。  
決算短信の業績予想から算出する来期予想ROEは、将来的に `forecast_financial_metrics` のような別データに分けるのが望ましい。実績値と混ぜない。

## 最近の重要変更

- ホームUIはコンパクト化済み。ユーザーがかなり気に入っているため、原則大きく変えない。
- 投資家詳細ページに以下のタブあり:
  - 行使先一覧
  - 詳細条件分析
  - ボーダー分析
- 条件分析では、ROE/PBR/政策保有株式/配当性向/株主還元/在任期間などを横断して拡張する方針。
- 報酬論点は細分類タグを入れる方向:
  - 業績連動株式報酬（社内）
  - 業績非連動株式報酬（社内）
  - 業績連動株式報酬（社外）
  - 業績非連動株式報酬（社外）
  - 金額報酬
- トヨタ自動車 `7203` の2025年3月期実績ROE `13.6%` を `data/financial_metrics.json` に追加済み。

## 最近の追加変更（2026-04-26 後半）

- `build-investor-opposition-records.mjs`: 企業名エンリッチメント追加
  - 全vote_casesファイルと `companies.json` から `company_code → company_name` マップを構築
  - `company_name` が空のレコード（アモーヴァAM等）に企業名を補完
  - アモーヴァAM: 0件 → 43,981件（44,412中）の企業名が補完
  - `normalizeVote` の mojibake 対応を修正（出力が文字化けしていた問題を修正）
  - `cleanReason` のmojibake置換を削除（現在のcase filesは正常なUTF-8なので不要）
- `companies.json`: 26社 → 75社に拡張（反対実績上位・主要プライム銘柄を追加）
- `data/financial_metrics.json`: 8社 → 20社に拡張（ROE/PBR 3期分ずつ追加）
- `components/InvestorOppositionTable.tsx`:
  - 「詳細条件」列を削除（フィルタードロップダウンは維持）
  - 行の縦パディングを削減（`py-2` → `py-1.5`）
  - 総会日を `YYYYMMDD` → `YYYY/MM/DD` 形式に変換表示
  - 「反対対象候補」列を削除し、議案列に集約
  - 出典・招集通知を1列に統合
  - フィルター行を4列に簡略化
  - 賛否フィルターを `vote.includes("反対")` で柔軟マッチ

## 次タスク

1. SMTAM旧CSVの `HEADER_ALIASES` 拡張
2. BlackRockのPDF行使結果を合法・安全な範囲で追加取り込み
3. フィディリティ投信ZIPが見つかり次第、解凍・Excel反映
4. 企業FACTデータ拡充（継続）
   - 役員属性: candidates番号、性別、社内/社外、独立性、社長/会長、代表権
   - 招集通知リンク: JPX/TDnet/企業IR/EDINET等の安定リンクを優先
   - EDINET API連携で75社への財務データ補完
5. 三菱UFJ信託のsummary側重複排除
6. 投資家別・論点別のCSV出力列をさらに整備

## 検証コマンド

```bash
npm run validate
npm run build
```

今回のローカル行使結果反映後、以下は実行済み。

- `npm run import:local-votes`
- `npm run analyze:nomura-votes`
- `npm run analyze:resona-votes`
- `npm run analyze:daiwa-votes`
- `npm run analyze:mufg-votes`
- `npm run analyze:structured-votes`
- `npm run build:opposition-records`
- `npm run split:opposition-records`
- `npm run build:opposition-focus`

補足: 52万件規模の `investor_opposition_records.json` をNext.jsページで直接importするとビルド時にメモリ不足になる。ホームは `investor_opposition_summary.json`、投資家詳細は `opposition_records_by_investor/[investorId].json` を読む構成に変更済み。

---

## EDINET API 連携（2026-04-26 追記）

ユーザー要望により、JPX/企業サイトへの都度アクセスより安定した取得経路として EDINET API v2 の入口を追加した。

追加ファイル:

- `scripts/edinet-discover-filings.mjs`
- `scripts/edinet-download-documents.mjs`
- `docs/EDINET_API_SETUP.md`

追加 npm script:

- `npm run edinet:discover`
- `npm run edinet:download`

使い方:

```powershell
$env:EDINET_API_KEY="取得したAPIキー"
npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --company=7203 --limit=3 --delay=2000
npm run edinet:download -- --limit=3 --type=1 --delay=2000
```

設計方針:

- APIキーは `EDINET_API_KEY` 環境変数で渡し、リポジトリには保存しない。
- `edinet:discover` は EDINET API v2 の `documents.json` を使い、`docTypeCode=120`（有価証券報告書）だけを `data/generated/edinet_filings.json` に保存する。
- `edinet:download` は発見した `doc_id` を使い、文書を `data/generated/sources/edinet/` に保存し、取得履歴を `data/generated/edinet_download_manifest.json` に残す。
- 大量取得を避けるため、`--limit` と `--delay` を持たせている。GitHub Actions に組み込む場合も必ず件数制限をかける。
- 次工程は、取得したXBRL/PDFから `financial_metrics.json`、`directors.json`、`company_governance_metrics.json`、`document_sources.json` へ反映する解析スクリプトの実装。
