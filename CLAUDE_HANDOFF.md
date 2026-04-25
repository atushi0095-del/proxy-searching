# Claude Code 引き継ぎ書

## 目的

本アプリは、SR/IR実務で使う「議決権行使反対パターン推定」WebアプリのMVPです。

初期対象投資家は以下の2者です。

- BlackRock
- 三菱UFJ信託銀行

目的は大きく2つです。

1. 投資家ごとの議決権行使ガイドライン上の抵触基準を分析する
   - 例: 「在任期間12年」と書かれている場合、12年目で反対なのか、13年目から反対なのかを探る
   - ROE、PBR、TSR、取締役会独立性、女性役員、出席率、兼職数なども対象
2. 過去の議決権行使結果から、実際の反対対象と賛成境界を推定する
   - 反対された企業・候補者を抽出する
   - 同一企業・近接事例で賛成された候補者も抽出する
   - 「誰が反対対象になるか」を FACT / GUIDELINE / INFERENCE に分けて表示する

このツールは断定ツールではなく、分析支援ツールです。必ず以下を分離してください。

- FACT: ROE、PBR、TSR、在任年数、出席率、取締役会構成などの事実
- GUIDELINE: 投資家の公式ガイドライン上の基準
- INFERENCE: 過去行使結果から推定した反対対象・反対可能性

## 技術スタック

- Next.js 16 / App Router
- TypeScript
- Tailwind CSS
- ローカルJSONデータ
- npm

プロジェクト場所:

```text
C:\Users\atush\Desktop\kindle\クロード\アプリ\proxy-vote-pattern-app
```

起動:

```bash
npm install
npm run dev
```

本番ビルド確認:

```bash
npm run build
```

## 現在の実装状況

### 画面

実装済みページ:

- `/`
  - 投資家カード
  - 対象企業カード
  - 主な基準一覧
  - 網羅的な基準分類
- `/companies/[companyCode]`
  - 企業詳細
  - FACT / GUIDELINE / INFERENCE 表示
  - 投資家別判定
  - 候補者別スコア
- `/investors/[investorId]`
  - 投資家別ルール一覧
  - 日本語ソース一覧
  - 将来拡張用の基準分類
  - 三菱UFJ信託銀行ページでは実データ抽出サマリーを表示

### UI上の重要修正

ユーザー要望により、以下は対応済みです。

- 企業ホームページリンクは日本語ページに変更済み
  - トヨタ: `https://global.toyota/jp/ir/`
  - ソニー: `https://www.sony.com/ja/SonyInfo/IR/`
- 「将来拡張用の基準分類」「網羅的な基準分類」の各行をクリック可能にした
- 基準分類クリック時のポップアップには以下を表示
  - 分析結果として提示する基準
  - 議決権行使ガイドラインの原文メモ
  - 日本語ガイドラインリンク
- 以前のようにJSONコードを画面に大きく出さない
- `INFERENCE` は「基準を満たしている」ではなく、具体的な状況説明に変更
  - 例: 「直近3期ROEが 3.8%、4.2%、4.5% で、いずれも5%未満」
  - 例: 「再任後の在任期間が13年となるため、Aパターンでは抵触可能性あり」

## 主なファイル

### 型・データ取得

- `lib/types.ts`
  - 全テーブルのTypeScript型
- `lib/data.ts`
  - JSONロード関数
- `lib/inference.ts`
  - 投資家別判定の集約
  - FACT / GUIDELINE / INFERENCE の文言生成
  - 網羅的 issue taxonomy

### UIコンポーネント

- `components/GuidelineRuleModalList.tsx`
  - 主なガイドラインルールのポップアップ
- `components/IssueTaxonomyModalList.tsx`
  - 将来拡張用の基準分類のポップアップ
- `components/FactSection.tsx`
- `components/GuidelineSection.tsx`
- `components/InferenceSection.tsx`
- `components/PatternInferencePanel.tsx`
- `components/DirectorCard.tsx`
- `components/EvidenceTable.tsx`
- `components/ExportButton.tsx`

### JSONデータ

- `data/investors.json`
- `data/guideline_rules.json`
- `data/guideline_sources.json`
- `data/companies.json`
- `data/financial_metrics.json`
- `data/company_governance_metrics.json`
- `data/directors.json`
- `data/vote_results.json`
- `data/inferred_patterns.json`

### 自動生成データ

- `data/generated/source_registry.json`
  - 公式ページから検出したソースリンク一覧
- `data/generated/download_manifest.json`
  - ダウンロード済みソースのマニフェスト
- `data/generated/sources/`
  - ダウンロードしたPDF/XLSX
- `data/generated/mufg_vote_summary.json`
  - 三菱UFJ信託銀行の個別議案別行使結果の集計
- `data/generated/mufg_vote_cases.json`
  - 論点別の反対事例・賛成近接事例

## 追加済み npm scripts

```json
{
  "discover:sources": "node scripts/discover-sources.mjs",
  "download:sources": "node scripts/download-sources.mjs",
  "analyze:mufg-votes": "node scripts/analyze-mufg-vote-excel.mjs"
}
```

使い方:

```bash
npm run discover:sources
npm run download:sources
npm run analyze:mufg-votes
```

## 実データ収集・解析の現在地

### 三菱UFJ信託銀行

`scripts/analyze-mufg-vote-excel.mjs` により、三菱UFJ信託銀行の公式ページで公開されている個別議案別Excelを読み込み済みです。

解析対象:

- 2017年5月～2025年12月総会
- 合計 196,986件

現在の集計:

- 賛成: 161,103件
- 反対: 35,846件

主な反対理由分類:

- board_independence
- gender_diversity
- low_roe
- tenure
- attendance
- policy_shareholdings
- independence_failure
- compensation
- takeover_defense
- shareholder_proposal

