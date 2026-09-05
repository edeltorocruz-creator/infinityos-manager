// app/api/mcp/route.ts
import { NextRequest, NextResponse } from 'next/server'

const MCP_VERSION = '2024-11-05'

interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

const TOOLS: Tool[] = [
  {
    name: 'list_clients',
    description: 'List all clients in Infinity Manager',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_client',
    description: 'Get details of a specific client',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'number', description: 'Client ID' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'create_client',
    description: 'Create a new client',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Client name (required)' },
        contact_name: { type: 'string', description: 'Contact person name' },
        phone: { type: 'string', description: 'Phone number' },
        email: { type: 'string', description: 'Email address' },
        address: { type: 'string', description: 'Physical address' },
        industry: { type: 'string', description: 'Industry type' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['name']
    }
  },
  {
    name: 'list_quotes',
    description: 'List all quotes',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_quote',
    description: 'Create a new quote',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'number', description: 'Client ID' },
        project_desc: { type: 'string', description: 'Project description' },
        subtotal: { type: 'number', description: 'Subtotal amount' },
        status: { type: 'string', description: 'Quote status (Draft, Sent, Accepted)' }
      },
      required: ['client_id', 'subtotal']
    }
  },
  {
    name: 'list_appointments',
    description: 'List all appointments',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_appointment',
    description: 'Create a new appointment',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Appointment title (required)' },
        start_time: { type: 'string', description: 'Start time (ISO format, required)' },
        end_time: { type: 'string', description: 'End time (ISO format, required)' },
        client_id: { type: 'number', description: 'Client ID' },
        location: { type: 'string', description: 'Location' },
        notes: { type: 'string', description: 'Notes' }
      },
      required: ['title', 'start_time', 'end_time']
    }
  },
  {
    name: 'list_expenses',
    description: 'List all expenses',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_expense',
    description: 'Create a new expense',
    inputSchema: {
      type: 'object',
      properties: {
        expense_date: { type: 'string', description: 'Expense date (ISO format, required)' },
        category: { type: 'string', description: 'Category (required)' },
        amount: { type: 'number', description: 'Amount (required)' },
        description: { type: 'string', description: 'Description' },
        vendor: { type: 'string', description: 'Vendor name' },
        notes: { type: 'string', description: 'Notes' }
      },
      required: ['expense_date', 'category', 'amount']
    }
  }
]

async function callInfinityAPI(endpoint: string, method: string, body?: any, token: string = 'cgpt_d788081a8826b0698b10354d2c6bbc755c8879c0d49a8f811b6ca6405aee4fd9') {
  const url = `https://infinity-manager-live.vercel.app/api/chatgpt${endpoint}`
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  return response.json()
}

async function handleToolCall(toolName: string, params: any) {
  switch (toolName) {
    case 'list_clients':
      return await callInfinityAPI('/clients', 'GET')
    
    case 'get_client':
      return { error: 'Not implemented yet' }
    
    case 'create_client':
      return await callInfinityAPI('/clients', 'POST', params)
    
    case 'list_quotes':
      return await callInfinityAPI('/quotes', 'GET')
    
    case 'create_quote':
      return await callInfinityAPI('/quotes', 'POST', params)
    
    case 'list_appointments':
      return await callInfinityAPI('/appointments', 'GET')
    
    case 'create_appointment':
      return await callInfinityAPI('/appointments', 'POST', params)
    
    case 'list_expenses':
      return await callInfinityAPI('/expenses', 'GET')
    
    case 'create_expense':
      return await callInfinityAPI('/expenses', 'POST', params)
    
    default:
      return { error: 'Unknown tool' }
  }
}

export async function POST(request: NextRequest) {
  const body: MCPRequest = await request.json()

  switch (body.method) {
    case 'initialize':
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'Infinity Manager MCP',
            version: '1.0.0'
          }
        }
      })

    case 'tools/list':
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          tools: TOOLS
        }
      })

    case 'tools/call':
      const result = await handleToolCall(body.params.name, body.params.arguments)
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result)
            }
          ]
        }
      })

    default:
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      }, { status: 404 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    name: 'Infinity Manager MCP Server',
    version: '1.0.0',
    status: 'ready',
    tools: TOOLS.length
  })
}
