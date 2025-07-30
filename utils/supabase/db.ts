import type { SupabaseClient } from '@supabase/supabase-js'

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Conversation {
  id: string
  user_id: string | null
  title: string | null
  provider: string
  model: string
  created_at: string | null
  updated_at: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: ChatRole
  content: string
  token_count: number | null
  created_at: string | null
}

/**
* Insert a new chat message.
*/
export async function insertMessage(
  client: SupabaseClient<any>,
  data: Omit<Message, 'id' | 'created_at'>,
) {
  return client
    .from('messages')
    .insert(data)
    .select()
    .single()
}

/**
* List all conversations that belong to the current authenticated user (RLS enforced).
*/
export async function listConversationsByUser(
  client: SupabaseClient<any>,
) {
  return client
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
}
