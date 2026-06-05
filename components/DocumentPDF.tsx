// DocumentPDF.tsx — shared PDF template for Quotes and Invoices
// Uses @react-pdf/renderer — works server-side, no Puppeteer needed
// Handles ALL business types: wrap, cleaning, remodeling, landscaping, general

import {
  Document, Page, Text, View, StyleSheet, Font
} from '@react-pdf/renderer'

// ── Styles ──────────────────────────────────────────────────────────────────
const c = {
  black:    '#111827',
  gray:     '#6b7280',
  grayLight:'#f3f4f6',
  grayBorder:'#e5e7eb',
  orange:   '#f97316',
  orangeLight: '#fff7ed',
  green:    '#16a34a',
  white:    '#ffffff',
}

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: c.black, backgroundColor: c.white, padding: 0 },
  // Header
  header:      { backgroundColor: c.black, padding: '28 36', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft:  { flexDirection: 'column', gap: 3 },
  bizName1:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.orange, letterSpacing: 1 },
  bizName2:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.white, letterSpacing: 1 },
  headerMeta:  { fontSize: 8, color: '#9ca3af', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  docType:     { fontSize: 30, fontFamily: 'Helvetica-Bold', color: c.orange, letterSpacing: 2 },
  docNum:      { fontSize: 9, color: '#d1d5db', fontFamily: 'Helvetica-Bold' },
  docMeta:     { fontSize: 8, color: '#9ca3af' },
  statusBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', backgroundColor: '#374151', color: c.white, padding: '3 8', borderRadius: 10, marginTop: 4 },
  statusApproved: { backgroundColor: '#16a34a' },
  statusPaid:     { backgroundColor: '#16a34a' },
  statusSent:     { backgroundColor: '#2563eb' },
  statusDeposit:  { backgroundColor: '#f97316' },
  // Bill To strip
  billStrip:   { backgroundColor: c.orangeLight, padding: '16 36', flexDirection: 'row', justifyContent: 'space-between', borderBottom: `1 solid ${c.grayBorder}` },
  billLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  billName:    { fontSize: 13, fontFamily: 'Helvetica-Bold', color: c.black },
  billDetail:  { fontSize: 8, color: '#4b5563', marginTop: 2 },
  detailRight: { alignItems: 'flex-end' },
  detailRow:   { fontSize: 8, color: c.gray, marginTop: 2 },
  detailVal:   { fontFamily: 'Helvetica-Bold', color: c.black },
  // Line items table
  tableWrap:   { padding: '16 36 0' },
  tableHead:   { flexDirection: 'row', borderBottom: `2 solid ${c.black}`, paddingBottom: 6, marginBottom: 2 },
  thDesc:      { flex: 4, fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase' },
  thQty:       { width: 40, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase' },
  thUnit:      { width: 60, textAlign: 'right', fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase' },
  thAmt:       { width: 70, textAlign: 'right', fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', paddingVertical: 8, borderBottom: `1 solid ${c.grayBorder}`, alignItems: 'flex-start' },
  rowAlt:      { backgroundColor: c.grayLight },
  tdDesc:      { flex: 4 },
  tdLabel:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.black },
  tdSub:       { fontSize: 7.5, color: c.gray, marginTop: 2 },
  tdQty:       { width: 40, textAlign: 'center', fontSize: 9, color: '#374151' },
  tdUnit:      { width: 60, textAlign: 'right', fontSize: 9, color: '#374151' },
  tdAmt:       { width: 70, textAlign: 'right', fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.black },
  // Totals
  totalsWrap:  { padding: '12 36 16', alignItems: 'flex-end' },
  totalsBox:   { width: 240 },
  totRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottom: `1 solid ${c.grayBorder}` },
  totLabel:    { fontSize: 8, color: c.gray },
  totVal:      { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.black, padding: '8 12', borderRadius: 6, marginTop: 4 },
  totalLabel:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.white },
  totalVal:    { fontSize: 14, fontFamily: 'Helvetica-Bold', color: c.orange },
  depositBox:  { backgroundColor: c.orangeLight, borderRadius: 6, padding: '10 12', marginTop: 6, gap: 5 },
  depositRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  depositLabel:{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#c2410c' },
  depositVal:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#c2410c' },
  balanceLabel:{ fontSize: 8, color: '#374151', fontFamily: 'Helvetica-Bold' },
  balanceVal:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.black },
  paidStamp:   { textAlign: 'center', fontSize: 22, fontFamily: 'Helvetica-Bold', color: c.green, letterSpacing: 3, marginTop: 8 },
  // Notes + Terms
  section:     { padding: '0 36 12' },
  noteBox:     { backgroundColor: '#eff6ff', borderRadius: 6, padding: '8 12', marginBottom: 10 },
  noteLabel:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 3 },
  noteText:    { fontSize: 8, color: '#1e40af' },
  warrantyBox: { backgroundColor: '#f0fdf4', borderRadius: 6, padding: '8 12', marginBottom: 10 },
  warrantyLabel:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#15803d', textTransform: 'uppercase', marginBottom: 3 },
  warrantyText: { fontSize: 8, color: '#166534' },
  termsLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase', marginBottom: 4 },
  termsText:   { fontSize: 7.5, color: c.gray, lineHeight: 1.5 },
  // Signature
  sigBox:      { margin: '0 36 16', border: `1.5 dashed ${c.grayBorder}`, borderRadius: 6, padding: '12 16' },
  sigLabel:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase', marginBottom: 10 },
  sigGrid:     { flexDirection: 'row', gap: 24 },
  sigField:    { flex: 1 },
  sigLine:     { borderBottom: `1 solid #d1d5db`, height: 24, marginBottom: 3 },
  sigCaption:  { fontSize: 7, color: c.gray },
  // Payment methods (invoice)
  payBox:      { backgroundColor: c.grayLight, borderRadius: 6, padding: '8 12', marginBottom: 10 },
  payLabel:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.gray, textTransform: 'uppercase', marginBottom: 3 },
  payMethods:  { fontSize: 8, color: '#374151' },
  // Footer
  footer:      { backgroundColor: c.black, padding: '10 36', flexDirection: 'row', justifyContent: 'center' },
  footerText:  { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
})

