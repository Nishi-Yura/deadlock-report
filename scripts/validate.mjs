// reports/*.json の中身を確かめる。これまで手で見つけて直してきた間違いを機械で拾うためのもの。
//   npm run validate          … ファイルだけで分かること（npm run build でも毎回実行）
//   npm run validate -- --api … Deadlock API のマッチ情報とも照らし合わせる（ネットが必要）
// エラーが1つでもあれば終了コード 1（ビルドが止まる）。「注意」は止めない。
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { root, loadReports, matchInfo, heroNames, heroKey, sides } from "./api.mjs"
import { slug } from "./slug.mjs"

const useApi = process.argv.includes("--api")
const errors = []
const warns = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)
const warn = (where, msg) => warns.push(`${where}: ${msg}`)

// src/heroes.ts の FILES にあるヒーロー名
const heroesTs = readFileSync(join(root, "src", "heroes.ts"), "utf8")
const known = new Set(
  [...heroesTs.slice(heroesTs.indexOf("FILES")).matchAll(/^\s+(?:"([^"]+)"|([A-Za-z]+)):/gm)].map((m) => m[1] ?? m[2])
)

// 同じヒーローの別表記。集計が割れるので右側にそろえる
const ALIAS = { "The Doorman": "Doorman" }

const FINAL = "決勝"
const stageOf = (x) => x.stage ?? FINAL

const reports = loadReports()
const matchIds = new Map()
const playerTeams = new Map()
const teamNames = new Set()

for (const { file, r } of reports) {
  const at = (s) => `${file} ${s}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) err(at("date"), `日付の形が違う: ${r.date}`)
  if (!r.headline) err(at("headline"), "見出しが空")
  for (const k of ["series", "maps", "takeaways", "sources"]) if (!Array.isArray(r[k])) err(at(k), "配列がない")

  // シリーズ
  for (const s of r.series ?? []) {
    const where = at(`series ${s.region} ${stageOf(s)}`)
    s.teams.forEach((t) => teamNames.add(t))
    if (s.teams[0] === s.teams[1]) err(where, "同じチーム同士になっている")
    if (s.date && !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) err(where, `date の形が違う: ${s.date}`)
    const maps = r.maps.filter((m) => m.region === s.region && stageOf(m) === stageOf(s))
    if (maps.length === 0) continue
    const won = s.teams.map((t) => maps.filter((m) => m.winner === t).length)
    if (maps.length === s.score[0] + s.score[1]) {
      if (won[0] !== s.score[0] || won[1] !== s.score[1]) {
        err(where, `スコア ${s.score.join("-")} とマップの勝者 ${won.join("-")} が合わない`)
      }
    } else {
      warn(where, `マップが ${maps.length} 件、スコアの合計は ${s.score[0] + s.score[1]}（足りないマップがある？）`)
    }
    for (const m of maps) {
      const names = m.teams.map((t) => t.name).sort().join()
      if (names !== [...s.teams].sort().join()) err(at(`map ${m.id}`), `チーム ${names} がシリーズ ${s.teams.join(",")} と違う`)
    }
  }
  const seen = new Set(r.series.map((s) => `${s.region}|${stageOf(s)}`))
  if (seen.size !== r.series.length) err(at("series"), "同じ地域・ステージのシリーズが2つある")

  // マップ
  const ids = new Set()
  for (const m of r.maps ?? []) {
    const where = at(`map ${m.id}`)
    if (ids.has(m.id)) err(where, "id が重複")
    ids.add(m.id)
    if (!seen.has(`${m.region}|${stageOf(m)}`)) err(where, `対応するシリーズ（${m.region} ${stageOf(m)}）がない`)
    if (matchIds.has(m.matchId)) err(where, `matchId ${m.matchId} が ${matchIds.get(m.matchId)} と重複`)
    matchIds.set(m.matchId, where)
    if (!/^\d{1,2}:\d{2}$/.test(m.duration)) err(where, `duration の形が違う: ${m.duration}`)
    const names = m.teams.map((t) => t.name)
    if (!names.includes(m.winner)) err(where, `winner ${m.winner} がどちらのチームでもない`)
    if (m.draftUnknown) {
      if (m.firstPick) err(where, "draftUnknown なのに firstPick がある")
      if (m.teams.some((t) => t.bans.length)) err(where, "draftUnknown なのに bans がある")
    } else {
      if (m.firstPick !== names[0]) err(where, `firstPick ${m.firstPick || "（空）"} が teams[0] ${names[0]} と違う（先行ピックのチームを先に書く）`)
      for (const t of m.teams) if (t.bans.length === 0) warn(where, `${t.name} の BAN が空`)
    }
    if (m.screenshot && !existsSync(join(root, "public", "deadlock-report", String(r.id), m.screenshot))) {
      err(where, `画像 ${m.screenshot} がない`)
    }

    const picked = m.teams.flatMap((t) => t.picks)
    const dup = picked.filter((h, i) => picked.indexOf(h) !== i)
    if (dup.length) err(where, `同じマップで2回ピックされている: ${dup.join(", ")}`)
    for (const t of m.teams) {
      const tw = `${where} ${t.name}`
      if (t.picks.length !== 6) err(tw, `ピックが ${t.picks.length} 体`)
      if (t.players.length !== 6) err(tw, `選手が ${t.players.length} 人`)
      for (const h of [...t.picks, ...t.bans, ...t.players.map((p) => p[1])]) {
        if (!known.has(h)) err(tw, `ヒーロー名 "${h}" が src/heroes.ts にない（綴り違いか新ヒーロー）`)
        else if (ALIAS[h]) err(tw, `"${h}" ではなく "${ALIAS[h]}" と書く（集計が別のヒーローとして割れる）`)
      }
      const bannedPicked = t.bans.filter((h) => picked.includes(h))
      if (bannedPicked.length) err(tw, `BAN したヒーローが同じマップでピックされている: ${bannedPicked.join(", ")}（BAN の読み違い？）`)
      if (new Set(t.bans).size !== t.bans.length) err(tw, "BAN が重複")
      const ph = t.players.map((p) => p[1]).sort().join()
      if (ph !== [...t.picks].sort().join()) err(tw, `選手のヒーロー（${ph}）とピック（${[...t.picks].sort().join()}）が違う`)
      if (/^\?|\?$/.test(t.name)) err(tw, `チーム名 "${t.name}" が仮のまま（npm run fill の置き換えで直す）`)
      for (const p of t.players) {
        if (/\?$/.test(p[0])) err(tw, `選手名 "${p[0]}" が仮のまま（EDL.GG の名前に直す）`)
        if (p.length !== 8 || p.slice(2).some((n) => typeof n !== "number" || n < 0)) err(tw, `選手の行の形が違う: ${JSON.stringify(p)}`)
        const teams = playerTeams.get(p[0]) ?? new Set()
        teams.add(t.name)
        playerTeams.set(p[0], teams)
      }
    }
  }
}

// レポートをまたいだ表記ゆれ
for (const [name, teams] of playerTeams) {
  if (teams.size > 1) warn(`選手 ${name}`, `複数のチームにいる: ${[...teams].join(", ")}（移籍なら問題なし）`)
}
const bySlug = (names, kind) => {
  const m = new Map()
  for (const n of names) {
    const s = slug(n)
    if (m.has(s) && m.get(s) !== n) err(kind, `"${m.get(s)}" と "${n}" が同じ URL（${s}）になる。表記ゆれでなければ名前を変える`)
    m.set(s, n)
  }
}
bySlug(playerTeams.keys(), "選手名")
bySlug(teamNames, "チーム名")

// ---- API から作るデータ（npm run timeline）の入れ忘れ ----
for (const name of ["timelines.json", "items.json"]) {
  const f = join(root, "src", name)
  const data = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}
  const missing = reports.flatMap(({ file, r }) => r.maps.filter((m) => !data[m.matchId]).map((m) => `${file} ${m.id}`))
  if (missing.length) err(`src/${name}`, `${missing.length} マップ分がない（${missing.slice(0, 3).join("、")}${missing.length > 3 ? " ほか" : ""}）。npm run timeline を実行してコミットする`)
}

// ---- 大会の予定（src/schedule.json） ----
{
  const f = join(root, "src", "schedule.json")
  const list = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : []
  if (!Array.isArray(list)) err("src/schedule.json", "配列ではない")
  else list.forEach((s, i) => {
    const at = `src/schedule.json [${i}]`
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(s.start ?? "")) err(at, `start は UTC の "2026-12-02T21:00:00Z" の形で書く（今は ${s.start}）`)
    if (!s.event || !s.region) err(at, "event と region を書く")
    if (!/^https:\/\//.test(s.url ?? "")) err(at, "url（EDL.GG の大会ページ）を書く")
  })
}

// ---- パッチまとめ：下書きのまま公開しない ----
const patchDir = join(root, "public", "deadlock-report", "patch")
if (existsSync(patchDir)) {
  for (const d of readdirSync(patchDir)) {
    const f = join(patchDir, d, "index.html")
    if (!existsSync(f)) continue
    const html = readFileSync(f, "utf8")
    // リンクを貼ったときの画像（og.png は scripts/og.mjs が作る）
    if (!html.includes(`property="og:image" content="https://nishi-yura.github.io/deadlock-report/patch/${d}/og.png"`)) {
      err(`patch/${d}`, `og:image のタグがない（または日付が違う）。<meta property="og:image" content="https://nishi-yura.github.io/deadlock-report/patch/${d}/og.png"> を入れる`)
    }
    const left = ["下書き: 未翻訳", "[EN] ", 'class="en"'].filter((m) => html.includes(m))
    if (left.length) err(`patch/${d}`, `訳していない下書きが残っている（${left.join("、")}）。訳し終えたら消す`)
  }
  const listed = JSON.parse(readFileSync(join(root, "src", "patches.json"), "utf8")).map((p) => p.date)
  for (const d of readdirSync(patchDir)) {
    if (existsSync(join(patchDir, d, "index.html")) && !listed.includes(d)) warn(`patch/${d}`, "src/patches.json にない（目次・RSS に出ない）")
  }
}

// ---- API と照らし合わせる ----
if (useApi) {
  const names = await heroNames()
  for (const { file, r } of reports) {
    for (const m of r.maps) {
      const where = `${file} map ${m.id}（${m.matchId}）`
      let info
      try {
        info = await matchInfo(m.matchId)
      } catch (e) {
        err(where, `API から取れない: ${e.message}`)
        continue
      }
      const side = await sides(m, info)
      if (!side) {
        err(where, "API のヒーローの組み合わせとどちらのチームも合わない")
        continue
      }
      const winner = m.teams[side[info.winning_team]]?.name
      if (winner !== m.winner) err(where, `勝者が API では ${winner}`)
      const dur = `${Math.floor(info.duration_s / 60)}:${String(info.duration_s % 60).padStart(2, "0")}`
      if (dur !== m.duration) err(where, `時間が API では ${dur}`)
      for (const ap of info.players) {
        const t = m.teams[side[ap.team]]
        const hero = names.get(ap.hero_id) ?? "?"
        const row = t.players.find((p) => heroKey(p[1]) === heroKey(hero))
        if (!row) continue
        const last = ap.stats.at(-1) ?? {}
        const want = [ap.kills, ap.deaths, ap.assists, ap.net_worth, last.player_damage, last.player_healing]
        const got = row.slice(2)
        const label = ["K", "D", "A", "ソウル", "ダメージ", "回復"]
        const diff = want.map((v, i) => (v !== undefined && v !== got[i] ? `${label[i]} ${got[i]}→${v}` : null)).filter(Boolean)
        if (diff.length) err(`${where} ${t.name} ${row[0]}（${row[1]}）`, `API と違う: ${diff.join(", ")}`)
      }
    }
  }
}

for (const w of warns) console.log(`注意  ${w}`)
for (const e of errors) console.log(`エラー ${e}`)
const total = reports.reduce((s, x) => s + x.r.maps.length, 0)
console.log(`validate: レポート ${reports.length} 本・${total} マップ${useApi ? "（API 照合あり）" : ""} → エラー ${errors.length}、注意 ${warns.length}`)
if (errors.length) process.exit(1)
