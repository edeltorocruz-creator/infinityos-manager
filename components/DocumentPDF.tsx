// DocumentPDF.tsx — Professional PDF for Quotes and Invoices
// Works for ALL business types: wrap, cleaning, remodeling, landscaping, general
// Logo: text-based monogram (works without image files)

import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Rect } from '@react-pdf/renderer'

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  black:    '#111827',
  darkBg:   '#0f1117',
  gray:     '#6b7280',
  grayMid:  '#9ca3af',
  grayLight:'#f3f4f6',
  grayBorder:'#e5e7eb',
  orange:   '#f97316',
  orangeDeep:'#ea580c',
  orangeLight:'#fff7ed',
  orangeBorder:'#fed7aa',
  green:    '#16a34a',
  greenLight:'#f0fdf4',
  blue:     '#1d4ed8',
  blueLight:'#eff6ff',
  white:    '#ffffff',
  red:      '#dc2626',
}

const S = StyleSheet.create({
  page:         { fontFamily:'Helvetica', fontSize:9, color:C.black, backgroundColor:C.white, padding:0 },

  // ── Header ──
  header:       { backgroundColor:C.darkBg, padding:'28 36 24', flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  logoArea:     { flexDirection:'row', alignItems:'flex-start', gap:14 },
  logoBox:      { width:48, height:48, borderRadius:10, backgroundColor:C.orange, alignItems:'center', justifyContent:'center' },
  logoText:     { fontSize:20, fontFamily:'Helvetica-Bold', color:C.white, letterSpacing:-1 },
  bizBlock:     { flexDirection:'column', gap:3, paddingTop:2 },
  bizName:      { fontSize:18, fontFamily:'Helvetica-Bold', color:C.white, letterSpacing:-0.5 },
  bizSub:       { fontSize:8, color:C.grayMid, marginTop:1 },
  bizContact:   { fontSize:7.5, color:'#9ca3af', marginTop:1 },
  headerRight:  { alignItems:'flex-end', gap:3 },
  docLabel:     { fontSize:32, fontFamily:'Helvetica-Bold', color:C.orange, letterSpacing:2 },
  docNum:       { fontSize:9, color:'#d1d5db', fontFamily:'Helvetica-Bold', marginTop:2 },
  docMeta:      { fontSize:7.5, color:'#9ca3af' },
  badge:        { fontSize:7, fontFamily:'Helvetica-Bold', padding:'3 8', borderRadius:10, marginTop:4, color:C.white, backgroundColor:'#374151' },
  badgeApproved:{ backgroundColor:'#16a34a' },
  badgePaid:    { backgroundColor:'#16a34a' },
  badgeSent:    { backgroundColor:'#2563eb' },
  badgeDeposit: { backgroundColor:C.orange },

  // ── Bill To ──
  billRow:      { backgroundColor:C.orangeLight, padding:'14 36', flexDirection:'row', justifyContent:'space-between', borderBottom:`1 solid ${C.orangeBorder}` },
  billLeft:     { flexDirection:'column' },
  billLabel:    { fontSize:7, fontFamily:'Helvetica-Bold', color:C.orange, textTransform:'uppercase', letterSpacing:1, marginBottom:4 },
  billName:     { fontSize:13, fontFamily:'Helvetica-Bold', color:C.black },
  billDetail:   { fontSize:8, color:'#4b5563', marginTop:2 },
  billRight:    { alignItems:'flex-end' },
  detailLabel:  { fontSize:7, fontFamily:'Helvetica-Bold', color:C.orange, textTransform:'uppercase', letterSpacing:1, marginBottom:4 },
  detailRow:    { fontSize:8, color:C.gray, marginTop:2 },
  detailVal:    { fontFamily:'Helvetica-Bold', color:C.black },

  // ── Line Items ──
  tableWrap:    { padding:'16 36 0' },
  tHead:        { flexDirection:'row', borderBottom:`2 solid ${C.black}`, paddingBottom:6, marginBottom:2 },
  thDesc:       { flex:4, fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase', letterSpacing:0.5 },
  thQty:        { width:44, textAlign:'center', fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase' },
  thUnit:       { width:64, textAlign:'right', fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase' },
  thAmt:        { width:72, textAlign:'right', fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase' },
  tRow:         { flexDirection:'row', paddingVertical:8, borderBottom:`1 solid ${C.grayBorder}`, alignItems:'flex-start' },
  tRowAlt:      { backgroundColor:C.grayLight },
  tdDesc:       { flex:4 },
  tdLabel:      { fontSize:9, fontFamily:'Helvetica-Bold', color:C.black },
  tdSub:        { fontSize:7.5, color:C.gray, marginTop:2 },
  tdQty:        { width:44, textAlign:'center', fontSize:9, color:'#374151' },
  tdUnit:       { width:64, textAlign:'right', fontSize:9, color:'#374151' },
  tdAmt:        { width:72, textAlign:'right', fontSize:9, fontFamily:'Helvetica-Bold', color:C.black },

  // ── Totals ──
  totalsWrap:   { padding:'12 36 16', alignItems:'flex-end' },
  totalsBox:    { width:256 },
  totRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:4, borderBottom:`1 solid ${C.grayBorder}` },
  totLabel:     { fontSize:8, color:C.gray },
  totVal:       { fontSize:8, fontFamily:'Helvetica-Bold' },
  discLabel:    { fontSize:8, fontFamily:'Helvetica-Bold', color:C.green },
  discVal:      { fontSize:8, fontFamily:'Helvetica-Bold', color:C.green },
  totalBar:     { flexDirection:'row', justifyContent:'space-between', backgroundColor:C.black, padding:'9 13', borderRadius:7, marginTop:4 },
  totalLabel:   { fontSize:11, fontFamily:'Helvetica-Bold', color:C.white },
  totalVal:     { fontSize:15, fontFamily:'Helvetica-Bold', color:C.orange },
  depBox:       { backgroundColor:C.orangeLight, border:`1 solid ${C.orangeBorder}`, borderRadius:7, padding:'10 13', marginTop:6, gap:5 },
  depRow:       { flexDirection:'row', justifyContent:'space-between' },
  depLabel:     { fontSize:8, fontFamily:'Helvetica-Bold', color:C.orangeDeep },
  depVal:       { fontSize:10, fontFamily:'Helvetica-Bold', color:C.orangeDeep },
  balLabel:     { fontSize:8, fontFamily:'Helvetica-Bold', color:C.gray },
  balVal:       { fontSize:9, fontFamily:'Helvetica-Bold', color:C.black },
  paidStamp:    { textAlign:'center', fontSize:24, fontFamily:'Helvetica-Bold', color:C.green, letterSpacing:4, marginTop:8 },

  // ── Included Concepts (price justification, NO amounts) ──
  inclBox:      { margin:'0 36 10', backgroundColor:C.grayLight, border:`1 solid ${C.grayBorder}`, borderRadius:7, padding:'10 14' },
  inclLabel:    { fontSize:7.5, fontFamily:'Helvetica-Bold', color:C.orangeDeep, textTransform:'uppercase', letterSpacing:1, marginBottom:6 },
  inclGrid:     { flexDirection:'row', flexWrap:'wrap' },
  inclItem:     { width:'50%', flexDirection:'row', marginBottom:4, paddingRight:8 },
  inclCheck:    { fontSize:8, color:C.green, marginRight:5, fontFamily:'Helvetica-Bold' },
  inclText:     { fontSize:8, color:'#374151', flex:1 },

  // ── Notes / Warranty / Terms ──
  sec:          { padding:'0 36 10' },
  noteBox:      { backgroundColor:C.blueLight, border:`1 solid #bfdbfe`, borderRadius:6, padding:'8 12', marginBottom:10 },
  noteLabel:    { fontSize:7, fontFamily:'Helvetica-Bold', color:C.blue, textTransform:'uppercase', letterSpacing:0.5, marginBottom:3 },
  noteText:     { fontSize:8, color:'#1e40af' },
  warrantyBox:  { backgroundColor:C.greenLight, border:`1 solid #bbf7d0`, borderRadius:6, padding:'8 12', marginBottom:10 },
  warrantyLabel:{ fontSize:7, fontFamily:'Helvetica-Bold', color:C.green, textTransform:'uppercase', letterSpacing:0.5, marginBottom:3 },
  warrantyText: { fontSize:8, color:'#166534' },
  termsLabel:   { fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  termsText:    { fontSize:7.5, color:C.gray, lineHeight:1.6 },
  payBox:       { backgroundColor:C.grayLight, borderRadius:6, padding:'8 12', marginBottom:10 },
  payLabel:     { fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase', letterSpacing:0.5, marginBottom:3 },
  payText:      { fontSize:8, color:'#374151' },
  socialBox:    { flexDirection:'row', gap:16, marginTop:3 },
  socialText:   { fontSize:7.5, color:C.orange },

  // ── Signature ──
  sigBox:       { margin:'0 36 14', border:`1.5 dashed ${C.grayBorder}`, borderRadius:7, padding:'12 16' },
  sigLabel:     { fontSize:7, fontFamily:'Helvetica-Bold', color:C.gray, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 },
  sigGrid:      { flexDirection:'row', gap:20 },
  sigField:     { flex:1 },
  sigLine:      { borderBottom:`1 solid #d1d5db`, height:24, marginBottom:3 },
  sigCaption:   { fontSize:7, color:C.gray },

  // ── Footer ──
  footer:       { backgroundColor:C.darkBg, padding:'10 36', alignItems:'center' },
  footerTop:    { fontSize:8, color:C.grayMid, textAlign:'center', marginBottom:3 },
  footerSub:    { fontSize:7, color:'#4b5563', textAlign:'center' },
})

// ── Types ────────────────────────────────────────────────────────────────────
export interface DocBusiness {
  name:         string
  logoText:     string    // 2-letter monogram: "IW", "EC", etc.
  phone:        string
  email:        string
  website?:     string
  address?:     string
  instagram?:   string
  facebook?:    string
  warrantyText: string
  terms:        string
}

export interface DocClient {
  name: string; company?: string; phone?: string; email?: string; address?: string
}

export interface DocLineItem {
  label: string; description?: string; qty: number
  unitPrice: number; subtotal: number; unit?: string
}

export interface DocData {
  type:          'quote' | 'invoice'
  docNumber:     string
  linkedNumber?: string
  status:        string
  date:          string
  validUntil?:   string
  dueDate?:      string
  business:      DocBusiness
  client:        DocClient
  items:         DocLineItem[]
  subtotal:      number
  tax:           number
  taxRate?:      number
  total:         number
  deposit:       number
  balance:       number
  notes?:        string
  isFullyPaid?:  boolean
  isDepositPaid?:boolean
  paymentMethod?:string
  depositRate?:  number
  discount?:     { label: string; amount: number }
  includedConcepts?: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n)

function badgeStyle(status: string) {
  if (status === 'approved' || status === 'paid') return [S.badge, S.badgeApproved]
  if (status === 'sent')          return [S.badge, S.badgeSent]
  if (status === 'deposit_paid')  return [S.badge, S.badgeDeposit]
  return [S.badge]
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DocumentPDF({ doc }: { doc: DocData }) {
  const isInvoice  = doc.type === 'invoice'
  const depRate    = doc.depositRate ?? 50
  const taxPct     = doc.taxRate != null ? (doc.taxRate * 100).toFixed(2) : '6.75'
  const hasSocial  = doc.business.instagram || doc.business.facebook

  return (
    <Document title={`${isInvoice ? 'Invoice' : 'Quote'} — ${doc.docNumber}`} author={doc.business.name}>
      <Page size="LETTER" style={S.page}>

        {/* ── HEADER ── */}
        <View style={S.header}>
          <View style={S.logoArea}>
            {/* Monogram Logo Box */}
            <View style={S.logoBox}>
              <Text style={S.logoText}>{doc.business.logoText || doc.business.name.slice(0,2).toUpperCase()}</Text>
            </View>
            <View style={S.bizBlock}>
              <Text style={S.bizName}>{doc.business.name}</Text>
              {doc.business.address && <Text style={S.bizSub}>{doc.business.address}</Text>}
              {doc.business.phone   && <Text style={S.bizContact}>{doc.business.phone}</Text>}
              {doc.business.email   && <Text style={S.bizContact}>{doc.business.email}</Text>}
              {doc.business.website && <Text style={S.bizContact}>{doc.business.website}</Text>}
              {hasSocial && (
                <View style={S.socialBox}>
                  {doc.business.instagram && <Text style={S.socialText}>{doc.business.instagram}</Text>}
                  {doc.business.facebook  && <Text style={S.socialText}>fb: {doc.business.facebook}</Text>}
                </View>
              )}
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.docLabel}>{isInvoice ? 'INVOICE' : 'QUOTE'}</Text>
            <Text style={S.docNum}>{doc.docNumber}</Text>
            {doc.linkedNumber && <Text style={S.docMeta}>{isInvoice?'Quote':'Ref'}: {doc.linkedNumber}</Text>}
            <Text style={S.docMeta}>Date: {doc.date}</Text>
            {doc.validUntil && <Text style={S.docMeta}>Valid: {doc.validUntil}</Text>}
            {doc.dueDate    && <Text style={S.docMeta}>Due: {doc.dueDate}</Text>}
            <Text style={badgeStyle(doc.status)}>{doc.status.replace(/_/g,' ').toUpperCase()}</Text>
          </View>
        </View>

        {/* ── BILL TO ── */}
        <View style={S.billRow}>
          <View style={S.billLeft}>
            <Text style={S.billLabel}>Bill To</Text>
            <Text style={S.billName}>{doc.client.name}</Text>
            {doc.client.company && <Text style={S.billDetail}>{doc.client.company}</Text>}
            {doc.client.phone   && <Text style={S.billDetail}>{doc.client.phone}</Text>}
            {doc.client.email   && <Text style={S.billDetail}>{doc.client.email}</Text>}
          </View>
          <View style={S.billRight}>
            <Text style={S.detailLabel}>{isInvoice ? 'Invoice Details' : 'Quote Details'}</Text>
            <Text style={S.detailRow}># <Text style={S.detailVal}>{doc.docNumber}</Text></Text>
            <Text style={S.detailRow}>Tax: <Text style={S.detailVal}>{taxPct}% (NC)</Text></Text>
            {!isInvoice && <Text style={S.detailRow}>Valid: <Text style={S.detailVal}>30 days</Text></Text>}
            {isInvoice && doc.paymentMethod && <Text style={S.detailRow}>Payment: <Text style={S.detailVal}>{doc.paymentMethod}</Text></Text>}
          </View>
        </View>

        {/* ── LINE ITEMS ── */}
        <View style={S.tableWrap}>
          <View style={S.tHead}>
            <Text style={S.thDesc}>Service / Description</Text>
            <Text style={S.thQty}>Qty</Text>
            <Text style={S.thUnit}>Unit $</Text>
            <Text style={S.thAmt}>Amount</Text>
          </View>
          {doc.items.length === 0 ? (
            <View style={S.tRow}><Text style={{...S.tdLabel, color:C.gray}}>No items</Text></View>
          ) : doc.items.map((item, i) => (
            <View key={i} style={[S.tRow, i%2===1 ? S.tRowAlt : {}]}>
              <View style={S.tdDesc}>
                <Text style={S.tdLabel}>{item.label}</Text>
                {item.description ? <Text style={S.tdSub}>{item.description}</Text> : null}
              </View>
              <Text style={S.tdQty}>{item.qty ?? 1}</Text>
              <Text style={S.tdUnit}>{fmt(item.unitPrice ?? 0)}</Text>
              <Text style={S.tdAmt}>{fmt(item.subtotal ?? 0)}</Text>
            </View>
          ))}
        </View>

        {/* ── TOTALS ── */}
        <View style={S.totalsWrap}>
          <View style={S.totalsBox}>
            <View style={S.totRow}>
              <Text style={S.totLabel}>Subtotal</Text>
              <Text style={S.totVal}>{fmt(doc.subtotal)}</Text>
            </View>
            {doc.discount && doc.discount.amount > 0 && (
              <View style={S.totRow}>
                <Text style={S.discLabel}>{doc.discount.label}</Text>
                <Text style={S.discVal}>-{fmt(doc.discount.amount)}</Text>
              </View>
            )}
            <View style={S.totRow}>
              <Text style={S.totLabel}>Tax ({taxPct}% NC)</Text>
              <Text style={S.totVal}>{fmt(doc.tax)}</Text>
            </View>
            <View style={S.totalBar}>
              <Text style={S.totalLabel}>TOTAL</Text>
              <Text style={S.totalVal}>{fmt(doc.total)}</Text>
            </View>
            <View style={S.depBox}>
              <View style={S.depRow}>
                <Text style={S.depLabel}>
                  {doc.isDepositPaid||doc.isFullyPaid?'✓ ':''}{depRate}% Deposit
                </Text>
                <Text style={S.depVal}>{fmt(doc.deposit)}</Text>
              </View>
              <View style={S.depRow}>
                <Text style={S.balLabel}>
                  {doc.isFullyPaid ? '✓ PAID IN FULL' : 'Balance Due on Completion'}
                </Text>
                <Text style={S.balVal}>{fmt(doc.balance)}</Text>
              </View>
            </View>
            {doc.isFullyPaid && <Text style={S.paidStamp}>PAID IN FULL</Text>}
          </View>
        </View>

        {/* ── THIS PRICE INCLUDES (justification — concepts only, NO amounts) ── */}
        {doc.includedConcepts && doc.includedConcepts.length > 0 && (
          <View style={S.inclBox}>
            <Text style={S.inclLabel}>This Price Includes</Text>
            <View style={S.inclGrid}>
              {doc.includedConcepts.map((c, i) => (
                <View key={i} style={S.inclItem}>
                  <Text style={S.inclCheck}>✓</Text>
                  <Text style={S.inclText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── NOTES ── */}
        {doc.notes ? (
          <View style={S.sec}>
            <View style={S.noteBox}>
              <Text style={S.noteLabel}>Notes</Text>
              <Text style={S.noteText}>{doc.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* ── WARRANTY ── */}
        <View style={S.sec}>
          <View style={S.warrantyBox}>
            <Text style={S.warrantyLabel}>✓ Warranty / Guarantee</Text>
            <Text style={S.warrantyText}>{doc.business.warrantyText}</Text>
          </View>
        </View>

        {/* ── PAYMENT METHODS (invoice) ── */}
        {isInvoice && !doc.isFullyPaid && (
          <View style={S.sec}>
            <View style={S.payBox}>
              <Text style={S.payLabel}>Payment Methods Accepted</Text>
              <Text style={S.payText}>Cash · Check · Zelle · Venmo · Card (fees may apply)     Ref: {doc.docNumber}</Text>
            </View>
          </View>
        )}

        {/* ── TERMS ── */}
        <View style={S.sec}>
          <Text style={S.termsLabel}>Terms & Conditions</Text>
          <Text style={S.termsText}>{doc.business.terms}</Text>
        </View>

        {/* ── SIGNATURE (quote only) ── */}
        {!isInvoice && (
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Client Acceptance — Authorized Signature</Text>
            <View style={S.sigGrid}>
              {['Client Signature', 'Date', 'Printed Name', `Deposit (${fmt(doc.deposit)}) Paid`].map(label => (
                <View key={label} style={S.sigField}>
                  <View style={S.sigLine}/>
                  <Text style={S.sigCaption}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── FOOTER ── */}
        <View style={S.footer}>
          <Text style={S.footerTop}>
            Thank you for your business!  ·  {doc.business.name}  ·  {doc.business.phone}  ·  {doc.business.email}
          </Text>
          {doc.business.website && (
            <Text style={S.footerSub}>{doc.business.website}</Text>
          )}
        </View>

      </Page>
    </Document>
  )
}
