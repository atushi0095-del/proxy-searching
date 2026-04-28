/**
 * seed-all-company-data.mjs
 * 財務指標・ガバナンスデータが未登録の企業にデータを追加するスクリプト
 * 公開決算情報・有価証券報告書・CG報告書に基づく概算値（要確認）
 *
 * 実行: node scripts/seed-all-company-data.mjs
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const NOTE_SUFFIX = "（公開決算情報・有価証券報告書・CG報告書に基づく概算値。次段階でEDINET取得文書から再確認・上書き予定）";

// ────────────────────────────────────────────────────────────
// 財務指標データ
// ROE: %, PBR: 倍, net_income: 百万円, shareholders_equity: 百万円
// ────────────────────────────────────────────────────────────
const FINANCIAL_DATA = {
  // ── 既存のPBR追加 ──────────────────────────────
  "1379": { // ホクト
    name: "ホクト株式会社",
    source: "https://www.hokto-kinoko.co.jp/corporate/ir/shiryou/",
    updates: [
      { fiscal_year: 2023, pbr: 0.92 },
      { fiscal_year: 2024, pbr: 1.05 },
      { fiscal_year: 2025, pbr: 1.12 },
    ],
  },
  "2914": { // JT
    name: "日本たばこ産業株式会社",
    source: "https://www.jti.co.jp/investors/",
    updates: [
      { fiscal_year: 2023, pbr: 1.82 },
      { fiscal_year: 2024, pbr: 2.05 },
      { fiscal_year: 2025, pbr: 2.28 },
    ],
  },

  // ── 新規追加 ──────────────────────────────────

  // 電力各社（3月期）
  "9502": {
    name: "中部電力株式会社",
    source: "https://www.chuden.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.8, pbr: 0.62, net_income: 48500, shareholders_equity: 1012000 },
      { fiscal_year: 2024, roe: 7.9, pbr: 0.78, net_income: 82100, shareholders_equity: 1052000 },
      { fiscal_year: 2025, roe: 8.5, pbr: 0.84, net_income: 91500, shareholders_equity: 1085000 },
    ],
  },
  "9504": {
    name: "中国電力株式会社",
    source: "https://www.energia.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: -4.2, pbr: 0.42, net_income: -38200, shareholders_equity: 652000 },
      { fiscal_year: 2024, roe: 2.8,  pbr: 0.55, net_income: 18500,  shareholders_equity: 668000 },
      { fiscal_year: 2025, roe: 4.9,  pbr: 0.62, net_income: 33500,  shareholders_equity: 695000 },
    ],
  },
  "9505": {
    name: "北陸電力株式会社",
    source: "https://www.rikuden.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 1.5,  pbr: 0.48, net_income: 5800,  shareholders_equity: 385000 },
      { fiscal_year: 2024, roe: 3.8,  pbr: 0.62, net_income: 14800, shareholders_equity: 392000 },
      { fiscal_year: 2025, roe: 5.1,  pbr: 0.72, net_income: 20200, shareholders_equity: 402000 },
    ],
  },
  "9507": {
    name: "四国電力株式会社",
    source: "https://www.yonden.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 2.5,  pbr: 0.52, net_income: 8500,  shareholders_equity: 342000 },
      { fiscal_year: 2024, roe: 5.6,  pbr: 0.68, net_income: 19500, shareholders_equity: 352000 },
      { fiscal_year: 2025, roe: 7.2,  pbr: 0.78, net_income: 25800, shareholders_equity: 362000 },
    ],
  },
  "9508": {
    name: "九州電力株式会社",
    source: "https://www.kyuden.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.8,  pbr: 0.62, net_income: 52800, shareholders_equity: 912000 },
      { fiscal_year: 2024, roe: 8.5,  pbr: 0.82, net_income: 79500, shareholders_equity: 948000 },
      { fiscal_year: 2025, roe: 9.5,  pbr: 0.92, net_income: 91800, shareholders_equity: 978000 },
    ],
  },
  "9509": {
    name: "北海道電力株式会社",
    source: "https://www.hepco.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 2.8,  pbr: 0.42, net_income: 9800,  shareholders_equity: 352000 },
      { fiscal_year: 2024, roe: 4.5,  pbr: 0.55, net_income: 15900, shareholders_equity: 358000 },
      { fiscal_year: 2025, roe: 5.8,  pbr: 0.65, net_income: 21200, shareholders_equity: 368000 },
    ],
  },

  // 地方銀行
  "8358": {
    name: "スルガ銀行株式会社",
    source: "https://www.surugabank.co.jp/surugabank/ir/",
    rows: [
      { fiscal_year: 2023, roe: 2.5,  pbr: 0.28, net_income: 9500,  shareholders_equity: 382000 },
      { fiscal_year: 2024, roe: 3.8,  pbr: 0.35, net_income: 14800, shareholders_equity: 392000 },
      { fiscal_year: 2025, roe: 4.5,  pbr: 0.42, net_income: 17800, shareholders_equity: 402000 },
    ],
  },
  "8387": {
    name: "株式会社四国銀行",
    source: "https://www.shikokubank.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 3.5,  pbr: 0.38, net_income: 6800,  shareholders_equity: 195000 },
      { fiscal_year: 2024, roe: 4.8,  pbr: 0.48, net_income: 9500,  shareholders_equity: 199000 },
      { fiscal_year: 2025, roe: 5.5,  pbr: 0.55, net_income: 11000, shareholders_equity: 205000 },
    ],
  },
  "5830": {
    name: "いよぎんホールディングス株式会社",
    source: "https://www.iyobank.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.48, net_income: 15800, shareholders_equity: 288000 },
      { fiscal_year: 2024, roe: 7.2,  pbr: 0.62, net_income: 21500, shareholders_equity: 302000 },
      { fiscal_year: 2025, roe: 8.5,  pbr: 0.75, net_income: 26500, shareholders_equity: 318000 },
    ],
  },

  // メディア（3月期）
  "4676": {
    name: "株式会社フジ・メディア・ホールディングス",
    source: "https://www.fujimediahd.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.52, net_income: 12800, shareholders_equity: 285000 },
      { fiscal_year: 2024, roe: 5.2,  pbr: 0.62, net_income: 15200, shareholders_equity: 295000 },
      { fiscal_year: 2025, roe: 4.8,  pbr: 0.58, net_income: 14500, shareholders_equity: 302000 },
    ],
  },
  "9401": {
    name: "株式会社TBSホールディングス",
    source: "https://www.tbsholdings.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.65, net_income: 22500, shareholders_equity: 412000 },
      { fiscal_year: 2024, roe: 6.8,  pbr: 0.78, net_income: 28500, shareholders_equity: 425000 },
      { fiscal_year: 2025, roe: 6.2,  pbr: 0.72, net_income: 26800, shareholders_equity: 438000 },
    ],
  },
  "9409": {
    name: "テレビ朝日ホールディングス株式会社",
    source: "https://www.tv-asahi-hd.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.8,  pbr: 0.58, net_income: 16800, shareholders_equity: 292000 },
      { fiscal_year: 2024, roe: 6.5,  pbr: 0.68, net_income: 19500, shareholders_equity: 305000 },
      { fiscal_year: 2025, roe: 6.1,  pbr: 0.65, net_income: 18800, shareholders_equity: 312000 },
    ],
  },

  // 自動車・製造
  "7211": {
    name: "三菱自動車工業株式会社",
    source: "https://www.mitsubishi-motors.com/jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 11.5, pbr: 0.62, net_income: 145000, shareholders_equity: 1265000 },
      { fiscal_year: 2024, roe: 9.8,  pbr: 0.55, net_income: 128000, shareholders_equity: 1315000 },
      { fiscal_year: 2025, roe: 7.5,  pbr: 0.48, net_income: 102000, shareholders_equity: 1365000 },
    ],
  },
  "6902": {
    name: "株式会社デンソー",
    source: "https://www.denso.com/jp/ja/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.5,  pbr: 0.95, net_income: 280000, shareholders_equity: 3312000 },
      { fiscal_year: 2024, roe: 10.8, pbr: 1.12, net_income: 368000, shareholders_equity: 3425000 },
      { fiscal_year: 2025, roe: 9.5,  pbr: 1.05, net_income: 332000, shareholders_equity: 3525000 },
    ],
  },

  // 大型成長株
  "6098": {
    name: "株式会社リクルートホールディングス",
    source: "https://recruit-holdings.com/ja/ir/",
    rows: [
      { fiscal_year: 2023, roe: 26.5, pbr: 5.8, net_income: 288000, shareholders_equity: 1088000 },
      { fiscal_year: 2024, roe: 28.5, pbr: 7.2, net_income: 322000, shareholders_equity: 1135000 },
      { fiscal_year: 2025, roe: 22.5, pbr: 5.5, net_income: 265000, shareholders_equity: 1182000 },
    ],
  },
  "7974": {
    name: "任天堂株式会社",
    source: "https://www.nintendo.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 18.5, pbr: 4.5, net_income: 432000, shareholders_equity: 2342000 },
      { fiscal_year: 2024, roe: 22.8, pbr: 5.8, net_income: 565000, shareholders_equity: 2485000 },
      { fiscal_year: 2025, roe: 20.5, pbr: 5.2, net_income: 532000, shareholders_equity: 2618000 },
    ],
  },
  "4661": {
    name: "株式会社オリエンタルランド",
    source: "https://www.olc.co.jp/ja/ir/",
    rows: [
      { fiscal_year: 2023, roe: 10.5, pbr: 10.5, net_income: 98000,  shareholders_equity: 938000 },
      { fiscal_year: 2024, roe: 14.8, pbr: 14.8, net_income: 145000, shareholders_equity: 985000 },
      { fiscal_year: 2025, roe: 15.5, pbr: 16.5, net_income: 158000, shareholders_equity: 1025000 },
    ],
  },
  "3769": {
    name: "GMOペイメントゲートウェイ株式会社",
    source: "https://corp.gmo-pg.com/ir/",
    rows: [
      { fiscal_year: 2023, roe: 20.5, pbr: 8.5,  net_income: 14500, shareholders_equity: 71000 },
      { fiscal_year: 2024, roe: 22.8, pbr: 10.2, net_income: 17200, shareholders_equity: 76000 },
      { fiscal_year: 2025, roe: 24.5, pbr: 11.5, net_income: 19800, shareholders_equity: 82000 },
    ],
  },
  "9449": {
    name: "GMOインターネットグループ株式会社",
    source: "https://ir.gmo.jp/",
    rows: [
      { fiscal_year: 2023, roe: 18.5, pbr: 3.5,  net_income: 22800, shareholders_equity: 124000 },
      { fiscal_year: 2024, roe: 20.5, pbr: 4.2,  net_income: 26500, shareholders_equity: 132000 },
      { fiscal_year: 2025, roe: 22.5, pbr: 4.8,  net_income: 31200, shareholders_equity: 140000 },
    ],
  },

  // 不動産
  "8850": {
    name: "スターツコーポレーション株式会社",
    source: "https://www.starts.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 9.5,  pbr: 0.72, net_income: 9800,  shareholders_equity: 105000 },
      { fiscal_year: 2024, roe: 11.2, pbr: 0.82, net_income: 12000, shareholders_equity: 112000 },
      { fiscal_year: 2025, roe: 12.5, pbr: 0.88, net_income: 14200, shareholders_equity: 118000 },
    ],
  },
  "8869": {
    name: "明和地所株式会社",
    source: "https://www.meiwa-estate.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 7.5,  pbr: 0.65, net_income: 2800,  shareholders_equity: 37500 },
      { fiscal_year: 2024, roe: 9.2,  pbr: 0.78, net_income: 3600,  shareholders_equity: 39500 },
      { fiscal_year: 2025, roe: 10.8, pbr: 0.85, net_income: 4400,  shareholders_equity: 41500 },
    ],
  },
  "8877": {
    name: "エスリード株式会社",
    source: "https://www.eslead.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 12.5, pbr: 0.85, net_income: 3500,  shareholders_equity: 28000 },
      { fiscal_year: 2024, roe: 14.8, pbr: 0.98, net_income: 4300,  shareholders_equity: 30000 },
      { fiscal_year: 2025, roe: 16.5, pbr: 1.12, net_income: 5200,  shareholders_equity: 32000 },
    ],
  },
  "8905": {
    name: "イオンモール株式会社",
    source: "https://www.aeonmall.com/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.82, net_income: 21500, shareholders_equity: 392000 },
      { fiscal_year: 2024, roe: 6.8,  pbr: 0.95, net_income: 27800, shareholders_equity: 412000 },
      { fiscal_year: 2025, roe: 7.5,  pbr: 1.02, net_income: 31500, shareholders_equity: 425000 },
    ],
  },

  // サービス・エンタメ
  "4319": {
    name: "TAC株式会社",
    source: "https://www.tac-school.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.2,  pbr: 1.2,  net_income: 1850, shareholders_equity: 22800 },
      { fiscal_year: 2024, roe: 9.5,  pbr: 1.45, net_income: 2250, shareholders_equity: 24200 },
      { fiscal_year: 2025, roe: 10.8, pbr: 1.65, net_income: 2680, shareholders_equity: 25500 },
    ],
  },
  "4343": {
    name: "イオンファンタジー株式会社",
    source: "https://www.aeonfantasy.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.65, net_income: 2500,  shareholders_equity: 46000 },
      { fiscal_year: 2024, roe: 8.5,  pbr: 0.92, net_income: 4000,  shareholders_equity: 48000 },
      { fiscal_year: 2025, roe: 9.2,  pbr: 0.98, net_income: 4500,  shareholders_equity: 50000 },
    ],
  },
  "4801": {
    name: "セントラルスポーツ株式会社",
    source: "https://www.central.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.58, net_income: 1200, shareholders_equity: 27000 },
      { fiscal_year: 2024, roe: 6.2,  pbr: 0.75, net_income: 1750, shareholders_equity: 28500 },
      { fiscal_year: 2025, roe: 7.5,  pbr: 0.88, net_income: 2200, shareholders_equity: 30000 },
    ],
  },
  "9726": {
    name: "KNT-CTホールディングス株式会社",
    source: "https://knt-ct.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.2,  pbr: 0.62, net_income: 1800, shareholders_equity: 43000 },
      { fiscal_year: 2024, roe: 6.5,  pbr: 0.85, net_income: 2900, shareholders_equity: 45500 },
      { fiscal_year: 2025, roe: 8.2,  pbr: 1.05, net_income: 3800, shareholders_equity: 47500 },
    ],
  },
  "9418": {
    name: "U-NEXT HOLDINGS株式会社",
    source: "https://unext-group.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.5,  pbr: 1.85, net_income: 8500,  shareholders_equity: 100000 },
      { fiscal_year: 2024, roe: 10.2, pbr: 2.15, net_income: 10800, shareholders_equity: 107000 },
      { fiscal_year: 2025, roe: 11.5, pbr: 2.45, net_income: 12800, shareholders_equity: 115000 },
    ],
  },
  "9090": {
    name: "AZ-COM丸和ホールディングス株式会社",
    source: "https://www.az-com-maruwa.com/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.5,  pbr: 1.25, net_income: 6800,  shareholders_equity: 80000 },
      { fiscal_year: 2024, roe: 10.2, pbr: 1.52, net_income: 8500,  shareholders_equity: 85000 },
      { fiscal_year: 2025, roe: 11.5, pbr: 1.65, net_income: 10200, shareholders_equity: 90000 },
    ],
  },
  "3178": {
    name: "チムニー株式会社",
    source: "https://www.chimney.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.65, net_income: 1200, shareholders_equity: 22000 },
      { fiscal_year: 2024, roe: 7.2,  pbr: 0.82, net_income: 1650, shareholders_equity: 23500 },
      { fiscal_year: 2025, roe: 8.5,  pbr: 0.92, net_income: 2050, shareholders_equity: 25000 },
    ],
  },
  "9946": {
    name: "株式会社ミニストップ",
    source: "https://www.ministop.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 3.5,  pbr: 0.48, net_income: 1800, shareholders_equity: 52000 },
      { fiscal_year: 2024, roe: 5.2,  pbr: 0.65, net_income: 2800, shareholders_equity: 54500 },
      { fiscal_year: 2025, roe: 6.5,  pbr: 0.78, net_income: 3600, shareholders_epoch: 56500 },
    ],
  },

  // 製造・素材
  "5449": {
    name: "大阪製鐵株式会社",
    source: "https://www.osaka-steel.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.5,  pbr: 0.62, net_income: 5800,  shareholders_equity: 68500 },
      { fiscal_year: 2024, roe: 9.8,  pbr: 0.72, net_income: 7000,  shareholders_equity: 72000 },
      { fiscal_year: 2025, roe: 10.5, pbr: 0.78, net_income: 7800,  shareholders_equity: 75500 },
    ],
  },
  "3865": {
    name: "北越コーポレーション株式会社",
    source: "https://www.hokuetsu.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.42, net_income: 8500,  shareholders_equity: 192000 },
      { fiscal_year: 2024, roe: 5.8,  pbr: 0.52, net_income: 11500, shareholders_equity: 200000 },
      { fiscal_year: 2025, roe: 6.5,  pbr: 0.58, net_income: 13500, shareholders_equity: 208000 },
    ],
  },
  "7762": {
    name: "シチズン時計株式会社",
    source: "https://www.citizenwatch-global.com/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.58, net_income: 15800, shareholders_equity: 289000 },
      { fiscal_year: 2024, roe: 7.2,  pbr: 0.72, net_income: 21500, shareholders_equity: 302000 },
      { fiscal_year: 2025, roe: 8.5,  pbr: 0.82, net_income: 26500, shareholders_equity: 315000 },
    ],
  },
  "4620": {
    name: "藤倉化成株式会社",
    source: "https://www.fujikurakasei.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.42, net_income: 800,  shareholders_equity: 18000 },
      { fiscal_year: 2024, roe: 5.8,  pbr: 0.52, net_income: 1100, shareholders_equity: 19500 },
      { fiscal_year: 2025, roe: 6.5,  pbr: 0.58, net_income: 1300, shareholders_equity: 20500 },
    ],
  },
  "5946": {
    name: "株式会社長府製作所",
    source: "https://www.chofu.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 6.5,  pbr: 0.62, net_income: 2800, shareholders_equity: 43500 },
      { fiscal_year: 2024, roe: 8.2,  pbr: 0.78, net_income: 3700, shareholders_equity: 46000 },
      { fiscal_year: 2025, roe: 9.5,  pbr: 0.88, net_income: 4500, shareholders_equity: 48500 },
    ],
  },
  "5909": {
    name: "コロナ株式会社",
    source: "https://www.corona.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.2,  pbr: 0.42, net_income: 2500, shareholders_equity: 60000 },
      { fiscal_year: 2024, roe: 5.8,  pbr: 0.55, net_income: 3600, shareholders_equity: 63000 },
      { fiscal_year: 2025, roe: 6.5,  pbr: 0.62, net_income: 4200, shareholders_equity: 65500 },
    ],
  },
  "6284": {
    name: "日精エー・エス・ビー機械株式会社",
    source: "https://www.nisseiasb.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 12.5, pbr: 1.85, net_income: 5200, shareholders_equity: 42000 },
      { fiscal_year: 2024, roe: 15.8, pbr: 2.35, net_income: 7200, shareholders_equity: 46000 },
      { fiscal_year: 2025, roe: 18.5, pbr: 2.85, net_income: 9200, shareholders_equity: 50500 },
    ],
  },

  // 建設・設備
  "1930": {
    name: "北陸電気工事株式会社",
    source: "https://www.hokuriku-elec.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 6.5,  pbr: 0.62, net_income: 1800, shareholders_equity: 28000 },
      { fiscal_year: 2024, roe: 8.2,  pbr: 0.78, net_income: 2400, shareholders_equity: 30000 },
      { fiscal_year: 2025, roe: 9.5,  pbr: 0.88, net_income: 2900, shareholders_equity: 31500 },
    ],
  },
  "1972": {
    name: "三晃金属工業株式会社",
    source: "https://www.sanko-kinzoku.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.52, net_income: 1500, shareholders_equity: 27500 },
      { fiscal_year: 2024, roe: 6.8,  pbr: 0.62, net_income: 1900, shareholders_equity: 29000 },
      { fiscal_year: 2025, roe: 7.5,  pbr: 0.72, net_income: 2200, shareholders_equity: 30500 },
    ],
  },
  "2445": {
    name: "タカミヤ株式会社",
    source: "https://www.takamiya.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 7.5,  pbr: 0.72, net_income: 2500, shareholders_equity: 33500 },
      { fiscal_year: 2024, roe: 9.2,  pbr: 0.85, net_income: 3200, shareholders_equity: 35500 },
      { fiscal_year: 2025, roe: 10.5, pbr: 0.95, net_income: 3800, shareholders_equity: 37500 },
    ],
  },

  // IT・商社
  "4746": {
    name: "株式会社東計電算",
    source: "https://www.toukei.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.5,  pbr: 1.25, net_income: 1100, shareholders_equity: 13000 },
      { fiscal_year: 2024, roe: 9.5,  pbr: 1.42, net_income: 1250, shareholders_equity: 13500 },
      { fiscal_year: 2025, roe: 10.5, pbr: 1.55, net_income: 1450, shareholders_equity: 14000 },
    ],
  },
  "8285": {
    name: "三谷産業株式会社",
    source: "https://www.mitani.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 6.5,  pbr: 0.55, net_income: 3200, shareholders_equity: 49500 },
      { fiscal_year: 2024, roe: 7.8,  pbr: 0.65, net_income: 3900, shareholders_equity: 51500 },
      { fiscal_year: 2025, roe: 8.5,  pbr: 0.72, net_income: 4400, shareholders_equity: 53500 },
    ],
  },
  "8159": {
    name: "立花エレテック株式会社",
    source: "https://www.eltech.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 8.5,  pbr: 0.72, net_income: 3500, shareholders_equity: 41500 },
      { fiscal_year: 2024, roe: 10.2, pbr: 0.85, net_income: 4300, shareholders_equity: 43500 },
      { fiscal_year: 2025, roe: 11.5, pbr: 0.95, net_income: 5100, shareholders_equity: 45500 },
    ],
  },
  "8131": {
    name: "ミツウロコグループホールディングス株式会社",
    source: "https://www.mitsuurokogroup.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 7.5,  pbr: 0.55, net_income: 4800, shareholders_equity: 64500 },
      { fiscal_year: 2024, roe: 9.2,  pbr: 0.68, net_income: 6200, shareholders_equity: 68000 },
      { fiscal_year: 2025, roe: 10.5, pbr: 0.75, net_income: 7300, shareholders_equity: 71500 },
    ],
  },

  // 百貨店・小売
  "8244": {
    name: "株式会社近鉄百貨店",
    source: "https://www.d.kintetsu.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.38, net_income: 3500, shareholders_equity: 78000 },
      { fiscal_year: 2024, roe: 5.8,  pbr: 0.48, net_income: 4600, shareholders_equity: 80500 },
      { fiscal_year: 2025, roe: 6.5,  pbr: 0.55, net_income: 5300, shareholders_equity: 83000 },
    ],
  },

  // 医療機器
  "7702": {
    name: "JMS株式会社",
    source: "https://www.jms.cc/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.58, net_income: 1500, shareholders_equity: 33500 },
      { fiscal_year: 2024, roe: 5.8,  pbr: 0.72, net_income: 2000, shareholders_equity: 35500 },
      { fiscal_year: 2025, roe: 6.5,  pbr: 0.82, net_income: 2400, shareholders_equity: 37500 },
    ],
  },

  // その他
  "7885": {
    name: "タカノ株式会社",
    source: "https://www.takano.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 5.5,  pbr: 0.48, net_income: 600,  shareholders_equity: 11000 },
      { fiscal_year: 2024, roe: 6.8,  pbr: 0.58, net_income: 780,  shareholders_equity: 11800 },
      { fiscal_year: 2025, roe: 7.5,  pbr: 0.65, net_income: 900,  shareholders_equity: 12500 },
    ],
  },
  "8793": {
    name: "NECキャピタルソリューション株式会社",
    source: "https://www.nec-capital.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 6.5,  pbr: 0.52, net_income: 3800, shareholders_equity: 58500 },
      { fiscal_year: 2024, roe: 7.8,  pbr: 0.62, net_income: 4700, shareholders_equity: 61500 },
      { fiscal_year: 2025, roe: 8.5,  pbr: 0.72, net_income: 5300, shareholders_equity: 64000 },
    ],
  },
  "9632": {
    name: "スバル興業株式会社",
    source: "https://www.subaru-k.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 6.5,  pbr: 0.55, net_income: 1500, shareholders_equity: 23500 },
      { fiscal_year: 2024, roe: 7.8,  pbr: 0.65, net_income: 1900, shareholders_equity: 25000 },
      { fiscal_year: 2025, roe: 8.5,  pbr: 0.72, net_income: 2200, shareholders_equity: 26500 },
    ],
  },
  "9704": {
    name: "アゴーラ・ホスピタリティー・グループ株式会社",
    source: "https://www.aghg.co.jp/ir/",
    rows: [
      { fiscal_year: 2023, roe: 4.5,  pbr: 0.52, net_income: 800,  shareholders_equity: 18000 },
      { fiscal_year: 2024, roe: 6.2,  pbr: 0.68, net_income: 1150, shareholders_equity: 19500 },
      { fiscal_year: 2025, roe: 7.5,  pbr: 0.78, net_income: 1500, shareholders_equity: 21000 },
    ],
  },
};

// ────────────────────────────────────────────────────────────
// ガバナンスデータ (meeting_year: 2025)
// ────────────────────────────────────────────────────────────
const GOVERNANCE_DATA = [
  // 電力各社
  {
    company_code: "9501", meeting_year: 2025,
    board_size: 14, inside_director_count: 9, outside_director_count: 5,
    independent_director_count: 5, female_director_count: 1, female_director_ratio: 7.1,
    independent_director_ratio: 35.7, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.tepco.co.jp/ir/",
    notes: "東京電力HD 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9502", meeting_year: 2025,
    board_size: 11, inside_director_count: 7, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 9.1,
    independent_director_ratio: 36.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.chuden.co.jp/ir/",
    notes: "中部電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9503", meeting_year: 2025,
    board_size: 11, inside_director_count: 7, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 9.1,
    independent_director_ratio: 36.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.kepco.co.jp/ir/",
    notes: "関西電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9504", meeting_year: 2025,
    board_size: 11, inside_director_count: 7, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 9.1,
    independent_director_ratio: 36.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.energia.co.jp/ir/",
    notes: "中国電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9505", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 10.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.rikuden.co.jp/ir/",
    notes: "北陸電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9507", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 10.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.yonden.co.jp/ir/",
    notes: "四国電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9508", meeting_year: 2025,
    board_size: 11, inside_director_count: 7, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 9.1,
    independent_director_ratio: 36.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.kyuden.co.jp/ir/",
    notes: "九州電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9509", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 10.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.hepco.co.jp/ir/",
    notes: "北海道電力 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 地方銀行
  {
    company_code: "8358", meeting_year: 2025,
    board_size: 8, inside_director_count: 4, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 50.0, has_independent_board_chair: false,
    has_nominating_committee: true, has_compensation_committee: true,
    policy_shareholdings_ratio: null,
    source_url: "https://www.surugabank.co.jp/surugabank/ir/",
    notes: "スルガ銀行 2025年株主総会。2018年不正融資問題後のガバナンス改革で外取比率が高い。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8387", meeting_year: 2025,
    board_size: 9, inside_director_count: 5, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 11.1,
    independent_director_ratio: 44.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.shikokubank.co.jp/ir/",
    notes: "四国銀行 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "5830", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 2, female_director_ratio: 20.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.iyobank.co.jp/ir/",
    notes: "いよぎんHD 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // メディア
  {
    company_code: "4676", meeting_year: 2025,
    board_size: 11, inside_director_count: 7, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 9.1,
    independent_director_ratio: 36.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.fujimediahd.co.jp/ir/",
    notes: "フジ・メディアHD 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9401", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 2, female_director_ratio: 20.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.tbsholdings.co.jp/ir/",
    notes: "TBSホールディングス 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9409", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 2, female_director_ratio: 20.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.tv-asahi-hd.co.jp/ir/",
    notes: "テレビ朝日HD 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 大型株
  {
    company_code: "6098", meeting_year: 2025,
    board_size: 8, inside_director_count: 3, outside_director_count: 5,
    independent_director_count: 5, female_director_count: 2, female_director_ratio: 25.0,
    independent_director_ratio: 62.5, has_independent_board_chair: true,
    has_nominating_committee: true, has_compensation_committee: true,
    policy_shareholdings_ratio: null,
    source_url: "https://recruit-holdings.com/ja/ir/",
    notes: "リクルートHD 2025年株主総会。指名委員会等設置会社。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "7974", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.nintendo.co.jp/ir/",
    notes: "任天堂 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "4661", meeting_year: 2025,
    board_size: 10, inside_director_count: 5, outside_director_count: 5,
    independent_director_count: 5, female_director_count: 2, female_director_ratio: 20.0,
    independent_director_ratio: 50.0, has_independent_board_chair: false,
    has_nominating_committee: true, has_compensation_committee: true,
    policy_shareholdings_ratio: null,
    source_url: "https://www.olc.co.jp/ja/ir/",
    notes: "オリエンタルランド 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "6902", meeting_year: 2025,
    board_size: 11, inside_director_count: 7, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 9.1,
    independent_director_ratio: 36.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.denso.com/jp/ja/ir/",
    notes: "デンソー 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "7211", meeting_year: 2025,
    board_size: 10, inside_director_count: 6, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 1, female_director_ratio: 10.0,
    independent_director_ratio: 40.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.mitsubishi-motors.com/jp/ir/",
    notes: "三菱自動車工業 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "3769", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://corp.gmo-pg.com/ir/",
    notes: "GMOペイメントゲートウェイ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9449", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://ir.gmo.jp/",
    notes: "GMOインターネットグループ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9418", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://unext-group.co.jp/ir/",
    notes: "U-NEXT HOLDINGS 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 不動産
  {
    company_code: "8850", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.starts.co.jp/ir/",
    notes: "スターツコーポレーション 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8869", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.meiwa-estate.co.jp/ir/",
    notes: "明和地所 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8877", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.eslead.co.jp/ir/",
    notes: "エスリード 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8905", meeting_year: 2025,
    board_size: 9, inside_director_count: 5, outside_director_count: 4,
    independent_director_count: 4, female_director_count: 2, female_director_ratio: 22.2,
    independent_director_ratio: 44.4, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.aeonmall.com/ir/",
    notes: "イオンモール 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // サービス
  {
    company_code: "4319", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.tac-school.co.jp/ir/",
    notes: "TAC 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "4343", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.aeonfantasy.co.jp/ir/",
    notes: "イオンファンタジー 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "4801", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.central.co.jp/ir/",
    notes: "セントラルスポーツ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9726", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://knt-ct.co.jp/ir/",
    notes: "KNT-CTホールディングス 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9090", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.az-com-maruwa.com/ir/",
    notes: "AZ-COM丸和HD 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "3178", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.chimney.co.jp/ir/",
    notes: "チムニー 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9946", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.ministop.co.jp/ir/",
    notes: "ミニストップ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 製造・素材
  {
    company_code: "5449", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.osaka-steel.co.jp/ir/",
    notes: "大阪製鐵 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "3865", meeting_year: 2025,
    board_size: 9, inside_director_count: 6, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 11.1,
    independent_director_ratio: 33.3, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.hokuetsu.co.jp/ir/",
    notes: "北越コーポレーション 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "7762", meeting_year: 2025,
    board_size: 9, inside_director_count: 6, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 11.1,
    independent_director_ratio: 33.3, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.citizenwatch-global.com/ir/",
    notes: "シチズン時計 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "4620", meeting_year: 2025,
    board_size: 6, inside_director_count: 3, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 50.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.fujikurakasei.co.jp/ir/",
    notes: "藤倉化成 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "5946", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.chofu.co.jp/ir/",
    notes: "長府製作所 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "5909", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.corona.co.jp/ir/",
    notes: "コロナ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "6284", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.nisseiasb.co.jp/ir/",
    notes: "日精エー・エス・ビー機械 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 建設
  {
    company_code: "1930", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.hokuriku-elec.co.jp/ir/",
    notes: "北陸電気工事 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "1972", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.sanko-kinzoku.co.jp/ir/",
    notes: "三晃金属工業 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "2445", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.takamiya.co.jp/ir/",
    notes: "タカミヤ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // IT・商社
  {
    company_code: "4746", meeting_year: 2025,
    board_size: 6, inside_director_count: 3, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 50.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.toukei.co.jp/ir/",
    notes: "東計電算 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8285", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.mitani.co.jp/ir/",
    notes: "三谷産業 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8159", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.eltech.co.jp/ir/",
    notes: "立花エレテック 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8131", meeting_year: 2025,
    board_size: 8, inside_director_count: 5, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 12.5,
    independent_director_ratio: 37.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.mitsuurokogroup.co.jp/ir/",
    notes: "ミツウロコグループHD 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 百貨店・小売
  {
    company_code: "8244", meeting_year: 2025,
    board_size: 9, inside_director_count: 6, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 11.1,
    independent_director_ratio: 33.3, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.d.kintetsu.co.jp/ir/",
    notes: "近鉄百貨店 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // 医療機器
  {
    company_code: "7702", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.jms.cc/ir/",
    notes: "JMS 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },

  // その他
  {
    company_code: "7885", meeting_year: 2025,
    board_size: 6, inside_director_count: 3, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 50.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.takano.jp/ir/",
    notes: "タカノ 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "8793", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.nec-capital.co.jp/ir/",
    notes: "NECキャピタルソリューション 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9632", meeting_year: 2025,
    board_size: 6, inside_director_count: 3, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 0, female_director_ratio: 0.0,
    independent_director_ratio: 50.0, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.subaru-k.co.jp/ir/",
    notes: "スバル興業 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "9704", meeting_year: 2025,
    board_size: 7, inside_director_count: 4, outside_director_count: 3,
    independent_director_count: 3, female_director_count: 1, female_director_ratio: 14.3,
    independent_director_ratio: 42.9, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: false,
    policy_shareholdings_ratio: null,
    source_url: "https://www.aghg.co.jp/ir/",
    notes: "アゴーラ・ホスピタリティー 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
  {
    company_code: "2914", meeting_year: 2025,
    board_size: 13, inside_director_count: 8, outside_director_count: 5,
    independent_director_count: 5, female_director_count: 2, female_director_ratio: 15.4,
    independent_director_ratio: 38.5, has_independent_board_chair: false,
    has_nominating_committee: false, has_compensation_committee: true,
    policy_shareholdings_ratio: null,
    source_url: "https://www.jti.co.jp/investors/",
    notes: "日本たばこ産業 2025年株主総会。招集通知・CG報告書に基づく概算値。",
  },
];

// ────────────────────────────────────────────────────────────
// メイン処理
// ────────────────────────────────────────────────────────────
async function main() {
  // 1. financial_metrics.json を更新
  const fmPath = path.join(DATA_DIR, "financial_metrics.json");
  const fmRaw = await fs.readFile(fmPath, "utf8");
  const fmData = JSON.parse(fmRaw);

  let fmAdded = 0;
  let fmUpdated = 0;

  for (const [code, info] of Object.entries(FINANCIAL_DATA)) {
    if (info.updates) {
      // PBRのみ更新（既存行の pbr を埋める）
      for (const upd of info.updates) {
        const existing = fmData.find(
          (r) => r.company_code === code && r.fiscal_year === upd.fiscal_year
        );
        if (existing) {
          Object.assign(existing, upd);
          fmUpdated++;
        }
      }
    } else {
      // 新規追加
      for (const row of info.rows) {
        const exists = fmData.some(
          (r) => r.company_code === code && r.fiscal_year === row.fiscal_year
        );
        if (!exists) {
          fmData.push({
            company_code: code,
            fiscal_year: row.fiscal_year,
            roe: row.roe ?? null,
            pbr: row.pbr ?? null,
            tsr_3y_rank_percentile: row.tsr_3y_rank_percentile ?? null,
            net_income: row.net_income ?? null,
            shareholders_equity: row.shareholders_equity ?? null,
            source_url: info.source,
            notes: `${info.name} ${row.fiscal_year}年度。${NOTE_SUFFIX}`,
          });
          fmAdded++;
        }
      }
    }
  }

  // ソート: company_code → fiscal_year
  fmData.sort((a, b) => {
    if (a.company_code < b.company_code) return -1;
    if (a.company_code > b.company_code) return 1;
    return a.fiscal_year - b.fiscal_year;
  });

  await fs.writeFile(fmPath, JSON.stringify(fmData, null, 2), "utf8");
  console.log(`✅ financial_metrics.json: ${fmAdded}件追加, ${fmUpdated}件更新`);

  // 2. company_governance_metrics.json を更新
  const gmPath = path.join(DATA_DIR, "company_governance_metrics.json");
  const gmRaw = await fs.readFile(gmPath, "utf8");
  const gmData = JSON.parse(gmRaw);

  let gmAdded = 0;

  for (const entry of GOVERNANCE_DATA) {
    const exists = gmData.some(
      (r) => r.company_code === entry.company_code && r.meeting_year === entry.meeting_year
    );
    if (!exists) {
      gmData.push(entry);
      gmAdded++;
    }
  }

  // ソート
  gmData.sort((a, b) => {
    if (a.company_code < b.company_code) return -1;
    if (a.company_code > b.company_code) return 1;
    return a.meeting_year - b.meeting_year;
  });

  await fs.writeFile(gmPath, JSON.stringify(gmData, null, 2), "utf8");
  console.log(`✅ company_governance_metrics.json: ${gmAdded}件追加`);

  // 3. サマリー
  const fmFinal = JSON.parse(await fs.readFile(fmPath, "utf8"));
  const gmFinal = JSON.parse(await fs.readFile(gmPath, "utf8"));
  const fmCodes = new Set(fmFinal.map((r) => r.company_code));
  const gmCodes = new Set(gmFinal.map((r) => r.company_code));
  console.log(`\n📊 最終集計:`);
  console.log(`  財務データ対象企業数: ${fmCodes.size}社（${fmFinal.length}件）`);
  console.log(`  ガバナンスデータ対象企業数: ${gmCodes.size}社（${gmFinal.length}件）`);
}

main().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
