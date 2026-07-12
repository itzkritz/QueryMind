import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { Database, Zap, Layers, Cpu, ArrowRight, X, Eye, EyeOff, Loader2, Chrome, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const { signIn, signUp, signInWithGoogle, isSupabaseReady } = useAuth()
  const [mode, setMode] = useState("signin") // "signin" | "signup"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localMsg, setLocalMsg] = useState("")   // success message (green)
  const [localErr, setLocalErr] = useState("")   // error message (red)

  function switchMode(newMode) {
    setMode(newMode)
    setLocalMsg("")
    setLocalErr("")
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLocalMsg("")
    setLocalErr("")
    setLoading(true)

    if (mode === "signup") {
      // 1. Create the account
      const { error: signUpErr } = await signUp({ email, password })
      if (signUpErr) {
        setLocalErr(typeof signUpErr === "string" ? signUpErr : (signUpErr.message || "Sign up failed."))
        setLoading(false)
        return
      }
      // 2. Immediately sign in so user lands on dashboard without any extra step
      const { error: signInErr } = await signIn({ email, password })
      setLoading(false)
      if (signInErr) {
        // Account created but auto-login failed — let them sign in manually
        setLocalMsg("Account created! Please sign in.")
        switchMode("signin")
      }
      // If sign-in succeeded, useAuth session listener will update user and App.jsx will render dashboard
    } else {
      const { error: signInErr } = await signIn({ email, password })
      setLoading(false)
      if (signInErr) {
        setLocalErr(typeof signInErr === "string" ? signInErr : (signInErr.message || "Sign in failed."))
      }
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setLocalErr("")
    await signInWithGoogle()
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-primary/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-primary transition-colors z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg uppercase tracking-tight text-foreground">QueryMind</span>
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tight text-foreground mb-1">
            {mode === "signin" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Sign in to your QueryMind workspace." : "Start querying your databases with AI."}
          </p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl border border-border bg-card hover:bg-card/80 text-foreground text-sm font-semibold transition-all hover:border-primary/40 mb-4 disabled:opacity-50"
          >
            <Chrome className="w-4 h-4" />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Success message */}
            {localMsg && (
              <p className="text-xs px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {localMsg}
              </p>
            )}
            {/* Error message */}
            {localErr && (
              <p className="text-xs px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                {localErr}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60 mt-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-bold hover:underline">
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="relative rounded-2xl border border-border bg-card p-6 group hover:border-primary/40 transition-all"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-black uppercase tracking-tight text-foreground text-sm mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  )
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage({ theme, toggleTheme }) {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden transition-all duration-300">
      <AnimatePresence>{showAuth && <AuthModal onClose={() => setShowAuth(false)} />}</AnimatePresence>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-5 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-lg uppercase tracking-tight text-foreground">QueryMind</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block mr-2">Features</a>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-accent/40 transition-colors mr-1"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5 text-primary" /> : <Moon className="w-4.5 h-4.5 text-primary" />}
          </button>
          <button
            onClick={() => setShowAuth(true)}
            className="h-9 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-primary/20"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* ── HERO SECTION (Screenshot 3 inspiration) ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
        {/* Grid background */}
        <div className="absolute inset-0 bg-[size:28px_28px] bg-[image:linear-gradient(rgba(225,29,72,0.04)_1px,transparent_1px),linear-gradient(to_right,rgba(225,29,72,0.04)_1px,transparent_1px)]" />

        {/* Atmospheric red glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 w-full text-center px-6">


          {/* ── Overline badge ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="inline-flex items-center gap-2 border border-primary/30 bg-primary/8 px-4 py-1.5 rounded-full mb-7"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Dynamic AI SQL Engine</span>
          </motion.div>

          {/* ── Main headline — QUERYMIND ghost behind the text ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="relative mb-8"
          >
            {/* QUERYMIND ghost — black→red→black gradient, sized to cover screen margins better */}
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
            >
              <span
                className="font-black uppercase leading-none tracking-tighter whitespace-nowrap"
                style={{
                  fontSize: 'clamp(90px, 11.5vw, 172px)',
                  background: 'linear-gradient(90deg, #0a0808 0%, #7f1d1d 25%, #dc2626 50%, #7f1d1d 75%, #0a0808 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  opacity: 0.85,
                }}
              >
                QUERYMIND
              </span>
            </div>

            {/* Headline text container — centered on screen */}
            <div className="flex flex-col items-center justify-center text-center w-full">
              {/* "Speak to" — dark: bright white, light: black */}
              <div
                className="relative dark:text-white text-black font-extrabold leading-none mb-2 uppercase tracking-tight"
                style={{ fontSize: 'clamp(36px, 6.5vw, 76px)', fontFamily: "Inter, system-ui, sans-serif", letterSpacing: '-0.02em' }}
              >
                Speak to
              </div>
              {/* "your data" — dark: bright white, light: black */}
              <div
                className="relative dark:text-white text-black font-extrabold leading-none uppercase tracking-tight"
                style={{ fontSize: 'clamp(36px, 6.5vw, 76px)', letterSpacing: '-0.02em', fontFamily: "Inter, system-ui, sans-serif" }}
              >
                your data
              </div>
            </div>
            {/* Tiny accent label */}
            <div
              className="relative mt-5 text-[#a8a29e] font-medium tracking-widest uppercase text-center"
              style={{ fontSize: 'clamp(9px, 1vw, 11px)', fontFamily: "Inter, system-ui, sans-serif" }}
            >
              — the future of database queries
            </div>
          </motion.div>

          {/* ── Body copy ── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-sm sm:text-base text-[#a8a29e] max-w-lg mx-auto leading-relaxed mb-10"
            style={{ fontFamily: 'inherit' }}
          >
            No SQL expertise needed. Type a question in plain English and instantly get accurate queries, data results, and schema insights — powered by Gemini &amp; Ollama.
          </motion.p>

          {/* ── CTA buttons ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
          >
            <button
              onClick={() => setShowAuth(true)}
              className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-xl shadow-primary/25 flex items-center gap-2 group"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#features"
              className="h-12 px-8 rounded-xl border border-border text-muted-foreground hover:text-foreground font-semibold uppercase tracking-wider text-sm transition-all flex items-center justify-center"
            >
              See Features
            </a>
          </motion.div>

          {/* ── Stats row ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center gap-10 pt-8 border-t border-border"
          >
            {[["2", "LLM Models"], ["100%", "Dynamic SQL"], ["Multi", "DB Support"]].map(([val, lbl]) => (
              <div key={lbl} className="text-center">
                <div className="text-2xl font-black text-primary">{val}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{lbl}</div>
              </div>
            ))}
          </motion.div>
        </div>

      </section>

      {/* ── FEATURES SECTION (Screenshot 2 inspiration) ── */}
      <section id="features" className="relative overflow-hidden bg-background border-t border-border">

        {/* ─── BIG TITLE + RED STRIPE BLOCK ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative w-full overflow-hidden select-none"
        >

          {/* Layer 2: "QUERY YOUR" — text above the stripe */}
          <div className="relative z-10 px-6 sm:px-12 pt-20 pb-0">
            <h2
              className="font-black uppercase leading-none tracking-tighter text-foreground"
              style={{ fontSize: 'clamp(52px, 9vw, 120px)' }}
            >
              QUERY YOUR
            </h2>
          </div>

          {/* Layer 3: The thick red stripe + "DATABASE" riding across it */}
          <div className="relative z-10 w-full">
            {/* Actual red stripe band — full viewport width, ~55% of the text's line-height */}
            <div
              className="absolute inset-x-0 bg-[#e11d48]"
              style={{ top: '22%', bottom: '22%' }}
            />
            {/* "DATABASE" — same font size so text overflows stripe top & bottom */}
            <div className="relative z-10 px-6 sm:px-12">
              <h2
                className="font-black uppercase leading-none tracking-tighter text-white"
                style={{ fontSize: 'clamp(52px, 9vw, 120px)' }}
              >
                DATABASE
              </h2>
            </div>
          </div>

          {/* Layer 4: sub-copy tagline */}
          <div className="relative z-10 px-6 sm:px-12 pt-5 pb-20">
            <p className="text-muted-foreground text-sm sm:text-base max-w-sm leading-relaxed">
              No SQL expertise required. Just ask — and get real answers from your data in seconds.
            </p>
          </div>
        </motion.div>

        {/* Body copy + terminal demo */}
        <div className="px-6 sm:px-12 max-w-6xl mx-auto mb-14">
          <div className="flex flex-col lg:flex-row items-start gap-10">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-muted-foreground text-base leading-relaxed max-w-md"
            >
              QueryMind transforms how you interact with data. Connect PostgreSQL, MySQL, or SQLite — then simply ask questions. The AI understands your schema and generates precise SQL on the fly.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex-1 bg-card rounded-2xl border border-border p-5 font-mono text-xs"
            >
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="ml-2 text-muted-foreground text-[10px]">querymind — AI SQL Console</span>
              </div>
              <div className="space-y-1">
                <div><span className="text-primary">❯</span> <span className="text-muted-foreground">You: </span><span className="text-foreground">"Show top 10 customers by revenue this month"</span></div>
                <div className="mt-2 text-emerald-500 dark:text-emerald-400">✓ Generated SQL in 0.8s</div>
                <div className="mt-1 text-muted-foreground">SELECT c.name, SUM(o.amount) AS revenue</div>
                <div className="text-muted-foreground">FROM customers c JOIN orders o ON c.id = o.customer_id</div>
                <div className="text-muted-foreground">WHERE o.date &gt;= DATE_TRUNC('month', NOW())</div>
                <div className="text-muted-foreground">GROUP BY c.name ORDER BY revenue DESC LIMIT 10;</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="px-6 sm:px-12 max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-16">
          <FeatureCard delay={0}    icon={Database} title="Multi-DB Connect"    desc="Connect PostgreSQL, MySQL, or SQLite. Your schema is auto-discovered and kept in sync." />
          <FeatureCard delay={0.1}  icon={Zap}      title="Instant SQL Gen"     desc="Powered by Gemini 2.5 Flash or a local Ollama model. Fast, accurate, context-aware." />
          <FeatureCard delay={0.2}  icon={Layers}   title="Schema Catalog"      desc="Auto-discovers tables, columns, foreign keys, and sample values on every connection." />
          <FeatureCard delay={0.3}  icon={Cpu}      title="Local LLM Support"   desc="Run fully offline using Ollama with models like Qwen or CodeLLaMA. Your data stays private." />
        </div>

        {/* CTA band */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="px-6 sm:px-12 max-w-6xl mx-auto pb-24"
        >
          <div className="relative rounded-3xl border border-primary/20 bg-card p-10 overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-3xl" />
            <div className="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">✦ Ready to start?</div>
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground leading-tight">
                Connect your first<br />database in 30 seconds
              </h3>
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="flex-shrink-0 h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-xl shadow-primary/25 flex items-center gap-2 group"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>QueryMind © 2026 — Text-to-SQL Platform</span>
        <span>Built with <span className="text-primary font-bold">FastAPI</span> + <span className="text-primary font-bold">React</span></span>
      </footer>
    </div>
  )
}
