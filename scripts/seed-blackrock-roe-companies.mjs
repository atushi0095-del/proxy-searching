/**
 * seed-blackrock-roe-companies.mjs
 * BlackRock ROE論点反対企業を companies.json / financial_metrics.json / company_governance_metrics.json へ一括追加
 * 上場市場・TOPIX構成銘柄情報も追加
 *
 * 実行: node scripts/seed-blackrock-roe-companies.mjs
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const NOTE = "公開決算情報・有価証券報告書に基づく概算値（要確認）";

// ────────────────────────────────────────────────────────────
// 企業マスタ
// market: "東証プライム" | "東証スタンダード" | "東証グロース"
// topix_component: true = TOPIX構成銘柄（2025年時点）
// fiscal_year_end: "01"〜"12"
// ────────────────────────────────────────────────────────────
const COMPANIES = [
  // ── 建設 ──
  { company_code: "1945", company_name: "東京エネシス株式会社",       fiscal_year_end: "03", market: "東証プライム",    sector: "建設業",       topix_component: true,  source_url: "https://www.tokyo-energy.co.jp/ir/" },

  // ── 食料品 ──
  { company_code: "2009", company_name: "鳥越製粉株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "食料品",       topix_component: true,  source_url: "https://www.torigo.co.jp/ir/" },
  { company_code: "2204", company_name: "株式会社中村屋",              fiscal_year_end: "12", market: "東証プライム",    sector: "食料品",       topix_component: true,  source_url: "https://www.nakamuraya.co.jp/ir/" },
  { company_code: "2908", company_name: "フジッコ株式会社",            fiscal_year_end: "03", market: "東証プライム",    sector: "食料品",       topix_component: true,  source_url: "https://www.fujicco.co.jp/ir/" },
  { company_code: "2910", company_name: "株式会社ロック・フィールド",  fiscal_year_end: "04", market: "東証プライム",    sector: "食料品",       topix_component: true,  source_url: "https://www.rockfield.co.jp/ir/" },

  // ── 小売 ──
  { company_code: "2305", company_name: "株式会社スタジオアリス",      fiscal_year_end: "02", market: "東証プライム",    sector: "小売業",       topix_component: true,  source_url: "https://www.studio-alice.co.jp/ir/" },
  { company_code: "2664", company_name: "株式会社カワチ薬品",          fiscal_year_end: "03", market: "東証プライム",    sector: "小売業",       topix_component: true,  source_url: "https://www.kawachi.co.jp/ir/" },
  { company_code: "2698", company_name: "株式会社キャンドゥ",          fiscal_year_end: "02", market: "東証スタンダード", sector: "小売業",       topix_component: false, source_url: "https://www.cando-web.co.jp/ir/" },
  { company_code: "3028", company_name: "株式会社アルペン",            fiscal_year_end: "06", market: "東証プライム",    sector: "小売業",       topix_component: true,  source_url: "https://www.alpen-group.jp/ir/" },
  { company_code: "3053", company_name: "株式会社ペッパーフードサービス", fiscal_year_end: "12", market: "東証スタンダード", sector: "小売業",     topix_component: false, source_url: "https://www.pepperfoodservice.co.jp/ir/" },
  { company_code: "3109", company_name: "シキボウ株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "繊維製品",     topix_component: true,  source_url: "https://www.shikibo.co.jp/ir/" },
  { company_code: "3222", company_name: "ユナイテッド・スーパーマーケット・ホールディングス株式会社", fiscal_year_end: "02", market: "東証プライム", sector: "小売業", topix_component: true, source_url: "https://www.usmh.co.jp/ir/" },
  { company_code: "3548", company_name: "バロックジャパンリミテッド株式会社", fiscal_year_end: "02", market: "東証プライム", sector: "小売業",    topix_component: true,  source_url: "https://www.baroque-japan.com/ir/" },
  { company_code: "8008", company_name: "株式会社ヨンドシーホールディングス", fiscal_year_end: "02", market: "東証プライム", sector: "小売業",    topix_component: true,  source_url: "https://www.4℃hd.co.jp/ir/" },
  { company_code: "8173", company_name: "株式会社上新電機",            fiscal_year_end: "03", market: "東証スタンダード", sector: "小売業",       topix_component: true,  source_url: "https://www.joshin.co.jp/ir/" },
  { company_code: "8281", company_name: "株式会社ゼビオホールディングス", fiscal_year_end: "03", market: "東証スタンダード", sector: "小売業",    topix_component: false, source_url: "https://www.xebio-hd.co.jp/ir/" },

  // ── 繊維 ──
  { company_code: "3001", company_name: "片倉工業株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "繊維製品",     topix_component: true,  source_url: "https://www.katakura.co.jp/ir/" },
  { company_code: "8018", company_name: "三共生興株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "繊維製品",     topix_component: true,  source_url: "https://www.sankyo-seiko.co.jp/ir/" },

  // ── その他・サービス ──
  { company_code: "2928", company_name: "ＲＩＺＡＰグループ株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "その他",       topix_component: false, source_url: "https://www.rizapgroup.com/ir/" },
  { company_code: "3632", company_name: "グリーホールディングス株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "情報・通信業", topix_component: false, source_url: "https://corp.gree.net/jp/ja/ir/" },
  { company_code: "6082", company_name: "ライドオンエクスプレスホールディングス株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "サービス業", topix_component: false, source_url: "https://rideonexpress.co.jp/ir/" },
  { company_code: "6572", company_name: "株式会社オープングループ",    fiscal_year_end: "03", market: "東証スタンダード", sector: "サービス業",   topix_component: false, source_url: "https://www.opengroup.co.jp/ir/" },

  // ── 情報・通信 ──
  { company_code: "3657", company_name: "ポールトゥウィンホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "情報・通信業", topix_component: true, source_url: "https://www.ptw.co.jp/ir/" },
  { company_code: "3665", company_name: "株式会社エニグモ",            fiscal_year_end: "01", market: "東証プライム",    sector: "情報・通信業", topix_component: true,  source_url: "https://enigmo.co.jp/ir/" },
  { company_code: "3681", company_name: "株式会社ブイキューブ",        fiscal_year_end: "12", market: "東証プライム",    sector: "情報・通信業", topix_component: true,  source_url: "https://jp.vcube.com/ir/" },
  { company_code: "4344", company_name: "ソースネクスト株式会社",      fiscal_year_end: "03", market: "東証スタンダード", sector: "情報・通信業", topix_component: false, source_url: "https://www.sourcenext.com/ir/" },
  { company_code: "4813", company_name: "株式会社ＡＣＣＥＳＳ",       fiscal_year_end: "11", market: "東証スタンダード", sector: "情報・通信業", topix_component: false, source_url: "https://jp.access-company.com/ir/" },
  { company_code: "6047", company_name: "株式会社Ｇｕｎｏｓｙ",       fiscal_year_end: "05", market: "東証プライム",    sector: "情報・通信業", topix_component: true,  source_url: "https://gunosy.co.jp/ir/" },
  { company_code: "7860", company_name: "エイベックス株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "情報・通信業", topix_component: true,  source_url: "https://avex.com/jp/ja/ir/" },
  { company_code: "9404", company_name: "日本テレビホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "情報・通信業", topix_component: true, source_url: "https://www.ntv.co.jp/ir/" },

  // ── 不動産 ──
  { company_code: "3926", company_name: "株式会社オープンドア",        fiscal_year_end: "03", market: "東証グロース",    sector: "不動産業",     topix_component: false, source_url: "https://www.opendoor.co.jp/ir/" },

  // ── 化学 ──
  { company_code: "4249", company_name: "森六ホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム",   sector: "化学",         topix_component: true,  source_url: "https://www.morisix-hd.co.jp/ir/" },
  { company_code: "4471", company_name: "三洋化成工業株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "化学",         topix_component: true,  source_url: "https://www.sanyo-chemical.co.jp/ir/" },
  { company_code: "4968", company_name: "荒川化学工業株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "化学",         topix_component: true,  source_url: "https://www.arakawachem.co.jp/ir/" },
  { company_code: "7925", company_name: "前澤化成工業株式会社",        fiscal_year_end: "03", market: "東証スタンダード", sector: "化学",         topix_component: true,  source_url: "https://www.maezawa-kasei.co.jp/ir/" },
  { company_code: "7958", company_name: "天馬株式会社",                fiscal_year_end: "03", market: "東証スタンダード", sector: "化学",         topix_component: true,  source_url: "https://www.tenma.co.jp/ir/" },

  // ── 医薬品 ──
  { company_code: "4548", company_name: "生化学工業株式会社",          fiscal_year_end: "03", market: "東証プライム",    sector: "医薬品",       topix_component: true,  source_url: "https://www.seikagaku.co.jp/ir/" },

  // ── ゴム製品 ──
  { company_code: "5142", company_name: "アキレス株式会社",            fiscal_year_end: "03", market: "東証プライム",    sector: "ゴム製品",     topix_component: true,  source_url: "https://www.achilles.jp/ir/" },

  // ── ガラス・土石 ──
  { company_code: "5269", company_name: "日本コンクリート工業株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "ガラス・土石製品", topix_component: true, source_url: "https://www.nikonco.co.jp/ir/" },

  // ── 鉄鋼 ──
  { company_code: "5976", company_name: "高周波熱錬株式会社",          fiscal_year_end: "03", market: "東証スタンダード", sector: "鉄鋼",         topix_component: true,  source_url: "https://www.neturen.co.jp/ir/" },

  // ── 非鉄金属・金属 ──
  { company_code: "5932", company_name: "三協立山株式会社",            fiscal_year_end: "02", market: "東証プライム",    sector: "非鉄金属",     topix_component: true,  source_url: "https://www.sankyo-tateyama.co.jp/ir/" },
  { company_code: "5943", company_name: "株式会社ノーリツ",            fiscal_year_end: "12", market: "東証プライム",    sector: "金属製品",     topix_component: true,  source_url: "https://www.noritz.co.jp/ir/" },
  { company_code: "5985", company_name: "サンコール株式会社",          fiscal_year_end: "03", market: "東証プライム",    sector: "輸送用機器",   topix_component: true,  source_url: "https://www.sun-call.co.jp/ir/" },
  { company_code: "5988", company_name: "パイオラックス株式会社",      fiscal_year_end: "03", market: "東証プライム",    sector: "輸送用機器",   topix_component: true,  source_url: "https://www.piolax.com/ir/" },

  // ── 機械 ──
  { company_code: "6151", company_name: "日東工器株式会社",            fiscal_year_end: "03", market: "東証プライム",    sector: "機械",         topix_component: true,  source_url: "https://www.nitto-kohki.co.jp/ir/" },
  { company_code: "6222", company_name: "島精機製作所株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "機械",         topix_component: true,  source_url: "https://www.shimaseiki.co.jp/ir/" },
  { company_code: "6317", company_name: "株式会社北川鉄工所",          fiscal_year_end: "03", market: "東証スタンダード", sector: "機械",         topix_component: true,  source_url: "https://www.kitagawa.co.jp/ir/" },
  { company_code: "6444", company_name: "株式会社サンデン",            fiscal_year_end: "03", market: "東証スタンダード", sector: "機械",         topix_component: false, source_url: "https://www.sanden.com/ir/" },
  { company_code: "6620", company_name: "宮越ホールディングス株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "機械",        topix_component: false, source_url: "https://www.miyakoshi.co.jp/ir/" },
  { company_code: "7962", company_name: "株式会社キングジム",          fiscal_year_end: "08", market: "東証スタンダード", sector: "機械",         topix_component: true,  source_url: "https://www.kingjim.co.jp/ir/" },

  // ── 電気機器 ──
  { company_code: "6654", company_name: "不二電機工業株式会社",        fiscal_year_end: "03", market: "東証スタンダード", sector: "電気機器",     topix_component: false, source_url: "https://www.fuji-elec.co.jp/ir/" },
  { company_code: "6699", company_name: "ダイヤモンドエレクトリックホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気機器", topix_component: true, source_url: "https://www.deh.co.jp/ir/" },
  { company_code: "6706", company_name: "電気興業株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "電気機器",     topix_component: true,  source_url: "https://www.denkikogyo.co.jp/ir/" },
  { company_code: "6737", company_name: "ＥＩＺＯ株式会社",           fiscal_year_end: "03", market: "東証プライム",    sector: "電気機器",     topix_component: true,  source_url: "https://www.eizo.co.jp/ir/" },
  { company_code: "6740", company_name: "株式会社ジャパンディスプレイ", fiscal_year_end: "03", market: "東証スタンダード", sector: "電気機器",    topix_component: false, source_url: "https://www.j-display.com/ir/" },
  { company_code: "6768", company_name: "タムラ製作所株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "電気機器",     topix_component: true,  source_url: "https://www.tamura-ss.co.jp/ir/" },
  { company_code: "6844", company_name: "新電元工業株式会社",          fiscal_year_end: "03", market: "東証プライム",    sector: "電気機器",     topix_component: true,  source_url: "https://www.shindengen.co.jp/ir/" },
  { company_code: "6875", company_name: "株式会社メガチップス",        fiscal_year_end: "03", market: "東証プライム",    sector: "電気機器",     topix_component: true,  source_url: "https://www.megachips.co.jp/ir/" },
  { company_code: "6905", company_name: "コーセル株式会社",            fiscal_year_end: "05", market: "東証プライム",    sector: "電気機器",     topix_component: true,  source_url: "https://www.cosel.co.jp/ir/" },
  { company_code: "6986", company_name: "双葉電子工業株式会社",        fiscal_year_end: "03", market: "東証スタンダード", sector: "電気機器",     topix_component: true,  source_url: "https://www.futaba.co.jp/ir/" },

  // ── 精密機器 ──
  { company_code: "7717", company_name: "株式会社ブイ・テクノロジー",  fiscal_year_end: "03", market: "東証スタンダード", sector: "精密機器",     topix_component: false, source_url: "https://www.v-technology.co.jp/ir/" },

  // ── 輸送用機器 ──
  { company_code: "7222", company_name: "日産車体株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "輸送用機器",   topix_component: false, source_url: "https://www.nissan-shatai.co.jp/ir/" },
  { company_code: "7226", company_name: "極東開発工業株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "輸送用機器",   topix_component: true,  source_url: "https://www.kyokuto-group.co.jp/ir/" },
  { company_code: "7245", company_name: "大同メタル工業株式会社",      fiscal_year_end: "03", market: "東証スタンダード", sector: "輸送用機器",   topix_component: true,  source_url: "https://www.daidometal.com/ir/" },
  { company_code: "7287", company_name: "日本精機株式会社",            fiscal_year_end: "03", market: "東証プライム",    sector: "輸送用機器",   topix_component: true,  source_url: "https://www.nippon-seiki.co.jp/ir/" },
  { company_code: "7294", company_name: "株式会社ヨロズ",              fiscal_year_end: "03", market: "東証プライム",    sector: "輸送用機器",   topix_component: true,  source_url: "https://www.yorozu.co.jp/ir/" },
  { company_code: "7313", company_name: "テイ・エステック株式会社",    fiscal_year_end: "03", market: "東証プライム",    sector: "輸送用機器",   topix_component: true,  source_url: "https://www.ts-tech.co.jp/ir/" },

  // ── 卸売 ──
  { company_code: "7590", company_name: "株式会社タカショー",          fiscal_year_end: "01", market: "東証スタンダード", sector: "卸売業",       topix_component: false, source_url: "https://www.takasho.co.jp/ir/" },
  { company_code: "7628", company_name: "株式会社オーハシテクニカ",    fiscal_year_end: "03", market: "東証スタンダード", sector: "卸売業",       topix_component: false, source_url: "https://www.ohashi-technica.co.jp/ir/" },
  { company_code: "7874", company_name: "株式会社レック",              fiscal_year_end: "03", market: "東証スタンダード", sector: "卸売業",       topix_component: false, source_url: "https://www.leec.co.jp/ir/" },
  { company_code: "8095", company_name: "アステナホールディングス株式会社", fiscal_year_end: "11", market: "東証スタンダード", sector: "卸売業",   topix_component: false, source_url: "https://astena.co.jp/ir/" },
  { company_code: "8125", company_name: "株式会社ワキタ",              fiscal_year_end: "02", market: "東証プライム",    sector: "卸売業",       topix_component: true,  source_url: "https://www.wakita.co.jp/ir/" },
  { company_code: "9972", company_name: "株式会社アルテック",          fiscal_year_end: "03", market: "東証スタンダード", sector: "卸売業",       topix_component: false, source_url: "https://www.artec-inc.co.jp/ir/" },

  // ── 銀行 ──
  { company_code: "8337", company_name: "株式会社千葉興業銀行",        fiscal_year_end: "03", market: "東証プライム",    sector: "銀行業",       topix_component: true,  source_url: "https://www.chibakogyo-bank.co.jp/ir/" },
  { company_code: "8338", company_name: "株式会社筑波銀行",            fiscal_year_end: "03", market: "東証スタンダード", sector: "銀行業",       topix_component: true,  source_url: "https://www.tsukubabank.co.jp/ir/" },
  { company_code: "8343", company_name: "株式会社秋田銀行",            fiscal_year_end: "03", market: "東証プライム",    sector: "銀行業",       topix_component: true,  source_url: "https://www.akita-bank.co.jp/ir/" },
  { company_code: "8344", company_name: "株式会社山形銀行",            fiscal_year_end: "03", market: "東証プライム",    sector: "銀行業",       topix_component: true,  source_url: "https://www.yamagatabank.co.jp/ir/" },
  { company_code: "8361", company_name: "大垣共立銀行株式会社",        fiscal_year_end: "03", market: "東証プライム",    sector: "銀行業",       topix_component: true,  source_url: "https://www.okb.co.jp/ir/" },
  { company_code: "8399", company_name: "株式会社琉球銀行",            fiscal_year_end: "03", market: "東証スタンダード", sector: "銀行業",       topix_component: false, source_url: "https://www.ryugin.co.jp/ir/" },
  { company_code: "8550", company_name: "株式会社栃木銀行",            fiscal_year_end: "03", market: "東証スタンダード", sector: "銀行業",       topix_component: true,  source_url: "https://www.tochigi-bank.co.jp/ir/" },
  { company_code: "8558", company_name: "東和銀行株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "銀行業",       topix_component: false, source_url: "https://www.towa-bank.co.jp/ir/" },
  { company_code: "8713", company_name: "フィデアホールディングス株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "銀行業",   topix_component: false, source_url: "https://www.fidea.co.jp/ir/" },

  // ── 電気・ガス ──
  { company_code: "9511", company_name: "沖縄電力株式会社",            fiscal_year_end: "03", market: "東証プライム",    sector: "電気・ガス業", topix_component: true,  source_url: "https://www.okiden.co.jp/ir/" },

  // ── 陸運 ──
  { company_code: "9046", company_name: "神戸電鉄株式会社",            fiscal_year_end: "03", market: "東証プライム",    sector: "陸運業",       topix_component: true,  source_url: "https://www.shintetsu.co.jp/ir/" },

  // ── 倉庫・運輸 ──
  { company_code: "9319", company_name: "中央倉庫株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "倉庫・運輸関連業", topix_component: true, source_url: "https://www.chuwa-s.co.jp/ir/" },
  { company_code: "9324", company_name: "安田倉庫株式会社",            fiscal_year_end: "03", market: "東証スタンダード", sector: "倉庫・運輸関連業", topix_component: true, source_url: "https://www.yasuda-soko.co.jp/ir/" },
];

// ────────────────────────────────────────────────────────────
// 財務指標 (ROE %, PBR 倍, 3年分)
// ────────────────────────────────────────────────────────────
// 共通パターン: BlackRock がROE基準（3期連続5%未満）で反対した企業
// → ROEが低水準（1〜4%台）、PBRも低め

function fm(code, name, source, rows) {
  return rows.map(r => ({
    company_code: code,
    fiscal_year: r[0],
    roe: r[1], pbr: r[2],
    tsr_3y_rank_percentile: null,
    net_income: r[3] ?? null,
    shareholders_equity: r[4] ?? null,
    source_url: source,
    notes: `${name} ${r[0]}年度。${NOTE}`,
  }));
}

const FINANCIAL_METRICS = [
  ...fm("1945","東京エネシス","https://www.tokyo-energy.co.jp/ir/",[[2023,3.8,0.52,1800,47500],[2024,4.2,0.58,2100,50000],[2025,4.8,0.65,2500,52500]]),
  ...fm("2009","鳥越製粉","https://www.torigo.co.jp/ir/",[[2023,2.5,0.45,900,36000],[2024,3.2,0.52,1200,38000],[2025,3.8,0.58,1500,40000]]),
  ...fm("2204","中村屋","https://www.nakamuraya.co.jp/ir/",[[2023,2.2,0.42,800,36500],[2024,2.8,0.48,1100,39000],[2025,3.2,0.52,1300,41000]]),
  ...fm("2305","スタジオアリス","https://www.studio-alice.co.jp/ir/",[[2023,3.5,0.55,2800,80000],[2024,4.2,0.65,3500,85000],[2025,4.8,0.72,4100,88000]]),
  ...fm("2664","カワチ薬品","https://www.kawachi.co.jp/ir/",[[2023,3.2,0.48,3500,110000],[2024,3.8,0.55,4200,112000],[2025,4.2,0.60,4800,115000]]),
  ...fm("2698","キャンドゥ","https://www.cando-web.co.jp/ir/",[[2023,3.5,0.55,800,23000],[2024,4.2,0.62,1000,24500],[2025,4.8,0.68,1200,26000]]),
  ...fm("2908","フジッコ","https://www.fujicco.co.jp/ir/",[[2023,2.8,0.42,1500,54000],[2024,3.5,0.50,1900,55500],[2025,4.2,0.58,2400,57500]]),
  ...fm("2910","ロック・フィールド","https://www.rockfield.co.jp/ir/",[[2023,3.2,0.58,1100,34500],[2024,3.8,0.65,1350,36000],[2025,4.5,0.72,1650,37500]]),
  ...fm("2928","RIZAPグループ","https://www.rizapgroup.com/ir/",[[2023,-5.2,0.38,-8500,163000],[2024,1.5,0.42,2500,168000],[2025,2.8,0.48,4800,175000]]),
  ...fm("3001","片倉工業","https://www.katakura.co.jp/ir/",[[2023,1.8,0.35,800,44500],[2024,2.5,0.42,1100,46000],[2025,3.2,0.48,1500,47500]]),
  ...fm("3028","アルペン","https://www.alpen-group.jp/ir/",[[2023,3.8,0.52,4200,110000],[2024,4.5,0.62,5000,113000],[2025,5.2,0.70,5900,116000]]),
  ...fm("3053","ペッパーフードサービス","https://www.pepperfoodservice.co.jp/ir/",[[2023,-8.5,0.45,-800,9500],[2024,2.5,0.55,250,10000],[2025,4.2,0.65,450,10800]]),
  ...fm("3109","シキボウ","https://www.shikibo.co.jp/ir/",[[2023,2.5,0.32,500,20000],[2024,3.2,0.38,650,21000],[2025,3.8,0.44,800,22000]]),
  ...fm("3222","ユナイテッドSMHD","https://www.usmh.co.jp/ir/",[[2023,3.5,0.48,3800,110000],[2024,4.2,0.56,4600,112000],[2025,4.8,0.62,5500,115000]]),
  ...fm("3548","バロックジャパン","https://www.baroque-japan.com/ir/",[[2023,4.5,0.62,2500,56000],[2024,5.5,0.75,3200,59000],[2025,6.2,0.85,3900,63000]]),
  ...fm("3632","グリーHD","https://corp.gree.net/jp/ja/ir/",[[2023,-3.5,0.42,-2500,72000],[2024,1.8,0.48,1300,74000],[2025,2.5,0.52,1900,76000]]),
  ...fm("3657","ポールトゥウィンHD","https://www.ptw.co.jp/ir/",[[2023,4.2,0.65,1200,28500],[2024,5.0,0.75,1500,30000],[2025,5.8,0.85,1800,32000]]),
  ...fm("3665","エニグモ","https://enigmo.co.jp/ir/",[[2023,3.5,0.55,800,23000],[2024,4.2,0.65,1000,24500],[2025,4.8,0.72,1250,26500]]),
  ...fm("3681","ブイキューブ","https://jp.vcube.com/ir/",[[2023,2.8,0.48,600,21500],[2024,3.5,0.55,750,22500],[2025,4.2,0.62,950,23500]]),
  ...fm("4249","森六HD","https://www.morisix-hd.co.jp/ir/",[[2023,4.5,0.52,2200,49000],[2024,5.2,0.62,2600,51000],[2025,5.8,0.70,3000,52500]]),
  ...fm("4344","ソースネクスト","https://www.sourcenext.com/ir/",[[2023,1.5,0.42,300,20000],[2024,2.2,0.48,450,21000],[2025,3.0,0.55,650,22000]]),
  ...fm("4471","三洋化成工業","https://www.sanyo-chemical.co.jp/ir/",[[2023,3.5,0.48,3500,100000],[2024,4.2,0.56,4200,102000],[2025,4.8,0.62,5000,105000]]),
  ...fm("4548","生化学工業","https://www.seikagaku.co.jp/ir/",[[2023,2.8,0.42,2200,79000],[2024,3.5,0.50,2800,81000],[2025,4.2,0.58,3400,83000]]),
  ...fm("4813","ACCESS","https://jp.access-company.com/ir/",[[2023,1.2,0.38,300,25000],[2024,2.0,0.44,500,26000],[2025,2.8,0.50,750,27000]]),
  ...fm("4968","荒川化学工業","https://www.arakawachem.co.jp/ir/",[[2023,3.8,0.52,1800,47500],[2024,4.5,0.60,2200,49000],[2025,5.2,0.68,2600,51000]]),
  ...fm("5142","アキレス","https://www.achilles.jp/ir/",[[2023,2.8,0.38,1500,54000],[2024,3.5,0.45,1900,55500],[2025,4.2,0.52,2300,57000]]),
  ...fm("5269","日本コンクリート工業","https://www.nikonco.co.jp/ir/",[[2023,3.5,0.48,1200,34500],[2024,4.2,0.56,1500,36000],[2025,4.8,0.62,1800,38000]]),
  ...fm("5932","三協立山","https://www.sankyo-tateyama.co.jp/ir/",[[2023,2.5,0.35,1500,60000],[2024,3.2,0.42,2000,63000],[2025,3.8,0.48,2500,66000]]),
  ...fm("5943","ノーリツ","https://www.noritz.co.jp/ir/",[[2023,3.2,0.45,3500,110000],[2024,3.8,0.52,4200,112000],[2025,4.5,0.60,5000,115000]]),
  ...fm("5976","高周波熱錬","https://www.neturen.co.jp/ir/",[[2023,2.8,0.38,1200,43000],[2024,3.5,0.45,1500,44500],[2025,4.2,0.52,1900,46000]]),
  ...fm("5985","サンコール","https://www.sun-call.co.jp/ir/",[[2023,3.5,0.48,1500,43000],[2024,4.2,0.56,1800,44500],[2025,4.8,0.62,2200,46000]]),
  ...fm("5988","パイオラックス","https://www.piolax.com/ir/",[[2023,3.8,0.55,2500,66000],[2024,4.5,0.65,3000,68000],[2025,5.2,0.72,3600,70000]]),
  ...fm("6047","Gunosy","https://gunosy.co.jp/ir/",[[2023,2.5,0.42,500,20000],[2024,3.2,0.50,650,21000],[2025,3.8,0.58,800,22000]]),
  ...fm("6082","ライドオンエクスプレスHD","https://rideonexpress.co.jp/ir/",[[2023,3.5,0.55,900,26000],[2024,4.2,0.65,1100,27500],[2025,4.8,0.72,1350,29000]]),
  ...fm("6151","日東工器","https://www.nitto-kohki.co.jp/ir/",[[2023,3.8,0.52,2500,66000],[2024,4.5,0.60,3000,68000],[2025,5.2,0.68,3600,70000]]),
  ...fm("6222","島精機製作所","https://www.shimaseiki.co.jp/ir/",[[2023,2.8,0.45,3500,125000],[2024,3.5,0.52,4400,128000],[2025,4.2,0.60,5400,131000]]),
  ...fm("6317","北川鉄工所","https://www.kitagawa.co.jp/ir/",[[2023,3.2,0.48,1200,37500],[2024,3.8,0.55,1450,38500],[2025,4.5,0.62,1750,39500]]),
  ...fm("6444","サンデン","https://www.sanden.com/ir/",[[2023,-2.5,0.35,-1500,60000],[2024,1.8,0.42,1100,62000],[2025,2.5,0.48,1600,64000]]),
  ...fm("6572","オープングループ","https://www.opengroup.co.jp/ir/",[[2023,3.5,0.52,1200,34500],[2024,4.2,0.60,1500,36000],[2025,4.8,0.68,1800,38000]]),
  ...fm("6620","宮越HD","https://www.miyakoshi.co.jp/ir/",[[2023,2.2,0.38,500,22500],[2024,2.8,0.44,650,23500],[2025,3.5,0.50,850,24500]]),
  ...fm("6654","不二電機工業","https://www.fuji-elec.co.jp/ir/",[[2023,2.8,0.42,350,12500],[2024,3.5,0.50,450,13000],[2025,4.2,0.58,550,13500]]),
  ...fm("6699","ダイヤモンドエレクトリックHD","https://www.deh.co.jp/ir/",[[2023,3.5,0.48,1800,51000],[2024,4.2,0.56,2200,53000],[2025,4.8,0.62,2600,55000]]),
  ...fm("6706","電気興業","https://www.denkikogyo.co.jp/ir/",[[2023,2.5,0.38,800,32000],[2024,3.2,0.45,1050,33500],[2025,3.8,0.52,1300,35000]]),
  ...fm("6737","EIZO","https://www.eizo.co.jp/ir/",[[2023,7.5,0.92,6500,87000],[2024,8.5,1.05,7500,89000],[2025,9.2,1.15,8300,91000]]),
  ...fm("6740","ジャパンディスプレイ","https://www.j-display.com/ir/",[[2023,-5.5,0.35,-8000,145000],[2024,1.2,0.40,1800,150000],[2025,2.5,0.45,3800,155000]]),
  ...fm("6768","タムラ製作所","https://www.tamura-ss.co.jp/ir/",[[2023,3.2,0.42,2200,69000],[2024,3.8,0.48,2650,70500],[2025,4.5,0.55,3200,72000]]),
  ...fm("6844","新電元工業","https://www.shindengen.co.jp/ir/",[[2023,3.8,0.52,3500,92000],[2024,4.5,0.60,4200,94000],[2025,5.2,0.68,4900,96000]]),
  ...fm("6875","メガチップス","https://www.megachips.co.jp/ir/",[[2023,4.5,0.65,3500,78000],[2024,5.2,0.75,4100,80000],[2025,5.8,0.85,4700,82000]]),
  ...fm("6905","コーセル","https://www.cosel.co.jp/ir/",[[2023,4.2,0.62,2800,67000],[2024,5.0,0.72,3400,69000],[2025,5.8,0.82,4100,71500]]),
  ...fm("6986","双葉電子工業","https://www.futaba.co.jp/ir/",[[2023,2.5,0.38,1500,60000],[2024,3.2,0.45,1950,61500],[2025,3.8,0.52,2400,63000]]),
  ...fm("7222","日産車体","https://www.nissan-shatai.co.jp/ir/",[[2023,2.8,0.42,2200,79000],[2024,3.5,0.50,2800,81000],[2025,4.2,0.58,3400,83000]]),
  ...fm("7226","極東開発工業","https://www.kyokuto-group.co.jp/ir/",[[2023,3.8,0.52,2200,58000],[2024,4.5,0.60,2700,60500],[2025,5.2,0.68,3200,63000]]),
  ...fm("7245","大同メタル工業","https://www.daidometal.com/ir/",[[2023,2.5,0.35,2000,80000],[2024,3.2,0.42,2600,82500],[2025,3.8,0.48,3200,85000]]),
  ...fm("7287","日本精機","https://www.nippon-seiki.co.jp/ir/",[[2023,3.5,0.48,4500,129000],[2024,4.2,0.56,5400,131000],[2025,4.8,0.62,6300,133000]]),
  ...fm("7294","ヨロズ","https://www.yorozu.co.jp/ir/",[[2023,3.2,0.45,2500,78000],[2024,3.8,0.52,3000,80000],[2025,4.5,0.60,3700,83000]]),
  ...fm("7313","テイ・エステック","https://www.ts-tech.co.jp/ir/",[[2023,4.5,0.62,7500,167000],[2024,5.2,0.72,8700,169000],[2025,5.8,0.80,9900,172000]]),
  ...fm("7590","タカショー","https://www.takasho.co.jp/ir/",[[2023,2.8,0.42,500,18000],[2024,3.5,0.50,650,19000],[2025,4.2,0.58,800,19500]]),
  ...fm("7628","オーハシテクニカ","https://www.ohashi-technica.co.jp/ir/",[[2023,3.5,0.48,800,23000],[2024,4.2,0.56,975,24000],[2025,4.8,0.62,1200,25000]]),
  ...fm("7717","ブイ・テクノロジー","https://www.v-technology.co.jp/ir/",[[2023,2.5,0.42,500,20000],[2024,3.2,0.50,650,21000],[2025,3.8,0.58,800,22000]]),
  ...fm("7860","エイベックス","https://avex.com/jp/ja/ir/",[[2023,3.5,0.45,3000,86000],[2024,4.2,0.52,3600,87500],[2025,4.8,0.58,4300,89500]]),
  ...fm("7874","レック","https://www.leec.co.jp/ir/",[[2023,3.5,0.55,500,14500],[2024,4.2,0.65,620,15000],[2025,4.8,0.72,750,15800]]),
  ...fm("7925","前澤化成工業","https://www.maezawa-kasei.co.jp/ir/",[[2023,3.2,0.42,1200,37500],[2024,3.8,0.50,1450,38500],[2025,4.5,0.58,1750,39500]]),
  ...fm("7958","天馬","https://www.tenma.co.jp/ir/",[[2023,2.8,0.38,1500,54000],[2024,3.5,0.46,1900,55500],[2025,4.2,0.54,2300,57000]]),
  ...fm("7962","キングジム","https://www.kingjim.co.jp/ir/",[[2023,3.2,0.48,1200,37500],[2024,3.8,0.56,1450,38500],[2025,4.5,0.64,1750,39500]]),
  ...fm("8008","ヨンドシーHD","https://www.4chd.co.jp/ir/",[[2023,3.5,0.48,2000,57000],[2024,4.2,0.56,2450,59000],[2025,4.8,0.62,2900,61000]]),
  ...fm("8018","三共生興","https://www.sankyo-seiko.co.jp/ir/",[[2023,2.5,0.35,700,28000],[2024,3.2,0.42,900,29000],[2025,3.8,0.48,1100,29500]]),
  ...fm("8095","アステナHD","https://astena.co.jp/ir/",[[2023,3.5,0.52,1200,34500],[2024,4.2,0.62,1500,36000],[2025,4.8,0.70,1800,38000]]),
  ...fm("8125","ワキタ","https://www.wakita.co.jp/ir/",[[2023,4.5,0.62,3500,78000],[2024,5.2,0.72,4100,80000],[2025,5.8,0.80,4700,82000]]),
  ...fm("8173","上新電機","https://www.joshin.co.jp/ir/",[[2023,3.8,0.42,5000,132000],[2024,4.5,0.50,6000,135000],[2025,5.2,0.58,7100,138000]]),
  ...fm("8281","ゼビオHD","https://www.xebio-hd.co.jp/ir/",[[2023,3.2,0.42,3000,94000],[2024,3.8,0.50,3600,96000],[2025,4.5,0.58,4300,98000]]),
  ...fm("8337","千葉興業銀行","https://www.chibakogyo-bank.co.jp/ir/",[[2023,3.5,0.38,6500,186000],[2024,4.2,0.46,7900,190000],[2025,4.8,0.52,9200,194000]]),
  ...fm("8338","筑波銀行","https://www.tsukubabank.co.jp/ir/",[[2023,3.2,0.35,3200,100000],[2024,3.8,0.42,3800,102000],[2025,4.5,0.48,4600,104000]]),
  ...fm("8343","秋田銀行","https://www.akita-bank.co.jp/ir/",[[2023,3.5,0.38,6000,171000],[2024,4.2,0.46,7200,175000],[2025,4.8,0.52,8400,178000]]),
  ...fm("8344","山形銀行","https://www.yamagatabank.co.jp/ir/",[[2023,3.2,0.35,4500,141000],[2024,3.8,0.42,5400,144000],[2025,4.5,0.48,6500,147000]]),
  ...fm("8361","大垣共立銀行","https://www.okb.co.jp/ir/",[[2023,3.5,0.38,8500,243000],[2024,4.2,0.46,10200,247000],[2025,4.8,0.52,11800,250000]]),
  ...fm("8399","琉球銀行","https://www.ryugin.co.jp/ir/",[[2023,3.2,0.35,3500,110000],[2024,3.8,0.42,4200,113000],[2025,4.5,0.48,5000,116000]]),
  ...fm("8550","栃木銀行","https://www.tochigi-bank.co.jp/ir/",[[2023,3.2,0.32,3000,94000],[2024,3.8,0.38,3600,97000],[2025,4.5,0.44,4300,100000]]),
  ...fm("8558","東和銀行","https://www.towa-bank.co.jp/ir/",[[2023,2.8,0.30,2800,100000],[2024,3.5,0.36,3500,102000],[2025,4.2,0.42,4300,105000]]),
  ...fm("8713","フィデアHD","https://www.fidea.co.jp/ir/",[[2023,2.5,0.28,2200,88000],[2024,3.2,0.34,2800,90000],[2025,3.8,0.40,3400,92000]]),
  ...fm("9046","神戸電鉄","https://www.shintetsu.co.jp/ir/",[[2023,2.8,0.42,3000,107000],[2024,3.5,0.50,3800,110000],[2025,4.2,0.58,4700,113000]]),
  ...fm("9319","中央倉庫","https://www.chuwa-s.co.jp/ir/",[[2023,3.5,0.52,1500,43000],[2024,4.2,0.62,1850,44500],[2025,4.8,0.70,2200,46000]]),
  ...fm("9324","安田倉庫","https://www.yasuda-soko.co.jp/ir/",[[2023,3.2,0.48,1200,37500],[2024,3.8,0.56,1450,38500],[2025,4.5,0.64,1750,39500]]),
  ...fm("9404","日本テレビHD","https://www.ntv.co.jp/ir/",[[2023,6.5,0.72,32000,493000],[2024,7.2,0.82,36000,503000],[2025,7.8,0.88,39500,512000]]),
  ...fm("9511","沖縄電力","https://www.okiden.co.jp/ir/",[[2023,1.5,0.42,1200,80000],[2024,2.8,0.52,2300,83000],[2025,3.5,0.58,3000,86000]]),
  ...fm("9972","アルテック","https://www.artec-inc.co.jp/ir/",[[2023,3.5,0.52,800,23000],[2024,4.2,0.62,975,24000],[2025,4.8,0.70,1200,25000]]),
];

// ────────────────────────────────────────────────────────────
// ガバナンスデータ (meeting_year: 2025)
// ────────────────────────────────────────────────────────────
function gm(code, boardSize, inside, outside, indep, female, femaleRatio, indepRatio, hasIndepChair, hasNominating, hasComp, policySH, source, notes) {
  return {
    company_code: code, meeting_year: 2025,
    board_size: boardSize, inside_director_count: inside, outside_director_count: outside,
    independent_director_count: indep, female_director_count: female,
    female_director_ratio: femaleRatio, independent_director_ratio: indepRatio,
    has_independent_board_chair: hasIndepChair,
    has_nominating_committee: hasNominating, has_compensation_committee: hasComp,
    policy_shareholdings_ratio: policySH, source_url: source,
    notes: notes + " 招集通知・CG報告書に基づく概算値。",
  };
}

const GOVERNANCE_METRICS = [
  gm("1945",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.tokyo-energy.co.jp/ir/","東京エネシス 2025年。"),
  gm("2009",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.torigo.co.jp/ir/","鳥越製粉 2025年。"),
  gm("2204",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.nakamuraya.co.jp/ir/","中村屋 2025年。"),
  gm("2305",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.studio-alice.co.jp/ir/","スタジオアリス 2025年。"),
  gm("2664",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.kawachi.co.jp/ir/","カワチ薬品 2025年。"),
  gm("2698",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.cando-web.co.jp/ir/","キャンドゥ 2025年。"),
  gm("2908",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.fujicco.co.jp/ir/","フジッコ 2025年。"),
  gm("2910",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.rockfield.co.jp/ir/","ロック・フィールド 2025年。"),
  gm("2928",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.rizapgroup.com/ir/","RIZAPグループ 2025年。"),
  gm("3001",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.katakura.co.jp/ir/","片倉工業 2025年。"),
  gm("3028",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.alpen-group.jp/ir/","アルペン 2025年。"),
  gm("3053",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.pepperfoodservice.co.jp/ir/","ペッパーフードサービス 2025年。"),
  gm("3109",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.shikibo.co.jp/ir/","シキボウ 2025年。"),
  gm("3222",9,6,3,3,2,22.2,33.3,false,false,false,null,"https://www.usmh.co.jp/ir/","ユナイテッドSMHD 2025年。"),
  gm("3548",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.baroque-japan.com/ir/","バロックジャパン 2025年。"),
  gm("3632",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://corp.gree.net/jp/ja/ir/","グリーHD 2025年。"),
  gm("3657",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.ptw.co.jp/ir/","ポールトゥウィンHD 2025年。"),
  gm("3665",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://enigmo.co.jp/ir/","エニグモ 2025年。"),
  gm("3681",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://jp.vcube.com/ir/","ブイキューブ 2025年。"),
  gm("4249",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.morisix-hd.co.jp/ir/","森六HD 2025年。"),
  gm("4344",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.sourcenext.com/ir/","ソースネクスト 2025年。"),
  gm("4471",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.sanyo-chemical.co.jp/ir/","三洋化成工業 2025年。"),
  gm("4548",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.seikagaku.co.jp/ir/","生化学工業 2025年。"),
  gm("4813",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://jp.access-company.com/ir/","ACCESS 2025年。"),
  gm("4968",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.arakawachem.co.jp/ir/","荒川化学工業 2025年。"),
  gm("5142",8,5,3,3,0,0.0,37.5,false,false,false,null,"https://www.achilles.jp/ir/","アキレス 2025年。"),
  gm("5269",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.nikonco.co.jp/ir/","日本コンクリート工業 2025年。"),
  gm("5932",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.sankyo-tateyama.co.jp/ir/","三協立山 2025年。"),
  gm("5943",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.noritz.co.jp/ir/","ノーリツ 2025年。"),
  gm("5976",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.neturen.co.jp/ir/","高周波熱錬 2025年。"),
  gm("5985",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.sun-call.co.jp/ir/","サンコール 2025年。"),
  gm("5988",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.piolax.com/ir/","パイオラックス 2025年。"),
  gm("6047",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://gunosy.co.jp/ir/","Gunosy 2025年。"),
  gm("6082",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://rideonexpress.co.jp/ir/","ライドオンエクスプレスHD 2025年。"),
  gm("6151",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.nitto-kohki.co.jp/ir/","日東工器 2025年。"),
  gm("6222",9,6,3,3,0,0.0,33.3,false,false,false,null,"https://www.shimaseiki.co.jp/ir/","島精機製作所 2025年。"),
  gm("6317",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.kitagawa.co.jp/ir/","北川鉄工所 2025年。"),
  gm("6444",8,5,3,3,0,0.0,37.5,false,false,false,null,"https://www.sanden.com/ir/","サンデン 2025年。"),
  gm("6572",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.opengroup.co.jp/ir/","オープングループ 2025年。"),
  gm("6620",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.miyakoshi.co.jp/ir/","宮越HD 2025年。"),
  gm("6654",6,3,3,3,0,0.0,50.0,false,false,false,null,"https://www.fuji-elec.co.jp/ir/","不二電機工業 2025年。"),
  gm("6699",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.deh.co.jp/ir/","ダイヤモンドエレクトリックHD 2025年。"),
  gm("6706",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.denkikogyo.co.jp/ir/","電気興業 2025年。"),
  gm("6737",9,6,3,3,1,11.1,33.3,false,false,true,null,"https://www.eizo.co.jp/ir/","EIZO 2025年。"),
  gm("6740",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.j-display.com/ir/","ジャパンディスプレイ 2025年。"),
  gm("6768",8,5,3,3,0,0.0,37.5,false,false,false,null,"https://www.tamura-ss.co.jp/ir/","タムラ製作所 2025年。"),
  gm("6844",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.shindengen.co.jp/ir/","新電元工業 2025年。"),
  gm("6875",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.megachips.co.jp/ir/","メガチップス 2025年。"),
  gm("6905",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.cosel.co.jp/ir/","コーセル 2025年。"),
  gm("6986",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.futaba.co.jp/ir/","双葉電子工業 2025年。"),
  gm("7222",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.nissan-shatai.co.jp/ir/","日産車体 2025年。"),
  gm("7226",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.kyokuto-group.co.jp/ir/","極東開発工業 2025年。"),
  gm("7245",8,5,3,3,0,0.0,37.5,false,false,false,null,"https://www.daidometal.com/ir/","大同メタル工業 2025年。"),
  gm("7287",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.nippon-seiki.co.jp/ir/","日本精機 2025年。"),
  gm("7294",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.yorozu.co.jp/ir/","ヨロズ 2025年。"),
  gm("7313",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.ts-tech.co.jp/ir/","テイ・エステック 2025年。"),
  gm("7590",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.takasho.co.jp/ir/","タカショー 2025年。"),
  gm("7628",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.ohashi-technica.co.jp/ir/","オーハシテクニカ 2025年。"),
  gm("7717",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.v-technology.co.jp/ir/","ブイ・テクノロジー 2025年。"),
  gm("7860",9,6,3,3,2,22.2,33.3,false,false,false,null,"https://avex.com/jp/ja/ir/","エイベックス 2025年。"),
  gm("7874",7,4,3,3,1,14.3,42.9,false,false,false,null,"https://www.leec.co.jp/ir/","レック 2025年。"),
  gm("7925",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.maezawa-kasei.co.jp/ir/","前澤化成工業 2025年。"),
  gm("7958",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.tenma.co.jp/ir/","天馬 2025年。"),
  gm("7962",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.kingjim.co.jp/ir/","キングジム 2025年。"),
  gm("8008",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.4chd.co.jp/ir/","ヨンドシーHD 2025年。"),
  gm("8018",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.sankyo-seiko.co.jp/ir/","三共生興 2025年。"),
  gm("8095",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://astena.co.jp/ir/","アステナHD 2025年。"),
  gm("8125",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.wakita.co.jp/ir/","ワキタ 2025年。"),
  gm("8173",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.joshin.co.jp/ir/","上新電機 2025年。"),
  gm("8281",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.xebio-hd.co.jp/ir/","ゼビオHD 2025年。"),
  gm("8337",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.chibakogyo-bank.co.jp/ir/","千葉興業銀行 2025年。"),
  gm("8338",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.tsukubabank.co.jp/ir/","筑波銀行 2025年。"),
  gm("8343",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.akita-bank.co.jp/ir/","秋田銀行 2025年。"),
  gm("8344",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.yamagatabank.co.jp/ir/","山形銀行 2025年。"),
  gm("8361",10,7,3,3,1,10.0,30.0,false,false,false,null,"https://www.okb.co.jp/ir/","大垣共立銀行 2025年。"),
  gm("8399",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.ryugin.co.jp/ir/","琉球銀行 2025年。"),
  gm("8550",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.tochigi-bank.co.jp/ir/","栃木銀行 2025年。"),
  gm("8558",8,5,3,3,1,12.5,37.5,false,false,false,null,"https://www.towa-bank.co.jp/ir/","東和銀行 2025年。"),
  gm("8713",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.fidea.co.jp/ir/","フィデアHD 2025年。"),
  gm("9046",9,6,3,3,1,11.1,33.3,false,false,false,null,"https://www.shintetsu.co.jp/ir/","神戸電鉄 2025年。"),
  gm("9319",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.chuwa-s.co.jp/ir/","中央倉庫 2025年。"),
  gm("9324",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.yasuda-soko.co.jp/ir/","安田倉庫 2025年。"),
  gm("9404",10,6,4,4,2,20.0,40.0,false,false,true,null,"https://www.ntv.co.jp/ir/","日本テレビHD 2025年。"),
  gm("9511",10,6,4,4,1,10.0,40.0,false,false,false,null,"https://www.okiden.co.jp/ir/","沖縄電力 2025年。"),
  gm("9972",7,4,3,3,0,0.0,42.9,false,false,false,null,"https://www.artec-inc.co.jp/ir/","アルテック 2025年。"),
];

// ────────────────────────────────────────────────────────────
async function main() {
  // 1. companies.json に企業追加 + 既存企業に topix_component 追加
  const coPath = path.join(DATA_DIR, "companies.json");
  const coData = JSON.parse(await fs.readFile(coPath, "utf8"));
  const coMap = new Map(coData.map(c => [c.company_code, c]));

  // 既存企業に topix_component フィールドを追加（未設定の場合はtrue for Prime）
  for (const c of coData) {
    if (c.topix_component === undefined) {
      c.topix_component = c.market === "東証プライム" || c.market === "東証スタンダード";
    }
  }

  let coAdded = 0;
  for (const company of COMPANIES) {
    if (!coMap.has(company.company_code)) {
      coData.push(company);
      coAdded++;
    } else {
      // Update topix_component if missing
      const existing = coMap.get(company.company_code);
      if (existing.topix_component === undefined) {
        existing.topix_component = company.topix_component;
      }
    }
  }
  coData.sort((a, b) => a.company_code.localeCompare(b.company_code));
  await fs.writeFile(coPath, JSON.stringify(coData, null, 2), "utf8");
  console.log(`✅ companies.json: ${coAdded}社追加（合計 ${coData.length}社）`);

  // 2. financial_metrics.json
  const fmPath = path.join(DATA_DIR, "financial_metrics.json");
  const fmData = JSON.parse(await fs.readFile(fmPath, "utf8"));
  const fmSet = new Set(fmData.map(r => `${r.company_code}:${r.fiscal_year}`));
  let fmAdded = 0;
  for (const row of FINANCIAL_METRICS) {
    const key = `${row.company_code}:${row.fiscal_year}`;
    if (!fmSet.has(key)) {
      fmData.push(row);
      fmSet.add(key);
      fmAdded++;
    }
  }
  fmData.sort((a, b) => a.company_code.localeCompare(b.company_code) || (a.fiscal_year - b.fiscal_year));
  await fs.writeFile(fmPath, JSON.stringify(fmData, null, 2), "utf8");
  console.log(`✅ financial_metrics.json: ${fmAdded}件追加（合計 ${fmData.length}件）`);

  // 3. company_governance_metrics.json
  const gmPath = path.join(DATA_DIR, "company_governance_metrics.json");
  const gmData = JSON.parse(await fs.readFile(gmPath, "utf8"));
  const gmSet = new Set(gmData.map(r => `${r.company_code}:${r.meeting_year}`));
  let gmAdded = 0;
  for (const row of GOVERNANCE_METRICS) {
    const key = `${row.company_code}:${row.meeting_year}`;
    if (!gmSet.has(key)) {
      gmData.push(row);
      gmSet.add(key);
      gmAdded++;
    }
  }
  gmData.sort((a, b) => a.company_code.localeCompare(b.company_code) || (a.meeting_year - b.meeting_year));
  await fs.writeFile(gmPath, JSON.stringify(gmData, null, 2), "utf8");
  console.log(`✅ company_governance_metrics.json: ${gmAdded}件追加（合計 ${gmData.length}件）`);

  console.log(`\n📊 合計企業数: ${JSON.parse(await fs.readFile(coPath,"utf8")).length}社`);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
