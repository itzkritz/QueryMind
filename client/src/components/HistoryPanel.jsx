import { useQuery } from "@tanstack/react-query"
import { fetchHistory } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, CheckCircle2, XCircle, Cpu, ChevronRight, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/useAuth"

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + "Z").getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function HistoryPanel({ onSelect }) {
  const { user } = useAuth()
  const { data: history, isLoading } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: () => fetchHistory(15),
    refetchInterval: 15000,
    enabled: !!user?.id,
  })

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" /> Recent Queries
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}
        </div>
      ) : !history?.length ? (
        <div className="text-center py-8 text-gray-600 text-sm">
          <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No queries yet
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {history.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSelect && onSelect(item)}
                className="w-full text-left rounded-lg border border-white/6 bg-white/3 hover:bg-white/6 hover:border-violet-500/20 px-3 py-2.5 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 truncate group-hover:text-white transition-colors">
                      {item.question}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-gray-600 text-xs">
                        <Clock className="w-3 h-3" /> {timeAgo(item.created_at)}
                      </span>
                      <span className="flex items-center gap-1 text-gray-600 text-xs">
                        <Cpu className="w-3 h-3" /> {item.provider}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.status === "success"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
