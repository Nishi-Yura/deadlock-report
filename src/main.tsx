import { lazy, StrictMode, Suspense, type ComponentType, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { startScrollHints } from "@/lib/scroll-hints"
import "./index.css"

// ページごとに分けて、開いたページの分だけ読み込む（全部を1つにすると 700KB 近くあった）
const page = <K extends string>(load: () => Promise<Record<K, ComponentType<never>>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType<Record<string, unknown>> })))

const ReportRoute = lazy(() =>
  Promise.all([import("@/pages/report-page"), import("@/lib/report")]).then(([p, r]) => ({
    default: ({ id }: { id: number }) => <p.ReportPage report={r.getReport(id)} />,
  }))
)
const IndexPage = page(() => import("@/pages/index-page"), "IndexPage")
const StatsPage = page(() => import("@/pages/stats-page"), "StatsPage")
const HeroPage = page(() => import("@/pages/hero-page"), "HeroPage")
const TrendsPage = page(() => import("@/pages/trends-page"), "TrendsPage")
const ComparePage = page(() => import("@/pages/compare-page"), "ComparePage")
const TeamsPage = page(() => import("@/pages/teams-page"), "TeamsPage")
const TeamPage = page(() => import("@/pages/teams-page"), "TeamPage")
const VsPage = page(() => import("@/pages/vs-page"), "VsPage")
const GlossaryPage = page(() => import("@/pages/glossary-page"), "GlossaryPage")
const PlayersPage = page(() => import("@/pages/players-page"), "PlayersPage")
const PlayerPage = page(() => import("@/pages/players-page"), "PlayerPage")

// パネルの出現アニメーションは、ページが見えているときだけ（index.css の .anim .reveal）
if (document.visibilityState === "visible" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("anim")
  // 念のため：アニメーションが止まっている環境でも、1.5秒後には必ず見えるようにする（終わっていれば見た目は変わらない）
  setTimeout(() => document.documentElement.classList.remove("anim"), 1500)
}

// scripts/entries.mjs が <div id="root" data-page="..." data-report="1" data-slug="..."> を書く
const el = document.getElementById("root")!
const { page: name, report, slug = "" } = el.dataset

function route(): ReactNode {
  if (report) return <ReportRoute id={Number(report)} />
  switch (name) {
    case "stats": return <StatsPage />
    case "hero": return <HeroPage slug={slug} />
    case "trends": return <TrendsPage />
    case "compare": return <ComparePage />
    case "teams": return <TeamsPage />
    case "vs": return <VsPage />
    case "glossary": return <GlossaryPage />
    case "team": return <TeamPage slug={slug} />
    case "players": return <PlayersPage />
    case "player": return <PlayerPage slug={slug} />
    default: return <IndexPage />
  }
}

// 読み込み中は上のバーと同じ色の帯だけ出す（真っ白にしない）
const Loading = () => <div className="h-[46px] bg-ink" aria-hidden />

createRoot(el).render(
  <StrictMode>
    <Suspense fallback={<Loading />}>{route()}</Suspense>
  </StrictMode>
)
startScrollHints()