// ── Types ────────────────────────────────────────────────────────────────────
export interface DocBusiness {
  name: string
  phone: string
  email: string
  address?: string
  warrantyText: string
  terms: string
}

export interface DocClient {
  name: string
  company?: string
  phone?: string
  email?: string
  address?: string
}

export interface DocLineItem {
  label: string
  description?: string
  qty: number
  unitPrice: number
  subtotal: number
  unit?: string
}

export interface DocData {
  type: 'quote' | 'invoice'
  docNumber: string
  linkedNumber?: string   // invoice→quote number or vice versa
  status: string
  date: string
  validUntil?: string     // quote only
  dueDate?: string        // invoice only
  business: DocBusiness
  client: DocClient
  items: DocLineItem[]
  subtotal: number
  tax: number
  taxRate?: number
  total: number
  deposit: number
  balance: number
  notes?: string
  isFullyPaid?: boolean
  isDepositPaid?: boolean
  paymentMethod?: string
  depositRate?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function statusStyle(status: string) {
  if (status === 'approved' || status === 'paid') return [s.statusBadge, s.statusApproved]
  if (status === 'sent') return [s.statusBadge, s.statusSent]
  if (status === 'deposit_paid') return [s.statusBadge, s.statusDeposit]
  return [s.statusBadge]
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toUpperCase()
}

// ── Main PDF Component ───────────────────────────────────────────────────────
export default function DocumentPDF({ doc }: { doc: DocData }) {
  const isInvoice  = doc.type === 'invoice'
  const depRate    = doc.depositRate ?? 50
  const taxPct     = doc.taxRate != null ? (doc.taxRate * 100).toFixed(2) : '6.75'
  const bizLines   = doc.business.name.split(' ')
  // Split business name: first word vs rest (for color effect)
  const biz1       = bizLines[0] ?? doc.business.name
  const biz2       = bizLines.slice(1).join(' ')

  return (
    <Document title={`${doc.type === 'quote' ? 'Quote' : 'Invoice'} — ${doc.docNumber}`} author={doc.business.name}>
      <Page size="LETTER" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.bizName1}>{biz1.toUpperCase()}</Text>
            {biz2 ? <Text style={s.bizName2}>{biz2.toUpperCase()}</Text> : null}
            <Text style={s.headerMeta}>{doc.business.phone}</Text>
            <Text style={s.headerMeta}>{doc.business.email}</Text>
            {doc.business.address && <Text style={s.headerMeta}>{doc.business.address}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.docType}>{isInvoice ? 'INVOICE' : 'QUOTE'}</Text>
            <Text style={s.docNum}>{doc.docNumber}</Text>
            {doc.linkedNumber && (
              <Text style={s.docMeta}>{isInvoice ? 'Quote' : 'Ref'}: {doc.linkedNumber}</Text>
            )}
            <Text style={s.docMeta}>Date: {doc.date}</Text>
            {doc.validUntil && <Text style={s.docMeta}>Valid: {doc.validUntil}</Text>}
            {doc.dueDate    && <Text style={s.docMeta}>Due: {doc.dueDate}</Text>}
            <Text style={statusStyle(doc.status)}>{statusLabel(doc.status)}</Text>
          </View>
        </View>

        {/* ── BILL TO ── */}
        <View style={s.billStrip}>
          <View>
            <Text style={s.billLabel}>Bill To</Text>
            <Text style={s.billName}>{doc.client.name}</Text>
            {doc.client.company && <Text style={s.billDetail}>{doc.client.company}</Text>}
            {doc.client.phone   && <Text style={s.billDetail}>{doc.client.phone}</Text>}
            {doc.client.email   && <Text style={s.billDetail}>{doc.client.email}</Text>}
            {doc.client.address && <Text style={s.billDetail}>{doc.client.address}</Text>}
          </View>
          <View style={s.detailRight}>
            <Text style={s.billLabel}>{isInvoice ? 'Invoice Details' : 'Quote Details'}</Text>
            <Text style={s.detailRow}>
              {isInvoice ? 'Invoice #: ' : 'Quote #: '}
              <Text style={s.detailVal}>{doc.docNumber}</Text>
            </Text>
            <Text style={s.detailRow}>
              Tax Rate: <Text style={s.detailVal}>{taxPct}% (NC)</Text>
            </Text>
            {isInvoice && doc.paymentMethod && (
              <Text style={s.detailRow}>
                Payment: <Text style={s.detailVal}>{doc.paymentMethod}</Text>
              </Text>
            )}
            {!isInvoice && (
              <Text style={s.detailRow}>Valid: <Text style={s.detailVal}>30 days</Text></Text>
            )}
          </View>
        </View>

        {/* ── LINE ITEMS ── */}
        <View style={s.tableWrap}>
          <View style={s.tableHead}>
            <Text style={s.thDesc}>Service / Description</Text>
            <Text style={s.thQty}>Qty</Text>
            <Text style={s.thUnit}>Unit $</Text>
            <Text style={s.thAmt}>Amount</Text>
          </View>
          {doc.items.map((item, i) => (
            <View key={i} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]}>
              <View style={s.tdDesc}>
                <Text style={s.tdLabel}>{item.label}</Text>
                {item.description
                  ? <Text style={s.tdSub}>{item.description}</Text>
                  : null}
              </View>
              <Text style={s.tdQty}>{item.qty ?? 1}</Text>
              <Text style={s.tdUnit}>{fmt(item.unitPrice ?? 0)}</Text>
              <Text style={s.tdAmt}>{fmt(item.subtotal ?? 0)}</Text>
            </View>
          ))}
        </View>

        {/* ── TOTALS ── */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>Subtotal</Text>
              <Text style={s.totVal}>{fmt(doc.subtotal)}</Text>
            </View>
            <View style={s.totRow}>
              <Text style={s.totLabel}>Tax ({taxPct}% NC)</Text>
              <Text style={s.totVal}>{fmt(doc.tax)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>TOTAL</Text>
              <Text style={s.totalVal}>{fmt(doc.total)}</Text>
            </View>
            <View style={s.depositBox}>
              <View style={s.depositRow}>
                <Text style={s.depositLabel}>
                  {doc.isDepositPaid || doc.isFullyPaid ? '✓ ' : ''}{depRate}% Deposit
                </Text>
                <Text style={s.depositVal}>{fmt(doc.deposit)}</Text>
              </View>
              <View style={s.depositRow}>
                <Text style={s.balanceLabel}>
                  {doc.isFullyPaid ? '✓ Balance — PAID IN FULL' : 'Balance Due on Completion'}
                </Text>
                <Text style={s.balanceVal}>{fmt(doc.balance)}</Text>
              </View>
            </View>
            {doc.isFullyPaid && <Text style={s.paidStamp}>PAID IN FULL</Text>}
          </View>
        </View>

        {/* ── NOTES ── */}
        {doc.notes ? (
          <View style={s.section}>
            <View style={s.noteBox}>
              <Text style={s.noteLabel}>Notes</Text>
              <Text style={s.noteText}>{doc.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* ── WARRANTY ── */}
        <View style={s.section}>
          <View style={s.warrantyBox}>
            <Text style={s.warrantyLabel}>✓ Warranty / Guarantee</Text>
            <Text style={s.warrantyText}>{doc.business.warrantyText}</Text>
          </View>
        </View>

        {/* ── PAYMENT METHODS (invoice only) ── */}
        {isInvoice && !doc.isFullyPaid && (
          <View style={s.section}>
            <View style={s.payBox}>
              <Text style={s.payLabel}>Payment Methods Accepted</Text>
              <Text style={s.payMethods}>Cash · Check · Zelle · Venmo · Card    Ref: {doc.docNumber}</Text>
            </View>
          </View>
        )}

        {/* ── TERMS ── */}
        <View style={s.section}>
          <Text style={s.termsLabel}>Terms & Conditions</Text>
          <Text style={s.termsText}>{doc.business.terms}</Text>
        </View>

        {/* ── SIGNATURE (quote) / acceptance area ── */}
        {!isInvoice && (
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>Client Acceptance</Text>
            <View style={s.sigGrid}>
              {['Client Signature', 'Date', 'Printed Name', `Deposit (${fmt(doc.deposit)}) Paid`].map(label => (
                <View key={label} style={s.sigField}>
                  <View style={s.sigLine}/>
                  <Text style={s.sigCaption}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Thank you for your business!  ·  {doc.business.name}  ·  {doc.business.phone}  ·  {doc.business.email}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
