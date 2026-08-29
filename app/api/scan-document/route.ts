import { NextRequest, NextResponse } from 'next/server'

// Server-side proxy for Claude Vision receipt/document OCR.
//
// Why this exists: the browser cannot call api.anthropic.com directly — Anthropic's
// API has no CORS allowance for browser-origin requests and requires a secret API
// key, which must never be shipped to the client (a NEXT_PUBLIC_* key would be
// visible in the bundle to anyone, and could run up real charges on the account).
// This route holds ANTHROPIC_API_KEY server-side only and forwards the image.
//
// Configuration: set ANTHROPIC_API_KEY in Vercel → Environment Variables as a
// Secret (not a NEXT_PUBLIC_ variable — it must stay server-only). Get a key from
// https://console.anthropic.com/settings/keys. Until it's set, this route returns
// a clear "not configured" error instead of failing silently.

const SYSTEM_PROMPTS: Record<string, string> = {
  receipt: 'You are an expense receipt analyzer for Infinity Wrap Design, a vehicle wrap company in North Carolina. Extract information from receipts and return ONLY valid JSON, no markdown, no explanation.',
  quote: 'You are a vendor/supplier quote document analyzer for Infinity Wrap Design, a vehicle wrap company in North Carolina. Extract information from the quote document and return ONLY valid JSON, no markdown, no explanation.',
}

const USER_PROMPTS: Record<string, string> = {
  receipt: `Analyze this receipt and extract the data. Return ONLY this JSON structure:
{
  "vendor": "store or company name",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "description": "brief description of what was purchased (max 60 chars)",
  "items": ["item1", "item2"],
  "category_hint": "one word describing the type: materials, fuel, supplies, equipment, food, or other",
  "confidence": "high|medium|low",
  "notes": "any relevant details"
}
If you cannot read a field clearly, use null. For date, default to today if unclear. Amount must be a number.`,
  quote: `Analyze this vendor/supplier quote document and extract the data. Return ONLY this JSON structure:
{
  "vendor": "company that issued the quote",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "description": "brief description of what the quote is for (max 60 chars)",
  "items": ["item1", "item2"],
  "confidence": "high|medium|low",
  "notes": "any relevant details, validity/expiration date, etc."
}
If you cannot read a field clearly, use null. For date, default to today if unclear. Amount must be a number.`,
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI scanning is not configured yet. Add ANTHROPIC_API_KEY in Vercel Environment Variables to enable it. You can still attach the file and fill in the details manually.' },
      { status: 501 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { base64, mediaType, kind } = body || {}
  if (!base64 || !mediaType) {
    return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
  }

  const promptKind = kind === 'quote' ? 'quote' : 'receipt'

  try {
    const isPdf = mediaType === 'application/pdf'
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPTS[promptKind],
        messages: [{
          role: 'user',
          content: [
            {
              type: isPdf ? 'document' : 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: USER_PROMPTS[promptKind] },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return NextResponse.json({ error: `AI scan failed: ${errText.slice(0, 300)}` }, { status: 502 })
    }

    const data = await anthropicRes.json()
    const text = data.content?.find((c: any) => c.type === 'text')?.text || ''
    return NextResponse.json({ text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error calling AI scan' }, { status: 500 })
  }
}
