/**
 * useAuth.jsx
 * -----------
 * Authentication context that wraps Supabase Auth.
 *
 * Supports:
 *   - Email / password sign-in & sign-up
 *   - Google OAuth (redirects via Supabase)
 *   - Automatic JWT token forwarding (stored as "supabase_token")
 *   - Graceful offline / demo mode when Supabase is not configured
 */

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { supabase, isSupabaseReady } from "@/lib/supabaseClient"

const AuthContext = createContext(null)

// ── Helpers ──────────────────────────────────────────────────────────────────

function sessionToUser(session) {
  if (!session?.user) return null
  return {
    id:     session.user.id,
    email:  session.user.email,
    name:   session.user.user_metadata?.full_name || session.user.email,
    avatar: session.user.user_metadata?.avatar_url || null,
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Sync token helper
  const syncToken = useCallback((session) => {
    if (session?.access_token) {
      localStorage.setItem("supabase_token", session.access_token)
    } else {
      localStorage.removeItem("supabase_token")
    }
    setUser(sessionToUser(session))
  }, [])

  useEffect(() => {
    if (!isSupabaseReady) {
      // Demo mode — treat as authenticated with a placeholder user
      setUser({ id: "demo", email: "demo@querymind.dev", name: "Demo User" })
      setLoading(false)
      return
    }

    // Restore session on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncToken(session)
      setLoading(false)
    })

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncToken(session)
    })

    return () => subscription.unsubscribe()
  }, [syncToken])

  // ── Auth Actions ────────────────────────────────────────────────────────────

  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseReady) return { error: "Supabase not configured" }
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    return { error }
  }, [])

  const signUp = useCallback(async ({ email, password }) => {
    if (!isSupabaseReady) return { error: "Supabase not configured" }
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    return { error }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseReady) return { error: "Supabase not configured" }
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) setError(error.message)
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseReady) await supabase.auth.signOut()
    localStorage.removeItem("supabase_token")
    setUser(null)
  }, [])

  // Legacy compat
  const login  = useCallback((token) => {
    localStorage.setItem("supabase_token", token)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      setUser({ id: payload.sub, email: payload.email || "user@querymind.dev", name: payload.email })
    } catch {
      setUser({ id: "user", email: "user@querymind.dev", name: "User" })
    }
  }, [])

  const logout = signOut

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      isAuthenticated: !!user,
      isSupabaseReady,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      login,   // legacy compat
      logout,
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
