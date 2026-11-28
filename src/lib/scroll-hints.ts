// 横スクロールする表やタブ（.overflow-x-auto）に、続きがある側を data-more で知らせる。
// index.css がその側の端を薄くするので、スマホで右の列（ダメージ・回復など）が隠れていることが分かる。
const SEL = ".overflow-x-auto"

function update(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth
  const left = el.scrollLeft > 2
  const right = el.scrollLeft < max - 2
  const v = max <= 2 ? "" : left && right ? "both" : right ? "right" : left ? "left" : ""
  if (v) el.dataset.more = v
  else delete el.dataset.more
}

export function startScrollHints() {
  const ro = new ResizeObserver((entries) => entries.forEach((e) => update(e.target as HTMLElement)))
  const seen = new WeakSet<Element>()
  const scan = () => {
    document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
      if (seen.has(el)) return update(el)
      seen.add(el)
      ro.observe(el)
      // 中身（表）の幅が変わったときも測り直す
      if (el.firstElementChild) ro.observe(el.firstElementChild)
      update(el)
    })
  }
  document.addEventListener(
    "scroll",
    (e) => {
      const t = e.target
      if (t instanceof HTMLElement && t.matches(SEL)) update(t)
    },
    { capture: true, passive: true }
  )
  // タブの切り替えなどで表が後から出てくるので、DOM の変化のたびに探し直す
  // （requestAnimationFrame は裏のタブで止まるので setTimeout でまとめる）
  let queued = false
  new MutationObserver(() => {
    if (queued) return
    queued = true
    setTimeout(() => {
      queued = false
      scan()
    }, 50)
  }).observe(document.body, { childList: true, subtree: true })
  scan()
}
