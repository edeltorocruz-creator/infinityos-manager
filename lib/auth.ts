import { supabase } from './supabase'

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
