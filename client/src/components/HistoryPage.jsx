import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchHistory } from "@/lib/api"
import { motion } from "framer-motion"
import {
  Clock, CheckCircle2, XCircle, Cpu, ChevronRight, Search, 
  Database, Copy, Check, MessageSquare, Terminal, ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + "Z").getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function HistoryPage({ databases, onRestoreSession }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const { data: history, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => fetchHistory(100),
    refetchInterval: 15000,
  })

  // Group history items by session_id
  const sessionsMap = {}
  if (history) {
    history.forEach(item => {
      const sId = item.session_id || "legacy"
      if (!sessionsMap[sId]) {
        sessionsMap[sId] = {
          id: sId,
          title: item.session_title || item.question || "Legacy Query Log",
          items: [],
          created_at: item.created_at,
          database_id: item.database_id
        }
      }
      sessionsMap[sId].items.push(item)
    })
  }

  // Convert to array and sort by the latest query's timestamp
  const sessions = Object.values(sessionsMap).sort((a, b) => {
    const aTime = new Date(a.items[0]?.created_at || a.created_at).getTime()
    const bTime = new Date(b.items[0]?.created_at || b.created_at).getTime()
    return bTime - aTime
  })

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    const matchTitle = session.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchItems = session.items.some(item => 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.generated_sql && item.generated_sql.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    return matchTitle || matchItems
  })

  // Set default selection
  const activeSessionId = selectedSessionId || filteredSessions[0]?.id
  const activeSession = sessions.find(s => s.id === activeSessionId)

  const handleCopy = (sqlText, itemId) => {
    navigator.clipboard.writeText(sqlText)
    setCopiedId(itemId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden gap-6 p-6">
      
      {/* Left Panel: Session Lists */}
      <div className="w-full md:w-80 flex flex-col border border-border bg-card rounded-xl overflow-hidden">
        
        {/* Search */}
        <div className="p-4 border-b border-border bg-background/50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Sessions scrollable list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No conversations found.
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId
              const db = databases?.find(d => d.id === session.database_id)
              const latestItem = session.items[0]
              
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full text-left rounded-lg p-3 transition-all duration-200 group flex flex-col gap-1.5 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <p className={`text-xs font-semibold truncate ${isActive ? "text-white" : "text-foreground"}`}>
                      {session.title}
                    </p>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0 mt-0.5" />
                  </div>

                  <div className="flex items-center justify-between w-full text-[10px] opacity-70">
                    <span className="flex items-center gap-1 font-mono truncate max-w-[120px]">
                      <Database className="w-2.5 h-2.5" /> {db?.name || "Unknown DB"}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0 font-sans">
                      <Clock className="w-2.5 h-2.5" /> {latestItem ? timeAgo(latestItem.created_at) : "some time ago"}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      isActive ? "bg-white/20 text-white" : "bg-card border border-border text-muted-foreground"
                    }`}>
                      {session.items.length} query{session.items.length !== 1 ? "ies" : ""}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right Panel: Selected Chat Details */}
      <div className="flex-1 flex flex-col border border-border bg-card rounded-xl overflow-hidden">
        {activeSession ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border bg-background/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Chat Conversation</span>
                <h2 className="text-base font-black text-foreground uppercase tracking-tight mt-0.5 truncate max-w-[500px]">
                  {activeSession.title}
                </h2>
              </div>
              <Button
                onClick={() => onRestoreSession(activeSession)}
                className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold uppercase tracking-wider h-9 px-4 rounded-lg flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in Console
              </Button>
            </div>

            {/* Scrollable messages thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {activeSession.items.slice().reverse().map((item, index) => {
                const db = databases?.find(d => d.id === item.database_id)
                const isSuccess = item.status === "success"
                
                return (
                  <div key={item.id} className="space-y-3 border-b border-border/40 pb-6 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] font-black text-primary">
                        Q
                      </div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Query #{index + 1}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5" /> {new Date(item.created_at + "Z").toLocaleString()}
                      </span>
                    </div>

                    {/* Question text bubble */}
                    <div className="bg-background rounded-xl border border-border p-4">
                      <p className="text-sm text-foreground font-medium">{item.question}</p>
                    </div>

                    {/* Meta stats */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={isSuccess ? "success" : "error"} className="text-[9px]">
                        {isSuccess ? "Success" : "Error"}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5 text-primary" /> {item.model_used}
                      </Badge>
                      {item.execution_time && (
                        <Badge variant="outline" className="text-[9px] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-primary" /> {item.execution_time}s
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] flex items-center gap-1 font-mono">
                        <Database className="w-2.5 h-2.5 text-primary" /> {db?.name || "Unknown DB"}
                      </Badge>
                    </div>

                    {/* Generated SQL block */}
                    {item.generated_sql && (
                      <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-violet-500/15">
                          <span className="text-[10px] font-bold text-violet-300 uppercase tracking-widest flex items-center gap-1">
                            <Terminal className="w-3 h-3" /> Generated SQL Query
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(item.generated_sql, item.id)}
                            className="w-6 h-6 rounded hover:bg-violet-500/25 text-violet-300 hover:text-white"
                          >
                            {copiedId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed bg-[#0c0a0f]/40">
                          {item.generated_sql}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-semibold">Select a chat from the sidebar to inspect its queries.</p>
          </div>
        )}
      </div>
    </div>
  )
}
