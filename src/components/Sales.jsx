import { useState, useEffect } from 'react'
import {
  ShoppingCart, Plus, Minus, Calendar, CheckCircle,
  ChevronDown, Lock, X, TrendingUp, History, Package
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils'

// ── Constants ──────────────────────────────────────────────────────────────
const IFOOD_PLANS = {
  basico:            { label: 'Básico (12%)',                rate: 0.12 },
  entrega:           { label: 'Entrega (27%)',               rate: 0.27 },
  entregaBeneficios: { label: 'Entrega + Benefícios (30%)',  rate: 0.30 },
}

// ── Date helpers ───────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDate = (iso) => {
  const [y, m, day] = iso.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${day}/${names[Number(m) - 1]}/${y}`
}

const fmtDateLong = (iso) => {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const weekdays = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const [, m, d] = iso.split('-')
  const date = new Date(`${iso}T12:00:00`)
  return `${weekdays[date.getDay()]}, ${Number(d)} de ${months[Number(m) - 1]}`
}

// ── Draft helpers (localStorage) ──────────────────────────────────────────
const draftKey = (date, ch) => `bc_sales_${date}_${ch}`
const loadDraft = (date, ch) => {
  try { const s = localStorage.getItem(draftKey(date, ch)); return s ? JSON.parse(s) : {} } catch { return {} }
}
const saveDraft = (date, ch, qty) => {
  try { localStorage.setItem(draftKey(date, ch), JSON.stringify(qty)) } catch { /* quota */ }
}
const clearDraft = (date, ch) => {
  try { localStorage.removeItem(draftKey(date, ch)) } catch { /* ignore */ }
}

// ── Summary calculations ───────────────────────────────────────────────────
function calcSummary(qty, products, totalExpenses, rate = 0) {
  const items = products
    .map(p => { const q = Math.max(0, Number(qty[p.id]) || 0); return { p, q } })
    .filter(({ q }) => q > 0)
  const totalItems = items.reduce((s, { q }) => s + q, 0)
  const revenue    = items.reduce((s, { p, q }) => s + q * p.salePrice, 0)
  const taxa       = revenue * rate
  const netRevenue = revenue - taxa
  const totalCost  = items.reduce((s, { p, q }) => s + q * p.ingredientCost, 0)
  const dailyExp   = totalExpenses / 30
  const grossProfit = netRevenue - totalCost
  const realProfit  = grossProfit - dailyExp
  const margin = revenue > 0 ? (realProfit / revenue) * 100 : 0
  const topProduct = items.length > 0 ? items.reduce((best, i) => i.q > best.q ? i : best, items[0]) : null
  return { items, totalItems, revenue, taxa, netRevenue, totalCost, dailyExp, grossProfit, realProfit, margin, topProduct }
}

function calcSummaryFromItems(dbItems, totalExpenses, rate = 0) {
  const totalItems  = dbItems.reduce((s, i) => s + i.quantidade, 0)
  const revenue     = dbItems.reduce((s, i) => s + i.quantidade * i.preco_venda, 0)
  const taxa        = revenue * rate
  const netRevenue  = revenue - taxa
  const totalCost   = dbItems.reduce((s, i) => s + i.quantidade * i.custo, 0)
  const dailyExp    = totalExpenses / 30
  const grossProfit = netRevenue - totalCost
  const realProfit  = grossProfit - dailyExp
  const margin = revenue > 0 ? (realProfit / revenue) * 100 : 0
  return { totalItems, revenue, taxa, netRevenue, totalCost, dailyExp, grossProfit, realProfit, margin }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function SummaryRow({ label, value, dim, positive, bold }) {
  return (
    <div className="flex justify-between items-center">
      <span className={dim ? 'text-gray-500' : 'text-gray-400'}>{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${
        positive === true ? 'text-green-400' : positive === false ? 'text-red-400' : dim ? 'text-gray-500' : 'text-white'
      }`}>{value}</span>
    </div>
  )
}

