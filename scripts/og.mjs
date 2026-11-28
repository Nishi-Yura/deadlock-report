// SNS（Discord・X など）に URL を貼ったときのカード画像を作る。1200×630 の PNG。
//   public/deadlock-report/og.png      … 目次用
//   public/deadlock-report/N/og.png    … 各レポート用
// npm run build の中で自動で実行される。見た目は design/DESIGN.md の A 案に合わせている。
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import { slug } from "./slug.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const W = 1200
const H = 630
const C = { page: "#cfcfcb", panel: "#ffffff", cell: "#f1f1ef", ink: "#2b2b2b", mute: "#6b6b6b", line: "#e3e3e3", win: "#237a35" }

// フォント。数字・英字は Barlow Semi Condensed（@fontsource）、和文は IBM Plex Sans JP の完全版（@ibm/plex-sans-jp）
const nm = (...p) => join(root, "node_modules", ...p)
const plex = (w) => readFileSync(nm("@ibm", "plex-sans-jp", "fonts", "complete", "woff", "hinted", `IBMPlexSansJP-${w}.woff`))
const fonts = [
  { name: "Barlow", weight: 700, style: "normal", data: readFileSync(nm("@fontsource", "barlow-semi-condensed", "files", "barlow-semi-condensed-latin-700-normal.woff")) },
  { name: "Plex", weight: 700, style: "normal", data: plex("Bold") },
  { name: "Plex", weight: 500, style: "normal", data: plex("Medium") },
]

// satori は React 要素の形のオブジェクトを受け取る
const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== false) } })

async function render(tree, out) {
  const svg = await satori(tree, { width: W, height: H, fonts })
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, png)
}

const M = 36
const PX = 52
const PY = 40
const frame = (...children) =>
  h("div", { width: W, height: H, background: C.page, fontFamily: "Plex", position: "relative" },
    // satori の width/height は padding を含まないので、その分を引く
    h("div", { position: "absolute", left: M, top: M, width: W - M * 2 - PX * 2, height: H - M * 2 - PY * 2, flexDirection: "column", background: C.panel, padding: `${PY}px ${PX}px` }, ...children))

const label = (text) => h("div", { fontSize: 22, fontWeight: 700, letterSpacing: 2, color: C.mute }, text)

function reportCard(r) {
  // カードには決勝だけ載せる（stage を省略したものが決勝）
  const finals = r.series.filter((s) => (s.stage ?? "決勝") === "決勝")
  const many = finals.length > 2
  const one = finals.length === 1
  const teamSize = many ? 40 : one ? 60 : 52
  const scoreSize = many ? 56 : one ? 92 : 76
  const series = finals.map((s) => {
    const winA = s.score[0] > s.score[1]
    return h("div", { alignItems: "center", padding: many ? "6px 0" : one ? "16px 0" : "12px 0", borderTop: `2px solid ${C.line}` },
      h("div", { width: 70, fontSize: 22, fontWeight: 700, color: C.mute }, s.region),
      h("div", { flex: 1, justifyContent: "flex-end", fontFamily: "Barlow", fontSize: teamSize, fontWeight: 700, color: C.ink }, s.teams[0]),
      h("div", { width: 230, justifyContent: "center", fontFamily: "Barlow", fontSize: scoreSize, fontWeight: 700, color: C.ink },
        h("span", { color: winA ? C.win : C.ink }, String(s.score[0])),
        h("span", { color: "#b9b9b9", padding: "0 14px" }, ":"),
        h("span", { color: winA ? C.ink : C.win }, String(s.score[1]))),
      h("div", { flex: 1, fontFamily: "Barlow", fontSize: teamSize, fontWeight: 700, color: C.ink }, s.teams[1]),
      h("div", { width: 70 }))
  })
  return frame(
    h("div", { justifyContent: "space-between", alignItems: "baseline" },
      label(`DEADLOCK レポート #${r.id}`),
      h("div", { fontSize: 22, fontWeight: 500, color: C.mute }, r.date.replaceAll("-", "."))),
    h("div", { fontSize: 42, fontWeight: 700, color: C.ink, marginTop: 10, marginBottom: 18 }, r.title),
    h("div", { flexDirection: "column" }, ...series),
    one && mapStrip(r, finals[0]),
    h("div", { flex: 1 }),
    h("div", { background: C.cell, padding: "16px 22px", fontSize: 28, fontWeight: 500, color: C.ink, lineHeight: 1.4 }, r.headline),
  )
}

