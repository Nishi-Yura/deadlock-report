import type { MapData, Report, Series } from "@/types"

const modules = import.meta.glob<Report>("../../reports/*.json", { eager: true, import: "default" })

/** 番号の新しい順 */
export const reports: Report[] = Object.values(modules).sort((a, b) => b.id - a.id)

export function getReport(id: number): Report {
  const r = reports.find((x) => x.id === id)
  if (!r) throw new Error(`reports/${id}.json がありません`)
  return r
}

export const reportPath = (id: number) => `/deadlock-report/${id}/`

export const fmt = (n: number) => n.toLocaleString("en-US")

export const FINAL = "決勝"
export const stageOf = (x: { stage?: string }) => x.stage ?? FINAL
export const isFinal = (x: { stage?: string }) => stageOf(x) === FINAL
export const seriesKey = (s: Series) => `${s.region}-${stageOf(s)}`

/** そのシリーズのマップ */
export function seriesMaps(r: Report, s: Series): MapData[] {
  return r.maps.filter((m) => m.region === s.region && stageOf(m) === stageOf(s))
}

/** 決勝 → チャレンジャー → 予選 の順に並べた地域ごとのシリーズ */
export function seriesByRegion(r: Report): { region: string; series: Series[] }[] {
  const regions = [...new Set(r.series.map((s) => s.region))]
  return regions.map((region) => ({ region, series: r.series.filter((s) => s.region === region) }))
}

export function mapLabel(m: MapData) {
  return `${m.region} ${stageOf(m)} Map ${m.no}`
}

export function kills(m: MapData): [number, number] {
  const sum = (i: 0 | 1) => m.teams[i].players.reduce((s, p) => s + p[2], 0)
  return [sum(0), sum(1)]
}

/** 勝ったチームを先にした [勝ち, 負け] */
export function winnerFirst(m: MapData) {
  const [a, b] = m.teams
  return a.name === m.winner ? ([a, b] as const) : ([b, a] as const)
}

export function seriesKills(r: Report, s: Series): [number, number] {
  let a = 0
  let b = 0
  for (const m of seriesMaps(r, s)) {
    for (const t of m.teams) {
      const k = t.players.reduce((sum, p) => sum + p[2], 0)
      if (t.name === s.teams[0]) a += k
      if (t.name === s.teams[1]) b += k
    }
  }
  return [a, b]
}

/** BAN が分かっている（配信のある）マップの数 */
export const draftMapCount = (r: Report) => r.maps.filter((m) => !m.draftUnknown).length

export interface HeroRecord {
  hero: string
  win: number
  lose: number
}

/** ピックしたチームから見た勝敗。2回以上使われたものだけ。勝ち数の多い順 */
export function heroRecords(r: Report, min = 2): HeroRecord[] {
  const map = new Map<string, HeroRecord>()
  for (const m of r.maps) {
    for (const t of m.teams) {
      for (const h of t.picks) {
        const rec = map.get(h) ?? { hero: h, win: 0, lose: 0 }
        if (t.name === m.winner) rec.win++
        else rec.lose++
        map.set(h, rec)
      }
    }
  }
  return [...map.values()]
    .filter((x) => x.win + x.lose >= min)
    .sort((a, b) => b.win - a.win || a.lose - b.lose || a.hero.localeCompare(b.hero))
}

/** BAN されたマップ数の多い順 */
export function banCounts(r: Report): { hero: string; maps: number }[] {
  const map = new Map<string, Set<string>>()
  for (const m of r.maps) {
    for (const t of m.teams) {
      for (const h of t.bans) {
        const s = map.get(h) ?? new Set<string>()
        s.add(m.id)
        map.set(h, s)
      }
    }
  }
  return [...map.entries()]
    .map(([hero, s]) => ({ hero, maps: s.size }))
    .sort((a, b) => b.maps - a.maps || a.hero.localeCompare(b.hero))
}

export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number)
  return `${y}年${m}月${day}日`
}
