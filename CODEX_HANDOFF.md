# Codex 引き継ぎ書

## 最重要方針

ユーザーは現在のUIをかなり気に入っています。原則としてUIの大幅変更は禁止です。

やるべきことは、見た目を作り替えることではなく、いまの画面、カード、ポップアップ、一覧の枠に、実データと分析結果を埋めていくことです。

特に守ること:

- `app/page.tsx` のトップ画面構成は維持する
- `IssueTaxonomyModalList` の「基準分類を押すとポップアップ」形式を維持する
- `GuidelineRuleModalList` の「分析結果として提示する基準 / 原文メモ / 日本語リンク」の構成を維持する
- JSONを画面に大きく表示しない
- 英語リンクを優先しない。日本語資料がある場合は日本語リンクを使う
- FACT / GUIDELINE / INFERENCE を混ぜない
- INFERENCE は断定せず、「どの事実からそう推定したか」を具体的に書く
- UI調整が必要な場合も、余白、罫線、色、カード感は現状に合わせる

## プロジェクト場所

```text
C:\Users\atush\Desktop\kindle\クロード\アプリ\proxy-vote-pattern-app
```

## 現在の技術スタック

- Next.js 16 / App Router
- TypeScript
- Tailwind CSS
- ローカルJSON
- npm

コマンド:

```bash
npm run dev
npm run build
npm run discover:sources
npm run download:sources
npm run analyze:mufg-votes
npm run analyze:nomura-votes
npm run sync:companies
npm run seed:sources
npm run profile:sources
npm run collect:data
```

注意:

- `npm run validate` は `npx tsx scripts/validate-data.ts` を使うが、現環境では `tsx` がローカル依存に無く、ネットワーク制限下で取得できない場合がある。
- 2026-04-25時点では `npm run build` は成功済み。

## 現在の実装状態

### 投資家

`data/investors.json` は12投資家に拡張済み。

実装済み:

- `blackrock`
- `mufg_trust`

追加済み、ソース収集・ルール抽出待ち:

- `nomura_am`: 野村アセットマネジメント
- `resona_am`: りそなアセットマネジメント
- `sumitomo_mitsui_trust_am`: 三井住友トラスト・アセットマネジメント
- `am_one`: アセットマネジメントOne
- `daiwa_am`: 大和アセットマネジメント
- `amova_am`: アモーヴァ・アセットマネジメント
- `mufg_am`: 三菱UFJアセットマネジメント
- `nissay_am`: ニッセイアセットマネジメント
- `goldman_sachs_am`: ゴールドマン・サックス・アセット・マネジメント
- `fidelity_japan`: フィディリティ投信

重要:

- 「フィディリティ投信」はFMRではない。日本法人またはフィデリティ・インターナショナルの日本向け開示を優先する。
- 「アモーヴァ・アセットマネジメント」は旧日興アセットマネジメント。2025年9月1日以降の現在表記を優先する。

### ソース

`data/guideline_sources.json` は20件に拡張済み。

主な追加ソース:

- 野村アセットマネジメント: `https://www.nomura-am.co.jp/special/esg/vote/index.html`
- りそなアセットマネジメント: `https://www.resona-am.co.jp/sustainability/voting.html`
- 三井住友トラストAM: `https://www.smtam.jp/company/policy/voting/`
- 三井住友トラストAM結果: `https://www.smtam.jp/company/policy/voting/result/`
- アセットマネジメントOne: `https://www.am-one.co.jp/company/voting/`
- 大和AM方針: `https://www.daiwa-am.co.jp/company/stewardship/policy.html`
- 大和AM結果: `https://www.daiwa-am.co.jp/company/stewardship/voting-results.html`
- アモーヴァAM基準: `https://www.amova-am.com/about/vote/standard`
- アモーヴァAM結果: `https://www.amova-am.com/about/vote/list/7-academy`
- 三菱UFJAM: `https://www.am.mufg.jp/investment_policy/responsible_stewardshipcode.html`
- ニッセイAM: `https://www.nam.co.jp/company/responsibleinvestor/cvr.html`
- Goldman Sachs AM: `https://am.gs.com/ja-jp/individual/creating-impact/stewardship-code`
- フィディリティ投信ガイドラインPDF: `https://www.fidelity.co.jp/static/japan/pdf/sustainable-investing/SustainableInvestingVotingPrinciples-and-Guidelines2406.pdf`
- フィディリティ投信 2025年4-6月行使状況PDF: `https://www.fidelity.co.jp/static/japan/pdf/FIJ_Disclosure_summary_2Q2025.pdf`

### 自動収集ターゲット

`data/source_targets.json` を追加済み。

`scripts/discover-sources.mjs` は固定2社ではなく、このファイルを読む形に変更済み。

次にCodexがやるべきこと:

```bash
npm run discover:sources
```

ネットワークが使える環境で実行し、`data/generated/source_registry.json` を更新する。

### 企業

`data/companies.json` は25社まで拡張済み。

