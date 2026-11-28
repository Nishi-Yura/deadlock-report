// URL に使う名前。"Buff Enjoyers" → "buff-enjoyers"
// src/lib/stats.ts の slug と同じ処理（画面側とビルド側で URL がずれないように、変えるときは両方）
export const slug = (name) =>
  name.toLowerCase().trim().replace(/[\s&]+/g, "-").replace(/[^a-z0-9_-]/g, "").replace(/-+/g, "-") || "x"
