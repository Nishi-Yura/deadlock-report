import { Label, Panel, SiteBar, SiteFoot } from "@/components/report/parts"
import { GLOSSARY } from "@/glossary"

const GROUPS = ["マップと目標", "試合の流れ", "ドラフト", "数字の見方", "大会"] as const

export function GlossaryPage() {
  return (
    <>
      <SiteBar />
      <main className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-5 pb-3">
        <Panel>
          <div className="px-4 pt-4 pb-3">
            <h1 className="font-num text-[26px] leading-tight font-bold">用語集</h1>
            <p className="m-0 mt-1 text-mute">
              レポートに出てくる言葉の短い説明。ページの中で点線の下線が付いた言葉は、マウスを乗せるかタップすると同じ説明が出ます。
            </p>
          </div>
          <nav aria-label="用語の分類" className="flex flex-wrap gap-x-1 border-t border-line px-3 py-1 text-[12px]">
            {GROUPS.map((g) => (
              <a key={g} href={`#g-${g}`} className="inline-flex min-h-9 items-center px-1.5">{g}</a>
            ))}
          </nav>
        </Panel>
        {GROUPS.map((g) => {
          const items = GLOSSARY.filter((t) => t.group === g)
          if (!items.length) return null
          return (
            <div key={g} id={`g-${g}`} className="scroll-mt-3">
              <Panel>
                <Label>{g}</Label>
                <dl className="m-0 px-4 pt-1 pb-2">
                  {items.map((t) => (
                    <div key={t.key} id={t.key} className="scroll-mt-3 border-b border-line py-2.5 last:border-0 target:bg-hi">
                      <dt className="font-bold">{t.term}</dt>
                      <dd className="m-0">{t.text}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          )
        })}
        <Panel>
          <p className="m-0 px-4 py-3 text-[12px] text-mute">
            マップと目標の説明は <a href="https://deadlock.wiki/Cursed_Apple">Deadlock Wiki</a>（2026年11月28日時点）をもとにしています。パッチで変わることがあります。
          </p>
        </Panel>
      </main>
      <SiteFoot />
    </>
  )
}
