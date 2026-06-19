import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchDatabases, fetchDatabaseSchema, refreshSchema, fetchHealth, deleteDatabase } from "@/lib/api"
import { Database, Cpu, Wifi, WifiOff, ChevronRight, Key, Plus, RefreshCw, Layers, MessageSquare, History, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

const TYPE_COLORS = {
  integer: "text-blue-500 dark:text-blue-400",
  bigint: "text-blue-500 dark:text-blue-400",
  numeric: "text-emerald-600 dark:text-emerald-400",
  double: "text-emerald-600 dark:text-emerald-400",
  float: "text-emerald-600 dark:text-emerald-400",
  real: "text-emerald-600 dark:text-emerald-400",
  varchar: "text-amber-600 dark:text-amber-400",
  "character varying": "text-amber-600 dark:text-amber-400",
  text: "text-amber-600 dark:text-amber-400",
  timestamp: "text-purple-600 dark:text-purple-400",
  datetime: "text-purple-600 dark:text-purple-400",
  date: "text-purple-600 dark:text-purple-400",
  boolean: "text-pink-600 dark:text-pink-400",
  default: "text-muted-foreground",
}

function getTypeColor(type) {
  const t = String(type).toLowerCase()
  for (const key in TYPE_COLORS) {
    if (t.includes(key)) return TYPE_COLORS[key]
  }
  return TYPE_COLORS.default
}

export default function Sidebar({
  provider,
  onProviderChange,
  selectedDbId,
  onDbChange,
  onOpenConnectModal,
  activeView,
  onViewChange,
  onNewChat,
  currentSessionId,
  onSessionSelect
}) {
  const queryClient = useQueryClient()

  // API Health status
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
    refetchInterval: 30000,
  })

  // List connected databases
  const { data: databases, isLoading: dbsLoading } = useQuery({
    queryKey: ["databases"],
    queryFn: fetchDatabases,
  })

  // Fetch recent queries history
  const { data: history } = useQuery({
    queryKey: ["history"],
    queryFn: () => fetchHistory(20),
    refetchInterval: 15000,
  })

  // Get schema for selected database
  const { data: schemaWrapper, isLoading: schemaLoading } = useQuery({
    queryKey: ["schema", selectedDbId],
    queryFn: () => fetchDatabaseSchema(selectedDbId),
    enabled: !!selectedDbId,
    staleTime: 5 * 60 * 1000,
  })

  const refreshMutation = useMutation({
    mutationFn: () => refreshSchema(selectedDbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schema", selectedDbId] })
      queryClient.invalidateQueries({ queryKey: ["databases"] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (dbId) => deleteDatabase(dbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["databases"] })
      onDbChange("")
    },
    onError: (err) => {
      alert(err.message || "Failed to remove database connection")
    }
  })

  const isOnline = !!health
  const activeDb = databases?.find(d => d.id === selectedDbId)
  const tables = schemaWrapper?.schema?.tables || {}

  // Group history items by session_id
  const sessionsMap = {}
  if (history) {
    history.forEach(item => {
      const sId = item.session_id || "legacy"
      if (!sessionsMap[sId]) {
        sessionsMap[sId] = {
          id: sId,
          title: item.session_title || item.question || "Legacy Chat",
          created_at: item.created_at,
          items: []
        }
      }
      sessionsMap[sId].items.push(item)
    })
  }
  const sidebarSessions = Object.values(sessionsMap)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <aside className="w-72 min-h-screen border-r border-border bg-secondary flex flex-col gap-0 overflow-y-auto transition-all duration-300">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Database className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-foreground font-black text-lg leading-none uppercase tracking-tight">QueryMind</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Multi-DB Text-to-SQL</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-5 py-3 border-b border-border bg-background/25">
        <Button
          onClick={onNewChat}
          className="w-full bg-primary/10 hover:bg-primary/20 hover:text-primary text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider h-10 flex items-center justify-center gap-2 rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Navigation View Switcher */}
      <div className="px-5 py-3 border-b border-border space-y-1">
        <button
          onClick={() => onViewChange("console")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
            activeView === "console"
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground border-transparent"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Query Console
        </button>
        <button
          onClick={() => onViewChange("history")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
            activeView === "history"
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground border-transparent"
          }`}
        >
          <History className="w-4 h-4" />
          Full History log
        </button>
      </div>

      {/* Recent Chats list */}
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Conversations</p>
        <div className="space-y-1">
          {sidebarSessions.map(session => {
            const isActive = session.id === currentSessionId && activeView === "console"
            return (
              <button
                key={session.id}
                onClick={() => {
                  onSessionSelect(session)
                  onViewChange("console")
                }}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded truncate transition-colors flex items-center gap-2 border ${
                  isActive
                    ? "bg-primary/10 text-primary font-bold border-primary/20"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground border-transparent"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                <span className="truncate">{session.title}</span>
              </button>
            )
          })}
          {sidebarSessions.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic pl-1">No chats yet</p>
          )}
        </div>
      </div>

      {/* Target Database Selection */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Database</p>
          <Button
            size="icon"
            variant="ghost"
            onClick={onOpenConnectModal}
            className="w-5 h-5 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {dbsLoading ? (
          <div className="h-10 bg-accent rounded-lg animate-pulse" />
        ) : databases?.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={selectedDbId} onValueChange={onDbChange}>
                <SelectTrigger className="w-full bg-card border-border">
                  <div className="flex items-center gap-2 truncate">
                    <Database className="w-4 h-4 text-primary flex-shrink-0" />
                    <SelectValue placeholder="Select Database" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {databases.map(db => (
                    <SelectItem key={db.id} value={db.id}>
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          db.status === "connected" ? "bg-emerald-500" : "bg-red-500"
                        }`} />
                        {db.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDbId && (
              <Button
                size="icon"
                variant="ghost"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirm("Are you sure you want to disconnect and delete this database connection?")) {
                    deleteMutation.mutate(selectedDbId)
                  }
                }}
                className="w-9 h-9 border border-border bg-card rounded-lg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-muted-foreground flex-shrink-0"
                title="Delete/Disconnect Database"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={onOpenConnectModal}
            className="w-full text-xs h-9 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
          >
            Connect Database
          </Button>
        )}

        {/* Database Health Badge */}
        {activeDb && (
          <div className="flex items-center justify-between mt-2 px-1 text-xs">
            <span className="text-muted-foreground font-mono text-[10px] uppercase">{activeDb.db_type}</span>
            <Badge variant={activeDb.status === "connected" ? "success" : "error"}>
              {activeDb.status}
            </Badge>
          </div>
        )}
      </div>

      {/* LLM Provider */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">LLM Model</p>
        <Select value={provider} onValueChange={onProviderChange}>
          <SelectTrigger className="bg-card border-border">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="gemini">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Gemini 2.5 Flash
              </span>
            </SelectItem>
            <SelectItem value="ollama">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Ollama (Local GPU)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Connection Status */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">API Health</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
              FastAPI Server
            </span>
            <Badge variant={isOnline ? "success" : "error"}>{isOnline ? "Online" : "Offline"}</Badge>
          </div>
        </div>
      </div>

      {/* Schema Explorer */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" /> Schema Catalog
          </p>
          {selectedDbId && (
            <Button
              size="icon"
              variant="ghost"
              disabled={refreshMutation.isPending || schemaLoading}
              onClick={() => refreshMutation.mutate()}
              className="w-5 h-5 rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {schemaLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 rounded bg-card animate-pulse" />
            ))}
          </div>
        ) : Object.keys(tables).length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {Object.entries(tables).map(([tableName, info]) => (
              <AccordionItem key={tableName} value={tableName} className="border-border">
                <AccordionTrigger className="hover:no-underline hover:text-primary">
                  <span className="flex items-center gap-2 truncate text-left">
                    <Database className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="font-mono text-xs truncate">{tableName}</span>
                    {info.row_count >= 0 && (
                      <span className="text-[10px] text-muted-foreground">({info.row_count})</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1.5 pl-2 border-l border-border ml-1.5 mt-1">
                    {info.columns.map(col => (
                      <div key={col.name} className="flex flex-col gap-0.5 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono text-xs text-foreground truncate">{col.name}</span>
                          <span className={`font-mono text-[10px] ml-auto ${getTypeColor(col.data_type)}`}>
                            {col.data_type.toLowerCase().split("(")[0]}
                          </span>
                        </div>
                        {col.is_foreign_key && col.foreign_key_ref && (
                          <div className="pl-4 text-[9px] text-primary/80 font-mono">
                            → {col.foreign_key_ref}
                          </div>
                        )}
                        {col.sample_values?.length > 0 && (
                          <div className="pl-4 text-[9px] text-muted-foreground truncate font-mono">
                            Sample: {col.sample_values.slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : selectedDbId ? (
          <p className="text-xs text-muted-foreground">No tables discovered yet. Click refresh to scan.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Please select or connect a database above.</p>
        )}
      </div>
    </aside>
  )
}
