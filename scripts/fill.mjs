// reports/N.json のマップを、マッチ ID から Deadlock API で埋める（下書き）。
//
//   npm run fill -- 5 EU:決勝:145000001,145000002 EU:チャレンジャー:145000000
//   npm run fill -- 5            … 追加はせず、JSON にある matchId のマップを埋め直す
//   npm run fill -- 5 "?チームB=EGO" "van3k?=vanek"   … 名前の置き換え（チーム名・選手名、JSON 全体）
//   手で直した名前は、もう一度 fill しても消えない（そのマップのアカウントから引き継ぐ）
//
// 埋めるもの：チーム名・選手（名前・ヒーロー・K/D/A・ソウル・ダメージ・回復）・時間・勝者、
//            シリーズ（なければ作る。スコアはマップの勝者から）
// 埋めないもの（配信を見て手で書く）：ピック順・BAN・先行ピック（teams[0]）・flow・画像・見出し・持ち帰り
//   - picks がまだ空なら、使ったヒーローを順不同で入れる。配信を見てピック順に並べ替える
//   - 前のレポートで見た選手は、アカウントから同じ名前とチームを使う。初めての選手は Steam 名を仮に入れる
// 終わったら、マップごとの要点（10分・20分のソウル差、Mid-Boss）を表示する。flow を書くときに使う。
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { root, loadReports, matchInfo, heroNames, heroKey, sides } from "./api.mjs"

const [idArg, ...args] = process.argv.slice(2)
const renames = args.filter((a) => a.includes("=")).map((a) => a.split("="))
const groups = args.filter((a) => !a.includes("="))
const id = Number(idArg)
const file = join(root, "reports", `${id}.json`)
if (!id || !existsSync(file)) {
  console.error("使い方: npm run fill -- <レポート番号> [地域:ステージ:マッチID,マッチID ...]\n先に npm run new でひな形を作る")
  process.exit(1)
}
const r = JSON.parse(readFileSync(file, "utf8"))
const names = await heroNames()
const FINAL = "決勝"
const stageOf = (x) => x.stage ?? FINAL
const STAGE_CODE = { [FINAL]: "", "チャレンジャー": "c", "予選": "q" }

// ---- 前のレポートから、アカウント → [選手名, チーム] を作る ----
const known = new Map()
// このレポートに書いてある名前を最後に読むので、手で直した名前が優先される
const others = loadReports().filter((x) => x.r.id !== id).map((x) => x.r)
for (const old of [...others, r]) {
  for (const m of old.maps) {
    if (!m.matchId || m.teams.some((t) => t.players.length !== 6)) continue
    let info
    try {
      info = await matchInfo(m.matchId)
    } catch {
      continue
    }
    const side = await sides(m, info)
    if (!side) continue
    for (const p of info.players) {
      const t = m.teams[side[p.team]]
      const row = t.players.find((x) => heroKey(x[1]) === heroKey(names.get(p.hero_id) ?? ""))
      if (row) known.set(p.account_id, [row[0], t.name])
    }
  }
}

async function steamName(account) {
  try {
    const res = await fetch(`https://api.deadlock-api.com/v1/players/${account}/steam`)
    if (res.ok) return (await res.json()).personaname
  } catch {}
  return `account_${account}`
}

// ---- 引数のマップを足す ----
let added = 0
for (const g of groups) {
  const [region, stage, ids] = g.split(":")
  if (!region || !stage || !ids) {
    console.error(`形が違う: ${g}（例: EU:決勝:145000001,145000002）`)
    process.exit(1)
  }
  for (const mid of ids.split(",").map(Number)) {
    if (r.maps.some((m) => m.matchId === mid)) continue
    const same = r.maps.filter((m) => m.region === region && stageOf(m) === stage)
    const no = same.length + 1
    const code = STAGE_CODE[stage] ?? "x"
    r.maps.push({
      id: `${region.toLowerCase()}${code}${no}`,
      region,
      ...(stage === FINAL ? {} : { stage }),
      no,
      winner: "",
      firstPick: "",
      duration: "",
      matchId: mid,
      flow: "",
      teams: [
        { name: "", picks: [], bans: [], players: [] },
        { name: "", picks: [], bans: [], players: [] },
      ],
    })
    added++
  }
}
// ひな形の見本（matchId 0 のマップ、チームA/チームB のシリーズ）は消す
r.maps = r.maps.filter((m) => m.matchId)
r.series = r.series.filter((s) => !s.teams.some((t) => /^チーム[AB]$/.test(t)))

