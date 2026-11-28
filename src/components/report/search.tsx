// 上のバーの検索。選手・チーム・ヒーロー・レポート・パッチ・ページの名前から飛ぶ。
// データはページに入っているものだけで作るので、サーバーはいらない
import { useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { reportPath, reports } from "@/lib/report"
import { heroPath, heroTable, allMaps, patches, playerPath, playerStats, teamPath, teamStats } from "@/lib/stats"
import { HeroIcon } from "./parts"
import { cn } from "@/lib/utils"
import { GLOSSARY } from "@/glossary"
import { HERO_KANA, normKana } from "@/hero-kana"

interface Entry {
  kind: string
  label: string
  sub?: string
  href: string
  hero?: string
  /** 別の呼び方（ヒーローのカタカナなど）。見出しと同じ強さで当てる */
  alt?: string[]
}

const PAGES: Entry[] = [
  { kind: "ページ", label: "ヒーロー統計", sub: "ピック率・勝率・BAN 率", href: "/deadlock-report/stats/" },
  { kind: "ページ", label: "試合の傾向", sub: "ソウル差・Mid-Boss・ドラフト", href: "/deadlock-report/trends/" },
  { kind: "ページ", label: "チーム", href: "/deadlock-report/teams/" },
  { kind: "ページ", label: "対戦カード", sub: "2チームを並べる", href: "/deadlock-report/vs/" },
  { kind: "ページ", label: "選手", href: "/deadlock-report/players/" },
  { kind: "ページ", label: "用語集", sub: "Guardian・Mid-Boss・ソウルなどの説明", href: "/deadlock-report/glossary/" },
  { kind: "ページ", label: "自分の試合と比べる", sub: "マッチ ID・直近の試合", href: "/deadlock-report/compare/" },
]

function buildIndex(): Entry[] {
  return [
    ...heroTable(allMaps).rows.map((r) => ({
      kind: "ヒーロー",
      label: r.hero,
      sub: `${HERO_KANA[r.hero]?.[0] ?? ""}　${r.picks} ピック・${r.bans} BAN`.trim(),
      href: heroPath(r.hero),
      hero: r.hero,
      alt: HERO_KANA[r.hero],
    })),
    ...teamStats().map((t) => ({ kind: "チーム", label: t.name, sub: t.regions.join(" / "), href: teamPath(t.name) })),
    ...playerStats().map((p) => ({ kind: "選手", label: p.name, sub: p.teams.join(" / "), href: playerPath(p.name) })),
    ...reports.map((r) => ({ kind: "レポート", label: `#${r.id} ${r.event}`, sub: r.headline, href: reportPath(r.id) })),
    ...patches.map((p) => ({ kind: "パッチ", label: p.title, sub: p.summary, href: p.path })),
    ...GLOSSARY.map((t) => ({ kind: "用語", label: t.term, sub: t.text, href: `/deadlock-report/glossary/#${t.key}` })),
    ...PAGES,
  ]
}

// ひらがな→カタカナ・ヴ→ブ・長音を消す、なども含めてそろえる（「びりー」でも「ビリ」でも Billy が出る）
const norm = normKana

function search(index: Entry[], q: string): Entry[] {
  const n = norm(q)
  if (!n) return []
  const score = (e: Entry) => {
    const names = [e.label, ...(e.alt ?? [])].map(norm)
    if (names.some((l) => l === n)) return 0
    if (names.some((l) => l.startsWith(n))) return 1
    if (names.some((l) => l.includes(n))) return 2
    if (e.sub && norm(e.sub).includes(n)) return 3
    return -1
  }
  return index
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.e.label.length - b.e.label.length)
    .slice(0, 8)
    .map((x) => x.e)
}

export function SiteSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const index = useMemo(() => (open ? buildIndex() : []), [open])
  const results = search(index, q)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === "/" && !open && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  useEffect(() => setSel(0), [q])

  const close = () => {
    setOpen(false)
    setQ("")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "検索を閉じる" : "検索"}
        aria-expanded={open}
        className="-mr-2 grid size-11 shrink-0 cursor-pointer place-items-center text-panel opacity-80 hover:opacity-100"
      >
        {open ? <X size={17} aria-hidden /> : <Search size={17} aria-hidden />}
      </button>
      {open && (
        <div className="basis-full pb-3">
          <label htmlFor="site-search" className="sr-only">サイト内を検索</label>
          <input
            id="site-search"
            ref={input}
            type="search"
            autoComplete="off"
            placeholder="選手・チーム・ヒーロー・レポート"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close()
              else if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, results.length - 1)))
              else if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)))
              else if (e.key === "Enter" && results[sel]) location.href = results[sel].href
            }}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="site-search-results"
            aria-activedescendant={results[sel] ? `ss-${sel}` : undefined}
            className="h-11 w-full border-0 bg-panel px-3 text-[16px] text-ink outline-none"
          />
          {q && (
            <ul id="site-search-results" role="listbox" className="m-0 list-none bg-panel p-0 text-ink">
              {results.length ? (
                results.map((r, i) => (
                  <li key={r.kind + r.href} id={`ss-${i}`} role="option" aria-selected={i === sel}>
                    <a
                      href={r.href}
                      onMouseEnter={() => setSel(i)}
                      className={cn("flex min-h-11 items-center gap-2.5 border-t border-line px-3 py-1.5 text-ink hover:no-underline", i === sel && "bg-cellhover")}
                    >
                      {r.hero ? <HeroIcon hero={r.hero} size={22} /> : <span className="w-[22px] shrink-0" />}
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate font-semibold">{r.label}</span>
                        {r.sub && <span className="block truncate text-[11px] text-mute">{r.sub}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-mute">{r.kind}</span>
                    </a>
                  </li>
                ))
              ) : (
                <li className="border-t border-line px-3 py-3 text-mute">見つかりませんでした</li>
              )}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
