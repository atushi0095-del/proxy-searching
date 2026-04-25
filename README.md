# 議決権行使 反対可能性分析アプリ

BlackRock Investment Stewardship と三菱UFJ信託銀行を初期対象に、投資家別ガイドライン、企業・取締役・財務データ、推定パターンを分けて表示するMVPです。

## 起動

```bash
npm install
npm run dev
```

既存サーバーが起動している場合は `http://localhost:3000` を開いてください。

## 実装済み

- 網羅的な `issue_type` 分類
- `guideline_rules` の拡張スキーマ
- `directors` の役職・独立性・委員会・在任期間・出席率項目
- `company_governance_metrics`
- FACT / GUIDELINE / INFERENCE を分けた表示
- 基準別の抵触可能性一覧
- 候補者別の論点別スコア
- BlackRock と三菱UFJ信託銀行の根拠区分の表示
- 実企業シードデータ: トヨタ自動車、ソニーグループ

## 主要データ

- `data/guideline_rules.json`: 投資家別ガイドラインルール
- `data/companies.json`: 企業マスター
- `data/directors.json`: 取締役候補者データ
- `data/financial_metrics.json`: ROE等の財務指標
- `data/company_governance_metrics.json`: 企業単位のガバナンス指標
- `data/guideline_sources.json`: 公式ソースリンク

## 注意

本アプリは分析支援ツールです。実際の行使判断や外部提供前には、各投資家の最新公式PDF、会社招集通知、有価証券報告書、CG報告書、行使結果ファイルを再確認してください。
