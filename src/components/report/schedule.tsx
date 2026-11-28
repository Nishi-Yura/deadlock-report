// 次の大会（src/schedule.json を手で書く）。時刻は日本時間で出し、残り時間を数える。
// 始まってから6時間たったものは出さない
import { useEffect, useState } from "react"
import schedule from "@/schedule.json"
import { Label, Note, Panel } from "./parts"
import { Term } from "./term"

export interface Scheduled {
  /** 開始（配信開始）の時刻。UTC の ISO 形式 "2026-12-02T21:00:00Z" */
  start: string
  event: string
  region: string
  /** EDL.GG の大会ページ */
  url: string
}

const LIVE_HOURS = 6
// EU・NA・APAC とも同じチャンネルで配信（レポートの配信アーカイブで確認）
const STREAM = "https://www.youtube.com/@DeadlockNightShift"

const jst = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })

function until(ms: number) {
  if (ms <= 0) return "開催中"
  const h = Math.floor(ms / 3600e3)
  if (h < 1) return `あと ${Math.max(1, Math.round(ms / 60e3))} 分`
  if (h < 24) return `あと ${h} 時間`
  const d = Math.floor(h / 24)
  return `あと ${d} 日 ${h % 24} 時間`
}

export function NextEvents() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60e3)
    return () => clearInterval(t)
  }, [])
  const upcoming = (schedule as Scheduled[])
    .map((s) => ({ ...s, t: Date.parse(s.start) }))
    .filter((s) => s.t + LIVE_HOURS * 3600e3 > now)
    .sort((a, b) => a.t - b.t)
    .slice(0, 4)
  if (!upcoming.length) return null

  return (
    <Panel>
      <Label>次の大会</Label>
      <ul className="m-0 list-none p-0 pt-1">
        {upcoming.map((s) => {
          const live = s.t <= now
          const parts = Object.fromEntries(jst.formatToParts(new Date(s.t)).map((p) => [p.type, p.value]))
          return (
            <li key={s.url} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 max-sm:grid-cols-[76px_1fr]">
              <span className="leading-tight">
                <span className="num block font-num text-[17px] font-bold">{parts.month}/{parts.day}<span className="ml-1 text-[13px] font-semibold text-mute">（{parts.weekday}）</span></span>
                <span className="num block text-[13px] text-mute">{parts.hour}:{parts.minute}〜</span>
              </span>
              <span className="min-w-0">
                <a href={s.url} className="block font-semibold">{s.event} <span className="text-ink">{s.region}</span></a>
                <span className={live ? "text-[13px] font-bold text-win" : "num text-[13px] text-mute"}>{until(s.t - now)}</span>
              </span>
              <a href={STREAM} className="text-[13px] max-sm:col-start-2 max-sm:-mt-1.5">配信（YouTube）</a>
            </li>
          )
        })}
      </ul>
      <Note label="時刻について">
        日本時間。<Term k="night-shift">Night Shift</Term> の開始時刻は EDL.GG のカウントダウンから。最初の試合はふつう 15〜30 分あと。
      </Note>
    </Panel>
  )
}
