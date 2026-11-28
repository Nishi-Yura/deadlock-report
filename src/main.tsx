import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getReport } from "@/lib/report"
import { ReportPage } from "@/pages/report-page"
import { IndexPage } from "@/pages/index-page"
import { StatsPage } from "@/pages/stats-page"
import { TeamPage, TeamsPage } from "@/pages/teams-page"
import { PlayerPage, PlayersPage } from "@/pages/players-page"
import { TrendsPage } from "@/pages/trends-page"
import { HeroPage } from "@/pages/hero-page"
import { ComparePage } from "@/pages/compare-page"
import "./index.css"

// scripts/entries.mjs が <div id="root" data-page="..." data-report="1" data-slug="..."> を書く
const el = document.getElementById("root")!
const { page, report, slug = "" } = el.dataset

function route(): ReactNode {
  if (report) return <ReportPage report={getReport(Number(report))} />
  switch (page) {
    case "stats": return <StatsPage />
    case "hero": return <HeroPage slug={slug} />
    case "trends": return <TrendsPage />
    case "compare": return <ComparePage />
    case "teams": return <TeamsPage />
    case "team": return <TeamPage slug={slug} />
    case "players": return <PlayersPage />
    case "player": return <PlayerPage slug={slug} />
    default: return <IndexPage />
  }
}

createRoot(el).render(
  <StrictMode>
    <TooltipProvider delay={150}>{route()}</TooltipProvider>
  </StrictMode>
)
