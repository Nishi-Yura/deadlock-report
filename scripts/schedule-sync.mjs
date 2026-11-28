// EDL.GG の大会一覧から、これからの Night Shift を src/schedule.json に足す。
//   npm run schedule-sync
// GitHub Actions（.github/workflows/schedule.yml）が毎日実行し、増えたときだけコミットして公開し直す。
//
// EDL.GG の大会ページには日付しか載っていない（時刻は画面のカウントダウンだけ）ので、
// 時刻はこれまでの実績の「地域ごとの開始時刻」を使う（2026年11月の配信・試合データで確認）：
//   EU 21:00 UTC（日本時間 翌6:00）・NA 00:00 UTC（9:00）・APAC 09:00 UTC（18:00）
// 実際と違ったときは src/schedule.json を手で直せば、同じ大会は二度と上書きしない（url で見分ける）。
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const file = join(root, "src", "schedule.json")
const START_HOUR_UTC = { eu: 21, na: 0, apac: 9 }
const EDL = "https://edl.gg"

const get = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "deadlock-report schedule sync (GitHub Actions)" } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

const schedule = JSON.parse(readFileSync(file, "utf8"))
const known = new Set(schedule.map((s) => s.url))
const today = new Date().toISOString().slice(0, 10)

let list
try {
  list = await get(`${EDL}/events`)
} catch (e) {
  // 取れないときは何も変えずに終わる（Actions も失敗にしない）
  console.log(`schedule-sync: EDL.GG を読めなかったので何もしない（${e.message}）`)
  process.exit(0)
}
const slugs = [...new Set([...list.matchAll(/\/events\/(deadlock-night-shift-(\d+)-(eu|na|apac))\b/g)].map((m) => m[1]))]

const added = []
for (const slug of slugs) {
  const url = `${EDL}/events/${slug}`
  if (known.has(url)) continue
  const [, num, region] = slug.match(/deadlock-night-shift-(\d+)-(eu|na|apac)/)
  let page
  try {
    page = await get(url)
  } catch (e) {
    console.log(`とばす ${slug}: ${e.message}`)
    continue
  }
  const date = page.match(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1]
  if (!date || date < today) continue
  const start = `${date}T${String(START_HOUR_UTC[region]).padStart(2, "0")}:00:00Z`
  added.push({ start, event: `Deadlock Night Shift ${num}`, region: region.toUpperCase(), url })
}

if (!added.length) {
  console.log("schedule-sync: 新しい予定はない")
  process.exit(0)
}
const next = [...schedule, ...added].sort((a, b) => a.start.localeCompare(b.start))
writeFileSync(file, JSON.stringify(next, null, 2) + "\n")
for (const a of added) console.log(`追加: ${a.start} ${a.event} ${a.region}`)
console.log(`schedule-sync: ${added.length} 件を src/schedule.json に足した`)