function ProductRow({ product: p, qty, rawVal, onRaw, onBlur, onInc, onDec, disabled }) {
  const q = Number(qty) || 0
  const total = q * p.salePrice
  return (
    <div className={`flex items-center gap-3 py-3 border-b border-gray-800/60 last:border-0 ${disabled ? 'opacity-60' : ''}`}>
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
        {p.image
          ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
          : <span className="text-xl">{p.emoji || '🍔'}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{p.name}</p>
        <p className="text-gray-500 text-xs">{formatCurrency(p.salePrice)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onDec} disabled={disabled || q <= 0}
          className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        ><Minus size={13} /></button>
        <input
          type="text" inputMode="numeric"
          value={rawVal !== undefined ? rawVal : (q > 0 ? String(q) : '')}
          onChange={(e) => onRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => onBlur(rawVal !== undefined ? rawVal : String(q))}
          disabled={disabled}
          placeholder="0"
          className="w-12 text-center bg-gray-800 border border-gray-700 rounded-lg py-1 text-white text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors disabled:cursor-not-allowed"
        />
        <button
          onClick={onInc} disabled={disabled}
          className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-orange-500 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        ><Plus size={13} /></button>
      </div>
      <div className="w-20 text-right shrink-0">
        <span className={`text-sm font-bold ${total > 0 ? 'text-orange-400' : 'text-gray-700'}`}>
          {total > 0 ? formatCurrency(total) : '—'}
        </span>
      </div>
    </div>
  )
}

function SummaryModal({ isOpen, onClose, onConfirm, directSummary, ifoodSummary, date, ifoodPlan, saving }) {
  if (!isOpen) return null
  const hasD = directSummary.totalItems > 0
  const hasI = ifoodSummary.totalItems > 0
  const combinedRevenue = directSummary.revenue + ifoodSummary.revenue
  const combinedProfit  = directSummary.realProfit + ifoodSummary.realProfit
  const combinedItems   = directSummary.totalItems + ifoodSummary.totalItems

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl">
          <div>
            <h2 className="text-white font-bold text-lg">Resumo do Dia</h2>
            <p className="text-gray-400 text-sm">{fmtDateLong(date)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Direto */}
          {hasD && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />Vendas Diretas
              </h3>
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                <SummaryRow label="Total de itens" value={`${directSummary.totalItems} itens`} />
                <SummaryRow label="Faturamento bruto" value={formatCurrency(directSummary.revenue)} />
                <SummaryRow label="Custo dos ingredientes" value={`− ${formatCurrency(directSummary.totalCost)}`} dim />
                <SummaryRow label="Lucro bruto" value={formatCurrency(directSummary.grossProfit)} positive={directSummary.grossProfit >= 0} />
                <SummaryRow label="Despesas fixas do dia" value={`− ${formatCurrency(directSummary.dailyExp)}`} dim />
                <div className="border-t border-gray-700 pt-2">
                  <SummaryRow label="Lucro real do dia" value={formatCurrency(directSummary.realProfit)} positive={directSummary.realProfit >= 0} bold />
                  <SummaryRow label="Margem real" value={`${directSummary.margin.toFixed(1)}%`} />
                </div>
                {directSummary.topProduct && (
                  <p className="text-gray-500 text-xs pt-1">⭐ Mais vendido: <span className="text-white">{directSummary.topProduct.p.emoji} {directSummary.topProduct.p.name}</span> ({directSummary.topProduct.q}×)</p>
                )}
              </div>
            </section>
          )}

          {/* iFood */}
          {hasI && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />iFood — {IFOOD_PLANS[ifoodPlan].label}
              </h3>
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                <SummaryRow label="Total de itens" value={`${ifoodSummary.totalItems} itens`} />
                <SummaryRow label="Faturamento bruto" value={formatCurrency(ifoodSummary.revenue)} />
                <SummaryRow label="Taxa iFood cobrada" value={`− ${formatCurrency(ifoodSummary.taxa)}`} dim />
                <SummaryRow label="Valor líquido recebido" value={formatCurrency(ifoodSummary.netRevenue)} />
                <SummaryRow label="Custo dos ingredientes" value={`− ${formatCurrency(ifoodSummary.totalCost)}`} dim />
                <SummaryRow label="Despesas fixas do dia" value={`− ${formatCurrency(ifoodSummary.dailyExp)}`} dim />
                <div className="border-t border-gray-700 pt-2">
                  <SummaryRow label="Lucro real após taxas" value={formatCurrency(ifoodSummary.realProfit)} positive={ifoodSummary.realProfit >= 0} bold />
                  <SummaryRow label="Margem real no iFood" value={`${ifoodSummary.margin.toFixed(1)}%`} />
                </div>
                {ifoodSummary.topProduct && (
                  <p className="text-gray-500 text-xs pt-1">⭐ Mais vendido: <span className="text-white">{ifoodSummary.topProduct.p.emoji} {ifoodSummary.topProduct.p.name}</span> ({ifoodSummary.topProduct.q}×)</p>
                )}
              </div>
            </section>
          )}

          {/* Resumo Geral */}
          {(hasD || hasI) && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-orange-400" />Resumo Geral do Dia
              </h3>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-2 text-sm">
                <SummaryRow label="Total de itens" value={`${combinedItems} itens`} />
                <SummaryRow label="Faturamento total" value={formatCurrency(combinedRevenue)} />
                <SummaryRow label="Lucro total do dia" value={formatCurrency(combinedProfit)} positive={combinedProfit >= 0} bold />
                {hasD && <p className="text-gray-400 text-xs pt-1">🟢 Direto: {formatCurrency(directSummary.revenue)}{combinedRevenue > 0 ? ` (${((directSummary.revenue / combinedRevenue) * 100).toFixed(0)}%)` : ''}</p>}
                {hasI && <p className="text-gray-400 text-xs">🟠 iFood: {formatCurrency(ifoodSummary.revenue)}{combinedRevenue > 0 ? ` (${((ifoodSummary.revenue / combinedRevenue) * 100).toFixed(0)}%)` : ''}</p>}
              </div>
            </section>
          )}

          {!hasD && !hasI && (
            <p className="text-gray-500 text-center py-8 text-sm">Nenhuma venda registrada. Adicione quantidades antes de fechar o dia.</p>
          )}
        </div>

        <div className="p-5 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || (!hasD && !hasI)}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
              : <><CheckCircle size={16} />Confirmar e Fechar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Sales({ enrichedProducts, totalExpenses }) {
  const { user } = useAuth()

  const [date, setDate]               = useState(todayStr)
  const [channel, setChannel]         = useState('direto')
  const [ifoodPlan, setIfoodPlan]     = useState(() => localStorage.getItem('bc_ifood_plan') || 'basico')
  const [directQty, setDirectQty]     = useState({})
  const [ifoodQty, setIfoodQty]       = useState({})
  const [rawVals, setRawVals]         = useState({})
  const [directClosed, setDirectClosed] = useState(false)
  const [ifoodClosed, setIfoodClosed]   = useState(false)
  const [history, setHistory]         = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [expandedDay, setExpandedDay] = useState(null)

  // Persist iFood plan choice
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { localStorage.setItem('bc_ifood_plan', ifoodPlan) }, [ifoodPlan])

  // Load day data when date or user changes
  useEffect(() => {
    if (!user) return
    loadDayData(date)
    setRawVals({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user])

  // Auto-save drafts to localStorage
  useEffect(() => { if (!directClosed) saveDraft(date, 'direto', directQty) }, [directQty, date, directClosed])
  useEffect(() => { if (!ifoodClosed)  saveDraft(date, 'ifood',  ifoodQty)  }, [ifoodQty,  date, ifoodClosed])

  // Load history on mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) loadHistory() }, [user])

  const loadDayData = async (d) => {
    const { data } = await supabase
      .from('vendas_dia')
      .select('*, vendas_itens(produto_id, quantidade, preco_venda, custo)')
      .eq('user_id', user.id)
      .eq('data', d)

    const direct = data?.find(vd => vd.canal === 'direto')
    const ifood  = data?.find(vd => vd.canal === 'ifood')

    if (direct?.fechado) {
      setDirectClosed(true)
      const q = {}; direct.vendas_itens?.forEach(i => { q[i.produto_id] = i.quantidade }); setDirectQty(q)
    } else {
      setDirectClosed(false); setDirectQty(loadDraft(d, 'direto'))
    }
    if (ifood?.fechado) {
      setIfoodClosed(true)
      const q = {}; ifood.vendas_itens?.forEach(i => { q[i.produto_id] = i.quantidade }); setIfoodQty(q)
    } else {
      setIfoodClosed(false); setIfoodQty(loadDraft(d, 'ifood'))
    }
  }

  const loadHistory = async () => {
    const { data } = await supabase
      .from('vendas_dia')
      .select('*, vendas_itens(produto_id, quantidade, preco_venda, custo)')
      .eq('user_id', user.id)
      .eq('fechado', true)
      .order('data', { ascending: false })
      .limit(60)

    const byDate = {}
    ;(data || []).forEach(vd => {
      if (!byDate[vd.data]) byDate[vd.data] = { date: vd.data, channels: {} }
      byDate[vd.data].channels[vd.canal] = vd
    })
    setHistory(Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)))
  }

  // ── Qty handlers ──
  const activeQty    = channel === 'direto' ? directQty : ifoodQty
  const setActiveQty = channel === 'direto' ? setDirectQty : setIfoodQty
  const isClosed     = channel === 'direto' ? directClosed : ifoodClosed

  const commitQty = (productId, raw) => {
    const n = Math.max(0, Number(raw) || 0)
    setActiveQty(prev => ({ ...prev, [productId]: n }))
    setRawVals(rv => { const r = { ...rv }; delete r[productId]; return r })
  }
  const handleInc = (id) => { setActiveQty(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + 1 })); setRawVals(rv => { const r = { ...rv }; delete r[id]; return r }) }
  const handleDec = (id) => { const curr = Number(activeQty[id]) || 0; if (curr > 0) { setActiveQty(prev => ({ ...prev, [id]: curr - 1 })); setRawVals(rv => { const r = { ...rv }; delete r[id]; return r }) } }

  // ── Summaries ──
  const ifoodRate     = IFOOD_PLANS[ifoodPlan].rate
  const directSummary = calcSummary(directQty, enrichedProducts, totalExpenses, 0)
  const ifoodSummary  = calcSummary(ifoodQty,  enrichedProducts, totalExpenses, ifoodRate)
  const currentSummary = channel === 'direto' ? directSummary : ifoodSummary

  // ── Close day ──
  const confirmClose = async () => {
    setSaving(true)
    try {
      for (const ch of ['direto', 'ifood']) {
        const chQty = ch === 'direto' ? directQty : ifoodQty
        const items = enrichedProducts
          .filter(p => Number(chQty[p.id]) > 0)
          .map(p => ({ produto_id: p.id, quantidade: Number(chQty[p.id]), preco_venda: p.salePrice, custo: p.ingredientCost }))
        if (items.length === 0) continue

        const { data: existing } = await supabase
          .from('vendas_dia').select('id').eq('user_id', user.id).eq('data', date).eq('canal', ch).maybeSingle()

        let dayId
        if (existing) {
          dayId = existing.id
          await supabase.from('vendas_dia').update({ fechado: true }).eq('id', dayId)
          await supabase.from('vendas_itens').delete().eq('venda_dia_id', dayId)
        } else {
          const { data, error } = await supabase.from('vendas_dia')
            .insert({ user_id: user.id, data: date, canal: ch, fechado: true }).select().single()
          if (error) throw error
          dayId = data.id
        }
        await supabase.from('vendas_itens').insert(items.map(i => ({ ...i, venda_dia_id: dayId })))
        clearDraft(date, ch)
      }
      setDirectClosed(true); setIfoodClosed(true)
      setShowSummary(false)
      loadHistory()
    } catch (err) {
      console.error('Erro ao fechar dia:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──
  const bothClosed = directClosed && ifoodClosed

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendas</h1>
          <p className="text-gray-400 text-sm mt-1">Registro diário de vendas</p>
        </div>
        <button
          onClick={() => setShowSummary(true)}
          disabled={bothClosed}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 disabled:shadow-none"
        >
          <CheckCircle size={16} />
          Fechar Dia
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="date" value={date} max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
          />
        </div>
        <span className="text-gray-400 text-sm hidden sm:block">{fmtDateLong(date)}</span>
      </div>

      {/* Channel tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-5 border border-gray-800">
        {[{ ch: 'direto', label: 'Venda Direta' }, { ch: 'ifood', label: 'iFood' }].map(({ ch, label }) => {
          const closed = ch === 'direto' ? directClosed : ifoodClosed
          return (
            <button
              key={ch}
              onClick={() => { setChannel(ch); setRawVals({}) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                channel === ch ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
              {closed && <Lock size={11} className="opacity-70" />}
            </button>
          )
        })}
      </div>

      {/* iFood plan selector */}
      {channel === 'ifood' && !ifoodClosed && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-900 border border-gray-800 rounded-xl">
          <span className="text-gray-400 text-sm shrink-0">Plano:</span>
          <div className="relative flex-1">
            <select
              value={ifoodPlan}
              onChange={(e) => setIfoodPlan(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
            >
              {Object.entries(IFOOD_PLANS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <span className="text-orange-400 text-sm font-bold shrink-0">
            −{(IFOOD_PLANS[ifoodPlan].rate * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Closed indicator */}
      {isClosed && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 mb-4">
          <Lock size={14} className="text-green-400 shrink-0" />
          <p className="text-green-300 text-sm">Dia fechado — este registro está finalizado.</p>
        </div>
      )}

      {/* Product list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Produto</span>
          <div className="flex items-center gap-10">
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Qtd</span>
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total</span>
          </div>
        </div>
        <div className="px-4">
          {enrichedProducts.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum produto cadastrado.</p>
            </div>
          ) : (
            enrichedProducts.map(p => (
              <ProductRow
                key={p.id} product={p}
                qty={activeQty[p.id] || 0}
                rawVal={rawVals[p.id]}
                onRaw={(v) => setRawVals(rv => ({ ...rv, [p.id]: v }))}
                onBlur={(v) => commitQty(p.id, v)}
                onInc={() => handleInc(p.id)}
                onDec={() => handleDec(p.id)}
                disabled={isClosed}
              />
            ))
          )}
        </div>
      </div>

      {/* Running totals */}
      {currentSummary.totalItems > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Itens</p>
            <p className="text-white font-bold text-xl">{currentSummary.totalItems}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Faturamento</p>
            <p className="text-orange-400 font-bold text-lg">{formatCurrency(currentSummary.revenue)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs mb-1">{channel === 'ifood' ? 'Líquido iFood' : 'Lucro Real'}</p>
            <p className={`font-bold text-lg ${currentSummary.realProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(channel === 'ifood' ? currentSummary.netRevenue : currentSummary.realProfit)}
            </p>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <History size={16} className="text-gray-400" />
          Histórico — últimos 30 dias
        </h2>
        {history.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-10 text-center border border-gray-800">
            <Package size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum dia fechado ainda.</p>
            <p className="text-gray-600 text-xs mt-1">Registre vendas e clique em "Fechar Dia".</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 30).map(day => {
              const dSum = day.channels.direto ? calcSummaryFromItems(day.channels.direto.vendas_itens || [], totalExpenses, 0) : null
              const iSum = day.channels.ifood  ? calcSummaryFromItems(day.channels.ifood.vendas_itens  || [], totalExpenses, ifoodRate) : null
              const totRevenue = (dSum?.revenue || 0) + (iSum?.revenue || 0)
              const totProfit  = (dSum?.realProfit || 0) + (iSum?.realProfit || 0)
              const totItems   = (dSum?.totalItems || 0) + (iSum?.totalItems || 0)
              const isExpanded = expandedDay === day.date
              return (
                <div key={day.date} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl overflow-hidden transition-colors">
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                    className="w-full flex items-center justify-between p-4 cursor-pointer text-left"
                  >
                    <div>
                      <p className="text-white font-medium text-sm">{fmtDate(day.date)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{totItems} itens · {day.channels.direto ? '🟢 Direto' : ''}{day.channels.direto && day.channels.ifood ? ' + ' : ''}{day.channels.ifood ? '🟠 iFood' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 font-bold text-sm">{formatCurrency(totRevenue)}</p>
                      <p className={`text-xs font-medium ${totProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Lucro: {formatCurrency(totProfit)}
                      </p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-800 grid grid-cols-2 gap-4 text-xs">
                      {dSum && (
                        <div className="space-y-1">
                          <p className="text-green-400 font-semibold mb-2">🟢 Direto</p>
                          <p className="text-gray-400">Itens: {dSum.totalItems}</p>
                          <p className="text-gray-400">Faturamento: {formatCurrency(dSum.revenue)}</p>
                          <p className="text-gray-400">Custo: −{formatCurrency(dSum.totalCost)}</p>
                          <p className={dSum.realProfit >= 0 ? 'text-green-400' : 'text-red-400'}>Lucro: {formatCurrency(dSum.realProfit)}</p>
                          <p className="text-gray-500">Margem: {dSum.margin.toFixed(1)}%</p>
                        </div>
                      )}
                      {iSum && (
                        <div className="space-y-1">
                          <p className="text-orange-400 font-semibold mb-2">🟠 iFood</p>
                          <p className="text-gray-400">Itens: {iSum.totalItems}</p>
                          <p className="text-gray-400">Faturamento: {formatCurrency(iSum.revenue)}</p>
                          <p className="text-gray-400">Taxa: −{formatCurrency(iSum.taxa)}</p>
                          <p className="text-gray-400">Custo: −{formatCurrency(iSum.totalCost)}</p>
                          <p className={iSum.realProfit >= 0 ? 'text-green-400' : 'text-red-400'}>Lucro: {formatCurrency(iSum.realProfit)}</p>
                          <p className="text-gray-500">Margem: {iSum.margin.toFixed(1)}%</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary modal */}
      <SummaryModal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        onConfirm={confirmClose}
        directSummary={directSummary}
        ifoodSummary={ifoodSummary}
        date={date}
        ifoodPlan={ifoodPlan}
        saving={saving}
      />
    </div>
  )
}
