import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Zap, Plus, Sun, Moon, Sparkles, Layers, History, Database, LogOut, Loader2, MessageSquare } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchDatabases, fetchHistory } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import Sidebar from "@/components/Sidebar"
import QueryForm from "@/components/QueryForm"
import ResultsPanel from "@/components/ResultsPanel"
import HistoryPage from "@/components/HistoryPage"
import ConnectDatabaseModal from "@/components/ConnectDatabaseModal"
import LandingPage from "@/components/LandingPage"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function App() {
  const { user, loading, isAuthenticated, signOut } = useAuth()
  const [provider, setProvider] = useState("gemini")
  const [selectedDbId, setSelectedDbId] = useState("")
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  
  // Chat session states
  const [activeView, setActiveView] = useState("console") // "console" | "history"
  const [sessionId, setSessionId] = useState(() => generateUuid())
  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionsMap, setSessionsMap] = useState({})
  
  // Theme state: dark by default (Red & Black), toggles to light (Red & Beige)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark"
  })

  // Sync theme to the document element class list
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"))
  }

  // Fetch databases to auto-select
  const { data: databases } = useQuery({
    queryKey: ["databases"],
    queryFn: fetchDatabases,
  })

  // Fetch history from API
  const { data: history } = useQuery({
    queryKey: ["history"],
    queryFn: () => fetchHistory(100),
  })

  // Sync database history to frontend session state
  useEffect(() => {
    if (history) {
      const grouped = {}
      history.forEach(item => {
        const sId = item.session_id || "legacy"
        if (!grouped[sId]) {
          grouped[sId] = []
        }
        grouped[sId].push({
          question: item.question,
          sql: item.generated_sql,
          rows: [], // Rows are not saved in server history table (which is standard)
          error: item.status === "error" ? "Query failed" : null,
          validated: item.status === "success",
          execution_time: item.execution_time,
          model_used: item.model_used,
          id: item.id
        })
      })

      setSessionsMap(prev => {
        const merged = { ...grouped }
        Object.keys(prev).forEach(sId => {
          const localQueries = prev[sId]
          // If the local queries have rows (i.e. run during this session), preserve them!
          if (localQueries && localQueries.some(q => q.rows?.length > 0)) {
            merged[sId] = localQueries
          }
        })
        return merged
      })
    }
  }, [history])

  // Auto-select first database if one exists and none is selected
  useEffect(() => {
    if (databases?.length > 0 && !selectedDbId) {
      const connectedDb = databases.find(d => d.status === "connected")
      if (connectedDb) {
        setSelectedDbId(connectedDb.id)
      } else {
        setSelectedDbId(databases[0].id)
      }
    }
  }, [databases, selectedDbId])

  // Start new chat thread
  const handleNewChat = () => {
    const newId = generateUuid()
    setSessionId(newId)
    setSessionTitle("")
    setActiveView("console")
  }

  // Restore session from history list or sidebar
  const handleRestoreSession = (session) => {
    setSessionId(session.id)
    setSessionTitle(session.title)
    if (session.database_id && session.database_id !== selectedDbId) {
      setSelectedDbId(session.database_id)
    }
    setActiveView("console")
  }

  // Handle adding query result to active thread
  const handleQueryResult = (queryResult) => {
    if (!sessionTitle && queryResult.question) {
      setSessionTitle(queryResult.question.slice(0, 50))
    }

    setSessionsMap(prev => {
      const currentList = prev[sessionId] ? [...prev[sessionId]] : []
      const newQueryItem = {
        question: queryResult.question,
        sql: queryResult.sql,
        rows: queryResult.rows || [],
        error: queryResult.error,
        validated: queryResult.validated,
        execution_time: queryResult.execution_time,
        model_used: queryResult.model_used,
        id: Date.now()
      }
      return {
        ...prev,
        [sessionId]: [...currentList, newQueryItem]
      }
    })
  }

  // Show spinner while auth state resolves
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0808]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Show landing page when not signed in
  if (!isAuthenticated) {
    return <LandingPage />
  }

  const activeSessionMessages = sessionsMap[sessionId] || []

  return (
    <div className="flex min-h-screen bg-background text-foreground creative-grid transition-all duration-300">
      {/* Sidebar */}
      <Sidebar
        provider={provider}
        onProviderChange={setProvider}
        selectedDbId={selectedDbId}
        onDbChange={setSelectedDbId}
        onOpenConnectModal={() => setIsConnectOpen(true)}
        activeView={activeView}
        onViewChange={setActiveView}
        onNewChat={handleNewChat}
        currentSessionId={sessionId}
        onSessionSelect={handleRestoreSession}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto relative">
        
        {/* Creative Slanted Red Banner Accent */}
        <div className="absolute top-0 right-0 left-0 h-40 bg-gradient-to-r from-primary/30 via-primary/5 to-transparent pointer-events-none transform -skew-y-3 origin-top-left -translate-y-8 z-0 border-b border-primary/20" />

        {/* Top Bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <motion.h2
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black uppercase tracking-tight text-primary"
              >
                {activeView === "history" ? "Query History" : "Query Console"}
              </motion.h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeView === "history" 
                  ? "Browse and restore your past multi-query chat sessions" 
                  : "Ask your database anything in plain English"
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="icon"
              className="w-9 h-9 border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
              title="Toggle Light/Dark Mode"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-primary" /> : <Moon className="w-4 h-4 text-primary" />}
            </Button>

            <Button
              onClick={() => setIsConnectOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-4 flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-lg shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Connect DB
            </Button>

            <Button
              onClick={signOut}
              variant="outline"
              size="icon"
              className="w-9 h-9 border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>

          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col z-10">
          {activeView === "history" ? (
            <HistoryPage 
              databases={databases} 
              onRestoreSession={handleRestoreSession} 
            />
          ) : (
            <div className="flex-1 px-8 py-6 space-y-6 max-w-5xl w-full mx-auto">
              {/* Input Form at the top of the conversation */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="card-creative p-6 shadow-xl"
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Natural Language Query</h3>
                  <span className="text-xs text-muted-foreground ml-auto bg-background px-2.5 py-0.5 rounded border border-border">
                    Model: {provider === "gemini" ? "Gemini 2.5 Flash" : "Ollama (Local)"}
                  </span>
                </div>
                <QueryForm
                  key={sessionId}
                  provider={provider}
                  selectedDbId={selectedDbId}
                  sessionId={sessionId}
                  sessionTitle={sessionTitle}
                  onResult={handleQueryResult}
                />
              </motion.div>

              {/* Message thread showing past queries in this session (reversed to show newest at the top) */}
              {activeSessionMessages.length > 0 ? (
                <div className="space-y-6">
                  {[...activeSessionMessages].reverse().map((msg, index) => {
                    const originalIndex = activeSessionMessages.length - index
                    return (
                      <motion.div
                        key={msg.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="card-creative p-6 shadow-xl"
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <Layers className="w-4 h-4 text-primary" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                            Query #{originalIndex} {index === 0 && <span className="text-primary font-normal text-[10px] ml-1.5 lowercase tracking-normal bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">(latest)</span>}
                          </h3>
                        </div>
                        <ResultsPanel result={msg} />
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                /* Blank state welcome title */
                <div className="text-center py-12 max-w-lg mx-auto space-y-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                    <MessageSquare className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Speak to your data</h3>
                  <p className="text-xs text-muted-foreground">Type a query in the console above to start analyzing. Select or connect target databases from the sidebar.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-8 py-6 border-t border-border bg-background text-xs text-muted-foreground flex items-center justify-between">
          <span>QueryMind © 2026 — Text-to-SQL Dynamic Connector</span>
        </footer>
      </main>

      {/* Connect Database Modal */}
      <ConnectDatabaseModal
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        onConnected={(newDb) => {
          setSelectedDbId(newDb.id)
        }}
      />
    </div>
  )
}
