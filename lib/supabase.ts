import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ykrtctotaehzhmzbvjrk.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnRjdG90YWVoemhtemJ2anJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNTUzNzksImV4cCI6MjA2MTYzMTM3OX0.UvCRXutjtU7mwq1dbYxiAw_gjRg3UoO'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