// 決勝が1つだけのとき、スコアの下にマップごとの勝者とキルを並べて空きを埋める
function mapStrip(r, s) {
  const maps = r.maps.filter((m) => m.region === s.region && (m.stage ?? "決勝") === "決勝")
  const k = (t) => t.players.reduce((n, p) => n + p[2], 0)
  return h("div", { gap: 8 },
    ...maps.map((m) => {
      const [a, b] = m.teams
      const [w, l] = a.name === m.winner ? [a, b] : [b, a]
      return h("div", { flex: 1, justifyContent: "space-between", alignItems: "baseline", background: C.cell, padding: "10px 16px", fontSize: 22 },
        h("div", { fontWeight: 700, color: C.ink }, `Map ${m.no}`),
        h("div", { fontFamily: "Barlow", fontWeight: 700, color: C.win, fontSize: 26 }, m.winner),
        h("div", { fontFamily: "Barlow", fontWeight: 700, color: C.ink, fontSize: 26 }, `${k(w)}-${k(l)}`))
    }))
}

function indexCard(reports) {
  const latest = reports[0]
  return frame(
    label(`${reports.length} 本のレポート`),
    h("div", { fontFamily: "Barlow", fontSize: 96, fontWeight: 700, color: C.ink, marginTop: 18, lineHeight: 1 }, "Deadlock"),
    h("div", { fontSize: 64, fontWeight: 700, color: C.ink, marginTop: 6 }, "レポート"),
    h("div", { fontSize: 28, fontWeight: 500, color: C.mute, marginTop: 18 }, "大会の決勝を、ドラフトとマッチデータで振り返る"),
    h("div", { flex: 1 }),
    latest &&
      h("div", { background: C.cell, padding: "16px 22px", alignItems: "baseline" },
        h("div", { fontFamily: "Barlow", fontSize: 30, fontWeight: 700, color: C.mute, marginRight: 18 }, `#${latest.id}`),
        h("div", { fontSize: 22, fontWeight: 700, color: C.mute, marginRight: 14 }, "最新"),
        h("div", { fontSize: 26, fontWeight: 700, color: C.ink }, latest.event)),
  )
}

// ---- 全レポートをまたぐページ（統計・チーム・選手・ヒーロー）のカード ----
// 見出し・大きい数字を最大4つ・下の帯、の共通の形
function statCard({ kicker, title, sub, stats, foot }) {
  return frame(
    label(kicker),
    h("div", { fontFamily: "Barlow", fontSize: title.length > 14 ? 72 : 96, fontWeight: 700, color: C.ink, marginTop: 14, lineHeight: 1 }, title),
    sub ? h("div", { fontSize: 28, fontWeight: 500, color: C.mute, marginTop: 14 }, sub) : null,
    h("div", { flex: 1 }),
    stats?.length
      ? h("div", { gap: 10, marginBottom: 14 },
          ...stats.map(([l, v]) =>
            h("div", { flex: 1, flexDirection: "column", background: C.cell, padding: "12px 18px" },
              h("div", { fontSize: 20, fontWeight: 700, color: C.mute }, l),
              h("div", { fontFamily: "Barlow", fontSize: 44, fontWeight: 700, color: C.ink }, String(v)))))
      : null,
    foot ? h("div", { borderTop: `2px solid ${C.line}`, paddingTop: 14, fontSize: 24, fontWeight: 500, color: C.ink }, foot) : null,
  )
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const wl = (w, n) => `${w}-${n - w}`
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k)
const inc = (m, k, by = 1) => m.set(k, (m.get(k) ?? 0) + by)

