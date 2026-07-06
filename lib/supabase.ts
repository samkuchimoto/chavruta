/**
 * lib/supabase.ts
 *
 * Three clients, one file. Key fix: all clients now pass 'chavruta' as the
 * second generic type parameter so TypeScript resolves tables from
 * Database['chavruta']['Tables'] instead of defaulting to 'public' (which
 * doesn't exist in our Database type), which caused every .from() call to
 * return type 'never'.
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient }       from '@supabase/supabase-js'
import type { CookieOptions }                       from '@supabase/ssr'
import { config }                                   from '@/lib/config'

// ── Database types ──────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export type Database = {
  chavruta: {
    Views:  Record<string, never>
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          what_i_know: string
          what_i_want: string
          embedding: number[] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: 'active' | 'inactive' | 'canceled' | 'past_due'
          in_queue: boolean
          queued_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          what_i_know: string
          what_i_want: string
          embedding?: number[] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: 'active' | 'inactive' | 'canceled' | 'past_due'
          in_queue?: boolean
          queued_at?: string | null
        }
        Update: {
          display_name?: string
          what_i_know?: string
          what_i_want?: string
          embedding?: number[] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: 'active' | 'inactive' | 'canceled' | 'past_due'
          in_queue?: boolean
          queued_at?: string | null
        }
        Relationships: []
      }
      source_texts: {
        Row: {
          id: string
          title: string
          body_or_link: string
          topic_tag: string | null
          added_at: string
        }
        Insert: {
          id?: string
          title: string
          body_or_link: string
          topic_tag?: string | null
        }
        Update: {
          title?: string
          body_or_link?: string
          topic_tag?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_a: string
          user_b: string
          source_text_id: string | null
          status: 'pending' | 'active' | 'completed' | 'no-show'
          accepted_a: boolean
          accepted_b: boolean
          proposed_slots: string[]
          slot_choice_a: string | null
          slot_choice_b: string | null
          scheduled_at: string | null
          started_at: string | null
          ended_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_a: string
          user_b: string
          source_text_id?: string | null
          status?: 'pending' | 'active' | 'completed' | 'no-show'
          accepted_a?: boolean
          accepted_b?: boolean
          proposed_slots?: string[]
          slot_choice_a?: string | null
          slot_choice_b?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          ended_at?: string | null
        }
        Update: {
          source_text_id?: string | null
          status?: 'pending' | 'active' | 'completed' | 'no-show'
          accepted_a?: boolean
          accepted_b?: boolean
          proposed_slots?: string[]
          slot_choice_a?: string | null
          slot_choice_b?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          ended_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          session_id: string
          sender_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          sender_id: string
          content: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      feedback: {
        Row: {
          id: string
          session_id: string
          user_id: string
          rating: number
          what_emerged: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          rating: number
          what_emerged?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Functions: {
      get_current_session: {
        Args: { p_user_id: string }
        Returns: Database['chavruta']['Tables']['sessions']['Row'][]
      }
      get_queue: {
        Args: Record<string, never>
        Returns: Database['chavruta']['Tables']['profiles']['Row'][]
      }
    }
  }
}

// ── Convenience aliases ─────────────────────────────────────────────────────

export type Profile    = Database['chavruta']['Tables']['profiles']['Row']
export type SourceText = Database['chavruta']['Tables']['source_texts']['Row']
export type Session    = Database['chavruta']['Tables']['sessions']['Row']
export type Message    = Database['chavruta']['Tables']['messages']['Row']
export type Feedback   = Database['chavruta']['Tables']['feedback']['Row']

export type SubscriptionStatus = Profile['subscription_status']
export type SessionStatus      = Session['status']

// ── Errors ───────────────────────────────────────────────────────────────────

export class SupabaseNotConfiguredError extends Error {
  constructor(missing: string) {
    super(
      `[supabase] Cannot create client: ${missing} is not set. ` +
      'Add it to your environment variables (see .env.example).'
    )
    this.name = 'SupabaseNotConfiguredError'
  }
}

// ── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHEMA           = 'chavruta' as const

// ── Browser client ──────────────────────────────────────────────────────────

// Explicit alias — used in return type annotations below so the literal
// 'chavruta' propagates correctly without relying on typeof inference.
type ChavrutaClient = SupabaseClient<Database, 'chavruta'>

export function createBrowserSupabaseClient(): ChavrutaClient {
  if (!config.supabase) {
    throw new SupabaseNotConfiguredError('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON!, {
    db: { schema: SCHEMA },
  }) as unknown as ChavrutaClient
}

// ── Server client ───────────────────────────────────────────────────────────

export function createServerSupabaseClient(): ChavrutaClient {
  if (!config.supabase) {
    throw new SupabaseNotConfiguredError('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // Lazy require — never at module scope. This file is imported by Client
  // Components (for createBrowserSupabaseClient). Importing next/headers at
  // the top level would fail webpack bundling for those components.

  const { cookies } = require('next/headers') as typeof import('next/headers')
  const cookieStore = cookies()

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON!, {
    db: { schema: SCHEMA },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch { /* read-only context */ }
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch { /* read-only context */ }
      },
    },
  }) as unknown as ChavrutaClient
}

// ── Admin client (lazy) ───────────────────────────────────────────────────────

let _adminClient: ChavrutaClient | null = null

function getAdminClient(): ChavrutaClient {
  if (_adminClient) return _adminClient
  if (!config.supabaseAdmin) throw new SupabaseNotConfiguredError('SUPABASE_SERVICE_ROLE_KEY')

  _adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  }) as unknown as ChavrutaClient

  return _adminClient
}

export const supabaseAdmin: ChavrutaClient = new Proxy(
  {} as ChavrutaClient,
  { get(_t, prop, recv) { return Reflect.get(getAdminClient(), prop, recv) } }
)
