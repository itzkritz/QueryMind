/**
 * ResultsPanel.jsx
 * ----------------
 * Renders query results with a 3-way view toggle: Table | Chart | Both
 * Chart metadata comes from the backend (result.chart_meta).
 * "Both" mode displays chart and table side-by-side.
 */
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck, ShieldX, Table2, BarChart2,
  Download, Clock, Code2, LayoutTemplate,
  Sparkles, Terminal,
} from "lucide-react"
import ChartPanel from "@/components/ChartPanel"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// ── Data Table ─────────────────────────────────────────────────────────────

function formatValue(v) {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") {
    return v > 1000
      ? v.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : Number.isInteger(v) ? String(v) : v.toFixed(2)
  }
  return String(v)
}

function DataTable({ rows }) {
  if (!rows.length)
    return <p className="text-muted-foreground text-sm text-center py-8">No rows returned.</p>
  const keys = Object.keys(rows[0])
  return (
    <div className="overflow-auto max-h-80 rounded-lg border border-border">
      <table className="w-full text-sm min-w-max">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            {keys.map(k => (
              <th key={k} className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
              {keys.map(k => (
                <td key={k} className="px-4 py-2.5 text-foreground/90 font-mono text-xs">
                  {formatValue(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── CSV Export ─────────────────────────────────────────────────────────────

function downloadCSV(rows) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(","),
    ...rows.map(r => keys.map(k => `"${r[k] ?? ""}"`).join(",")),
  ].join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.download = `querymind_${Date.now()}.csv`
  a.click()
}

// ── View Toggle ────────────────────────────────────────────────────────────

const VIEWS = [
  { id: "table", label: "Table",  Icon: Table2        },
  { id: "chart", label: "Chart",  Icon: BarChart2     },
  { id: "both",  label: "Both",   Icon: LayoutTemplate },
]

function ViewToggle({ view, onChange, hasChart }) {
  const visible = hasChart ? VIEWS : VIEWS.slice(0, 1)
  return (
    <div className="flex items-center gap-1 bg-background rounded-lg p-1 border border-border">
      {visible.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            view === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────

export default function ResultsPanel({ result, onRerun }) {
  const chartMeta = result?.chart_meta
  const hasChart  = !!chartMeta?.suitable
  const [view, setView] = useState("table")
  const [explanationOpen, setExplanationOpen] = useState(false)

  // If chart is no longer suitable (e.g. re-run), reset to table
  const activeView = hasChart ? view : "table"
  const isRestoredWithoutRows = result?.isHistoryItem && !result?.rows?.length && !result?.error

  return (
    <AnimatePresence mode="wait">
      {result && (
        <motion.div
          key={result.sql + result.error}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Question display */}
          {result.question && (
            <div className="rounded-xl border border-border bg-accent/10 p-4">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">
                Question Asked
              </span>
              <p className="text-sm text-foreground font-medium">{result.question}</p>
            </div>
          )}

          {/* Status Row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {result.validated ? (
                <Badge variant="success" className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> Validation Passed
                </Badge>
              ) : (
                <Badge variant="error" className="flex items-center gap-1.5">
                  <ShieldX className="w-3 h-3" /> Validation Failed
                </Badge>
              )}
              {result.execution_time != null && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {result.execution_time}s
                </Badge>
              )}
              {/* Chart type badge */}
              {hasChart && (
                <Badge variant="outline" className="flex items-center gap-1 text-primary border-primary/30">
                  <BarChart2 className="w-3 h-3" />
                  {chartMeta.chart_type} chart available
                </Badge>
              )}
            </div>
            {result.rows?.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Error display */}
          {result.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 dark:bg-red-500/8 p-4 text-sm text-red-800 dark:text-red-300">
              {result.error}
            </div>
          )}

          {/* Generated SQL */}
          {result.sql && (
            <div className="rounded-lg border border-red-200 dark:border-violet-500/20 bg-red-100/40 dark:bg-violet-950/30">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200 dark:border-violet-500/15">
                <Code2 className="w-4 h-4 text-red-500 dark:text-violet-400" />
                <span className="text-xs font-semibold text-red-700 dark:text-violet-300 uppercase tracking-wide">
                  Generated SQL
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExplanationOpen(true)}
                  className="ml-auto text-xs flex items-center gap-1 text-red-600 dark:text-violet-400 hover:bg-red-500/10 dark:hover:bg-violet-500/20 py-1 h-7 font-bold px-2.5 rounded-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Explain SQL
                </Button>
              </div>
              <pre className="p-4 text-xs text-black dark:text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {result.sql}
              </pre>
            </div>
          )}

          {/* Re-run notice for restored history items */}
          {isRestoredWithoutRows && onRerun && (
            <div className="rounded-lg border border-dashed border-border bg-accent/5 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Terminal className="w-4 h-4 shrink-0" />
                <p className="text-xs">
                  <span className="font-semibold text-foreground">Table & chart not available</span> — results aren't stored between sessions.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRerun(result.question)}
                className="text-xs h-7 px-3 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-bold"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Re-run
              </Button>
            </div>
          )}

          {/* Results — Table / Chart / Both */}
          {result.rows?.length > 0 && (
            <div className="rounded-xl border border-border bg-card/50">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <ViewToggle view={activeView} onChange={setView} hasChart={hasChart} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCSV(result.rows)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 h-8"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>

              {/* Content Area */}
              <div className="p-4">
                {activeView === "table" && (
                  <DataTable rows={result.rows} />
                )}

                {activeView === "chart" && (
                  <ChartPanel rows={result.rows} chartMeta={chartMeta} />
                )}

                {activeView === "both" && (
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Chart — left side */}
                    <div className="flex-1 min-w-0 rounded-xl border border-border bg-background/40 p-4">
                      <ChartPanel rows={result.rows} chartMeta={chartMeta} />
                    </div>

                    {/* Divider (vertical on large, horizontal on small) */}
                    <div className="lg:w-px lg:self-stretch bg-border hidden lg:block" />
                    <div className="h-px bg-border lg:hidden" />

                    {/* Table — right side */}
                    <div className="flex-1 min-w-0">
                      <DataTable rows={result.rows} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Explanation Sheet */}
          <Sheet open={explanationOpen} onOpenChange={setExplanationOpen}>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                  <SheetTitle>SQL Explanation</SheetTitle>
                </div>
                <SheetDescription>
                  Plain-English structural breakdown of the generated database query.
                </SheetDescription>
              </SheetHeader>

              {result.sql_explanation ? (
                <div className="mt-6 space-y-6">
                  {/* Summary */}
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-1.5">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Summary</h4>
                    <p className="text-sm text-foreground leading-relaxed">
                      {result.sql_explanation.summary}
                    </p>
                  </div>

                  {/* Tables Used */}
                  {result.sql_explanation.tables_used && result.sql_explanation.tables_used.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tables Used</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.sql_explanation.tables_used.map((table) => (
                          <Badge key={table} variant="outline" className="bg-background text-xs font-semibold px-2 py-0.5 border-border text-foreground">
                            {table}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Joins */}
                  {result.sql_explanation.joins && result.sql_explanation.joins.toLowerCase() !== "none" && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Joins</h4>
                      <p className="text-sm text-foreground bg-accent/10 border border-border/40 rounded-lg p-3 leading-relaxed">
                        {result.sql_explanation.joins}
                      </p>
                    </div>
                  )}

                  {/* Filters */}
                  {result.sql_explanation.filters && result.sql_explanation.filters.toLowerCase() !== "none" && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filters</h4>
                      <p className="text-sm text-foreground bg-accent/10 border border-border/40 rounded-lg p-3 leading-relaxed">
                        {result.sql_explanation.filters}
                      </p>
                    </div>
                  )}

                  {/* Aggregations */}
                  {result.sql_explanation.aggregations && result.sql_explanation.aggregations.length > 0 && 
                   !(result.sql_explanation.aggregations.length === 1 && result.sql_explanation.aggregations[0].toLowerCase() === "none") && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aggregations</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.sql_explanation.aggregations.map((agg) => (
                          <Badge key={agg} variant="outline" className="bg-background text-xs font-semibold px-2 py-0.5 border-border text-foreground">
                            {agg}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sorting / Grouping */}
                  {result.sql_explanation.sorting_grouping && result.sql_explanation.sorting_grouping.toLowerCase() !== "none" && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sorting & Grouping</h4>
                      <p className="text-sm text-foreground bg-accent/10 border border-border/40 rounded-lg p-3 leading-relaxed">
                        {result.sql_explanation.sorting_grouping}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-8 flex flex-col items-center justify-center text-muted-foreground text-center p-6 bg-accent/5 rounded-xl border border-dashed border-border/60">
                  <Terminal className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-semibold">No explanation available</p>
                  <p className="text-xs text-muted-foreground/75 mt-1 max-w-[200px]">
                    Explanations are only generated for successfully executed queries.
                  </p>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
