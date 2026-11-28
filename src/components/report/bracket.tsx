// 勝ち上がり表。予選 → チャレンジャー → 決勝 を左から右へ階段状に並べ、勝者が次の試合へ進む線を引く。
// スマホ幅では縦に並べ、間に「↓ ○○ が決勝へ」を挟む。
import { formatDate, seriesKey, stageOf } from "@/lib/report"
import type { Series } from "@/types"
import { cn } from "@/lib/utils"

const R = 34 // チーム1行の高さ
const H = 24 // 見出し（ステージ名）の高さ

const winnerOf = (s: Series) => (s.score[0] > s.score[1] ? s.teams[0] : s.teams[1])

/** 前の試合の勝者が上の行に来るように並べ替えた [team, score] の2行 */
function rows(s: Series, incoming?: string): [string, number][] {
  const r: [string, number][] = [[s.teams[0], s.score[0]], [s.teams[1], s.score[1]]]
  return incoming && r[1][0] === incoming ? [r[1], r[0]] : r
}

export function Bracket({ series, onPick }: { series: Series[]; onPick?: (key: string) => void }) {
  const incoming = series.map((_, i) => (i > 0 ? winnerOf(series[i - 1]) : undefined))
  return (
    <>
      {/* 横（sm 以上） */}
      <div className="flex items-start max-sm:hidden" style={{ height: (series.length - 1) * R + H + 2 * R }}>
        {series.map((s, i) => (
          <div key={seriesKey(s)} className="contents">
            {i > 0 && (
              <div className="relative w-6 shrink-0" style={{ marginTop: (i - 1) * R + H + R, height: R / 2 }} aria-hidden>
                <span className="absolute top-0 left-0 h-full w-1/2 border-t border-r border-mute/60" />
                <span className="absolute right-0 bottom-0 w-1/2 border-b border-mute/60" />
              </div>
            )}
            <div className="min-w-0 flex-1" style={{ marginTop: i * R }}>
              <Box s={s} incoming={incoming[i]} last={i === series.length - 1} onPick={onPick} />
            </div>
          </div>
        ))}
      </div>
      {/* 縦（スマホ） */}
      <div className="sm:hidden">
        {series.map((s, i) => (
          <div key={seriesKey(s)}>
            {i > 0 && (
              <p className="m-0 py-1 pl-2 text-[13px] text-mute">
                ↓ <b className="font-semibold text-ink">{incoming[i]}</b> が{stageOf(s)}へ
              </p>
            )}
            <Box s={s} incoming={incoming[i]} last={i === series.length - 1} onPick={onPick} />
          </div>
        ))}
      </div>
    </>
  )
}

function Box({ s, incoming, last, onPick }: { s: Series; incoming?: string; last: boolean; onPick?: (key: string) => void }) {
  const w = winnerOf(s)
  return (
    <button
      type="button"
      onClick={() => onPick?.(seriesKey(s))}
      className="block w-full cursor-pointer text-left hover:[&_.row]:bg-cellhover"
      aria-label={`${s.region} ${stageOf(s)} のマップを見る`}
    >
      <span className="flex items-baseline justify-between gap-2 text-[13px] text-mute" style={{ height: H }}>
        <span className={cn(last && "font-bold text-ink")}>{stageOf(s)}</span>
        {s.date && <span className="num">{formatDate(s.date).replace(/^\d+年/, "")}</span>}
      </span>
      {rows(s, incoming).map(([team, score], j) => (
        <span
          key={team}
          className={cn("row flex items-center justify-between gap-2 bg-cell px-2.5", j === 0 && "border-b border-panel")}
          style={{ height: R }}
        >
          <span className={cn("truncate font-num text-[15px] font-semibold", team !== w && "text-mute")}>{team}</span>
          <span className={cn("num font-num text-[16px] font-bold", team === w ? "text-win" : "text-mute")}>{score}</span>
        </span>
      ))}
    </button>
  )
}
