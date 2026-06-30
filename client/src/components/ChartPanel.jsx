/**
 * ChartPanel.jsx
 * ---------------
 * Renders the correct Recharts chart based on chart_meta from the backend.
 * Supports: Line, Bar, Pie, Area
 */
import {
  LineChart,   Line,
  BarChart,    Bar,
  AreaChart,   Area,
  PieChart,    Pie,    Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"

// Palette: primary red tones → accent purples → cool blues/greens
const COLORS = [
  "#e11d48", // primary red
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#4f46e5", // indigo
  "#db2777", // pink
  "#0284c7", // sky
]

const TOOLTIP_STYLE = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-main)",
  borderRadius: 10,
  color: "var(--text-main)",
  fontSize: 12,
}

const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 11 }

function truncate(str, n = 14) {
  return str && str.length > n ? str.slice(0, n) + "…" : str
}

function formatYAxis(v) {
  if (typeof v !== "number") return v
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000)    return `${(v / 1_000).toFixed(0)}k`
  return v
}

// ── Individual chart renderers ─────────────────────────────────────────────

function LineChartView({ data, xKey, yKeys }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" opacity={0.3} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false}
          tickFormatter={v => truncate(String(v))} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={formatYAxis} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />}
        {yKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 4, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function BarChartView({ data, xKey, yKeys }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" opacity={0.3} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false}
          tickFormatter={v => truncate(String(v))} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={formatYAxis} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />}
        {yKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60}>
            {yKeys.length === 1 &&
              data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)
            }
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function AreaChartView({ data, xKey, yKeys }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
        <defs>
          {yKeys.map((key, i) => (
            <linearGradient key={key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS[i % COLORS.length]} stopOpacity={0.35} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" opacity={0.3} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={false} tickLine={false}
          tickFormatter={v => truncate(String(v))} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={formatYAxis} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />}
        {yKeys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2.5}
            fill={`url(#grad-${i})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function PieChartView({ data, xKey, yKeys }) {
  const valueKey = yKeys[0]
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={xKey}
          cx="50%"
          cy="50%"
          outerRadius={110}
          innerRadius={45}
          paddingAngle={3}
          label={({ name, percent }) =>
            percent > 0.04 ? `${truncate(String(name), 12)} ${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={{ stroke: "var(--border-main)", strokeWidth: 1 }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
          formatter={(value) => truncate(String(value), 20)}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Public export ──────────────────────────────────────────────────────────

export default function ChartPanel({ rows, chartMeta }) {
  if (!chartMeta?.suitable || !rows?.length) return null

  const { chart_type, x_key, y_keys, title } = chartMeta

  // Normalize: truncate x labels in data copy
  const data = rows.map(r => ({
    ...r,
    [x_key]: r[x_key] != null ? String(r[x_key]) : "—",
  }))

  const renderers = {
    line: <LineChartView data={data} xKey={x_key} yKeys={y_keys} />,
    bar:  <BarChartView  data={data} xKey={x_key} yKeys={y_keys} />,
    area: <AreaChartView data={data} xKey={x_key} yKeys={y_keys} />,
    pie:  <PieChartView  data={data} xKey={x_key} yKeys={y_keys} />,
  }

  const chart = renderers[chart_type]
  if (!chart) return null

  return (
    <div className="space-y-3">
      {/* Chart type badge + title */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
          {chart_type} chart
        </span>
        {title && (
          <span className="text-xs text-muted-foreground truncate">{title}</span>
        )}
      </div>
      {chart}
    </div>
  )
}