async function siteCards(reports, pub) {
  const maps = reports.flatMap((r) => r.maps)
  const drafted = maps.filter((m) => !m.draftUnknown)
  const heroes = new Map()
  const teams = new Map()
  const players = new Map()
  const H = (k) => heroes.get(k) ?? heroes.set(k, { picks: 0, wins: 0, bans: 0, by: new Map() }).get(k)
  const T = (k) => teams.get(k) ?? teams.set(k, { regions: new Set(), titles: 0, sw: 0, sn: 0, mw: 0, mn: 0, heroes: new Map() }).get(k)
  const P = (k) => players.get(k) ?? players.set(k, { teams: new Set(), n: 0, w: 0, k: 0, d: 0, a: 0, heroes: new Map() }).get(k)
  for (const m of maps) {
    for (const t of m.teams) {
      const win = t.name === m.winner
      const tm = T(t.name)
      tm.mn++; if (win) tm.mw++
      for (const hero of t.picks) { const x = H(hero); x.picks++; if (win) x.wins++; inc(tm.heroes, hero) }
      for (const [name, hero, k, d, a] of t.players) {
        const p = P(name)
        p.teams.add(t.name); p.n++; if (win) p.w++; p.k += k; p.d += d; p.a += a; inc(p.heroes, hero)
        inc(H(hero).by, name)
      }
    }
    for (const hero of new Set(m.teams.flatMap((t) => t.bans))) H(hero).bans++
  }
  for (const r of reports) for (const s of r.series) s.teams.forEach((name, i) => {
    const t = T(name)
    const win = s.score[i] > s.score[1 - i]
    t.regions.add(s.region); t.sn++; if (win) t.sw++
    if (win && (s.stage ?? "決勝") === "決勝") t.titles++
  })

  const n = maps.length
  const byPick = [...heroes.entries()].sort((a, b) => b[1].picks - a[1].picks || a[0].localeCompare(b[0]))
  const sub = `${reports.length} 本のレポート・${n} マップ`
  await render(statCard({
    kicker: "DEADLOCK レポート", title: "ヒーロー統計", sub,
    stats: byPick.slice(0, 4).map(([h, x]) => [h, `${pct(x.picks, n)}%`]),
    foot: "ピック率・勝率・BAN 率。過去○日とそれ以前を比べられる",
  }), join(pub, "stats", "og.png"))

  const fpWin = drafted.filter((m) => m.winner === m.teams[0].name).length
  await render(statCard({
    kicker: "DEADLOCK レポート", title: "試合の傾向", sub,
    stats: [["先行ピックの勝率", `${pct(fpWin, drafted.length)}%`], ["平均試合時間", avgDuration(maps)]],
    foot: "ソウル差・Mid-Boss・ドラフトと勝敗の関係",
  }), join(pub, "trends", "og.png"))
  await render(statCard({ kicker: "DEADLOCK レポート", title: "チーム", sub: `${teams.size} チーム・${n} マップ`, foot: "大会に出たチームの戦績" }), join(pub, "teams", "og.png"))
  await render(statCard({ kicker: "DEADLOCK レポート", title: "選手", sub: `${players.size} 人・${n} マップ`, foot: "K/D/A・ソウル・ダメージ・回復" }), join(pub, "players", "og.png"))
  await render(statCard({ kicker: "DEADLOCK レポート", title: "対戦カード", sub: `${teams.size} チーム・${n} マップ`, foot: "2チームの直接の対戦成績と、よく使う・よく BAN するヒーロー" }), join(pub, "vs", "og.png"))
  await render(statCard({ kicker: "DEADLOCK レポート", title: "自分の試合と比べる", sub: "マッチ ID を入れると、同じヒーローの大会の平均と並べて表示", foot: "ソウル・ダメージ・回復・K/D/A を1分あたりで比べる" }), join(pub, "compare", "og.png"))

  for (const [name, t] of teams) {
    await render(statCard({
      kicker: `チーム・${[...t.regions].join(" / ")}`, title: name,
      stats: [["優勝", t.titles], ["シリーズ", wl(t.sw, t.sn)], ["マップ", wl(t.mw, t.mn)], ...(t.mn ? [["マップ勝率", `${pct(t.mw, t.mn)}%`]] : [])],
      foot: t.heroes.size ? `よく使う：${top(t.heroes, 4).join("・")}` : null,
    }), join(pub, "team", slug(name), "og.png"))
  }
  for (const [name, p] of players) {
    const avg = (v) => (v / p.n).toFixed(1)
    await render(statCard({
      kicker: `選手・${[...p.teams].join(" / ")}`, title: name,
      stats: [["マップ", wl(p.w, p.n)], ["K / D / A", `${avg(p.k)}/${avg(p.d)}/${avg(p.a)}`], ["KDA", ((p.k + p.a) / Math.max(p.d, 1)).toFixed(2)]],
      foot: `ヒーロー：${top(p.heroes, 4).join("・")}`,
    }), join(pub, "player", slug(name), "og.png"))
  }
  for (const [name, x] of heroes) {
    await render(statCard({
      kicker: "ヒーロー", title: name, sub,
      stats: [["ピック率", `${pct(x.picks, n)}%`], ["勝敗", wl(x.wins, x.picks)], ["BAN 率", `${pct(x.bans, drafted.length)}%`]],
      foot: x.by.size ? `使った選手：${top(x.by, 4).join("・")}` : "大会ではまだピックされていない",
    }), join(pub, "hero", slug(name), "og.png"))
  }
  return { teams: teams.size, players: players.size, heroes: heroes.size }
}

