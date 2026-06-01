'use client'

import React from 'react'
import { Quote, QuoteItem } from '@/types'
import { formatCurrency, SERVICE_LABELS, VEHICLE_LABELS, TAX_RATE } from '@/lib/quote-engine'

interface QuotePDFProps {
  quote: Quote
  clientName: string
  clientEmail?: string
  clientPhone?: string
  clientCompany?: string
}

export const QuotePDF = React.forwardRef<HTMLDivElement, QuotePDFProps>(
  ({ quote, clientName, clientEmail, clientPhone, clientCompany }, ref) => {
    const expiresDate = new Date()
    expiresDate.setDate(expiresDate.getDate() + (quote.valid_days || 30))

    return (
      <div ref={ref} className="bg-white p-10 max-w-4xl mx-auto font-sans text-gray-800">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-10 pb-6 border-b-4 border-orange-500">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">INFINITY WRAP DESIGN</h1>
            <p className="text-orange-500 font-semibold text-lg">Professional Vehicle Wraps & Graphics</p>
            <p className="text-gray-500 text-sm mt-1">North Carolina</p>
            <p className="text-gray-500 text-sm">edeltorocruz@gmail.com</p>
          </div>
          <div className="text-right">
            <div className="bg-orange-500 text-white px-6 py-3 rounded-lg">
              <p className="text-sm font-medium uppercase tracking-wide">Quote</p>
              <p className="text-2xl font-bold">{quote.quote_number}</p>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              Date: {new Date(quote.created_at).toLocaleDateString('en-US')}
            </p>
            <p className="text-gray-500 text-sm">
              Valid until: {expiresDate.toLocaleDateString('en-US')}
            </p>
          </div>
        </div>

        {/* CLIENT INFO */}
        <div className="mb-8 bg-gray-50 p-5 rounded-lg">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Quote Prepared For</h2>
          <p className="font-bold text-lg text-gray-900">{clientName}</p>
          {clientCompany && <p className="text-gray-600">{clientCompany}</p>}
          {clientEmail && <p className="text-gray-600">{clientEmail}</p>}
          {clientPhone && <p className="text-gray-600">{clientPhone}</p>}
        </div>

        {/* ITEMS TABLE */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left py-3 px-4 text-sm font-semibold">Service Description</th>
              <th className="text-center py-3 px-4 text-sm font-semibold">Material</th>
              <th className="text-center py-3 px-4 text-sm font-semibold">Qty</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Unit Price</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item: QuoteItem, index: number) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-4 px-4">
                  <p className="font-semibold text-gray-900">
                    {SERVICE_LABELS[item.service_type] || item.service_type}
                    {item.vehicle_type !== 'any' && ` — ${VEHICLE_LABELS[item.vehicle_type] || item.vehicle_type}`}
                  </p>
                  <p className="text-gray-500 text-sm">{item.description}</p>
                  {item.sq_ft && <p className="text-gray-400 text-xs">{item.sq_ft} sq ft × ${item.sq_ft > 0 ? (item.unit_price / item.sq_ft).toFixed(2) : 0}/sq ft</p>}
                  {item.discount_pct > 0 && (
                    <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded mt-1">
                      Fleet discount: {item.discount_pct}% off
                    </span>
                  )}
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">
                    {item.material}
                  </span>
                </td>
                <td className="py-4 px-4 text-center text-gray-700">{item.quantity}</td>
                <td className="py-4 px-4 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                <td className="py-4 px-4 text-right font-semibold text-gray-900">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Tax (NC {(TAX_RATE * 100).toFixed(2)}%)</span>
              <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
            </div>
            <div className="flex justify-between py-3 bg-orange-500 text-white px-3 rounded-lg mt-2">
              <span className="font-bold text-lg">TOTAL</span>
              <span className="font-bold text-lg">{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>

        {/* NOTES */}
        {quote.notes && (
          <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <p className="text-sm font-semibold text-yellow-800 mb-1">Notes</p>
            <p className="text-gray-700 text-sm">{quote.notes}</p>
          </div>
        )}

        {/* TERMS */}
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm">Payment Terms</h3>
            <p className="text-gray-600 text-sm">• 50% deposit required to schedule</p>
            <p className="text-gray-600 text-sm">• 50% balance due upon completion</p>
            <p className="text-gray-600 text-sm">• Accepted: Cash, Check, Zelle, Card</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2 text-sm">Warranty</h3>
            <p className="text-gray-600 text-sm">• Premium material: 3–5 years</p>
            <p className="text-gray-600 text-sm">• Installation: 12 months</p>
            <p className="text-gray-600 text-sm">• Against defects & peeling</p>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="grid grid-cols-2 gap-10 mt-10 pt-6 border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-500 mb-6">Authorized by Infinity Wrap Design</p>
            <div className="border-b-2 border-gray-400 mb-1"></div>
            <p className="text-xs text-gray-400">Signature & Date</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-6">Client Acceptance</p>
            <div className="border-b-2 border-gray-400 mb-1"></div>
            <p className="text-xs text-gray-400">Signature & Date</p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center mt-8 pt-4 border-t border-gray-100">
          <p className="text-orange-500 font-semibold">INFINITY WRAP DESIGN</p>
          <p className="text-gray-400 text-xs">Thank you for your business! This quote is valid for {quote.valid_days || 30} days.</p>
        </div>
      </div>
    )
  }
)

QuotePDF.displayName = 'QuotePDF'
