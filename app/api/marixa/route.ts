import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  const { command, history } = await req.json()

  if (!command) {
    return NextResponse.json({ error: 'Command is required' }, { status: 400 })
  }

  try {
    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get all clients, appointments, and quotes for context
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .order('created_at', { ascending: false })

    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, client_id, date, description')
      .order('date', { ascending: false })

    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, client_id, total, created_at')
      .order('created_at', { ascending: false })

    // Create prompt for Gemini
    const systemPrompt = `You are Marixa, an AI assistant for Infinity Wrap Design.
You help manage:
- Clients: name, email, phone
- Appointments: create, view, modify
- Quotes: generate, view
- Expenses: track and categorize
- Business queries: client status, payment status, etc.

CONSTRAINTS:
- You CANNOT delete anything
- You can only CREATE, READ, UPDATE
- Respond in Spanish when the user writes in Spanish
- Be concise and direct

User's current data:
Clients: ${JSON.stringify(clients || [])}
Appointments: ${JSON.stringify(appointments || [])}
Recent Quotes: ${JSON.stringify(quotes?.slice(0, 5) || [])}

When the user asks you to:
1. Create an appointment: respond with { action: "create_appointment", client_id: "...", date: "...", description: "..." }
2. Query clients: respond with { action: "query_clients", filters: {...} }
3. Get unpaid clients: respond with { action: "get_unpaid_clients" }
4. Create a quote: respond with { action: "create_quote", client_id: "...", items: [...], total: ... }
5. Register a new client: respond with { action: "create_client", name: "...", phone: "...", email: "..." }
6. Any other query: respond naturally

Always respond with valid JSON when an action is needed.
Use the conversation history to resolve references like "her", "that client", or data given in earlier messages.

Conversation history:
${(Array.isArray(history) ? history.slice(-10) : []).map((m: any) => `${m.role}: ${m.content}`).join('\n')}`

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `System: ${systemPrompt}\n\nUser command: ${command}`,
            },
          ],
        },
      ],
    })

    const responseText = result.response.text()
    let parsedAction = null

    // Try to parse JSON action from response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedAction = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      // Response is not JSON, just return as text
    }

    // If action is parsed, execute it
    if (parsedAction) {
      const executionResult = await executeAction(parsedAction, supabase)
      const confirmations: Record<string, string> = {
        create_client: `✅ Cliente "${parsedAction.name || ''}" registrado.`,
        create_appointment: '✅ Cita creada.',
        create_quote: '✅ Cotización creada (borrador).',
      }
      const cleanText = responseText.replace(/```[\s\S]*?```|\{[\s\S]*\}/g, '').trim()
      const message = executionResult?.error
        ? `⚠️ No pude completarlo: ${executionResult.error}`
        : confirmations[parsedAction.action] || cleanText || responseText
      return NextResponse.json({
        success: true,
        action: parsedAction.action,
        result: executionResult,
        message,
      })
    }

    // Otherwise, return the text response
    return NextResponse.json({
      success: true,
      message: responseText,
      action: 'query',
    })
  } catch (error) {
    console.error('Marixa error:', error)
    return NextResponse.json(
      { error: 'Failed to process command', details: String(error) },
      { status: 500 }
    )
  }
}

async function executeAction(action: any, supabase: any) {
  switch (action.action) {
    case 'query_clients': {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
      return { data, error: error?.message || null }
    }

    case 'get_unpaid_clients': {
      const { data: unpaidAppointments, error } = await supabase
        .from('appointments')
        .select('client_id, paid, clients(name, email, phone)')
        .eq('paid', false)
      return { unpaidAppointments, error: error?.message || null }
    }

    case 'create_appointment': {
      const { data, error } = await supabase.from('appointments').insert([
        {
          client_id: action.client_id,
          date: action.date,
          description: action.description,
          status: 'pending',
        },
      ])
      return { created: data?.[0] || null, error: error?.message || null }
    }

    case 'create_quote': {
      const { data, error } = await supabase.from('quotes').insert([
        {
          client_id: action.client_id,
          items: action.items || [],
          total: action.total || 0,
          status: 'draft',
        },
      ])
      return { created: data?.[0] || null, error: error?.message || null }
    }

    case 'create_client': {
      const { data, error } = await supabase.from('clients').insert([
        {
          name: action.name,
          phone: action.phone || null,
          email: action.email || null,
        },
      ]).select()
      return { created: data?.[0] || null, error: error?.message || null }
    }

    default:
      return { error: 'Unknown action' }
  }
}
