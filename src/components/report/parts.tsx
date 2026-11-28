import { useState, type ReactNode } from "react"
import { heroImage, heroInitials } from "@/heroes"
import { cn } from "@/lib/utils"
import { SiteSearch } from "./search"
import { ThemeSwitch } from "./theme"

/** サイト共通の上部バー。項目は4つまで（DESIGN.md 5章）。選手ページはチームと同じ項目に入れる */
const NAV = [
  { keys: ["stats", "hero"], href: "/deadlock-report/stats/", label: "ヒーロー" },
  { keys: ["trends"], href: "/deadlock-report/trends/", label: "傾向" },
  { keys: ["teams", "players", "vs"], href: "/deadlock-report/teams/", label: "チーム・選手", short: "チーム" },
  { keys: ["compare"], href: "/deadlock-report/compare/", label: "比べる" },
] as const

export type NavKey = (typeof NAV)[number]["keys"][number]

export function SiteBar({ current }: { current?: NavKey } = {}) {
  const link = "py-3.5 text-panel hover:no-underline hover:underline-offset-4 hover:[text-decoration-line:underline] focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline-none"
  return (
    <header className="bg-ink text-panel">
      <nav className="mx-auto flex max-w-[760px] items-center gap-x-5 px-4 text-[14px] whitespace-nowrap max-sm:gap-x-3.5 max-sm:text-[13px]">
        <a href="/deadlock-report/" className={cn(link, "mr-auto font-bold")}>
          Deadlock<span className="max-[400px]:hidden"> レポート</span>
        </a>
        {NAV.map((n) => {
          const on = !!current && (n.keys as readonly string[]).includes(current)
          return (
            <a
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={cn(link, on ? "font-bold underline underline-offset-4" : "opacity-80 hover:opacity-100")}
            >
              {"short" in n ? <><span className="max-sm:hidden">{n.label}</span><span className="sm:hidden">{n.short}</span></> : n.label}
            </a>
          )
        })}
        <SiteSearch />
      </nav>
    </header>
  )
}

export function SiteFoot() {
  return (
    <footer className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-x-4 px-4 pt-2 pb-10 text-[13px] text-(--onpage)">
      <span>
        <a href="/deadlock-report/" className="inline-block py-3 text-(--onpage-link)">レポート一覧</a>
        <span className="px-2">・</span>
        <a href="/deadlock-report/feed.xml" className="inline-block py-3 text-(--onpage-link)">RSS</a>
        <span className="px-2">・</span>
        <a href="/deadlock-report/glossary/" className="inline-block py-3 text-(--onpage-link)">用語集</a>
        <span className="px-2">・</span>
        <a href="/deadlock-report/players/" className="inline-block py-3 text-(--onpage-link)">選手</a>
      </span>
      {/* 灰色の地の上なので、ラベルとボタンの文字も地に合わせた濃さにする */}
      <span className="[&_.lab]:text-(--onpage) [&_button]:text-(--onpage) [&_button[aria-checked=true]]:text-ink [&_button:hover]:bg-transparent">
        <ThemeSwitch />
      </span>
    </footer>
  )
}

/** 白いパネル。角丸・影・枠線なし（DESIGN.md） */
export function Panel({ className, children, delay = 0 }: { className?: string; children: ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <section className={cn("bg-panel", className)}>{children}</section>
    </Reveal>
  )
}

/** パネルの出現（0.3秒で下から 6px・フェードイン）。CSS だけで動かす（index.css の .reveal）。
 *  以前は Magic UI BlurFade（motion ライブラリ）だったが、それだけで JS が 500KB 以上増えていた。
 *  「動きを減らす」設定のときは index.css 側で止める */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="reveal" style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  )
}

/** スコア。以前は 0 から数え上げていたが、画面に入るまで「0:0」のまま見えることがあったので、最初から本当の数字を出す */
export function Score({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{value}</span>
}

/** パネルの見出し（h2）。16px・太字・本文の色。見出しの段は h1・h2・本文の3段だけ（DESIGN.md 5章） */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("px-4 pt-3.5 text-[16px] leading-snug font-bold text-ink", className)}>{children}</h2>
}

/** 見出しでたためるパネル（DESIGN.md 5章「たためるパネル」）。hint は見出しの右に出す一言の要約 */
export function Fold({
  title, hint, open = false, id, children, className, delay,
}: {
  title: ReactNode; hint?: ReactNode; open?: boolean; id?: string; children: ReactNode; className?: string; delay?: number
}) {
  return (
    <Reveal delay={delay}>
      <details id={id} open={open} className={cn("group scroll-mt-3 bg-panel", className)}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-cellhover focus-visible:bg-cellhover focus-visible:outline-2 focus-visible:outline-link [&::-webkit-details-marker]:hidden">
          <h2 className="text-[16px] leading-snug font-bold text-ink">{title}</h2>
          {hint && <span className="min-w-0 flex-1 truncate text-[13px] text-mute">{hint}</span>}
          <span className="ml-auto shrink-0 text-[13px] text-link group-open:hidden">開く</span>
          <span className="ml-auto hidden shrink-0 text-[13px] text-link group-open:inline">閉じる</span>
        </summary>
        {children}
      </details>
    </Reveal>
  )
}

/** 表・グラフの下の説明文。最初はたたんでおく（DESIGN.md 4.12 の4） */
export function Note({ children, label = "この数字の読み方", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <details className={cn("group border-t border-line", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-[13px] text-link hover:bg-cellhover hover:underline focus-visible:underline focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">›</span>{label}
      </summary>
      <div className="px-4 pb-3 text-[13px] text-mute">{children}</div>
    </details>
  )
}

/** ヒーローのアイコン。名前はマウスを乗せると出る（ブラウザの title）。読み込めないときは頭文字 */
export function HeroIcon({ hero, size = 26, dim = false }: { hero: string; size?: number; dim?: boolean }) {
  const src = heroImage(hero)
  const [failed, setFailed] = useState(false)
  return (
    <span
      role="img"
      title={hero}
      aria-label={hero}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden bg-[#3a3a3a] text-[10px] font-bold text-white",
        dim && "opacity-45 grayscale"
      )}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        heroInitials(hero)
      )}
    </span>
  )
}
