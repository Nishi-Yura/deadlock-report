// 用語の説明（src/glossary.ts）。点線の下線の語にマウスを乗せるか、タップすると短い説明が出る。
// スマホでもタップで開くように、ツールチップではなく自前の小さな吹き出しにしている
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { TERM_MATCHES, termByKey, type TermDef } from "@/glossary"
import { cn } from "@/lib/utils"

export const glossaryPath = "/deadlock-report/glossary/"

export function Term({ k, children, className }: { k: string; children?: ReactNode; className?: string }) {
  const def = termByKey.get(k)
  if (!def) return <>{children}</>
  return <TermPop def={def} className={className}>{children ?? def.term}</TermPop>
}

function TermPop({ def, children, className }: { def: TermDef; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [shift, setShift] = useState(0)
  const wrap = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  const id = useId()

  // 外をタップ・Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false)
        setPinned(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setPinned(false)
      }
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // 画面の端からはみ出さないように左右をずらす
  useLayoutEffect(() => {
    if (!open || !bubble.current) return setShift(0)
    const r = bubble.current.getBoundingClientRect()
    const pad = 8
    if (r.right > innerWidth - pad) setShift(innerWidth - pad - r.right)
    else if (r.left < pad) setShift(pad - r.left)
  }, [open])

  return (
    <span ref={wrap} className="relative inline">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          setPinned(!pinned)
          setOpen(!pinned)
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        className={cn(
          "cursor-help border-0 bg-transparent p-0 font-[inherit] text-inherit underline decoration-mute decoration-dotted underline-offset-[3px] hover:decoration-ink",
          className
        )}
      >
        {children}
      </button>
      {open && (
        <span
          ref={bubble}
          id={id}
          role="tooltip"
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
          className="absolute top-full left-1/2 z-50 mt-1.5 block w-[min(280px,calc(100vw-16px))] bg-ink px-3 py-2 text-left text-[12px] leading-relaxed font-normal tracking-normal text-panel normal-case shadow-sm"
        >
          <b className="mb-0.5 block font-bold">{def.term}</b>
          {def.text}
          <a href={`${glossaryPath}#${def.key}`} className="mt-1 block text-[11px] text-panel underline opacity-80">用語集で見る</a>
        </span>
      )}
    </span>
  )
}

/** 文章の中の用語に、それぞれ最初の1回だけ説明を付ける（レポートの試合の流れ・持ち帰りなど） */
export function Glossed({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const used = new Set<string>()
  let i = 0
  let plain = ""
  const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c)
  while (i < text.length) {
    const hit = TERM_MATCHES.find(([m, def]) => {
      if (used.has(def.key) || !text.startsWith(m, i)) return false
      // 英字の用語は単語の途中では拾わない（"Guardians" の Guardian は OK、"MBA" の MB は NG）
      if (/^[A-Za-z]/.test(m) && isWord(text[i - 1])) return false
      if (/[A-Za-z]$/.test(m) && isWord(text[i + m.length]) && text[i + m.length] !== "s") return false
      return true
    })
    if (hit) {
      const [m, def] = hit
      if (plain) parts.push(plain)
      plain = ""
      parts.push(<Term key={i} k={def.key}>{m}</Term>)
      used.add(def.key)
      i += m.length
    } else {
      plain += text[i]
      i++
    }
  }
  if (plain) parts.push(plain)
  return <>{parts}</>
}
