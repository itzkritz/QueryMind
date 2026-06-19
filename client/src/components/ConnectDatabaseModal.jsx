import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { connectDatabase, connectSqliteDatabase } from "@/lib/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Database, Plus, CheckCircle, AlertTriangle, Loader2, Upload } from "lucide-react"

export default function ConnectDatabaseModal({ open, onOpenChange, onConnected }) {
  const queryClient = useQueryClient()
  const [dbType, setDbType] = useState("POSTGRESQL")
  const [testStatus, setTestStatus] = useState(null) // { success: boolean, message: string } | null
  const [testing, setTesting] = useState(false)
  const [sqliteFile, setSqliteFile] = useState(null)

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      name: "",
      host: "",
      port: 5432,
      database_name: "",
      username: "",
      password: "",
    }
  })

  // Watch fields to run connection tests dynamically
  const formValues = watch()

  // Handle resetting state on close
  const handleOpenChange = (val) => {
    if (!val) {
      reset()
      setTestStatus(null)
      setSqliteFile(null)
    }
    onOpenChange(val)
  }

  // Connection validation
  const testConnection = async () => {
    setTesting(true)
    setTestStatus(null)
    try {
      if (dbType === "SQLITE") {
        if (!sqliteFile) throw new Error("Please upload a .db file first.")
        // SQLite test by connecting temporarily via the connect API
        // We'll upload a draft or just let the user save it directly
        setTestStatus({ success: true, message: "Ready to upload & index SQLite database." })
      } else {
        const payload = {
          name: formValues.name || "Test Connection",
          db_type: dbType,
          host: formValues.host,
          port: Number(formValues.port),
          database_name: formValues.database_name,
          username: formValues.username,
          password: formValues.password,
        }
        // Call the backend connect validation endpoint (which tests connection before persisting)
        const res = await connectDatabase(payload)
        setTestStatus({ success: true, message: `Successfully connected to ${res.database_name}!` })
      }
    } catch (err) {
      setTestStatus({ success: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (dbType === "SQLITE") {
        return connectSqliteDatabase({ name: data.name, file: sqliteFile })
      } else {
        return connectDatabase({
          name: data.name,
          db_type: dbType,
          host: data.host,
          port: Number(data.port),
          database_name: data.database_name,
          username: data.username,
          password: data.password,
        })
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["databases"] })
      if (onConnected) onConnected(data)
      handleOpenChange(false)
    },
    onError: (err) => {
      setTestStatus({ success: false, message: err.message })
    }
  })

  const onSubmit = (data) => {
    mutation.mutate(data)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSqliteFile(e.target.files[0])
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet-400" />
            Connect Database
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Database Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Display Name</label>
            <Input
              {...register("name", { required: true })}
              placeholder="e.g. Production PostgreSQL"
              className="text-sm"
            />
          </div>

          {/* Database Type Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Database Type</label>
            <Tabs value={dbType} onValueChange={(val) => {
              setDbType(val)
              setTestStatus(null)
              if (val === "MYSQL") reset({ ...formValues, port: 3306 })
              if (val === "POSTGRESQL") reset({ ...formValues, port: 5432 })
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="POSTGRESQL">PostgreSQL</TabsTrigger>
                <TabsTrigger value="MYSQL">MySQL</TabsTrigger>
                <TabsTrigger value="SQLITE">SQLite</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Form Fields based on selection */}
          {dbType !== "SQLITE" ? (
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-4 space-y-1">
                <label className="text-xs text-gray-500">Host</label>
                <Input {...register("host")} placeholder="127.0.0.1" className="h-9 text-xs" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-gray-500">Port</label>
                <Input {...register("port")} placeholder="5432" className="h-9 text-xs" />
              </div>
              <div className="col-span-6 space-y-1">
                <label className="text-xs text-gray-500">Database Name</label>
                <Input {...register("database_name")} placeholder="postgres" className="h-9 text-xs" />
              </div>
              <div className="col-span-3 space-y-1">
                <label className="text-xs text-gray-500">Username</label>
                <Input {...register("username")} placeholder="postgres" className="h-9 text-xs" />
              </div>
              <div className="col-span-3 space-y-1">
                <label className="text-xs text-gray-500">Password</label>
                <Input type="password" {...register("password")} placeholder="••••••••" className="h-9 text-xs" />
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center bg-white/3">
              <Upload className="w-8 h-8 text-gray-500 mb-2" />
              <p className="text-xs text-gray-400 mb-4 text-center">
                {sqliteFile ? sqliteFile.name : "Select or drag a SQLite .db file"}
              </p>
              <label className="cursor-pointer">
                <span className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md">
                  Browse File
                </span>
                <input
                  type="file"
                  accept=".db"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Test connection results */}
          {testStatus && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              testStatus.success
                ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
                : "bg-red-500/8 border-red-500/20 text-red-300"
            }`}>
              {testStatus.success
                ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <div>
                <p className="font-semibold">{testStatus.success ? "Connection OK" : "Connection Failed"}</p>
                <p className="opacity-90 leading-normal mt-0.5">{testStatus.message}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/8">
            <Button
              type="button"
              variant="outline"
              disabled={testing || mutation.isPending}
              onClick={testConnection}
              className="text-xs border-white/10 hover:bg-white/5 h-9"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                  Testing...
                </>
              ) : "Test Connection"}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="text-xs text-gray-400 hover:text-white h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={testing || mutation.isPending}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 h-9 shadow-lg shadow-violet-900/30"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Connecting...
                  </>
                ) : "Connect"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