三菱UFJ信託銀行ページ `/investors/mufg_trust` には、この実データ抽出サマリーを表示済みです。

### BlackRock

日本語ガイドラインPDFと議案別議決権行使状況PDFのリンク検出までは実装済みです。

ただし、BlackRockのPDFから議決権行使結果を構造化抽出する処理は未実装です。

次にやるならここです。

## 公式ソース

### BlackRock

- 議決権行使ガイドライン 日本株式
  - `https://www.blackrock.com/jp/individual/ja/literature/publication/blkj-proxy-voting-guideline-2025-jp-ja.pdf`
- 議決権行使関連ページ
  - `https://www.blackrock.com/jp/individual/ja/about-us/important-information/voting`

### 三菱UFJ信託銀行

- 2026年度議決権行使方針
  - `https://www.tr.mufg.jp/new_assets/houjin/jutaku/pdf/unyou_kabu_12_pdf.pdf`
- スチュワードシップ活動ページ
  - `https://www.tr.mufg.jp/houjin/jutaku/about_stewardship.html`
- 個別議案別行使結果Excel
  - `data/generated/source_registry.json` に検出済み

## 今後の優先タスク

### 1. 三菱UFJ信託銀行の在任期間12年基準を深掘り

目的:

- 「12年超」なのか
- 「12年満了時点」なのか
- 「再任後12年超」なのか
- あるいは「独立性評価に影響するが直ちに反対ではない」のか

現在あるデータ:

- `data/generated/mufg_vote_cases.json`
  - `issue_type = tenure` の反対事例
  - 同一企業の賛成近接事例

次に必要なこと:

1. `tenure` 反対事例の会社コードと議案番号を抽出
2. 対象企業の招集通知を取得
3. 候補者ごとの在任年数を抽出
4. 反対候補者と賛成候補者を比較
5. A/B/C/Dパターンに分類

パターン:

- A: 12年超、つまり13年目から反対
- B: 12年間在任した時点で反対
- C: 再任後に12年超となる場合に反対
- D: 独立性評価には影響するが、直ちに反対ではない

### 2. 反対対象の推定ロジック強化

特にやるべき論点:

- low_roe
  - 代表取締役候補者なのか
  - 社長・CEOなのか
  - 会長も対象になるのか
- board_independence
  - 候補者全員なのか
  - 経営トップだけなのか
  - 指名委員長・取締役会議長なのか
- gender_diversity
  - 指名委員長なのか
  - 経営トップなのか
  - 候補者全員なのか
- tenure
  - 該当社外取締役本人だけか

### 3. BlackRock議決権行使結果PDFの構造化

BlackRockは反対対象が「責任を有する取締役」など抽象的です。

やるべきこと:

1. `source_registry.json` の BlackRock `vote_result` PDFを対象にする
2. PDFから表を抽出する
3. 会社名、議案番号、賛否、理由を構造化する
4. `vote_results` または generated JSON に格納する
5. ROE抵触時に誰が反対されているかを推定する

推定表示では、必ず根拠区分を分けること。

- 公式ガイドライン
- 過去行使結果
- 推定パターン

### 4. 実企業データの拡充

現時点では、企業・取締役・財務データは一部サンプル/マスターです。

次に実務利用へ近づけるには、以下が必要です。

- EDINETまたはTDnetから招集通知を取得
- 有価証券報告書からROE/PBR等を取得
- 取締役候補者の役職・独立性・在任年数・出席率を抽出
- 会社コード単位で `directors.json` と `company_governance_metrics.json` を更新

## 実装時の注意

### UI

ユーザーは「前のUIがめちゃくちゃ良かった」と言っているため、UIの大幅変更は避けてください。

特に避けること:

- JSONをそのまま画面に大きく表示する
- 英語リンクを優先する
- FACT / GUIDELINE / INFERENCE を混ぜる
- INFERENCEで断定する

良い表示:

- 基準名を押すとポップアップ
- 上から「分析結果として提示する基準」
- 次に「議決権行使ガイドラインの原文メモ」
- 最後に日本語ガイドラインリンク

### 文言

NG:

```text
INFERENCE: 基準を満たしている
```

OK:

```text
INFERENCE: 再任後の在任期間が13年となるため、12年超を13年目から反対と解釈するAパターンでは抵触可能性があります。一方、12年満了時点で反対とするBパターンかどうかは、賛成事例との照合が必要です。
```

### 依存関係

Excel解析用に `xlsx` を追加済みです。

注意:

- `npm audit` では脆弱性警告が出ています
- MVPでは使用可
- 本番化する場合は代替ライブラリ検討が望ましい

## 検証済み

以下は確認済みです。

```bash
npm run build
```

成功しています。

ブラウザ確認済み:

- `/investors/mufg_trust`
  - 実データ抽出サマリー表示あり
  - 日本語ソース表示あり
  - 将来拡張用の基準分類表示あり
  - 三菱UFJ信託銀行の日本語PDFリンクあり
- 基準分類の「個別取締役 / 社外取締役の在任期間」ポップアップ
  - 分析結果として提示する基準あり
  - 議決権行使ガイドラインの原文メモあり
  - 日本語ガイドラインPDFリンクあり

## Claude Codeへの次の指示例

```text
このプロジェクトの CLAUDE_HANDOFF.md を読んでください。
まず現状を壊さず、三菱UFJ信託銀行の tenure 反対事例を data/generated/mufg_vote_cases.json から抽出し、反対された企業と同一企業で賛成された取締役候補者を比較するための中間テーブルを作ってください。

目的は、在任期間12年基準が A/B/C/D のどれに近いかを推定することです。
UIは大きく変えず、必要なら investors/mufg_trust に「在任期間分析」セクションを追加してください。
```

