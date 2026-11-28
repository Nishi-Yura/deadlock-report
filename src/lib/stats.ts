// レポートをまたいだ集計（ヒーロー統計・チーム・選手のページ）
import { reports, stageOf } from "@/lib/report"
import patchList from "@/patches.json"
import type { MapData, Report, Series } from "@/types"

export interface Patch {
  /** "2026-11-26" */
  date: string
  path: string
  title: string
  summary: string
}

/** 新しい順 */
export const patches: Patch[] = [...patchList].sort((a, b) => b.date.localeCompare(a.date))
export const latestPatch: Patch | undefined = patches[0]

/** "2026-11-26" → "11/26" */
export const shortDate = (d: string) => {
  const [, m, day] = d.split("-").map(Number)
  return `${m}/${day}`
}

/** URL に使う名前。"Buff Enjoyers" → "buff-enjoyers" */
export const slug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s&]+/g, "-").replace(/[^a-z0-9_-]/g, "").replace(/-+/g, "-") || "x"

export const teamPath = (name: string) => `/deadlock-report/team/${slug(name)}/`
export const playerPath = (name: string) => `/deadlock-report/player/${slug(name)}/`

export interface MapCtx {
  report: Report
  map: MapData
  /** そのマップが行われた日（シリーズの date、なければ大会の日） */
  date: string
}

/** シリーズの日付（予選などは大会と別の日） */
export const seriesDate = (r: Report, s: Series) => s.date ?? r.date

export function mapDate(r: Report, m: MapData) {
  const s = r.series.find((x) => x.region === m.region && stageOf(x) === stageOf(m))
  return s ? seriesDate(r, s) : r.date
}

/** 全レポートの全マップ。新しい順 */
export const allMaps: MapCtx[] = reports
  .flatMap((report) => report.maps.map((map) => ({ report, map, date: mapDate(report, map) })))
  .sort((a, b) => b.date.localeCompare(a.date) || b.report.id - a.report.id)

export const regions: string[] = [...new Set(reports.flatMap((r) => r.series.map((s) => s.region)))].sort()

// ---- 期間（今日から数えて過去 N 日） ----

/** 期間の選択肢（日数）。0 は全期間 */
export const DAY_OPTIONS = [3, 7, 14, 30] as const

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** 過去 N 日の最初の日（今日を含めて N 日）。"2026-11-22" など */
export function sinceDate(days: number, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  d.setDate(d.getDate() - (days - 1))
  return iso(d)
}

export const todayISO = () => iso(new Date())

export interface Filter {
  /** 過去何日か。0 なら全期間 */
  days: number
  region: string // "" で全地域
  /** true なら「過去 N 日より前」のマップ（比べる用） */
  older?: boolean
}

export function inDays(date: string, days: number, older = false) {
  if (!days) return !older
  const since = sinceDate(days)
  return older ? date < since : date >= since
}

export function filterMaps(maps: MapCtx[], f: Filter): MapCtx[] {
  return maps.filter((x) => inDays(x.date, f.days, f.older) && (!f.region || x.map.region === f.region))
}

/** 一番新しい試合の日（データがいつまでか） */
export const latestMatchDate = (): string => allMaps[0]?.date ?? ""

// ---- ヒーロー ----

export interface HeroStat {
  hero: string
  picks: number
  wins: number
  /** BAN されたマップ数（同じマップで両チームが BAN しても1） */
  bans: number
}

export interface HeroTable {
  rows: HeroStat[]
  maps: number
  /** ドラフト（BAN）が分かっているマップ数 */
  draftMaps: number
}

