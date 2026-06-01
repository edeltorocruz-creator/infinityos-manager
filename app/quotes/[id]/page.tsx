'use client'

export const dynamic = 'force-dynamic'


import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Quote, Client } from '@/types'
import { QuotePDF } from '@/components/QuotePDF'
import { formatCurrency } from '@/lib/quote-engine'
import { ArrowLeft, Printer, CheckCircle, XCircle, FolderPlus } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

export default function QuoteDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({ contentRef: printRef })

  useEffect(() => {
    if (id) loadQuote(id as string)
  }, [id])

  async function loadQuote(quoteId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*, client:clients(*)')
      .eq('id', quoteId)
      .single()

    if (!error && data) {
      setQuote(data as any)
      setClient((data as any).client)
    }
    setLoading(false)
  }

  async function updateStatus(status: string) {
    if (!quote) return
    const updates: any = { status }
    if (status === 'approved') updates.accepted_at = new Date().toISOString()
    await supabase.from('quotes').update(updates).eq('id', quote.id)
    setQuote({ ...quote, status: status as any })
  }

  async function convertToProject() {
    if (!quote || !client) return
    const { data, error } = await supabase.from('projects').insert({
      client_id: quote.client_id,
      name: `${client.name} — ${quote.quote_number}`,
      status: 'quoted',
      total_amount: quote.total,
      notes: `Converted from Quote ${quote.quote_number}`,
    }).select().single()

    if (!error && data) {
      await supabase.from('quotes').update({
        project_id: data.id,
        status: 'approved',
        accepted_at: new Date().toISOString()
      }).eq('id', quote.id)
      alert(`✅ Project created successfully!`)
      router.push('/quotes')
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>
  if (!quote) return <div className="flex items-center justify-center min-h-screen text-gray-400">Quote not found</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* TOOLBAR */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => router.push('/quotes')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft size={18} />
            <span className="font-medium">Back to Quotes</span>
          </button>

          <div className="flex items-center gap-3">
            {quote.status === 'draft' || quote.status === 'sent' ? (
              <>
                <button onClick={() => updateStatus('approved')}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button onClick={() => updateStatus('rejected')}
                  className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <XCircle size={16} />
                  Reject
                </button>
              </>
            ) : null}

            {quote.status === 'approved' && !quote.project_id && (
              <button onClick={convertToProject}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <FolderPlus size={16} />
                Convert to Project
              </button>
            )}

            <button onClick={handlePrint}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Printer size={16} />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* PDF PREVIEW */}
      <div className="max-w-4xl mx-auto shadow-xl rounded-xl overflow-hidden">
        <QuotePDF
          ref={printRef}
          quote={quote}
          clientName={client?.name || 'Client'}
          clientEmail={client?.email || undefined}
          clientPhone={client?.phone || undefined}
          clientCompany={client?.company || undefined}
        />
      </div>
    </div>
  )
}
