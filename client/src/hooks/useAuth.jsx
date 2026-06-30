/**
 * useAuth.jsx
 * -----------
 * Hybrid auth context:
 *   - Email/password → QueryMind custom backend (/api/auth/signup, /api/auth/signin)
 *   - Google OAuth   → Supabase OAuth redirect (token stored and validated by backend)
 */

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { supabase, isSupabaseReady } from "@/lib/supabaseClient"

const API_BASE = "http://127.0.0.1:8000"

const AuthContext = createContext(null)

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Helper: persist session from a Supabase OAuth callback
  function applySupabaseSession(session) {
    if (!session?.user) return
    const token = session.access_token
    const userData = {
      id:     session.user.id,
      email:  session.user.email,
      name:   session.user.user_metadata?.full_name || session.user.email,
      avatar: session.user.user_metadata?.avatar_url || null,
    }
    localStorage.setItem("qm_token", token)
    localStorage.setItem("qm_user",  JSON.stringify(userData))
    setUser(userData)
  }

  // On mount: restore from localStorage OR detect Supabase OAuth redirect
  useEffect(() => {
    // 1. Try our own stored session first
    const token   = localStorage.getItem("qm_token")
    const stored  = localStorage.getItem("qm_user")
    if (token && stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
      setLoading(false)
      return
    }

    // 2. Check if Supabase has an OAuth session (post-redirect)
    if (isSupabaseReady) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) applySupabaseSession(session)
        setLoading(false)
      })

      // Listen for future Supabase auth changes (token refresh, sign-out)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          applySupabaseSession(session)
        } else if (!localStorage.getItem("qm_user")) {
          // Only clear if it's not a custom-auth session
          setUser(null)
        }
      })
      return () => subscription.unsubscribe()
    }

    setLoading(false)
  }, [])

  // ── Email / Password (custom backend) ───────────────────────────────────────

  const signUp = useCallback(async ({ email, password }) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.detail || "Sign up failed." }

      const userData = { id: data.user_id, email: data.email, name: data.email }
      localStorage.setItem("qm_token", data.access_token)
      localStorage.setItem("qm_user",  JSON.stringify(userData))
      setUser(userData)
      return { error: null }
    } catch {
      return { error: "Could not reach server. Is the backend running?" }
    }
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.detail || "Sign in failed." }

      const userData = { id: data.user_id, email: data.email, name: data.email }
      localStorage.setItem("qm_token", data.access_token)
      localStorage.setItem("qm_user",  JSON.stringify(userData))
      setUser(userData)
      return { error: null }
    } catch {
      return { error: "Could not reach server. Is the backend running?" }
    }
  }, [])

  // ── Google OAuth (Supabase redirect flow) ────────────────────────────────────

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseReady) {
      return { error: "Supabase is not configured. Cannot use Google sign-in." }
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      })
      if (error) return { error: error.message || "Google sign-in failed." }
      return { error: null }
    } catch (e) {
      return { error: e.message || "Google sign-in failed." }
    }
  }, [])

  // ── Sign Out ─────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    localStorage.removeItem("qm_token")
    localStorage.removeItem("qm_user")
    if (isSupabaseReady) await supabase.auth.signOut().catch(() => {})
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error: null,
      isAuthenticated: !!user,
      isSupabaseReady,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
