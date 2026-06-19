import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { submitQuery } from "@/lib/api"
import { Textarea } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Zap, Loader2, Database } from "lucide-react"

export default function QueryForm({ provider, selectedDbId, onResult, sessionId, sessionTitle, initialQuestion }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { question: initialQuestion || "" }
  })

  useEffect(() => {
    setValue("question", initialQuestion || "")
  }, [initialQuestion, setValue])

  const question = watch("question", "")

  const mutation = useMutation({
    mutationFn: (data) => submitQuery({
      question: data.question,
      provider,
      databaseId: selectedDbId,
      sessionId,
      sessionTitle
    }),
    onSuccess: (data, variables) => {
      onResult({
        question: variables.question,
        ...data
      })
      setValue("question", "")
      queryClient.invalidateQueries({ queryKey: ["history"] })
    },
    onError: (err, variables) => {
      onResult({
        question: variables.question,
        error: err.message,
        sql: null,
        rows: [],
        validated: false
      })
    },
  })

  const onSubmit = (data) => {
    if (!selectedDbId) return
    if (!data.question?.trim()) return
    mutation.mutate(data)
  }

  const isBtnDisabled = !selectedDbId || mutation.isPending

  return (
    <div className="space-y-4">
      {/* Query Input */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="relative">
          <Textarea
            {...register("question", { required: "Please enter a question" })}
            placeholder={
              selectedDbId
                ? "Ask anything about your database in plain English...\ne.g. Show me the top 10 users grouped by sign-up date"
                : "Please connect or select a database from the sidebar to start querying..."
            }
            rows={4}
            disabled={!selectedDbId}
            className="text-sm pr-4 bg-background border-border focus:border-primary disabled:opacity-50 w-full"
          />
          {errors.question && (
            <p className="text-xs text-red-500 mt-1">{errors.question.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {!selectedDbId ? (
              <span className="text-primary flex items-center gap-1 font-bold uppercase tracking-wider">
                <Database className="w-3.5 h-3.5" /> No Database Selected
              </span>
            ) : question.length > 0 ? (
              `${question.length} characters`
            ) : (
              "Ask in natural language"
            )}
          </span>
          <Button
            type="submit"
            disabled={isBtnDisabled}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-primary-foreground px-6 py-2.5 rounded-lg font-bold uppercase tracking-wider shadow-lg shadow-primary/20 transition-all duration-200 disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating SQL...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run Query
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
