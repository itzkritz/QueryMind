/**
 * supabaseClient.js
 * -----------------
 * Initialises the Supabase JS client using Vite environment variables.
 *
 * Required env vars (create client/.env):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-key>
 *
 * If the variables are missing the app falls back to a null client so that
 * the UI still renders in demo / development mode.
 */

import { createClient } from "@supabase/supabase-js"

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || ""
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

export const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // picks up OAuth redirect tokens from the URL
      },
    })
  : null   // null → demo mode, no auth calls will be made

export const isSupabaseReady = Boolean(supabase)
