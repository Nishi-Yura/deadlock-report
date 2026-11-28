// 大会が始まる少し前に、Discord にお知らせを投稿する（src/schedule.json を見る）。
//
// GitHub Actions（.github/workflows/remind.yml）が30分ごとに実行する：
//   node scripts/remind.mjs --since <前に成功した実行の時刻>
// 「開始の LEAD 分前」が、前の実行から今までの間に入った大会だけを投稿する。
// こうすると Actions の起動が遅れても、同じ大会を2回投稿したり、抜かしたりしない。
// ただし、始まってから30分以上たった大会は、もう遅いので投稿しない。
//
// 手元で文面だけ確かめる（投稿はしない）：
//   npm run remind -- --at 2026-12-02T20:10:00Z
// 手元から本当に投稿するときは --send を付け、環境変数 DISCORD_WEBHOOK_URL を設定しておく。
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const SITE = "https://nishi-yura.github.io/deadlock-report/"
const STREAM = "https://www.youtube.com/@DeadlockNightShift"
/** 開始の何分前に知らせるか */
export const LEAD = 60
/** 前の実行の時刻が分からない・古すぎるときに、さかのぼる長さ（分） */
const MAX_BACK = 120

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
const inCI = !!process.env.GITHUB_ACTIONS
// --at は文面の確認用（投稿しない）。CI は --now（この実行が始まった時刻）を渡して投稿する
const send = (inCI && !opt("at")) || args.includes("--send")
const webhook = process.env.DISCORD_WEBHOOK_URL ?? ""

const MIN = 60_000
const nowArg = opt("at") || opt("now")
let now = nowArg ? Date.parse(nowArg) : Date.now()
if (opt("at") && Number.isNaN(now)) throw new Error(`--at の時刻が読めない: ${opt("at")}`)
if (Number.isNaN(now)) now = Date.now()
let since = opt("since") ? Date.parse(opt("since")) : NaN
if (Number.isNaN(since) || since < now - MAX_BACK * MIN || since > now) since = now - 30 * MIN

const jst = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
})

export function remindMessage(s) {
  const p = Object.fromEntries(jst.formatToParts(new Date(s.start)).map((x) => [x.type, x.value]))
  return [
    `**まもなく ${s.event} ${s.region}**`,
    `日本時間 ${p.month}/${p.day}（${p.weekday}）${p.hour}:${p.minute} から。最初の試合はふつう 15〜30 分あと。`,
    `配信：${STREAM}`,
    `大会ページ：${s.url}`,
    `出場チームの成績・よく使うヒーロー：${SITE}teams/`,
  ].join("\n")
}

const schedule = JSON.parse(readFileSync(join(root, "src", "schedule.json"), "utf8"))
const due = schedule
  .map((s) => ({ s, t: Date.parse(s.start) }))
  // 知らせる時刻（開始の LEAD 分前）が (since, now] に入るもの。始まって30分以上たったものは除く
  .filter(({ t }) => t - LEAD * MIN > since && t - LEAD * MIN <= now && t > now - 30 * MIN)
  .sort((a, b) => a.t - b.t)
  .map(({ s }) => s)

const fmt = (t) => new Date(t).toISOString().slice(0, 16) + "Z"
console.log(`remind: ${fmt(since)} 〜 ${fmt(now)} に知らせる大会 ${due.length} 件`)
if (!due.length) process.exit(0)
const messages = due.map(remindMessage)
for (const m of messages) console.log(`---\n${m}`)
console.log("---")
if (!send) {
  console.log("remind: 文面の確認だけ（投稿するなら --send）")
  process.exit(0)
}
if (!webhook) {
  console.log("remind: DISCORD_WEBHOOK_URL が設定されていないので投稿しない")
  process.exit(0)
}
for (const content of messages) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  })
  if (!res.ok) throw new Error(`Discord への投稿に失敗（${res.status}）: ${(await res.text()).slice(0, 200)}`)
  await new Promise((r) => setTimeout(r, 1000))
}
console.log(`remind: ${messages.length} 件を投稿した`)
