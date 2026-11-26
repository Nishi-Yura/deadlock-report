// reports/N.json の形。新しいレポートはこの形で書く（README.md 参照）

/** [選手名, ヒーロー, キル, デス, アシスト, ソウル, ダメージ, 回復] */
export type PlayerRow = [string, string, number, number, number, number, number, number]

export interface MapTeam {
  name: string
  /** ピック順 */
  picks: string[]
  bans: string[]
  players: PlayerRow[]
}

export interface MapData {
  id: string
  region: string
  /** "決勝" | "チャレンジャー" | "予選" など。省略すると "決勝" */
  stage?: string
  no: number
  winner: string
  /** 配信がなくて分からないときは "" */
  firstPick: string
  /** 配信がなく、ピック順と BAN が分からないマップ。picks は使用ヒーローを書く（順不同）、bans は [] */
  draftUnknown?: boolean
  /** "36:32" */
  duration: string
  matchId: number
  /** public/deadlock-report/N/ からの相対パス */
  screenshot?: string
  screenshotNote?: string
  flow?: string
  /** teams[0] が先行ピックのチーム */
  teams: [MapTeam, MapTeam]
}

export interface Series {
  region: string
  /** 省略すると "決勝"。決勝以外は小さく表示される */
  stage?: string
  /** 大会当日と違う日に行われた場合（予選など）"2026-11-23" */
  date?: string
  teams: [string, string]
  score: [number, number]
  note?: string
}

export interface Report {
  id: number
  event: string
  title: string
  /** "2026-11-18" */
  date: string
  headline: string
  series: Series[]
  maps: MapData[]
  heroNote?: string
  banNote?: string
  takeaways: { title: string; body: string }[]
  practice?: string[]
  sources: { label: string; url: string }[]
}
