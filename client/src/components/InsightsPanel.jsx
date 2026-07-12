import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  BarChart3, Table2, Columns3, Hash, TrendingUp, TrendingDown,
  GitBranch, Database, RefreshCw, Loader2, AlertCircle, Sparkles,
  ArrowUpDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchDatabases, regenerateInsights } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent = "primary", delay = 0 }) {
  const accentMap = {
    primary:  "text-primary border-primary/20 bg-primary/5",
    blue:     "text-blue-500 border-blue-500/20 bg-blue-500/5",
    emerald:  "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
    violet:   "text-violet-500 border-violet-500/20 bg-violet-500/5",
    amber:    "text-amber-500 border-amber-500/20 bg-amber-500/5",
    rose:     "text-rose-500 border-rose-500/20 bg-rose-500/5",
  }
  const cls = accentMap[accent] || accentMap.primary

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-xl border p-5 flex flex-col gap-3 ${cls}`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${cls}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )
}

// ── Table Row ────────────────────────────────────────────────────────────────

function TableRow({ table, index, maxRows }) {
  const pct = maxRows > 0 ? (table.row_count / maxRows) * 100 : 0
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
    >
      <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">{index + 1}</span>
      <span className="text-sm font-medium text-foreground flex-1 truncate">{table.name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-20 text-right tabular-nums">
          {table.row_count.toLocaleString()} rows
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
          {table.column_count}c
        </Badge>
      </div>
    </motion.div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InsightsPanel({ selectedDbId }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [sortBy, setSortBy] = useState("rows") // "rows" | "columns" | "name"

  const { data: databases } = useQuery({
    queryKey: ["databases", user?.id],
    queryFn: fetchDatabases,
    enabled: !!user?.id,
  })

  const selectedDb = databases?.find(d => d.id === selectedDbId)
  const insights   = selectedDb?.insights

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateInsights(selectedDbId),
    onSuccess: (updatedDb) => {
      // Patch the database list cache with fresh insights
      queryClient.setQueryData(["databases", user?.id], (old) =>
        old?.map(d => d.id === selectedDbId ? updatedDb : d)
      )
    },
  })

  // ── Empty / loading states ──────────────────────────────────────────────

  if (!selectedDbId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Database className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-black uppercase tracking-tight text-foreground">No Database Selected</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Select or connect a database from the sidebar to view its insights.
        </p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="text-base font-black uppercase tracking-tight text-foreground">No Insights Yet</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Click "Generate Insights" to analyse this database's structure.
        </p>
        <Button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider text-xs px-5 h-9"
        >
          {regenerateMutation.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-2" />Generate Insights</>
          )}
        </Button>
      </div>
    )
  }

  // ── Sort tables ───────────────────────────────────────────────────────────

  const sortedTables = [...(insights.tables || [])].sort((a, b) => {
    if (sortBy === "columns") return b.column_count - a.column_count
    if (sortBy === "name")    return a.name.localeCompare(b.name)
    return b.row_count - a.row_count // default: rows desc
  })

  const maxRows = sortedTables[0]?.row_count || 1

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 px-8 py-6 space-y-8 max-w-5xl w-full mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
              Database Overview
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedDb?.name} &nbsp;·&nbsp;
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                {insights.db_engine}
              </Badge>
              {insights.generated_at && (
                <span className="ml-2">
                  Last generated {new Date(insights.generated_at).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        </div>

        <Button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          variant="outline"
          size="sm"
          className="text-xs h-8 px-3 border-border hover:border-primary/40 hover:text-primary font-bold uppercase tracking-wider"
        >
          {regenerateMutation.isPending
            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Regenerating…</>
            : <><RefreshCw className="w-3 h-3 mr-1.5" />Regenerate</>
          }
        </Button>
      </motion.div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={Table2}
          label="Tables"
          value={insights.total_tables.toLocaleString()}
          delay={0}
          accent="primary"
        />
        <StatCard
          icon={Columns3}
          label="Columns"
          value={insights.total_columns.toLocaleString()}
          delay={0.05}
          accent="blue"
        />
        <StatCard
          icon={Hash}
          label="Total Rows"
          value={insights.total_rows >= 1_000_000
            ? `${(insights.total_rows / 1_000_000).toFixed(1)}M`
            : insights.total_rows >= 1_000
              ? `${(insights.total_rows / 1_000).toFixed(1)}K`
              : insights.total_rows.toLocaleString()}
          sub="across all tables"
          delay={0.1}
          accent="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Largest Table"
          value={insights.largest_table?.name ?? "—"}
          sub={insights.largest_table
            ? `${insights.largest_table.row_count.toLocaleString()} rows`
            : undefined}
          delay={0.15}
          accent="violet"
        />
        <StatCard
          icon={TrendingDown}
          label="Smallest Table"
          value={insights.smallest_table?.name ?? "—"}
          sub={insights.smallest_table
            ? `${insights.smallest_table.row_count.toLocaleString()} rows`
            : undefined}
          delay={0.2}
          accent="amber"
        />
        <StatCard
          icon={GitBranch}
          label="Relationships"
          value={insights.total_relationships.toLocaleString()}
          sub="foreign key links"
          delay={0.25}
          accent="rose"
        />
      </div>

      {/* Table Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-creative p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Table Breakdown
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {["rows", "columns", "name"].map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                  sortBy === s
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-0">
          <AnimatePresence mode="wait">
            {sortedTables.map((table, i) => (
              <TableRow
                key={table.name}
                table={table}
                index={i}
                maxRows={maxRows}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

    </div>
  )
}
