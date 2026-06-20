import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();

// ========== DIRECTORS ==========
const directors = JSON.parse(readFileSync(`${ROOT}/data/directors.json`, "utf8"));
const otherDirs = directors.filter((d) => d.company_code !== "8088");

const dirs2025 = [
  { director_id: "8088_2025_makino", company_code: "8088", name: "牧野　明次", meeting_year: 2025, is_president: false, is_chair: true, is_outside_director: false, is_female: false, has_representative_authority: true, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 27, current_title: "代表取締役会長兼CEO", attendance_rate: 100, other_company_positions: 3, notes: "1941年生。1998年6月再就任（1996年一時退任）。2026年4月にCEO離脱、代表取締役会長に。セントラル石油瓦斯㈱代表取締役会長など兼任。" },
  { director_id: "8088_2025_watanabe", company_code: "8088", name: "渡邊　敏夫", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: true, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "代表取締役副会長", attendance_rate: 100, other_company_positions: 3, notes: "代表取締役副会長。セントラル石油瓦斯㈱監査役、キンセイマテック㈱代表取締役会長など兼任。" },
  { director_id: "8088_2025_majima", company_code: "8088", name: "間島　寬", meeting_year: 2025, is_president: true, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: true, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 13, current_title: "代表取締役社長執行役員", attendance_rate: 100, other_company_positions: 0, notes: "1958年生。2012年6月取締役就任。2020年4月より代表取締役社長執行役員。2026年4月よりCEO兼任。" },
  { director_id: "8088_2025_hirota", company_code: "8088", name: "廣田　博清", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役副社長執行役員", attendance_rate: null, other_company_positions: 2, notes: "副社長執行役員。営業部門管掌、マーケティング部・社長室担当、危機管理委員会委員長。2026年AGMで退任。" },
  { director_id: "8088_2025_tsuyoshi", company_code: "8088", name: "津吉　学", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役専務執行役員", attendance_rate: 100, other_company_positions: 1, notes: "専務執行役員。水素本部長（2025時点）→2026年4月より産業ガス・機械事業本部長。" },
  { director_id: "8088_2025_fukushima", company_code: "8088", name: "福島　洋", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 3, current_title: "取締役専務執行役員", attendance_rate: 100, other_company_positions: 1, notes: "1962年生。元通商産業省（現経済産業省）審議官。2022年6月取締役就任。技術・エンジニアリング本部長、水素エネルギー担当。" },
  { director_id: "8088_2025_takayama", company_code: "8088", name: "髙山　健志", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役専務執行役員", attendance_rate: 100, other_company_positions: 0, notes: "専務執行役員。経営企画部・新システム推進部担当（2025時点）。" },
  { director_id: "8088_2025_terada", company_code: "8088", name: "寺田　和正", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 0, current_title: "取締役常務執行役員", attendance_rate: null, other_company_positions: 0, notes: "1969年生。元㈱三菱UFJ銀行執行役員（地区本部長西日本）。2025年5月入社、2025年6月新任取締役就任。経理部担当。" },
  { director_id: "8088_2025_motoori", company_code: "8088", name: "本折　憲司", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役", attendance_rate: null, other_company_positions: 0, notes: "取締役。企業経営・財務会計・グローバルスキル保有（スキルマトリックス）。" },
  { director_id: "8088_2025_mori", company_code: "8088", name: "森　詳介", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: true, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: true, is_nomination_committee_member: true, is_compensation_committee_member: true, tenure_years: 6, current_title: "社外取締役（独立役員）", attendance_rate: 100, other_company_positions: 0, notes: "1940年生。2019年6月就任（在任6年）。元関西電力代表取締役社長・会長、元関西経済連合会会長。人事・報酬委員会委員長。" },
  { director_id: "8088_2025_sato", company_code: "8088", name: "佐藤　廣士", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: true, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: true, is_compensation_committee_member: false, tenure_years: 4, current_title: "社外取締役（独立役員）", attendance_rate: 100, other_company_positions: 2, notes: "2021年6月就任（在任4年）。住友電気工業㈱社外取締役、㈱神戸製鋼所顧問兼任。人事・報酬委員会委員。" },
  { director_id: "8088_2025_suzuki", company_code: "8088", name: "鈴木　博之", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: true, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 3, current_title: "社外取締役（独立役員）", attendance_rate: 100, other_company_positions: 4, notes: "1946年生。2022年6月就任（在任3年）。丸一鋼管㈱代表取締役会長兼CEO会長執行役員兼任。" },
  { director_id: "8088_2025_saito", company_code: "8088", name: "齋藤　友紀", meeting_year: 2025, is_president: false, is_chair: false, is_outside_director: true, is_female: true, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 2, current_title: "社外取締役（独立役員）", attendance_rate: null, other_company_positions: 2, notes: "2023年6月就任（在任2年）。さくら法律事務所パートナー弁護士。クリヤマホールディングス㈱・モリ工業㈱の社外取締役（監査等委員）兼任。" },
];

const dirs2026 = [
  { director_id: "8088_2026_makino", company_code: "8088", name: "牧野　明次", meeting_year: 2026, is_president: false, is_chair: true, is_outside_director: false, is_female: false, has_representative_authority: true, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 28, current_title: "代表取締役会長", attendance_rate: 100, other_company_positions: 3, notes: "1941年生。1998年6月再就任（取締役歴通算38年）。2026年4月より代表取締役会長（CEO離脱）。セントラル石油瓦斯㈱代表取締役会長、ダイキン工業㈱社外取締役など兼任。" },
  { director_id: "8088_2026_watanabe", company_code: "8088", name: "渡邊　敏夫", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: true, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "代表取締役副会長", attendance_rate: 100, other_company_positions: 3, notes: "代表取締役副会長。セントラル石油瓦斯㈱監査役、キンセイマテック㈱代表取締役会長など兼任。" },
  { director_id: "8088_2026_majima", company_code: "8088", name: "間島　寬", meeting_year: 2026, is_president: true, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: true, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 14, current_title: "代表取締役社長執行役員兼CEO", attendance_rate: 100, other_company_positions: 0, notes: "1958年生。2012年6月取締役就任。2020年4月より代表取締役社長執行役員。2026年4月よりCEO兼任。産業ガス・機械・情報企画・経営企画部門の豊富な経験。" },
  { director_id: "8088_2026_tsuyoshi", company_code: "8088", name: "津吉　学", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役専務執行役員", attendance_rate: 100, other_company_positions: 1, notes: "専務執行役員。2026年4月より産業ガス・機械事業本部長担当。" },
  { director_id: "8088_2026_fukushima", company_code: "8088", name: "福島　洋", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 4, current_title: "取締役専務執行役員", attendance_rate: 100, other_company_positions: 1, notes: "1962年生。元通商産業省（現経済産業省）審議官。2022年6月取締役就任。技術・エンジニアリング本部長、中央研究所・岩谷水素技術研究所担当、水素エネルギー担当。" },
  { director_id: "8088_2026_takayama", company_code: "8088", name: "髙山　健志", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役専務執行役員", attendance_rate: 100, other_company_positions: 0, notes: "専務執行役員。物流部・業務部・監査部・情報企画部・新システム推進部・経営企画部・広報部・総務人事部・法務部担当。" },
  { director_id: "8088_2026_terada", company_code: "8088", name: "寺田　和正", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 1, current_title: "取締役常務執行役員", attendance_rate: 100, other_company_positions: 0, notes: "1969年生。元㈱三菱UFJ銀行執行役員（地区本部長西日本）。2025年6月就任。経理部・2026年4月より監査部担当、危機管理委員会委員長。" },
  { director_id: "8088_2026_motoori", company_code: "8088", name: "本折　憲司", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: false, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: null, current_title: "取締役", attendance_rate: 100, other_company_positions: 0, notes: "取締役。企業経営・財務会計・グローバルスキル保有（スキルマトリックス）。" },
  { director_id: "8088_2026_mori", company_code: "8088", name: "森　詳介", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: true, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: true, is_nomination_committee_member: true, is_compensation_committee_member: true, tenure_years: 7, current_title: "社外取締役（独立役員）", attendance_rate: 100, other_company_positions: 0, notes: "1940年生。2019年6月就任（在任7年）。元関西電力代表取締役社長・会長、元関西経済連合会会長。人事・報酬委員会委員長。" },
  { director_id: "8088_2026_sato", company_code: "8088", name: "佐藤　廣士", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: true, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: true, is_compensation_committee_member: false, tenure_years: 5, current_title: "社外取締役（独立役員）", attendance_rate: 100, other_company_positions: 2, notes: "2021年6月就任（在任5年）。住友電気工業㈱社外取締役、㈱神戸製鋼所顧問兼任。人事・報酬委員会委員。" },
  { director_id: "8088_2026_suzuki", company_code: "8088", name: "鈴木　博之", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: true, is_female: false, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 4, current_title: "社外取締役（独立役員）", attendance_rate: 100, other_company_positions: 4, notes: "1946年生。2022年6月就任（在任4年）。丸一鋼管㈱代表取締役会長兼CEO会長執行役員兼任。" },
  { director_id: "8088_2026_saito", company_code: "8088", name: "齋藤　友紀", meeting_year: 2026, is_president: false, is_chair: false, is_outside_director: true, is_female: true, has_representative_authority: false, is_board_chair: false, is_audit_committee_member: false, is_nomination_committee_chair: false, is_nomination_committee_member: false, is_compensation_committee_member: false, tenure_years: 3, current_title: "社外取締役（独立役員）", attendance_rate: null, other_company_positions: 2, notes: "2023年6月就任（在任3年）。さくら法律事務所パートナー弁護士。クリヤマホールディングス㈱・モリ工業㈱の社外取締役（監査等委員）兼任。" },
];

const newDirectors = [...otherDirs, ...dirs2025, ...dirs2026];
writeFileSync(`${ROOT}/data/directors.json`, JSON.stringify(newDirectors, null, 2) + "\n", "utf8");
console.log(`directors.json updated. 8088: ${dirs2025.length}(2025) + ${dirs2026.length}(2026) = ${dirs2025.length + dirs2026.length} entries`);

// ========== GOVERNANCE METRICS ==========
const gov = JSON.parse(readFileSync(`${ROOT}/data/company_governance_metrics.json`, "utf8"));
const otherGov = gov.filter((g) => g.company_code !== "8088");

const gov8088 = [
  {
    company_code: "8088",
    meeting_year: 2025,
    board_size: 13,
    inside_director_count: 9,
    outside_director_count: 4,
    independent_director_count: 4,
    female_director_count: 1,
    female_director_ratio: 7.7,
    independent_director_ratio: 30.8,
    has_independent_board_chair: false,
    has_nominating_committee: true,
    has_compensation_committee: true,
    policy_shareholdings_ratio: null,
    source_url: "https://www.iwatani.co.jp/jpn/ir/stock/shareholders/files/83/stock_convo_83rd.pdf",
    notes: "第82回定時株主総会（2025年6月18日）選任。取締役13名（社内9名・社外独立4名）。女性1名（齋藤友紀）7.7%。社外比率30.8%でBlackRock1/3閾値未達→反対。りそなAM女性10%未達→3名反対。人事・報酬委員会（諮問委員会）あり。",
  },
  {
    company_code: "8088",
    meeting_year: 2026,
    board_size: 12,
    inside_director_count: 8,
    outside_director_count: 4,
    independent_director_count: 4,
    female_director_count: 1,
    female_director_ratio: 8.3,
    independent_director_ratio: 33.3,
    has_independent_board_chair: false,
    has_nominating_committee: true,
    has_compensation_committee: true,
    policy_shareholdings_ratio: null,
    source_url: "https://www.iwatani.co.jp/jpn/ir/stock/shareholders/files/83/stock_convo_83rd.pdf",
    notes: "第83回定時株主総会（2026年6月17日）選任。取締役12名（社内8名・社外独立4名）。廣田博清退任により1名減。女性1名（齋藤友紀）8.3%で依然10%未達。社外比率33.3%（ちょうど1/3）。人事・報酬委員会（諮問委員会）委員長：森詳介。",
  },
];

const newGov = [...otherGov, ...gov8088];
writeFileSync(`${ROOT}/data/company_governance_metrics.json`, JSON.stringify(newGov, null, 2) + "\n", "utf8");
console.log("company_governance_metrics.json updated.");

// ========== FINANCIAL METRICS ==========
const fin = JSON.parse(readFileSync(`${ROOT}/data/financial_metrics.json`, "utf8"));
const otherFin = fin.filter((f) => f.company_code !== "8088");

const fin8088 = [
  {
    company_code: "8088", fiscal_year: 2023, roe: 10.25, pbr: null, tsr_3y_rank_percentile: null,
    net_income: 32022, shareholders_equity: 312230, total_assets: 656003, sales: 906261,
    operating_profit: null, eps: 139.17, bps: null, equity_ratio: 47.6,
    fiscal_period_end: "2023-03-31",
    source_url: "https://www.iwatani.co.jp/jpn/ir/stock/shareholders/files/83/stock_convo_83rd.pdf",
    notes: "第83回招集通知P20・第80期実績。連結ベース。売上9,063億、経常利益470億、純利益320億。",
  },
  {
    company_code: "8088", fiscal_year: 2024, roe: 11.78, pbr: null, tsr_3y_rank_percentile: null,
    net_income: 43468, shareholders_equity: 369034, total_assets: 830495, sales: 847888,
    operating_profit: null, eps: 188.90, bps: null, equity_ratio: 44.4,
    fiscal_period_end: "2024-03-31",
    source_url: "https://www.iwatani.co.jp/jpn/ir/stock/shareholders/files/83/stock_convo_83rd.pdf",
    notes: "第83回招集通知P20・第81期実績。連結ベース。売上8,479億、経常利益623億、純利益435億。",
  },
  {
    company_code: "8088", fiscal_year: 2025, roe: 10.19, pbr: null, tsr_3y_rank_percentile: null,
    net_income: 40465, shareholders_equity: 397209, total_assets: 873044, sales: 883011,
    operating_profit: null, eps: 175.84, bps: null, equity_ratio: 45.5,
    fiscal_period_end: "2025-03-31",
    source_url: "https://www.iwatani.co.jp/jpn/ir/stock/shareholders/files/83/stock_convo_83rd.pdf",
    notes: "第83回招集通知P20・第82期実績。連結ベース。J-Quantsとの差は端数処理（J-Quants: 40,448/397,191/10.18%）。",
  },
  {
    company_code: "8088", fiscal_year: 2026, roe: 10.62, pbr: null, tsr_3y_rank_percentile: null,
    net_income: 47666, shareholders_equity: 448995, total_assets: 899772, sales: 908522,
    operating_profit: 38318, eps: 207.10, bps: null, equity_ratio: 49.9,
    fiscal_period_end: "2026-03-31",
    source_url: "https://www.iwatani.co.jp/jpn/ir/stock/shareholders/files/83/stock_convo_83rd.pdf",
    notes: "第83回招集通知P17/P20・第83期実績。連結ベース。売上9,085億、営業利益383億、経常利益552億、純利益477億。社内ROE計算値11.6%（平均純資産使用）。中計最終目標ROE10%以上達成。",
  },
];

const newFin = [...otherFin, ...fin8088];
writeFileSync(`${ROOT}/data/financial_metrics.json`, JSON.stringify(newFin, null, 2) + "\n", "utf8");
console.log(`financial_metrics.json updated. 8088: ${fin8088.length} entries (FY2023-FY2026)`);
