# Claude Code 引き継ぎ書

最終更新: 2026-04-26

## まず守ること

ユーザーは現在のUIをかなり気に入っている。原則として、見た目を大きく作り替えないこと。

- ホームのコンパクトな構成、投資家チップ、企業テーブル、主な基準サマリーは維持する。
- 投資家詳細ページのタブ構成は維持する。
  - 行使先一覧
  - 詳細条件分析
  - ボーダー分析
- 企業詳細ページは、既存のカード・罫線・余白の雰囲気を維持しながら情報を増やす。
- UI改善は「見やすくする」「不足情報を埋める」「CSV出力や絞り込みを便利にする」方向に限定する。
- FACT / GUIDELINE / INFERENCE を混ぜない。
- INFERENCE は断定せず、「どの事実からそう推定したか」を具体的に書く。
- PDFロック解除、編集制限回避、過度な大量アクセスはしない。

## リポジトリ

- ローカル: `C:\Users\atush\Desktop\kindle\クロード\アプリ\proxy-vote-pattern-app`
- GitHub: `https://github.com/atushi0095-del/proxy-searching`
- 開発サーバー: `npm run dev:proxy`
- URL: `http://127.0.0.1:3010`

別案件のローカルサーバーと衝突したことがあるため、通常は3000ではなく3010を使う。

## 現在できていること

### 投資家・行使結果

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

Excel/XLS/CSVで取得できる投資家の行使結果はかなり入っている。BlackRockやAM-OneのようなPDF中心の投資家は、PDF制限に注意しながら通常抽出可能な範囲で扱う。

### GitHub Actions 自動取得

`.github/workflows/data-collection.yml` は動作確認済み。

GitHub Actions の `Weekly data collection #6` が成功済み。  
成功時のワークフロー実行コミット表示は `0e284ea`。

EDINET APIキーはGitHub Secretsの `EDINET_API_KEY` に登録済み。コードにはAPIキーを絶対に書かない。

ワークフローの主な流れ:

1. `npm ci`
2. `npm run collect:data`
3. `npm run edinet:discover`
4. `npm run edinet:download`
5. `npm run build`
6. 軽量な生成データだけコミット・push

注意:

- `data/generated/investor_opposition_records.json` は約494MBになることがあるためコミット対象から除外する。
- `data/generated/*_cases.json` も100MB超になることがあるため、Actionsではコミット対象から除外する。
- GitHubに置くのは、原則として `*_summary.json`、`opposition_focus_companies.json`、`download_manifest.json`、`source_registry.json`、EDINETのmanifest類など軽量ファイル。
- 巨大な生レコードは将来的にSupabase等へ逃がすのが望ましい。

### EDINET API

追加済み:

- `scripts/edinet-discover-filings.mjs`
- `scripts/edinet-download-documents.mjs`
- `docs/EDINET_API_SETUP.md`
- `npm run edinet:discover`
- `npm run edinet:download`

ローカル実行例:

```powershell
$env:EDINET_API_KEY="APIキー"
npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --company=7203 --limit=3 --delay=2000
npm run edinet:download -- --limit=3 --type=1 --delay=2000
```

EDINET APIは企業FACT拡充の中心にする。JPX/TDnet/企業IRは補助的に使う。

## 企業データの現状

ユーザーの関心は、投資家データよりも次は企業FACTデータの充実に移っている。

現在不足しているもの:

- 財務データ
  - ROE
  - PBR
  - 配当性向
  - 株主還元
  - 政策保有株式比率
  - 2025年3月期など直近期の実績値
- 役員データ
  - 候補者番号
  - 氏名
  - 性別
  - 社内/社外
  - 独立性
  - 社長/CEO/会長
  - 代表権有無
  - 指名・報酬・監査委員会
  - 在任年数
  - 出席率
  - 兼職数
- ガバナンスデータ
  - 取締役人数
  - 独立社外取締役比率
  - 女性取締役数・比率
  - 独立議長有無
  - 委員会設置状況
- 証拠リンク
  - 有価証券報告書
  - 招集通知
  - CG報告書
  - TDnet/JPX/EDINETリンク

ユーザーは「投資家がなぜ反対したのか」「誰に反対したのか」を分析したい。企業データが薄いと、候補者属性や反対対象推定が弱くなる。

## 企業データ拡充の推奨方針

### 1. EDINETを安定ソースにする

EDINET APIで有価証券報告書を取得し、以下を抽出する。

- 財務指標
- 役員の状況
- 社外役員、独立役員、女性役員
- 所有株式数
- 政策保有株式
- 取締役会構成に関する記載

出力先候補:

- `data/financial_metrics.json`
- `data/directors.json`
- `data/company_governance_metrics.json`
- `data/document_sources.json`

次に作るとよい中間ファイル:

- `data/generated/edinet_financial_metrics.json`
- `data/generated/edinet_directors.json`
- `data/generated/edinet_governance_metrics.json`

最初は対象企業を絞る。

優先候補:

- BlackRockで反対・賛成が混在する企業
- 三菱UFJ信託で反対実績が多い企業
- ユーザーが例示したホクト `1379`
- トヨタ `7203`
- 三井住友FG `8316`

### 2. 招集通知は反対対象候補の紐付けに使う

EDINETだけでは「議案番号」「候補者番号」と投資家行使結果の紐付けが弱い。招集通知から次の中間データを作る。

推奨ファイル:

`data/generated/convocation_candidates.json`

キー:

- `company_code`
- `meeting_date`
- `resolution_number`
- `candidate_number`

持たせたい値:

- `candidate_name`
- `candidate_title`
- `is_inside_director`
- `is_outside_director`
- `is_independent`
- `is_female`
- `is_president`
- `is_ceo`
- `is_chair`
- `has_representative_authority`
- `tenure_years`
- `attendance_rate`
- `source_url`
- `source_page`
- `confidence`

