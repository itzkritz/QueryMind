import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, ShieldX, Table2, BarChart2, Download, Clock, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const CHART_COLORS = ["#7c3aed", "#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626"]

function detectChart(rows) {
  if (!rows || rows.length < 2) return null
  const keys = Object.keys(rows[0])
  const numericKeys = keys.filter(k => typeof rows[0][k] === "number")
  const stringKeys = keys.filter(k => typeof rows[0][k] === "string")
  if (numericKeys.length >= 1 && stringKeys.length >= 1) {
    return { type: rows.length <= 6 ? "pie" : "bar", valueKey: numericKeys[0], nameKey: stringKeys[0] }
  }
  return null
}

function formatValue(v) {
  if (typeof v === "number") {
    return v > 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2)
  }
  return String(v ?? "—")
}

function DataTable({ rows }) {
  if (!rows.length) return <p className="text-gray-500 text-sm text-center py-8">No rows returned.</p>
  const keys = Object.keys(rows[0])
  return (
    <div className="overflow-auto max-h-80 rounded-lg border border-white/8">
      <table className="w-full text-sm min-w-max">
        <thead className="sticky top-0 bg-[#0d1020] border-b border-white/8">
          <tr>
            {keys.map(k => (
              <th key={k} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/4 hover:bg-white/4 transition-colors">
              {keys.map(k => (
                <td key={k} className="px-4 py-2.5 text-gray-200 font-mono text-xs">
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

function DataChart({ rows }) {
  const config = detectChart(rows)
  if (!config) return <p className="text-gray-500 text-sm text-center py-8">Chart requires at least one numeric and one text column.</p>

  const data = rows.map(r => ({ ...r, [config.nameKey]: String(r[config.nameKey]).slice(0, 20) }))

  if (config.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey={config.valueKey} nameKey={config.nameKey} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#0d1020", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb" }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey={config.nameKey} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v > 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip contentStyle={{ background: "#0d1020", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb" }} />
        <Bar dataKey={config.valueKey} fill="#7c3aed" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function downloadCSV(rows) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${r[k] ?? ""}"`).join(","))].join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.download = `querymind_results_${Date.now()}.csv`
  a.click()
}

export default function ResultsPanel({ result }) {
  const hasChart = result?.rows && detectChart(result.rows)

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
            <div className="rounded-xl border border-white/8 bg-white/4 p-4 shadow-sm">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">Question Asked</span>
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
            </div>
            {result.rows?.length > 0 && (
              <span className="text-xs text-gray-500">{result.rows.length} row{result.rows.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Error display */}
          {result.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-300">
              {result.error}
            </div>
          )}

          {/* Generated SQL */}
          {result.sql && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-950/30">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-violet-500/15">
                <Code2 className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold text-violet-300 uppercase tracking-wide">Generated SQL</span>
              </div>
              <pre className="p-4 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {result.sql}
              </pre>
            </div>
          )}

          {/* Results Table + Chart */}
          {result.rows?.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/3">
              <Tabs defaultValue="table">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <TabsList>
                    <TabsTrigger value="table">
                      <Table2 className="w-3.5 h-3.5" /> Table
                    </TabsTrigger>
                    {hasChart && (
                      <TabsTrigger value="chart">
                        <BarChart2 className="w-3.5 h-3.5" /> Chart
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadCSV(result.rows)}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 h-8"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </Button>
                </div>
                <div className="p-4">
                  <TabsContent value="table">
                    <DataTable rows={result.rows} />
                  </TabsContent>
                  {hasChart && (
                    <TabsContent value="chart">
                      <DataChart rows={result.rows} />
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
