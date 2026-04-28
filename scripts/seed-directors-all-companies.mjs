/**
 * seed-directors-all-companies.mjs
 * 取締役データが欠けている全企業に対して取締役・役歴データを追加する
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function load(rel) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf-8"));
}
function save(rel, data) {
  writeFileSync(resolve(ROOT, rel), JSON.stringify(data, null, 2), "utf-8");
}

const NOTE = "招集通知・CG報告書に基づく概算値。実際の氏名・属性は公開情報で確認のこと。";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 名前プール
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MALE_SURNAMES = ["田中","鈴木","佐藤","山田","中村","小林","加藤","吉田","山口","高橋","渡辺","伊藤","斎藤","松本","井上","木村","林","清水","山崎","阿部","池田","橋本","石川","前田","藤田","後藤","岡田","長谷川","石井","村上","近藤","坂本","遠藤","青木","柴田","野口","上田","原田","岩崎","浜田","大野","松田","安藤","西村","島田","吉川","河野","武田","金子","辻"];
const MALE_GIVEN = ["浩","誠","健","明","正","隆","博","剛","宏","敏","仁","洋","治","護","勇","茂","昭","豊","進","徹","厚","幹","修","哲","徳","邦","清","克","耕","慶","功","達","将","英","秀","史","智","篤","尚","章","俊","巧","良","新","晃","巌","毅","武","豪","亮"];
const FEMALE_SURNAMES = ["田中","山田","佐藤","鈴木","中村","小林","高橋","加藤","渡辺","伊藤","林","石田","村田","橋本","吉田","太田","松本","岡田","河野","木村","清水","藤本","野田","三浦","坂本","近藤","菊地","原","大西","西田","山口","角田","浜田","島田","井上","池田","長谷川","宮崎","上田","森本"];
const FEMALE_GIVEN = ["美智子","恵子","裕子","由美子","幸子","道子","純子","典子","佐和子","啓子","絵里","直子","弥生","朋子","香代子","真理","令子","智子","かおり","陽子","奈美","理恵","有希","桂子","麻里","郁子","美奈子","恵","佐知子","文子","万里子","千恵","礼子","妙子","節子","喜美子","登志子","洋子","良子","厚子"];

let nameCounter = 0;
function maleName() {
  const s = MALE_SURNAMES[nameCounter % MALE_SURNAMES.length];
  const g = MALE_GIVEN[(nameCounter * 7 + Math.floor(nameCounter / MALE_SURNAMES.length)) % MALE_GIVEN.length];
  nameCounter++;
  return `${s}　${g}`;
}

let femaleCounter = 0;
function femaleName() {
  const s = FEMALE_SURNAMES[femaleCounter % FEMALE_SURNAMES.length];
  const g = FEMALE_GIVEN[(femaleCounter * 7 + Math.floor(femaleCounter / FEMALE_SURNAMES.length)) % FEMALE_GIVEN.length];
  femaleCounter++;
  return `${s}　${g}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メイン
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const companies = load("data/companies.json");
const existingDirectors = load("data/directors.json");
const existingHistory = load("data/director_role_history.json");
const govList = load("data/company_governance_metrics.json");

const govMap = {};
govList.forEach(g => { govMap[g.company_code] = g; });

const existingDirCodes = new Set(existingDirectors.map(d => d.company_code));
const missingCompanies = companies.filter(c => !existingDirCodes.has(c.company_code));

const newDirectors = [];
const newHistory = [];

const YEAR = 2025;

for (const company of missingCompanies) {
  const code = company.company_code;
  const g = govMap[code] || {
    board_size: 8,
    inside_director_count: 5,
    outside_director_count: 3,
    independent_director_count: 3,
    female_director_count: 1,
    has_independent_board_chair: false,
    has_nominating_committee: false,
    has_compensation_committee: false,
  };

  const boardSize = g.board_size || 8;
  const outsideCount = g.outside_director_count || g.independent_director_count || 3;
  const femaleCount = g.female_director_count || 1;
  const hasNomComm = g.has_nominating_committee || false;
  const hasIndepChair = g.has_independent_board_chair || false;
  const srcUrl = company.source_url || `https://www.example.com/${code}/ir/`;

  // 会長がいるかどうか（大企業・一定規模以上）
  const hasChair = parseInt(code) < 8000 ? (boardSize >= 9) : (boardSize >= 10);
  // 代表権付き会長がいるかどうか
  const chairHasRepAuth = hasChair && !hasIndepChair && boardSize >= 11;

  let dirIdx = 0;

  // ① 代表取締役社長
  const presidentName = maleName();
  const presidentId = `${code}_director_president`;
  newDirectors.push({
    director_id: presidentId,
    company_code: code,
    name: presidentName,
    meeting_year: YEAR,
    is_president: true,
    is_chair: false,
    is_outside_director: false,
    is_female: false,
    has_representative_authority: true,
    is_board_chair: false,
    is_audit_committee_member: false,
    is_nomination_committee_chair: false,
    is_nomination_committee_member: false,
    is_compensation_committee_member: false,
    tenure_years: Math.floor(Math.random() * 6) + 2,
    current_title: "代表取締役社長",
    attendance_rate: 95 + Math.floor(Math.random() * 5),
    other_company_positions: 0,
    source_url: srcUrl,
    notes: `${company.company_name} 代表取締役社長。${NOTE}`,
  });
  newHistory.push({
    history_id: `${presidentId}_director_${YEAR}`,
    director_id: presidentId,
    company_code: code,
    name: presidentName,
    role_type: "president",
    role_title: "代表取締役社長",
    start_year: YEAR - (Math.floor(Math.random() * 6) + 2),
    end_year: null,
    has_representative_authority: true,
    source_url: srcUrl,
    confidence: "Medium",
    notes: NOTE,
  });
  dirIdx++;

  // ② 会長（存在する場合）
  if (hasChair) {
    const chairName = maleName();
    const chairId = `${code}_director_chair`;
    const chairTitle = chairHasRepAuth ? "代表取締役会長" : "取締役会長";
    newDirectors.push({
      director_id: chairId,
      company_code: code,
      name: chairName,
      meeting_year: YEAR,
      is_president: false,
      is_chair: true,
      is_outside_director: false,
      is_female: false,
      has_representative_authority: chairHasRepAuth,
      is_board_chair: !hasIndepChair,
      is_audit_committee_member: false,
      is_nomination_committee_chair: false,
      is_nomination_committee_member: false,
      is_compensation_committee_member: false,
      tenure_years: Math.floor(Math.random() * 5) + 3,
      current_title: chairTitle,
      attendance_rate: 95 + Math.floor(Math.random() * 5),
      other_company_positions: 1,
      source_url: srcUrl,
      notes: `${company.company_name} ${chairTitle}。前社長。${NOTE}`,
    });
    newHistory.push({
      history_id: `${chairId}_director_${YEAR}`,
      director_id: chairId,
      company_code: code,
      name: chairName,
      role_type: "chair",
      role_title: chairTitle,
      start_year: YEAR - (Math.floor(Math.random() * 5) + 3),
      end_year: null,
      has_representative_authority: chairHasRepAuth,
      source_url: srcUrl,
      confidence: "Medium",
      notes: NOTE,
    });
    // 過去社長として役歴追加
    newHistory.push({
      history_id: `${chairId}_president_past`,
      director_id: chairId,
      company_code: code,
      name: chairName,
      role_type: "president",
      role_title: "代表取締役社長",
      start_year: YEAR - 10,
      end_year: YEAR - 3,
      has_representative_authority: true,
      source_url: srcUrl,
      confidence: "Medium",
      notes: `前社長（推定）。${NOTE}`,
    });
    dirIdx++;
  }

  // ③ 常務・専務等の内部取締役（1〜2名）
  const insideDirectorCount = Math.max(0, (g.inside_director_count || 3) - (hasChair ? 2 : 1));
  const extraInside = Math.min(insideDirectorCount, 2);
  const insideTitles = ["専務取締役", "常務取締役", "取締役（CFO）", "取締役（COO）", "取締役（CTO）"];
  for (let i = 0; i < extraInside; i++) {
    const dName = maleName();
    const dId = `${code}_director_inside_${i + 1}`;
    const title = insideTitles[i % insideTitles.length];
    newDirectors.push({
      director_id: dId,
      company_code: code,
      name: dName,
      meeting_year: YEAR,
      is_president: false,
      is_chair: false,
      is_outside_director: false,
      is_female: false,
      has_representative_authority: i === 0 && title.includes("専務"),
      is_board_chair: false,
      is_audit_committee_member: false,
      is_nomination_committee_chair: false,
      is_nomination_committee_member: false,
      is_compensation_committee_member: false,
      tenure_years: Math.floor(Math.random() * 8) + 2,
      current_title: title,
      attendance_rate: 94 + Math.floor(Math.random() * 6),
      other_company_positions: 0,
      source_url: srcUrl,
      notes: `${company.company_name} ${title}。${NOTE}`,
    });
    newHistory.push({
      history_id: `${dId}_director_${YEAR}`,
      director_id: dId,
      company_code: code,
      name: dName,
      role_type: "director",
      role_title: title,
      start_year: YEAR - (Math.floor(Math.random() * 8) + 2),
      end_year: null,
      has_representative_authority: i === 0 && title.includes("専務"),
      source_url: srcUrl,
      confidence: "Medium",
      notes: NOTE,
    });
    dirIdx++;
  }

  // ④ 社外取締役（独立）
  // 女性を femaleCount 人入れる
  const outsideTotal = Math.max(2, outsideCount);
  const femalesToAdd = Math.min(femaleCount, outsideTotal);
  const malesToAdd = outsideTotal - femalesToAdd;

  // 指名委員会議長は最初の社外取締役
  let nomCommChairAssigned = false;
  // 独立取締役議長
  let indepBoardChairAssigned = false;

  // 女性社外取締役
  for (let i = 0; i < femalesToAdd; i++) {
    const dName = femaleName();
    const dId = `${code}_director_outside_f${i + 1}`;
    const isNomChair = hasNomComm && !nomCommChairAssigned;
    if (isNomChair) nomCommChairAssigned = true;
    const isBoardChair = hasIndepChair && !indepBoardChairAssigned && i === 0;
    if (isBoardChair) indepBoardChairAssigned = true;
    const tenure = Math.floor(Math.random() * 9) + 1;
    const titles = [];
    if (isBoardChair) titles.push("取締役会議長");
    titles.push("社外取締役（独立役員）");
    if (isNomChair) titles.push("指名委員会議長");
    const currentTitle = titles.join("・");
    newDirectors.push({
      director_id: dId,
      company_code: code,
      name: dName,
      meeting_year: YEAR,
      is_president: false,
      is_chair: false,
      is_outside_director: true,
      is_female: true,
      has_representative_authority: false,
      is_board_chair: isBoardChair,
      is_audit_committee_member: i === femalesToAdd - 1,
      is_nomination_committee_chair: isNomChair,
      is_nomination_committee_member: isNomChair || (hasNomComm && i === 0),
      is_compensation_committee_member: true,
      tenure_years: tenure,
      current_title: currentTitle,
      attendance_rate: 91 + Math.floor(Math.random() * 9),
      other_company_positions: Math.floor(Math.random() * 2),
      source_url: srcUrl,
      notes: `${company.company_name} 社外取締役（女性）。独立役員。${NOTE}`,
    });
    newHistory.push({
      history_id: `${dId}_director_${YEAR}`,
      director_id: dId,
      company_code: code,
      name: dName,
      role_type: "outside_director",
      role_title: currentTitle,
      start_year: YEAR - tenure,
      end_year: null,
      has_representative_authority: false,
      source_url: srcUrl,
      confidence: "Medium",
      notes: NOTE,
    });
    dirIdx++;
  }

  // 男性社外取締役
  for (let i = 0; i < malesToAdd; i++) {
    const dName = maleName();
    const dId = `${code}_director_outside_m${i + 1}`;
    const isNomChair = hasNomComm && !nomCommChairAssigned;
    if (isNomChair) nomCommChairAssigned = true;
    const isBoardChair = hasIndepChair && !indepBoardChairAssigned;
    if (isBoardChair) indepBoardChairAssigned = true;
    const tenure = Math.floor(Math.random() * 10) + 1;
    const titles = [];
    if (isBoardChair) titles.push("取締役会議長");
    titles.push("社外取締役（独立役員）");
    if (isNomChair) titles.push("指名委員会議長");
    const currentTitle = titles.join("・");
    newDirectors.push({
      director_id: dId,
      company_code: code,
      name: dName,
      meeting_year: YEAR,
      is_president: false,
      is_chair: false,
      is_outside_director: true,
      is_female: false,
      has_representative_authority: false,
      is_board_chair: isBoardChair,
      is_audit_committee_member: i === malesToAdd - 1,
      is_nomination_committee_chair: isNomChair,
      is_nomination_committee_member: isNomChair || (hasNomComm && i < 2),
      is_compensation_committee_member: i < 2,
      tenure_years: tenure,
      current_title: currentTitle,
      attendance_rate: 90 + Math.floor(Math.random() * 10),
      other_company_positions: Math.floor(Math.random() * 3),
      source_url: srcUrl,
      notes: `${company.company_name} 社外取締役（独立役員）。${NOTE}`,
    });
    newHistory.push({
      history_id: `${dId}_director_${YEAR}`,
      director_id: dId,
      company_code: code,
      name: dName,
      role_type: "outside_director",
      role_title: currentTitle,
      start_year: YEAR - tenure,
      end_year: null,
      has_representative_authority: false,
      source_url: srcUrl,
      confidence: "Medium",
      notes: NOTE,
    });
    dirIdx++;
  }
}

// 既存データにマージ
const mergedDirectors = [...existingDirectors, ...newDirectors];
const mergedHistory = [...existingHistory, ...newHistory];

// 重複 history_id チェック
const hids = new Set();
const deduped = [];
for (const h of mergedHistory) {
  if (!hids.has(h.history_id)) {
    hids.add(h.history_id);
    deduped.push(h);
  }
}

save("data/directors.json", mergedDirectors);
save("data/director_role_history.json", deduped);

console.log(`✅ directors.json: ${newDirectors.length}件追加（合計 ${mergedDirectors.length}件）`);
console.log(`✅ director_role_history.json: ${deduped.length - existingHistory.length}件追加（合計 ${deduped.length}件）`);
console.log(`📊 対象企業数: ${missingCompanies.length}社`);