これを `investor_opposition_records` の候補者番号と照合すると、「誰に反対したか」がかなり見える。

### 3. JPX/TDnet/CG報告書は補助

JPX CG報告書検索:

`https://www2.jpx.co.jp/tseHpFront/CGK010010Action.do`

ユーザー例:

- ホクト `1379`
- JPX/TDnet/EDINETリンクが存在する

ただし、JPXサイトは画面操作やリンク期限の問題がある。大量自動取得は避け、EDINET API中心にする。

## UI方針

### ホーム

現在のフェーズ3 UIはユーザーが気に入っている。

- 投資家一覧はコンパクトチップ
- 対象企業はコンパクトテーブル
- 主な基準サマリーは集約テーブル
- ProgressDashboardはコンパクト表示

ここは大きく変えない。

### 投資家詳細ページ

重要画面。ユーザーがよく見る。

維持する:

- 行使先一覧
- 詳細条件分析
- ボーダー分析
- CSV出力
- 反対のみ/賛成のみ/両方の絞り込み
- 詳細条件の絞り込み
- 条件クリアボタン

改善したいこと:

- 会社名クリックで企業詳細ページへ遷移
- 候補者属性をより多く表示
- 理由文が途中で切れないようにする
- 論点と理由が整合しない場合は「推定論点」と「原文理由」を分けて表示する
- 同一企業・同一総会のまとまりは見やすく。ただし前回のグルーピング表示はユーザーから見づらいと言われたので、無理に大きく変えない。

### 企業詳細ページ

ここが次の重点。

増やしたい表示:

- 直近3期の財務指標
  - 対象年に応じて自動で3年スライド
  - 例: 2025年総会なら2023/2024/2025年3月期など
- 指標ごとのエビデンスリンク
- 取締役候補者一覧
- 役員属性タグ
- 投資家別にどの基準に抵触しそうか
- 抵触しているのに賛成している場合の考察
  - 定性判断
  - 例外基準
  - ガイドライン文言が曖昧
  - 反対対象が別候補者

## ボーダー分析の目的

ユーザーは単純なROEだけではなく、複数基準の境界を分析したい。

対象:

- ROE
- PBR
- 政策保有株式
- 配当性向
- 株主還元
- TSR
- 在任期間
- 独立社外取締役比率
- 女性取締役数・比率

重要:

- ROEは例にすぎない。
- 「任期12年」は、12年目で反対なのか、13年目から反対なのかを投資家別に分析したい。
- 反対された企業だけでなく、同じ条件に見えるのに賛成された企業も比較したい。

## 役員報酬分類

ユーザー要望:

- 業績連動株式報酬（社内）
- 業績非連動株式報酬（社内）
- 業績連動株式報酬（社外）
- 業績非連動株式報酬（社外）
- 金額報酬

注意:

- 行使結果の理由文だけでは、ここまで分類できない場合が多い。
- 招集通知の議案本文や報酬制度説明が必要。
- まずは `detail_tags` で粗く分類し、招集通知解析が入った段階で精緻化するのがよい。

## 巨大ファイル・GitHub運用

GitHubの100MB制限に注意。

巨大化するファイル:

- `data/generated/investor_opposition_records.json`
- `data/generated/*_cases.json`
- 特に `mufg_vote_cases.json`

Actionsでは巨大ファイルをコミットしないよう対応済み。

今後の理想:

- GitHubには軽量サマリーだけ
- 生データはSupabase、SQLite、DuckDB、または外部ストレージ
- UIはAPI/DBからページング取得

## よく使うコマンド

```bash
npm run dev:proxy
npm run build
npm run validate
npm run collect:data
npm run edinet:discover -- --from=2025-06-01 --to=2025-06-30 --limit=25 --delay=2000
npm run edinet:download -- --limit=10 --type=1 --delay=2000
npm run analyze:structured-votes
npm run build:opposition-records
npm run split:opposition-records
npm run build:opposition-focus
```

## 現在の注意点

- GitHub Actionsは成功済みだが、ローカル作業ツリーには多数の未コミット変更が残っている。
- いきなり `git reset --hard` しないこと。
- Claude Codeで作業開始する前に `git status` を確認する。
- remote側はActionsのbot commitで進んでいる可能性がある。ローカル変更と衝突し得るため、pullは慎重に。
- APIキーはGitHub Secretsにあり、ファイルには書かない。
- `data/generated/sources/` は取得ファイル置き場で、通常コミットしない。

## 次にやるとよい順番

1. 企業詳細ページの不足表示を整理
   - 財務指標、役員属性、エビデンスリンク、未登録表示
2. EDINET取得済み文書から財務指標抽出スクリプトを作る
   - まずはROE/PBR/自己資本/純利益/株主資本
3. EDINETまたは招集通知から役員属性抽出の中間データを作る
   - `convocation_candidates.json` または `edinet_directors.json`
4. 投資家行使結果と候補者番号を照合
   - `company_code + meeting_date + resolution_number + candidate_number`
5. 企業詳細ページで「どの投資家が何の基準で反対し得るか」を見やすくする
6. ボーダー分析をROE以外に拡張
   - PBR、政策保有株式、配当性向、株主還元、在任期間
7. 巨大JSONをDBへ移す設計を検討

## ユーザーへの説明で大事なこと

- 「自動取得」はCodexが毎週動くのではなく、GitHub Actionsがスケジュール実行する。
- EDINET APIはGitHub Secretsの `EDINET_API_KEY` で動く。
- Actionsは成功済みなので、自動取得の土台は完了。
- ただし企業FACTデータはまだ薄い。次フェーズは企業情報拡充。
- UIは気に入っているので、デザイン変更よりデータ・分析精度を上げる。
