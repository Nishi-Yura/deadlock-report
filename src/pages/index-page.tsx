import { Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { isFinal, reportPath, reports } from "@/lib/report"

// パッチまとめ（public/deadlock-report/patch/ の静的ページ）。新しい順に上へ足す
const patches = [
  {
    date: "2026.11.26",
    path: "/deadlock-report/patch/2026-11-26/",
    title: "11/26 アップデート（感謝祭）",
    summary: "ソウル経済・ダメージ計算の見直しと33体のヒーロー調整。Wraith に大きな弱体。",
  },
]

export function IndexPage() {
  return (
    <>
      <SiteBar />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="font-num text-[26px] leading-tight font-bold">Deadlock レポート</h1>
            <p className="m-0 mt-1 text-mute">大会の決勝を、ドラフトとマッチデータで振り返るレポートです。新しい順。</p>
          </div>
          <div className="grid grid-cols-[44px_1fr_auto] gap-3 border-y border-line px-4 py-2 max-sm:hidden">
            <span className="lab">#</span>
            <span className="lab">大会 ・ 見出し</span>
            <span className="lab text-right">結果</span>
          </div>
          <ol className="m-0 list-none p-0">
            {reports.map((r) => (
              <li key={r.id} className="border-b border-line last:border-0">
                <a
                  href={reportPath(r.id)}
                  className="grid grid-cols-[44px_1fr_auto] items-start gap-3 px-4 py-3.5 text-ink hover:bg-cellhover hover:no-underline max-sm:grid-cols-[36px_1fr]"
                >
                  <span className="num font-num text-[28px] leading-none font-bold text-mute">{r.id}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-link">{r.event}</span>
                    <span className="block text-[12px] text-mute">{r.date.replaceAll("-", ".")}</span>
                    <span className="mt-1 block">{r.headline}</span>
                  </span>
                  <span className="text-right text-[12px] leading-6 max-sm:col-start-2 max-sm:text-left">
                    {r.series.filter(isFinal).map((s) => {
                      const winner = s.score[0] > s.score[1] ? s.teams[0] : s.teams[1]
                      return (
                        <span key={s.region} className="block whitespace-nowrap">
                          <span className="text-mute">{s.region} </span>
                          <b className="font-bold text-win">{winner}</b>{" "}
                          <span className="num">{Math.max(...s.score)}-{Math.min(...s.score)}</span>
                        </span>
                      )
                    })}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel delay={0.05}>
          <h2 className="lab px-4 pt-3.5 pb-2">パッチまとめ</h2>
          <ol className="m-0 list-none border-t border-line p-0">
            {patches.map((p) => (
              <li key={p.path} className="border-b border-line last:border-0">
                <a
                  href={p.path}
                  className="grid grid-cols-[88px_1fr] items-baseline gap-3 px-4 py-3 text-ink hover:bg-cellhover hover:no-underline max-sm:grid-cols-[1fr] max-sm:gap-0"
                >
                  <span className="num font-num text-[15px] font-semibold text-mute">{p.date}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-link">{p.title}</span>
                    <span className="block">{p.summary}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}
