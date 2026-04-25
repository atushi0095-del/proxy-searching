import fs from "node:fs";

const directorsPath = "data/directors.json";
const historyPath = "data/director_role_history.json";

const directors = JSON.parse(fs.readFileSync(directorsPath, "utf8"));
let histories = JSON.parse(fs.readFileSync(historyPath, "utf8"));
const existing = new Set(histories.map((history) => history.history_id));

function addHistory(director, roleType, roleTitle) {
  const historyId = `${director.director_id}_${roleType}_${director.meeting_year}`;
  if (existing.has(historyId)) return;
  histories.push({
    history_id: historyId,
    director_id: director.director_id,
    company_code: director.company_code,
    name: director.name,
    role_type: roleType,
    role_title: roleTitle,
    start_year: director.meeting_year,
    end_year: null,
    has_representative_authority: director.has_representative_authority,
    source_url: director.source_url,
    confidence: "Medium",
    notes: "directors.jsonの現任役職から生成。過去役職は招集通知・有報から追加取得が必要。",
  });
  existing.add(historyId);
}

for (const director of directors) {
  addHistory(director, "director", director.current_title);
  if (director.is_president) addHistory(director, "president", director.current_title);
  if (director.is_ceo) addHistory(director, "ceo", director.current_title);
  if (director.is_chair) addHistory(director, "chair", director.current_title);
  if (director.is_board_chair) addHistory(director, "board_chair", director.current_title);
  if (director.is_outside_director) addHistory(director, "outside_director", director.current_title);
}

histories = histories.sort((a, b) => {
  if (a.company_code !== b.company_code) return a.company_code.localeCompare(b.company_code);
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return String(a.role_type).localeCompare(String(b.role_type));
});

fs.writeFileSync(historyPath, `${JSON.stringify(histories, null, 2)}\n`);
console.log(`Seeded ${histories.length} director role history records`);