export function heroTable(maps: MapCtx[]): HeroTable {
  const by = new Map<string, HeroStat>()
  const get = (hero: string) => {
    let s = by.get(hero)
    if (!s) by.set(hero, (s = { hero, picks: 0, wins: 0, bans: 0 }))
    return s
  }
  for (const { map } of maps) {
    for (const t of map.teams) {
      for (const h of t.picks) {
        const s = get(h)
        s.picks++
        if (t.name === map.winner) s.wins++
      }
    }
    for (const h of new Set(map.teams.flatMap((t) => t.bans))) get(h).bans++
  }
  return {
    rows: [...by.values()],
    maps: maps.length,
    draftMaps: maps.filter((x) => !x.map.draftUnknown).length,
  }
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// ---- チーム ----

export interface TeamMap {
  ctx: MapCtx
  /** そのマップでのこのチーム */
  side: 0 | 1
  win: boolean
  opponent: string
}

export interface TeamSeries {
  report: Report
  series: Series
  win: boolean
  opponent: string
  score: [number, number]
}

export interface TeamStat {
  name: string
  regions: string[]
  maps: TeamMap[]
  series: TeamSeries[]
  /** 決勝で勝った回数 */
  titles: number
}

export function teamStats(): TeamStat[] {
  const by = new Map<string, TeamStat>()
  const get = (name: string) => {
    let t = by.get(name)
    if (!t) by.set(name, (t = { name, regions: [], maps: [], series: [], titles: 0 }))
    return t
  }
  for (const ctx of allMaps) {
    ctx.map.teams.forEach((t, i) => {
      const side = i as 0 | 1
      get(t.name).maps.push({ ctx, side, win: t.name === ctx.map.winner, opponent: ctx.map.teams[1 - side].name })
    })
  }
  for (const report of reports) {
    for (const s of report.series) {
      s.teams.forEach((name, i) => {
        const t = get(name)
        const win = s.score[i] > s.score[1 - i]
        t.series.push({ report, series: s, win, opponent: s.teams[1 - i], score: [s.score[i], s.score[1 - i]] })
        if (!t.regions.includes(s.region)) t.regions.push(s.region)
        if (win && stageOf(s) === "決勝") t.titles++
      })
    }
  }
  for (const t of by.values()) {
    t.series.sort((a, b) => seriesDate(b.report, b.series).localeCompare(seriesDate(a.report, a.series)) || b.report.id - a.report.id)
  }
  return [...by.values()].sort(
    (a, b) => b.titles - a.titles || wins(b.maps) - wins(a.maps) || a.name.localeCompare(b.name)
  )
}

export const wins = (xs: { win: boolean }[]) => xs.filter((x) => x.win).length

// ---- 選手 ----

export interface PlayerMap {
  ctx: MapCtx
  team: string
  opponent: string
  win: boolean
  hero: string
  k: number
  d: number
  a: number
  souls: number
  dmg: number
  heal: number
}

export interface PlayerStat {
  name: string
  teams: string[]
  maps: PlayerMap[]
}

export function playerStats(): PlayerStat[] {
  const by = new Map<string, PlayerStat>()
  for (const ctx of allMaps) {
    ctx.map.teams.forEach((t, i) => {
      for (const [name, hero, k, d, a, souls, dmg, heal] of t.players) {
        let p = by.get(name)
        if (!p) by.set(name, (p = { name, teams: [], maps: [] }))
        if (!p.teams.includes(t.name)) p.teams.push(t.name)
        p.maps.push({
          ctx, team: t.name, opponent: ctx.map.teams[1 - i].name, win: t.name === ctx.map.winner,
          hero, k, d, a, souls, dmg, heal,
        })
      }
    })
  }
  return [...by.values()].sort((a, b) => b.maps.length - a.maps.length || a.name.localeCompare(b.name))
}

export interface PlayerTotals {
  maps: number
  wins: number
  k: number
  d: number
  a: number
  /** 1マップ平均 */
  souls: number
  dmg: number
  heal: number
  /** (K+A)/D。デス0なら K+A */
  kda: number
}

export function playerTotals(ms: PlayerMap[]): PlayerTotals {
  const n = ms.length || 1
  const sum = (f: (m: PlayerMap) => number) => ms.reduce((s, m) => s + f(m), 0)
  const k = sum((m) => m.k)
  const d = sum((m) => m.d)
  const a = sum((m) => m.a)
  return {
    maps: ms.length,
    wins: wins(ms),
    k, d, a,
    souls: Math.round(sum((m) => m.souls) / n),
    dmg: Math.round(sum((m) => m.dmg) / n),
    heal: Math.round(sum((m) => m.heal) / n),
    kda: (k + a) / Math.max(d, 1),
  }
}

/** ヒーローごとの使用回数と勝敗。使った回数の多い順 */
export function heroUsage(xs: { hero: string; win: boolean }[]) {
  const by = new Map<string, { hero: string; n: number; win: number }>()
  for (const x of xs) {
    const r = by.get(x.hero) ?? { hero: x.hero, n: 0, win: 0 }
    r.n++
    if (x.win) r.win++
    by.set(x.hero, r)
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.win - a.win || a.hero.localeCompare(b.hero))
}

/** "1回戦（APAC 決勝 Map 2）" のような短いマップ名 */
export const mapShort = (m: MapData) => `${m.region} ${stageOf(m)} M${m.no}`

/** レポートのそのマップへのリンク */
export const mapLink = (ctx: MapCtx) => `/deadlock-report/${ctx.report.id}/#${ctx.map.id}`

export const heroPath = (name: string) => `/deadlock-report/hero/${slug(name)}/`

/** これより少ない回数の勝率は、色を付けずに灰色で出す（たまたまの 100% を強く見せない） */
export const MIN_HERO = 5 // ヒーロー：ピック回数
export const MIN_MAPS = 3 // 選手・チーム：マップ数
