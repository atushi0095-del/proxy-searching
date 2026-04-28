import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const companiesPath = path.join(ROOT, "data", "companies.json");
const companies = JSON.parse(fs.readFileSync(companiesPath, "utf8"));
const existing = new Set(companies.map((c) => c.company_code));

const newCompanies = [
  { company_code: "9503", company_name: "関西電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.kepco.co.jp/" },
  { company_code: "9508", company_name: "九州電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.kyuden.co.jp/" },
  { company_code: "9501", company_name: "東京電力ホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.tepco.co.jp/" },
  { company_code: "9502", company_name: "中部電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.chuden.co.jp/" },
  { company_code: "9504", company_name: "中国電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.energia.co.jp/" },
  { company_code: "9505", company_name: "北陸電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.rikuden.co.jp/" },
  { company_code: "9507", company_name: "四国電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.yonden.co.jp/" },
  { company_code: "9509", company_name: "北海道電力株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "電気・ガス業", source_url: "https://www.hepco.co.jp/" },
  { company_code: "4676", company_name: "株式会社フジ・メディア・ホールディングス", fiscal_year_end: "03", market: "東証プライム", sector: "情報・通信業", source_url: "https://www.fujimediahd.co.jp/" },
  { company_code: "9409", company_name: "テレビ朝日ホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "情報・通信業", source_url: "https://www.tv-asahi-hd.co.jp/" },
  { company_code: "9401", company_name: "株式会社TBSホールディングス", fiscal_year_end: "03", market: "東証プライム", sector: "情報・通信業", source_url: "https://www.tbs-holdings.co.jp/" },
  { company_code: "9449", company_name: "GMOインターネットグループ株式会社", fiscal_year_end: "12", market: "東証プライム", sector: "情報・通信業", source_url: "https://www.gmo.jp/" },
  { company_code: "7211", company_name: "三菱自動車工業株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "輸送用機器", source_url: "https://www.mitsubishi-motors.co.jp/" },
  { company_code: "8905", company_name: "イオンモール株式会社", fiscal_year_end: "02", market: "東証プライム", sector: "不動産業", source_url: "https://www.aeonmall.com/" },
  { company_code: "8358", company_name: "スルガ銀行株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "銀行業", source_url: "https://www.surugabank.co.jp/" },
  { company_code: "3769", company_name: "GMOペイメントゲートウェイ株式会社", fiscal_year_end: "09", market: "東証プライム", sector: "情報・通信業", source_url: "https://corp.gmo-pg.com/" },
  { company_code: "7762", company_name: "シチズン時計株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "精密機器", source_url: "https://citizen.jp/" },
  { company_code: "3865", company_name: "北越コーポレーション株式会社", fiscal_year_end: "12", market: "東証プライム", sector: "パルプ・紙", source_url: "https://www.hokuetsu-corp.co.jp/" },
  { company_code: "8244", company_name: "株式会社近鉄百貨店", fiscal_year_end: "02", market: "東証プライム", sector: "小売業", source_url: "https://www.kintetsu-dept.co.jp/" },
  { company_code: "9946", company_name: "株式会社ミニストップ", fiscal_year_end: "02", market: "東証プライム", sector: "小売業", source_url: "https://www.ministop.co.jp/" },
  { company_code: "5449", company_name: "大阪製鐵株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "鉄鋼", source_url: "https://www.osaka-steel.co.jp/" },
  { company_code: "8850", company_name: "スターツコーポレーション株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "不動産業", source_url: "https://starts.co.jp/" },
  { company_code: "8387", company_name: "株式会社四国銀行", fiscal_year_end: "03", market: "東証プライム", sector: "銀行業", source_url: "https://www.shikokubank.co.jp/" },
  { company_code: "9726", company_name: "KNT-CTホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "サービス業", source_url: "https://www.knt-ct.co.jp/" },
  { company_code: "8877", company_name: "エスリード株式会社", fiscal_year_end: "09", market: "東証プライム", sector: "不動産業", source_url: "https://www.eslead.co.jp/" },
  { company_code: "9418", company_name: "U-NEXT HOLDINGS株式会社", fiscal_year_end: "08", market: "東証プライム", sector: "情報・通信業", source_url: "https://unext.co.jp/" },
  { company_code: "5909", company_name: "コロナ株式会社", fiscal_year_end: "09", market: "東証プライム", sector: "金属製品", source_url: "https://www.corona.co.jp/" },
  { company_code: "8285", company_name: "三谷産業株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "卸売業", source_url: "https://www.mitani.co.jp/" },
  { company_code: "4319", company_name: "TAC株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "サービス業", source_url: "https://www.tac-school.co.jp/" },
  { company_code: "8869", company_name: "明和地所株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "不動産業", source_url: "https://www.meiwa-estate.co.jp/" },
  { company_code: "5830", company_name: "いよぎんホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "銀行業", source_url: "https://www.iyogin.co.jp/" },
  { company_code: "8793", company_name: "NECキャピタルソリューション株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "その他金融業", source_url: "https://www.nec-capital.co.jp/" },
  { company_code: "7885", company_name: "タカノ株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "家具・装備品", source_url: "https://www.takano.jp/" },
  { company_code: "3178", company_name: "チムニー株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "小売業", source_url: "https://www.chimney.co.jp/" },
  { company_code: "9090", company_name: "AZ-COM丸和ホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "陸運業", source_url: "https://www.az-com-maruwa.co.jp/" },
  { company_code: "9632", company_name: "スバル興業株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "サービス業", source_url: "https://www.subaruks.co.jp/" },
  { company_code: "8131", company_name: "ミツウロコグループホールディングス株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "卸売業", source_url: "https://www.mitsuurokogroup.co.jp/" },
  { company_code: "4801", company_name: "セントラルスポーツ株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "サービス業", source_url: "https://www.central.co.jp/" },
  { company_code: "2445", company_name: "タカミヤ株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "その他製品", source_url: "https://www.takamiya.co/" },
  { company_code: "1930", company_name: "北陸電気工事株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "建設業", source_url: "https://www.hokuriku-elec.co.jp/" },
  { company_code: "4620", company_name: "藤倉化成株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "化学", source_url: "https://www.fujikura-kasei.co.jp/" },
  { company_code: "7702", company_name: "JMS株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "精密機器", source_url: "https://www.jms.co.jp/" },
  { company_code: "6284", company_name: "日精エー・エス・ビー機械株式会社", fiscal_year_end: "09", market: "東証プライム", sector: "機械", source_url: "https://www.nissei-asb.com/jp/" },
  { company_code: "4343", company_name: "イオンファンタジー株式会社", fiscal_year_end: "02", market: "東証プライム", sector: "サービス業", source_url: "https://www.aeonfantasy.co.jp/" },
  { company_code: "9704", company_name: "アゴーラ・ホスピタリティー・グループ株式会社", fiscal_year_end: "03", market: "東証スタンダード", sector: "サービス業", source_url: "https://www.agora-hospitality.co.jp/" },
  { company_code: "4746", company_name: "株式会社東計電算", fiscal_year_end: "03", market: "東証スタンダード", sector: "情報・通信業", source_url: "https://www.tokeids.co.jp/" },
  { company_code: "1972", company_name: "三晃金属工業株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "金属製品", source_url: "https://www.sanko-metal.co.jp/" },
  { company_code: "8159", company_name: "立花エレテック株式会社", fiscal_year_end: "03", market: "東証プライム", sector: "卸売業", source_url: "https://www.tachibana-elec.co.jp/" },
  { company_code: "5946", company_name: "株式会社長府製作所", fiscal_year_end: "03", market: "東証プライム", sector: "金属製品", source_url: "https://www.chofu.co.jp/" },
].filter((c) => !existing.has(c.company_code));

console.log("Adding", newCompanies.length, "new companies");
const allCompanies = [...companies, ...newCompanies].sort((a, b) => a.company_code.localeCompare(b.company_code));
fs.writeFileSync(companiesPath, JSON.stringify(allCompanies, null, 2), "utf8");
console.log("Total now:", allCompanies.length);