function avgDuration(maps) {
  const s = maps.reduce((sum, m) => { const [a, b] = m.duration.split(":").map(Number); return sum + a * 60 + b }, 0) / (maps.length || 1)
  return `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`
}

const reports = readdirSync(join(root, "reports"))
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(root, "reports", f), "utf8")))
  .sort((a, b) => b.id - a.id)

const pub = join(root, "public", "deadlock-report")
await render(indexCard(reports), join(pub, "og.png"))
for (const r of reports) await render(reportCard(r), join(pub, String(r.id), "og.png"))
const c = await siteCards(reports, pub)

// ---- パッチまとめ（public/deadlock-report/patch/YYYY-MM-DD/）のカード ----
// 数はページの中のヒーロー表（const H=[...]）とアイテム表の行から数える
const patchList = JSON.parse(readFileSync(join(root, "src", "patches.json"), "utf8"))
let patchCards = 0
for (const p of patchList) {
  const html = join(pub, "patch", p.date, "index.html")
  let page = ""
  try {
    page = readFileSync(html, "utf8")
  } catch {
    continue
  }
  const kinds = [...page.matchAll(/^\s*\["[^"]+","[^"]*","(buff|nerf|adj|fix)"/gm)].map((m) => m[1])
  const count = (k) => kinds.filter((x) => x === k).length
  const itemRows = (page.match(/<section class="panel">\s*<h2 class="lab">アイテム<\/h2>[\s\S]*?<\/section>/) ?? [""])[0].split("<tr><td>").length - 1
  const stats = [
    ["変更ヒーロー", `${kinds.length} 体`],
    ...(count("buff") ? [["強化", count("buff")]] : []),
    ...(count("nerf") ? [["弱体", count("nerf")]] : []),
    ...(itemRows ? [["変更アイテム", itemRows]] : []),
  ].slice(0, 4)
  await render(
    statCard({ kicker: `パッチまとめ・${p.date.replaceAll("-", ".")}`, title: p.title, sub: p.summary, stats, foot: "Deadlock の公式アップデートを日本語で整理" }),
    join(pub, "patch", p.date, "og.png")
  )
  patchCards++
}
console.log(`og: 目次 + レポート ${reports.length} 本 + 統計・傾向・一覧 + チーム ${c.teams} + 選手 ${c.players} + ヒーロー ${c.heroes} + パッチ ${patchCards}`)