// ---- API で埋める ----
const unknownPlayers = []
const notes = []
for (const m of r.maps) {
  const info = await matchInfo(m.matchId)
  const byTeam = [0, 1].map((team) => info.players.filter((p) => p.team === team))
  // API のチームごとに、知っている選手の多いチーム名を使う
  const teamName = byTeam.map((ps, i) => {
    const count = new Map()
    for (const p of ps) {
      const k = known.get(p.account_id)
      if (k) count.set(k[1], (count.get(k[1]) ?? 0) + 1)
    }
    const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
    return best ? best[0] : `?チーム${i === 0 ? "A" : "B"}`
  })
  // すでに書いてあるチームの順（teams[0] = 先行ピック）を守る
  const order = m.teams[0].name && m.teams[0].name === teamName[1] ? [1, 0] : [0, 1]

  const teams = []
  for (const apiTeam of order) {
    const old = m.teams.find((t) => t.name === teamName[apiTeam]) ?? m.teams[teams.length]
    const players = []
    for (const p of byTeam[apiTeam]) {
      let name = known.get(p.account_id)?.[0]
      if (!name) {
        name = (await steamName(p.account_id)) + "?"
        unknownPlayers.push(`${name}（${teamName[apiTeam]}・アカウント ${p.account_id}）`)
        known.set(p.account_id, [name, teamName[apiTeam]])
      }
      const last = p.stats.at(-1) ?? {}
      players.push([name, names.get(p.hero_id) ?? `#${p.hero_id}`, p.kills, p.deaths, p.assists, p.net_worth, last.player_damage ?? 0, last.player_healing ?? 0])
    }
    const heroes = players.map((p) => p[1])
    const picksOk = old?.picks?.length === 6 && [...old.picks].sort().join() === [...heroes].sort().join()
    const picks = picksOk ? old.picks : heroes
    players.sort((a, b) => picks.indexOf(a[1]) - picks.indexOf(b[1]))
    teams.push({ name: teamName[apiTeam], picks, bans: old?.bans?.filter(Boolean) ?? [], players })
    if (!picksOk && !m.draftUnknown) notes.push(`${m.id} ${teamName[apiTeam]}: picks を配信のピック順に並べ替える`)
  }
  m.teams = teams
  m.winner = teamName[info.winning_team]
  m.duration = `${Math.floor(info.duration_s / 60)}:${String(info.duration_s % 60).padStart(2, "0")}`
  if (!m.draftUnknown && m.firstPick !== m.teams[0].name) {
    notes.push(`${m.id}: 先行ピックのチームを teams[0] にして firstPick を書く（配信がなければ draftUnknown: true）`)
  }

  // flow を書くための要点
  const lead = (t) => {
    let v = 0
    for (const p of info.players) {
      const s = [...p.stats].reverse().find((x) => x.time_stamp_s <= t)
      v += (order[0] === p.team ? 1 : -1) * (s?.net_worth ?? 0)
    }
    return v
  }
  const fmtLead = (v) => `${v >= 0 ? m.teams[0].name : m.teams[1].name} +${Math.abs(v).toLocaleString("en-US")}`
  const kills = m.teams.map((t) => t.players.reduce((s, p) => s + p[2], 0))
  const mids = (info.mid_boss ?? []).filter((b) => b.destroyed_time_s).map((b) => {
    const t = b.destroyed_time_s
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} ${teamName[b.team_claimed]}`
  })
  const mvp = m.teams.flatMap((t) => t.players).sort((a, b) => (b[2] + b[4]) / Math.max(b[3], 1) - (a[2] + a[4]) / Math.max(a[3], 1))[0]
  console.log(
    `\n${m.id}（${m.matchId}）${m.winner} の勝ち ${m.duration}  キル ${kills.join("-")}（${m.teams.map((t) => t.name).join(" vs ")}）\n` +
      `  10分 ${fmtLead(lead(600))} / 20分 ${info.duration_s > 1200 ? fmtLead(lead(1200)) : "—"} / 終了 ${fmtLead(lead(info.duration_s + 1))}\n` +
      `  Mid-Boss ${mids.join("・") || "なし"}\n` +
      `  KDA 最高 ${mvp[0]}（${mvp[1]}）${mvp[2]}/${mvp[3]}/${mvp[4]}`
  )
}

// ---- シリーズ ----
const keys = [...new Set(r.maps.map((m) => `${m.region}|${stageOf(m)}`))]
for (const key of keys) {
  const [region, stage] = key.split("|")
  const maps = r.maps.filter((m) => m.region === region && stageOf(m) === stage)
  const teams = [...new Set(maps.flatMap((m) => m.teams.map((t) => t.name)))].slice(0, 2)
  const score = teams.map((t) => maps.filter((m) => m.winner === t).length)
  let s = r.series.find((x) => x.region === region && stageOf(x) === stage)
  if (!s) {
    s = { region, ...(stage === FINAL ? {} : { stage }), teams, score }
    r.series.push(s)
    console.log(`\nシリーズを作成: ${region} ${stage} ${teams[0]} ${score[0]}-${score[1]} ${teams[1]}`)
  } else if (s.teams.every((t) => teams.includes(t))) {
    s.score = s.teams.map((t) => maps.filter((m) => m.winner === t).length)
  }
}

// ---- 名前の置き換え（JSON の中の "名前" をそのまま差し替える） ----
let out = JSON.stringify(r, null, 2) + "\n"
for (const [from, to] of renames) {
  const n = out.split(JSON.stringify(from)).length - 1
  out = out.split(JSON.stringify(from)).join(JSON.stringify(to))
  console.log(`置き換え: ${from} → ${to}（${n} か所）`)
}
writeFileSync(file, out)
console.log(`\nfill: reports/${id}.json に書いた（マップ ${r.maps.length}、うち今回追加 ${added}）`)
if (unknownPlayers.length) {
  const list = [...new Set(unknownPlayers)]
  console.log(`\n初めての選手（Steam 名に ? を付けて仮に入れた。EDL.GG のスコアボードの名前に直す）:\n  ${list.join("\n  ")}`)
  console.log(`  直し方の例: npm run fill -- ${id} "?チームB=チーム名" "${list[0].split("（")[0]}=正しい名前"`)
}
if (notes.length) console.log(`\nあとで手で直すこと:\n  ${[...new Set(notes)].join("\n  ")}`)
console.log("\n次: 配信でピック順・BAN を読んで書く → npm run validate -- --api → npm run timeline")
