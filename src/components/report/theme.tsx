// 表示の切り替え（自動 / ライト / ダーク）。<html data-theme> を付け外しして、選んだものはブラウザに覚えておく。
// 最初の描画の前に当てる処理は scripts/entries.mjs が <head> に入れている（ちらつき防止）
import { useState } from "react"
import { Segmented } from "./filters"

type Theme = "auto" | "light" | "dark"
const KEY = "theme"

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === "light" || v === "dark" ? v : "auto"
  } catch {
    return "auto"
  }
}

function apply(t: Theme) {
  const root = document.documentElement
  if (t === "auto") delete root.dataset.theme
  else root.dataset.theme = t
  try {
    if (t === "auto") localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    // 保存できなくても、このページの表示は切り替わる
  }
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(read)
  return (
    <Segmented<Theme>
      label="表示"
      value={theme}
      options={[
        { value: "auto", label: "自動" },
        { value: "light", label: "ライト" },
        { value: "dark", label: "ダーク" },
      ]}
      onChange={(t) => {
        apply(t)
        setTheme(t)
      }}
    />
  )
}