`data/company_universe.json` をマスター候補として追加済み。企業を増やす場合は、まずここに足してから以下を実行する。

```bash
npm run sync:companies
```

これにより、`companies.json` と `document_sources.json` のIRトップ、招集通知、有報、CG報告書、会社公表の議決権行使結果プレースホルダーが同期される。

今後増やす候補:

- 7203 トヨタ自動車
- 6758 ソニーグループ
- 9984 ソフトバンクグループ
- 8306 三菱UFJフィナンシャル・グループ
- 8316 三井住友フィナンシャルグループ
- 8411 みずほフィナンシャルグループ
- 9432 日本電信電話
- 9433 KDDI
- 6861 キーエンス
- 8035 東京エレクトロン
- 8058 三菱商事
- 8001 伊藤忠商事
- 6501 日立製作所
- 6098 リクルートホールディングス
- 4519 中外製薬

既に追加済みの主な企業:

- 2914 日本たばこ産業
- 4063 信越化学工業
- 4502 武田薬品工業
- 4519 中外製薬
- 4568 第一三共
- 4661 オリエンタルランド
- 6098 リクルートホールディングス
- 6501 日立製作所
- 6758 ソニーグループ
- 6861 キーエンス
- 6902 デンソー
- 6954 ファナック
- 7203 トヨタ自動車
- 7267 本田技研工業
- 7974 任天堂
- 8001 伊藤忠商事
- 8035 東京エレクトロン
- 8058 三菱商事
- 8306 三菱UFJフィナンシャル・グループ
- 8316 三井住友フィナンシャルグループ
- 8411 みずほフィナンシャルグループ
- 8766 東京海上ホールディングス
- 9432 日本電信電話
- 9433 KDDI
- 9984 ソフトバンクグループ

企業追加時に最低限そろえるデータ:

- `companies.json`
- `financial_metrics.json`
- `company_governance_metrics.json`
- `directors.json`
- `board_composition.json`
- `document_sources.json`

## 「画像の分類のみ」を埋める方針

ユーザーの「画像を全て埋めたい」は、トップ画面や投資家ページの「網羅的な基準分類 / 将来拡張用の基準分類」で `分類のみ` になっている行を `実装済み` にしていく意味です。

UIを変えず、データを増やして埋めること。

`分類のみ` から `実装済み` へ変える条件:

- 該当 `issue_type` の `guideline_rules.json` が存在する
- `summary_text` がある
- `original_text` がある
- `source_url` が日本語公式ソース
- `condition_structured` が最低限入っている
- `official_target_text` と `target_candidates` が入っている

優先順位:

1. `low_pbr`
2. `low_tsr`
3. `policy_shareholdings`
4. `compensation`
5. `takeover_defense`
6. `shareholder_proposal`
7. `outside_director_ratio`
8. `outside_director_independence`
9. `board_chair_independence`
10. `overboarding`
11. `independence_failure`

## 重要ファイル

### UI

- `app/page.tsx`
- `app/companies/[companyCode]/page.tsx`
- `app/investors/[investorId]/page.tsx`
- `app/issues/[issueType]/page.tsx`
- `components/IssueTaxonomyModalList.tsx`
- `components/GuidelineRuleModalList.tsx`
- `components/SearchBox.tsx`

### ロジック

- `lib/types.ts`
- `lib/data.ts`
- `lib/inference.ts`
- `lib/export.ts`

### データ

- `data/investors.json`
- `data/guideline_rules.json`
- `data/guideline_sources.json`
- `data/source_targets.json`
- `data/companies.json`
- `data/financial_metrics.json`
- `data/company_governance_metrics.json`
- `data/directors.json`
- `data/board_composition.json`
- `data/document_sources.json`
- `data/vote_results.json`
- `data/inferred_patterns.json`

### 自動化

- `scripts/discover-sources.mjs`
- `scripts/download-sources.mjs`
- `scripts/seed-source-registry.mjs`
- `scripts/profile-downloaded-sources.mjs`
- `scripts/sync-company-universe.mjs`
- `scripts/run-data-pipeline.mjs`
- `scripts/analyze-mufg-vote-excel.mjs`
- `scripts/analyze-nomura-vote-excel.mjs`
- `scripts/validate-data.ts`

`data/collection_policy.json` を追加済み。ログイン、CAPTCHA、非公開API、個人情報取得、高頻度アクセスを避け、公式公開資料を低頻度で取得する方針を明記している。

`npm run collect:data` は以下を順番に実行する。

1. 企業ユニバース同期
2. 投資家ソース探索
3. 既知公式ソースのregistry統合
4. guideline / vote_result_excel の上限付きダウンロード
5. ダウンロード済みExcel/PDFのプロファイル生成
6. 三菱UFJ信託銀行Excel解析
7. 野村アセットマネジメントExcel解析

現在の上限は `scripts/run-data-pipeline.mjs` で `--limit=60`。

Codexアプリ側に週次自動実行も作成済み。

