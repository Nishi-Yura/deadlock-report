// 試合展開（ソウル差・Mid-Boss）とドラフトの集計。/trends/ ページが使う
import timelines from "@/timelines.json"
import type { MapCtx } from "@/lib/stats"
import type { MapData } from "@/types"

export interface Timeline {
  t: number[]
  /** teams[0] − teams[1] のソウル */
  lead: number[]
  /** team はレポートの teams の添字 */
  mid: { t: number; team: number }[]
}

const data = timelines as Record<string, Timeline>
export const timelineOf = (m: MapData): Timeline | undefined => data[m.matchId]

export const durationSec = (m: MapData) => {
  const [mm, ss] = m.duration.split(":").map(Number)
  return mm * 60 + ss
}

/** t 秒のときの teams[0] から見たソウル差（スナップショットの間は直線でつなぐ） */
export function leadAt(tl: Timeline, t: number): number | undefined {
  if (t > tl.t[tl.t.length - 1]) return undefined
  for (let i = 1; i < tl.t.length; i++) {
    if (tl.t[i] >= t) {
      const [t0, t1] = [tl.t[i - 1], tl.t[i]]
      const [v0, v1] = [tl.lead[i - 1], tl.lead[i]]
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return tl.lead[0]
}

const winSide = (m: MapData) => (m.teams[0].name === m.winner ? 0 : 1)

export interface Rate {
  n: number
  win: number
}

/** ○分の時点でリードしていたチームの勝率。差が 1,000 未満のマップは数えない */
export function leaderAt(maps: MapCtx[], minute: number): Rate & { close: number; ended: number } {
  const r = { n: 0, win: 0, close: 0, ended: 0 }
  for (const { map } of maps) {
    const tl = timelineOf(map)
    if (!tl) continue
    const v = leadAt(tl, minute * 60)
    if (v === undefined) {
      r.ended++
      continue
    }
    if (Math.abs(v) < 1000) {
      r.close++
      continue
    }
    r.n++
    if ((v > 0 ? 0 : 1) === winSide(map)) r.win++
  }
  return r
}

/** 先に X ソウル差をつけたチームの勝率 */
export function firstTo(maps: MapCtx[], x: number): Rate {
  const r = { n: 0, win: 0 }
  for (const { map } of maps) {
    const tl = timelineOf(map)
    if (!tl) continue
    const i = tl.lead.findIndex((v) => Math.abs(v) >= x)
    if (i === -1) continue
    r.n++
    if ((tl.lead[i] > 0 ? 0 : 1) === winSide(map)) r.win++
  }
  return r
}

export interface Comeback {
  ctx: MapCtx
  /** 勝ったチームが一番負けていたときの差 */
  deficit: number
  /** そのときの時刻（秒） */
  at: number
}

/** 逆転勝ち（勝ったチームが途中で負けていた差の大きい順） */
export function comebacks(maps: MapCtx[]): Comeback[] {
  const out: Comeback[] = []
  for (const ctx of maps) {
    const tl = timelineOf(ctx.map)
    if (!tl) continue
    const sign = winSide(ctx.map) === 0 ? 1 : -1
    let deficit = 0
    let at = 0
    tl.lead.forEach((v, i) => {
      if (-sign * v > deficit) {
        deficit = -sign * v
        at = tl.t[i]
      }
    })
    if (deficit >= 3000) out.push({ ctx, deficit, at })
  }
  return out.sort((a, b) => b.deficit - a.deficit)
}

/** 最初の Mid-Boss を取ったチームの勝率と、平均の時刻 */
export function firstMidBoss(maps: MapCtx[]): Rate & { avgT: number; none: number } {
  const r = { n: 0, win: 0, avgT: 0, none: 0 }
  let sum = 0
  for (const { map } of maps) {
    const tl = timelineOf(map)
    if (!tl) continue
    const first = [...tl.mid].sort((a, b) => a.t - b.t)[0]
    if (!first) {
      r.none++
      continue
    }
    r.n++
    sum += first.t
    if (first.team === winSide(map)) r.win++
  }
  r.avgT = r.n ? Math.round(sum / r.n) : 0
  return r
}

export function durations(maps: MapCtx[]) {
  const xs = maps.map((x) => ({ ctx: x, s: durationSec(x.map) })).sort((a, b) => a.s - b.s)
  const avg = xs.length ? Math.round(xs.reduce((s, x) => s + x.s, 0) / xs.length) : 0
  return { avg, shortest: xs[0], longest: xs[xs.length - 1], n: xs.length }
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`

// ---- ドラフト ----

const drafted = (maps: MapCtx[]) => maps.filter((x) => !x.map.draftUnknown)

/** 先行ピック（teams[0]）側の勝率 */
export function firstPickRate(maps: MapCtx[]): Rate {
  const d = drafted(maps)
  return { n: d.length, win: d.filter((x) => winSide(x.map) === 0).length }
}

export interface HeroCount {
  hero: string
  n: number
  win: number
}

const count = (xs: { hero: string; win: boolean }[]): HeroCount[] => {
  const by = new Map<string, HeroCount>()
  for (const x of xs) {
    const r = by.get(x.hero) ?? { hero: x.hero, n: 0, win: 0 }
    r.n++
    if (x.win) r.win++
    by.set(x.hero, r)
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.win - a.win || a.hero.localeCompare(b.hero))
}

/** 試合の最初のピック（先行チームの1体目） */
export function firstPicks(maps: MapCtx[]): HeroCount[] {
  return count(drafted(maps).map((x) => ({ hero: x.map.teams[0].picks[0], win: winSide(x.map) === 0 })))
}

/** チームの中で何番目に取られたか（1〜6）の平均。早いほど優先度が高い。min 回以上ピックされたもの */
export function pickOrder(maps: MapCtx[], min = 3) {
  const by = new Map<string, number[]>()
  for (const { map } of drafted(maps)) {
    for (const t of map.teams) {
      t.picks.forEach((h, i) => by.set(h, [...(by.get(h) ?? []), i + 1]))
    }
  }
  return [...by.entries()]
    .filter(([, xs]) => xs.length >= min)
    .map(([hero, xs]) => ({ hero, n: xs.length, avg: xs.reduce((s, x) => s + x, 0) / xs.length, early: xs.filter((x) => x <= 2).length }))
    .sort((a, b) => a.avg - b.avg || b.n - a.n)
}

/** 先行側・後攻側それぞれが BAN したヒーロー */
export function bansBySide(maps: MapCtx[], side: 0 | 1): HeroCount[] {
  return count(drafted(maps).flatMap((x) => x.map.teams[side].bans.map((hero) => ({ hero, win: winSide(x.map) === side }))))
}

export const draftedCount = (maps: MapCtx[]) => drafted(maps).length
export const withTimeline = (maps: MapCtx[]) => maps.filter((x) => timelineOf(x.map)).length

// ---- ヒーローの組み合わせ ----

export interface Pair {
  a: string
  b: string
  n: number
  win: number
}

/** 同じチームで一緒にピックされた2体。min 回以上のもの、回数の多い順 */
export function pairs(maps: MapCtx[], min = 3): Pair[] {
  const by = new Map<string, Pair>()
  for (const { map } of maps) {
    for (const t of map.teams) {
      const hs = [...t.picks].sort()
      for (let i = 0; i < hs.length; i++) {
        for (let j = i + 1; j < hs.length; j++) {
          const key = hs[i] + "|" + hs[j]
          const p = by.get(key) ?? { a: hs[i], b: hs[j], n: 0, win: 0 }
          p.n++
          if (t.name === map.winner) p.win++
          by.set(key, p)
        }
      }
    }
  }
  return [...by.values()].filter((p) => p.n >= min).sort((x, y) => y.n - x.n || y.win - x.win || (x.a + x.b).localeCompare(y.a + y.b))
}

/** そのヒーローと同じチームでピックされたヒーロー */
export function partners(maps: MapCtx[], hero: string) {
  const by = new Map<string, { hero: string; n: number; win: number }>()
  for (const { map } of maps) {
    for (const t of map.teams) {
      if (!t.picks.includes(hero)) continue
      for (const h of t.picks) {
        if (h === hero) continue
        const r = by.get(h) ?? { hero: h, n: 0, win: 0 }
        r.n++
        if (t.name === map.winner) r.win++
        by.set(h, r)
      }
    }
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.win - a.win || a.hero.localeCompare(b.hero))
}
