import { Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { NextEvents } from "@/components/report/schedule"
import updateList from "@/updates.json"
import { isFinal, reportPath, reports } from "@/lib/report"
// パッチまとめ（public/deadlock-report/patch/ の静的ページ）の一覧は src/patches.json に書く
import { patches } from "@/lib/stats"

/** サイトの更新（src/updates.json）。新しい順 */
const updates = [...updateList].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

/** パッチまとめとサイトの更新を1つの一覧にする（左に日付・右に中身。DESIGN.md 5章「トップページ」） */
type NewsItem =
  | { kind: "patch"; date: string; key: string; title: string; text: string; href: string }
  | { kind: "site"; date: string; key: string; title: string; items: string[] }
const news: NewsItem[] = [
  ...patches.map((p) => ({ kind: "patch" as const, date: p.date, key: p.path, title: p.title, text: p.summary, href: p.path })),
  ...updates.slice(0, 3).map((u) => ({ kind: "site" as const, date: u.date, key: u.id, title: u.title, items: u.items })),
].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "patch" ? -1 : 1))

const dateCol = "num font-num text-[15px] font-semibold text-mute"
const tag = "mr-2 inline-block text-[13px] font-semibold text-mute"

export function IndexPage() {
  return (
    <>
      <SiteBar />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3 max-sm:px-3">
        {/* 1. レポート一覧（主役） */}
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="text-[20px] leading-snug font-bold max-sm:text-[18px]">Deadlock レポート</h1>
            <p className="m-0 mt-0.5 text-[13px] text-mute">大会の決勝を、ドラフトとマッチデータで振り返る。新しい順。</p>
          </div>
          <ol className="m-0 list-none border-t border-line p-0">
            {reports.map((r) => (
              <li key={r.id} className="border-b border-line last:border-0">
                <a
                  href={reportPath(r.id)}
                  className="grid grid-cols-[40px_1fr_auto] items-start gap-3 px-4 py-4 text-ink hover:bg-cellhover hover:no-underline focus-visible:bg-cellhover focus-visible:outline-none max-sm:grid-cols-[32px_1fr]"
                >
                  <span className="num font-num text-[26px] leading-none font-bold text-mute">{r.id}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-mute">
                      <span className="font-semibold text-link">{r.event}</span>
                      <span className="num ml-2">{r.date.replaceAll("-", ".")}</span>
                    </span>
                    <span className="mt-0.5 block leading-normal font-semibold">{r.headline}</span>
                  </span>
                  <span className="text-right font-num text-[15px] leading-6 max-sm:col-start-2 max-sm:-mt-1 max-sm:text-left">
                    {r.series.filter(isFinal).map((s) => {
                      const winner = s.score[0] > s.score[1] ? s.teams[0] : s.teams[1]
                      return (
                        <span key={s.region} className="block whitespace-nowrap">
                          <span className="text-[13px] text-mute">{s.region} </span>
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

        {/* 2. 次の大会 */}
        <NextEvents />

        {/* 3. パッチ・サイトの更新 */}
        <Panel delay={0.05}>
          <Label className="pb-2">パッチ・サイトの更新</Label>
          <ol className="m-0 list-none border-t border-line p-0">
            {news.map((n) => (
              <li key={n.key} className="border-b border-line last:border-0">
                {n.kind === "patch" ? (
                  <a
                    href={n.href}
                    className="grid grid-cols-[88px_1fr] items-baseline gap-3 px-4 py-3 text-ink hover:bg-cellhover hover:no-underline focus-visible:bg-cellhover focus-visible:outline-none max-sm:grid-cols-[1fr] max-sm:gap-0"
                  >
                    <span className={dateCol}>{n.date.replaceAll("-", ".")}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-link"><span className={tag}>パッチ</span>{n.title}</span>
                      <span className="block text-[14px]">{n.text}</span>
                    </span>
                  </a>
                ) : (
                  <details className="group">
                    <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[88px_1fr_auto] items-baseline gap-3 px-4 py-3 hover:bg-cellhover focus-visible:bg-cellhover focus-visible:outline-none max-sm:grid-cols-[1fr_auto] max-sm:gap-y-0 [&::-webkit-details-marker]:hidden">
                      <span className={`${dateCol} max-sm:col-span-2`}>{n.date.replaceAll("-", ".")}</span>
                      <span className="font-semibold"><span className={tag}>サイト</span>{n.title}</span>
                      <span className="text-[13px] text-link group-open:hidden">{n.items.length} 件</span>
                      <span className="hidden text-[13px] text-link group-open:inline">閉じる</span>
                    </summary>
                    <ul className="m-0 list-disc pr-4 pb-3 pl-9 text-[14px] sm:pl-[123px]">
                      {n.items.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}