- 名前: 議決権行使データ週次収集
- 実行: 毎週月曜 8:00
- コマンド趣旨: `npm run collect:data`
- 注意: UI変更なし、公式公開資料のみ、過剰アクセス禁止

## 実データ解析の現在地

三菱UFJ信託銀行については、個別議案別Excelを解析済み。

生成ファイル:

- `data/generated/mufg_vote_summary.json`
- `data/generated/mufg_vote_cases.json`
- `data/generated/source_registry.json`
- `data/generated/sources/*.xlsx`

集計:

- 2017年5月から2025年12月総会
- 合計 196,986件
- 賛成 161,103件
- 反対 35,846件

次にやるべきこと:

1. `mufg_vote_cases.json` の `tenure` を使って、在任期間反対事例を抽出
2. 同一企業の賛成された取締役候補者を比較
3. 招集通知から候補者ごとの在任年数を取得
4. A/B/C/D のどれに近いかを推定

在任期間パターン:

- A: 12年超、つまり13年目から反対
- B: 12年間在任した時点で反対
- C: 再任後に12年超となる場合に反対
- D: 独立性評価には影響するが、直ちに反対ではない

## 追加投資家の進め方

### 1. ソース収集

まず `data/source_targets.json` を見て、対象投資家の日本語公式ページを確認する。

次に:

```bash
npm run discover:sources
```

生成された `data/generated/source_registry.json` から、以下を確認する。

- guideline
- vote_result
- vote_result_excel

### 2. guideline_rules 追加

最初に全分類を埋めようとしない。

優先5分類:

- `low_roe`
- `tenure`
- `board_independence`
- `gender_diversity`
- `attendance`

次に:

- `low_pbr`
- `low_tsr`
- `overboarding`
- `policy_shareholdings`
- `compensation`

### 3. vote result parser

投資家ごとに形式が違うため、最初は個別スクリプトでよい。

推奨:

```text
scripts/analyze-nomura-votes.mjs
scripts/analyze-resona-votes.mjs
scripts/analyze-smtam-votes.mjs
```

共通化できる部分は後で `scripts/lib/` に切り出す。

生成先:

```text
data/generated/{investor_id}_vote_summary.json
data/generated/{investor_id}_vote_cases.json
data/generated/{investor_id}_source_registry.json
```

## ユーザーが最も見たい分析

### 在任期間12年

最優先。

期待される表示:

```text
三菱UFJ信託銀行では、在任期間を理由に反対された候補者の多くが「再任後13年目」または「在任12年超」に該当している可能性があります。ただし、12年満了時点で反対しているかは、賛成事例との比較が必要です。
```

注意:

- 実データ確認前に断定しない
- 反対候補と賛成候補の両方を見る
- 招集通知で候補者略歴を確認する

### 反対対象

論点ごとに反対対象が違うことを明示する。

例:

- ROE: 経営トップ、代表取締役、CEO、会長
- 在任期間: 該当する社外取締役本人
- 取締役会独立性: 候補者全員、経営トップ、指名委員長など投資家により異なる
- 女性役員不足: 指名委員長、経営トップ、候補者全員など投資家により異なる

## 次のCodexへの具体指示テンプレート

```text
CODEX_HANDOFF.mdを読んでください。UIは原則変えないでください。

まず「分類のみ」を減らすため、low_pbr / low_tsr / policy_shareholdings / compensation / takeover_defense / shareholder_proposal の順に、既存UIで表示できる guideline_rules を追加してください。

日本語公式ソースを優先し、各ルールには summary_text / original_text / condition_structured / official_target_text / target_candidates / source_url を必ず入れてください。

次に、追加済み投資家のうち野村アセットマネジメント、りそなアセットマネジメント、三井住友トラスト・アセットマネジメントの3社から source_registry を更新し、ExcelまたはPDFの行使結果を解析する準備をしてください。
```

## 検証

2026-04-25時点:

```bash
npm run build
```

成功済み。

2026-04-25時点の収集状況:

- `data/generated/source_registry.json`: 638件
- 種別: guideline 97件、vote_result 278件、vote_result_excel 119件、reference 144件
- `data/generated/download_manifest.json`: 60件
- `data/generated/source_file_profiles.json`: ダウンロード済みファイルのシート名・ヘッダー候補
- `data/generated/nomura_am_vote_summary.json`: 野村AM個別開示Excelの集計
- `data/generated/nomura_am_vote_cases.json`: 野村AMの論点別反対・賛成近接事例

野村AM解析状況:

- 解析済み: 46,463件
- 賛成: 41,283件
- 反対: 5,180件
- 主な反対理由候補:
  - 独立性に関する当社基準を満たさないため
  - 社外取締役の人数が当社基準を満たさないため
  - 株主価値向上又はガバナンス強化に対する効果が確認されないため
- `data/generated/pipeline_logs/`: 実行ログあり
- `data/document_sources.json`: 132件
- `data/companies.json`: 25社

`npm run validate` は `tsx` が未キャッシュで失敗する場合あり。必要なら `tsx` をdevDependencyに追加してから実行する。
