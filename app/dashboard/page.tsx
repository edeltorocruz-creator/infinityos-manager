'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({ quotes: 0, clients: 0, projects: 0, revenue: 0, pendingQuotes: 0 })
  const [recentQuotes, setRecentQuotes] = useState<any[]>([])

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const [quotesRes, clientsRes, projectsRes, recentRes] = await Promise.all([
      supabase.from('quotes').select('status, total'),
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('projects').select('id', { count: 'exact' }),
      supabase.from('quotes').select('*, client:clients(name)').order('created_at', { ascending: false }).limit(5)
    ])

    const quotes = quotesRes.data || []
    const revenue = quotes.filter(q => q.status === 'approved').reduce((s, q) => s + q.total, 0)
    const pending = quotes.filter(q => q.status === 'draft' || q.status === 'sent').length

    setStats({
      quotes: quotes.length,
      clients: clientsRes.count || 0,
      projects: projectsRes.count || 0,
      revenue,
      pendingQuotes: pending,
    })
    setRecentQuotes(recentRes.data || [])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Infinity Wrap Design — Operations Overview</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Quotes" value={stats.quotes} color="text-gray-900" />
          <StatCard label="Pending Quotes" value={stats.pendingQuotes} color="text-blue-600" />
          <StatCard label="Clients" value={stats.clients} color="text-purple-600" />
          <StatCard label="Revenue Closed" value={formatCurrency(stats.revenue)} color="text-orange-500" isText />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Recent Quotes</h2>
              <Link href="/quotes" className="text-orange-500 text-sm hover:underline">View all →</Link>
            </div>
            {recentQuotes.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No quotes yet</p>
            ) : (
              <div className="space-y-3">
                {recentQuotes.map(q => (
                  <div key={q.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{q.quote_number}</p>
                      <p className="text-gray-400 text-xs">{q.client?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-sm">{formatCurrency(q.total)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        q.status === 'approved' ? 'bg-green-100 text-green-700' :
                        q.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{q.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/quotes/new" className="flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="font-medium text-orange-700">Create New Quote</p>
                  <p className="text-orange-500 text-xs">Fleet graphics, wraps, murals</p>
                </div>
              </Link>
              <Link href="/clients" className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                <span className="text-2xl">👤</span>
                <div>
                  <p className="font-medium text-purple-700">Add Client</p>
                  <p className="text-purple-500 text-xs">New customer record</p>
                </div>
              </Link>
              <Link href="/leads" className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="font-medium text-blue-700">Track Lead</p>
                  <p className="text-blue-500 text-xs">Sales pipeline</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, isText }: any) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-gray-500 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
