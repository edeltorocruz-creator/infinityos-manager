import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jrlwzikfjpuvdgykrtnq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybHd6aWtmanB1dmRneWtydG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzAzMTUsImV4cCI6MjA5NTg0NjMxNX0.5qfiQlB5Bp5GrNyRzNpJJu4fbIUBkPBPeBAE4Scn6gw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
