import { useState, type ReactNode } from "react"
import { heroImage, heroInitials } from "@/heroes"
import { cn } from "@/lib/utils"
import { SiteSearch } from "./search"
import { ThemeSwitch } from "./theme"

/** サイト共通の上部バー */
const NAV = [
  { key: "stats", href: "/deadlock-report/stats/", label: "ヒーロー" },
  { key: "trends", href: "/deadlock-report/trends/", label: "傾向" },
  { key: "teams", href: "/deadlock-report/teams/", label: "チーム" },
  { key: "players", href: "/deadlock-report/players/", label: "選手" },
  { key: "compare", href: "/deadlock-report/compare/", label: "比べる" },
] as const

export type NavKey = (typeof NAV)[number]["key"]

export function SiteBar({ current }: { current?: NavKey } = {}) {
  const link = "py-3.5 text-panel hover:no-underline hover:underline-offset-4 hover:[text-decoration-line:underline]"
  return (
    <header className="bg-ink text-panel">
      {/* 横スクロールで右端の項目が隠れないように、狭い画面ではロゴを短くし、それでも入らなければ折り返す */}
      <nav className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-4 px-4 text-[12px] whitespace-nowrap max-sm:gap-x-3">
        <a href="/deadlock-report/" className={cn(link, "mr-auto font-bold")}>
          Deadlock<span className="max-[420px]:hidden"> レポート</span>
        </a>
        {NAV.map((n) => (
          <a
            key={n.key}
            href={n.href}
            aria-current={current === n.key ? "page" : undefined}
            className={cn(link, current === n.key ? "font-bold underline underline-offset-4" : "opacity-80 hover:opacity-100")}
          >
            {n.label}
          </a>
        ))}
        <SiteSearch />
      </nav>
    </header>
  )
}

export function SiteFoot() {
  return (
    <footer className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-x-4 px-4 pt-2 pb-10 text-[12px] text-(--onpage)">
      <span>
        <a href="/deadlock-report/" className="inline-block py-3 text-(--onpage-link)">レポート一覧</a>
        <span className="px-2">・</span>
        <a href="/deadlock-report/feed.xml" className="inline-block py-3 text-(--onpage-link)">RSS</a>
        <span className="px-2">・</span>
        <a href="/deadlock-report/glossary/" className="inline-block py-3 text-(--onpage-link)">用語集</a>
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

/** パネルの見出し。長いページで区切りを見つけやすいよう、本文の色で少し大きめに */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("lab px-4 pt-3.5 text-[12px] text-ink", className)}>{children}</h2>
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
