// reports/*.json から、ビルドの入口になる HTML（entries/）を作り直す。
// あわせて更新フィード public/deadlock-report/feed.xml も書く。
// npm run build の最初に自動で実行される。
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { slug } from "./slug.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const entries = join(root, "entries")
if (existsSync(entries)) rmSync(entries, { recursive: true })

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const SITE = "https://nishi-yura.github.io"


const page = ({ title, ogTitle, description, data = {}, depth, path, type, ogImage }) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" type="application/rss+xml" title="Deadlock レポート" href="${SITE}/deadlock-report/feed.xml">
<meta property="og:site_name" content="Deadlock レポート">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="ja_JP">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}${ogImage ?? path + "og.png"}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogTitle)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2b2b2b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
<div id="root"${Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("")}></div>
<noscript>このページは JavaScript で表示しています。</noscript>
<script type="module" src="${"../".repeat(depth + 1)}src/main.tsx"></script>
</body>
</html>
`

const write = (dir, html) => {
  mkdirSync(join(entries, dir), { recursive: true })
  writeFileSync(join(entries, dir, "index.html"), html)
}

write("deadlock-report", page({
  title: "Deadlock レポート",
  ogTitle: "Deadlock レポート",
  path: "/deadlock-report/",
  type: "website",
  description: "Deadlock の大会の決勝を、ドラフトとマッチデータで振り返るレポートの一覧。",
  depth: 1,
}))

const files = readdirSync(join(root, "reports")).filter((f) => /^\d+\.json$/.test(f))
const reports = files.map((f) => JSON.parse(readFileSync(join(root, "reports", f), "utf8"))).sort((a, b) => b.id - a.id)
for (const r of reports) {
  write(`deadlock-report/${r.id}`, page({
    title: `${r.title} | Deadlock レポート #${r.id}`,
    ogTitle: `${r.title}（レポート #${r.id}）`,
    path: `/deadlock-report/${r.id}/`,
    type: "article",
    description: r.headline,
    data: { report: r.id },
    depth: 2,
  }))
}

// 全レポートをまたぐページ。カード画像（og.png）は scripts/og.mjs が各ページのフォルダに作る
const sub = (dir, depth, { title, description, data }) =>
  write(`deadlock-report/${dir}`, page({
    title: `${title} | Deadlock レポート`,
    ogTitle: title,
    path: `/deadlock-report/${dir}/`,
    type: "website",
    description,
    data,
    depth,
  }))

sub("stats", 2, {
  title: "ヒーロー統計",
  description: "Deadlock の大会のピック率・勝率・BAN 率。パッチ前後の比較と地域別の絞り込みつき。",
  data: { page: "stats" },
})
sub("trends", 2, {
  title: "試合の傾向",
  description: "Deadlock の大会で、ソウル差・Mid-Boss・先行ピックが勝敗とどれくらい結びついているか。",
  data: { page: "trends" },
})
sub("compare", 2, {
  title: "自分の試合と比べる",
  description: "Deadlock のマッチ ID を入れると、同じヒーローの大会での平均（ソウル・ダメージ・回復・K/D/A）と並べて表示。",
  data: { page: "compare" },
})
sub("teams", 2, { title: "チーム", description: "Deadlock の大会に出たチームの戦績。", data: { page: "teams" } })
sub("vs", 2, { title: "対戦カード", description: "Deadlock の大会に出た2チームの直接の対戦成績と、よく使う・よく BAN するヒーロー。", data: { page: "vs" } })
sub("players", 2, { title: "選手", description: "Deadlock の大会に出た選手の成績（K/D/A・ソウル・ダメージ・回復）。", data: { page: "players" } })

const teams = new Set()
const players = new Set()
const heroes = new Set()
for (const r of reports) {
  for (const s of r.series) s.teams.forEach((t) => teams.add(t))
  for (const m of r.maps) {
    for (const t of m.teams) {
      for (const p of t.players) players.add(p[0])
      for (const h of [...t.picks, ...t.bans]) heroes.add(h)
    }
  }
}
for (const t of teams) {
  sub(`team/${slug(t)}`, 3, { title: `${t}（チーム）`, description: `Deadlock のチーム ${t} の戦績、よく使うヒーロー、BAN、選手。`, data: { page: "team", slug: slug(t) } })
}
for (const p of players) {
  sub(`player/${slug(p)}`, 3, { title: `${p}（選手）`, description: `Deadlock の選手 ${p} の大会での成績と使ったヒーロー。`, data: { page: "player", slug: slug(p) } })
}

for (const h of heroes) {
  sub(`hero/${slug(h)}`, 3, { title: `${h}（ヒーロー）`, description: `Deadlock の大会での ${h} のピック率・勝敗・BAN、使った選手。`, data: { page: "hero", slug: slug(h) } })
}

// ---- RSS（レポートとパッチまとめ） ----
const patches = JSON.parse(readFileSync(join(root, "src", "patches.json"), "utf8"))
const rfc822 = (d) => new Date(`${d}T12:00:00+09:00`).toUTCString()
const items = [
  ...reports.map((r) => ({
    date: r.date,
    title: `#${r.id} ${r.title}`,
    link: `${SITE}/deadlock-report/${r.id}/`,
    description: r.headline,
  })),
  ...patches.map((p) => ({ date: p.date, title: `パッチまとめ：${p.title}`, link: SITE + p.path, description: p.summary })),
].sort((a, b) => b.date.localeCompare(a.date))

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Deadlock レポート</title>
<link>${SITE}/deadlock-report/</link>
<atom:link href="${SITE}/deadlock-report/feed.xml" rel="self" type="application/rss+xml"/>
<description>Deadlock の大会レポートとパッチまとめ</description>
<language>ja</language>
${items.length ? `<lastBuildDate>${rfc822(items[0].date)}</lastBuildDate>\n` : ""}${items.map((i) => `<item>
<title>${esc(i.title)}</title>
<link>${i.link}</link>
<guid>${i.link}</guid>
<pubDate>${rfc822(i.date)}</pubDate>
<description>${esc(i.description)}</description>
</item>`).join("\n")}
</channel>
</rss>
`
writeFileSync(join(root, "public", "deadlock-report", "feed.xml"), feed)

console.log(`entries: 目次 + レポート ${reports.length} 本 + 統計 + チーム ${teams.size} + 選手 ${players.size} + ヒーロー ${heroes.size}、feed.xml ${items.length} 件`)
