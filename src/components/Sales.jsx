import { useState, useEffect } from 'react'
import {
  ShoppingCart, Plus, Minus, Calendar, CheckCircle,
  ChevronDown, Lock, X, TrendingUp, History, Package
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils'

// ── Constants ──────────────────────────────────────────────────────────────
const TAXA_TRANSACAO = 0.032   // taxa de pagamento online, sempre aplicada no iFood

const IFOOD_PLANS = {
  basico:            { label: 'Básico',               comissao: 0.12 },
  entrega:           { label: 'Entrega',              comissao: 0.27 },
  entregaBeneficios: { label: 'Entrega + Benefícios', comissao: 0.30 },
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

// ── Draft helpers ──────────────────────────────────────────────────────────
const draftKey  = (date, ch) => `bc_sales_${date}_${ch}`
const loadDraft = (date, ch) => { try { const s = localStorage.getItem(draftKey(date, ch)); return s ? JSON.parse(s) : {} } catch { return {} } }
const saveDraft = (date, ch, qty) => { try { localStorage.setItem(draftKey(date, ch), JSON.stringify(qty)) } catch { /* quota */ } }
const clearDraft = (date, ch) => { try { localStorage.removeItem(draftKey(date, ch)) } catch { /* ignore */ } }

// ── Summary calculations ───────────────────────────────────────────────────
// comissaoRate: plano iFood (0.12/0.27/0.30); se > 0, TAXA_TRANSACAO também é aplicada
function calcSummary(qty, allItems, totalExpenses, comissaoRate = 0) {
  const rows = allItems
    .map(item => { const q = Math.max(0, Number(qty[item.id]) || 0); return { item, q } })
    .filter(({ q }) => q > 0)
  const totalItems    = rows.reduce((s, { q }) => s + q, 0)
  const revenue       = rows.reduce((s, { item, q }) => s + q * item.salePrice, 0)
  const comissao      = revenue * comissaoRate
  const taxaTransacao = comissaoRate > 0 ? revenue * TAXA_TRANSACAO : 0
  const taxa          = comissao + taxaTransacao
  const netRevenue    = revenue - taxa
  const totalCost     = rows.reduce((s, { item, q }) => s + q * item.ingredientCost, 0)
  const dailyExp      = totalExpenses / 30
  const grossProfit   = netRevenue - totalCost
  const realProfit    = grossProfit - dailyExp
  const margin        = revenue > 0 ? (realProfit / revenue) * 100 : 0
  const topProduct    = rows.length > 0 ? rows.reduce((best, r) => r.q > best.q ? r : best, rows[0]) : null
  return { rows, totalItems, revenue, comissao, taxaTransacao, taxa, netRevenue, totalCost, dailyExp, grossProfit, realProfit, margin, topProduct }
}

function calcSummaryFromItems(dbItems, totalExpenses, comissaoRate = 0) {
  const totalItems    = dbItems.reduce((s, i) => s + i.quantidade, 0)
  const revenue       = dbItems.reduce((s, i) => s + i.quantidade * i.preco_venda, 0)
  const comissao      = revenue * comissaoRate
  const taxaTransacao = comissaoRate > 0 ? revenue * TAXA_TRANSACAO : 0
  const taxa          = comissao + taxaTransacao
  const netRevenue    = revenue - taxa
  const totalCost     = dbItems.reduce((s, i) => s + i.quantidade * i.custo, 0)
  const dailyExp      = totalExpenses / 30
  const grossProfit   = netRevenue - totalCost
  const realProfit    = grossProfit - dailyExp
  const margin        = revenue > 0 ? (realProfit / revenue) * 100 : 0
  return { totalItems, revenue, comissao, taxaTransacao, taxa, netRevenue, totalCost, dailyExp, grossProfit, realProfit, margin }
}

// ── SaleCard — horizontal row card ────────────────────────────────────────
function SaleCard({ item, qty, rawVal, onRaw, onBlur, onInc, onDec, disabled }) {
  const q     = Number(qty) || 0
  const total = q * item.salePrice
  return (
    <div className={`bg-gray-800/60 border border-gray-700/50 rounded-xl flex items-center gap-3 px-3 py-2.5 transition-colors ${q > 0 ? 'border-orange-500/50 bg-gray-800/80' : ''} ${disabled ? 'opacity-60' : ''}`}>
      {/* Square photo */}
      <div className="relative w-[60px] h-[60px] shrink-0 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <span className="text-3xl">{item.emoji || '🍔'}</span>}
        {item.type === 'combo' && (
          <span className="absolute bottom-0 left-0 right-0 bg-purple-600/90 text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-wide">
            Combo
          </span>
        )}
      </div>

      {/* Name + price */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-bold uppercase leading-tight truncate">{item.name}</p>
        <p className="text-orange-400 text-sm font-semibold mt-0.5">{formatCurrency(item.salePrice)}</p>
        {q > 0 && (
          <p className="text-green-400 text-xs font-medium mt-0.5">= {formatCurrency(total)}</p>
        )}
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onDec} disabled={disabled || q <= 0}
          className="w-9 h-9 rounded-xl bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        ><Minus size={14} /></button>
        <input
          type="text" inputMode="numeric"
          value={rawVal !== undefined ? rawVal : (q > 0 ? String(q) : '')}
          onChange={(e) => onRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => onBlur(rawVal !== undefined ? rawVal : String(q))}
          disabled={disabled}
          placeholder="0"
          className="w-10 text-center bg-gray-700 border border-gray-600 rounded-lg py-1.5 text-white text-sm font-bold focus:outline-none focus:border-orange-500 transition-colors disabled:cursor-not-allowed"
        />
        <button
          onClick={onInc} disabled={disabled}
          className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

// ── SummaryModal ───────────────────────────────────────────────────────────
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

function SummaryModal({ isOpen, onClose, onConfirm, directSummary, ifoodSummary, date, ifoodPlan, ifoodComissao, saving, saveError }) {
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
                  <p className="text-gray-500 text-xs pt-1">⭐ Mais vendido: <span className="text-white">{directSummary.topProduct.item.emoji || ''} {directSummary.topProduct.item.name}</span> ({directSummary.topProduct.q}×)</p>
                )}
              </div>
            </section>
          )}

          {hasI && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                iFood — {IFOOD_PLANS[ifoodPlan].label} ({(ifoodComissao * 100).toFixed(0)}% + 3,2%)
              </h3>
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                <SummaryRow label="Total de itens" value={`${ifoodSummary.totalItems} itens`} />
                <SummaryRow label="Faturamento bruto" value={formatCurrency(ifoodSummary.revenue)} />
                <div className="border-l-2 border-red-500/30 pl-3 space-y-1.5 my-1">
                  <SummaryRow label={`Comissão iFood (${(ifoodComissao * 100).toFixed(0)}%)`} value={`− ${formatCurrency(ifoodSummary.comissao)}`} dim />
                  <SummaryRow label="Taxa transação (3,2%)" value={`− ${formatCurrency(ifoodSummary.taxaTransacao)}`} dim />
                  <SummaryRow label="Total de taxas" value={`− ${formatCurrency(ifoodSummary.taxa)}`} positive={false} />
                </div>
                <SummaryRow label="Valor líquido recebido" value={formatCurrency(ifoodSummary.netRevenue)} />
                <SummaryRow label="Custo dos ingredientes" value={`− ${formatCurrency(ifoodSummary.totalCost)}`} dim />
                <SummaryRow label="Despesas fixas do dia" value={`− ${formatCurrency(ifoodSummary.dailyExp)}`} dim />
                <div className="border-t border-gray-700 pt-2">
                  <SummaryRow label="Lucro real após taxas" value={formatCurrency(ifoodSummary.realProfit)} positive={ifoodSummary.realProfit >= 0} bold />
                  <SummaryRow label="Margem real no iFood" value={`${ifoodSummary.margin.toFixed(1)}%`} />
                </div>
                {ifoodSummary.topProduct && (
                  <p className="text-gray-500 text-xs pt-1">⭐ Mais vendido: <span className="text-white">{ifoodSummary.topProduct.item.emoji || ''} {ifoodSummary.topProduct.item.name}</span> ({ifoodSummary.topProduct.q}×)</p>
                )}
              </div>
            </section>
          )}

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

        <div className="p-5 border-t border-gray-800 space-y-3">
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
              <X size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{saveError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={onConfirm} disabled={saving || (!hasD && !hasI)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
                : <><CheckCircle size={16} />Confirmar e Fechar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Sales({ enrichedProducts, enrichedCombos = [], totalExpenses }) {
  const { user } = useAuth()

  const [date, setDate]                 = useState(todayStr)
  const [channel, setChannel]           = useState('direto')
  const [ifoodPlan, setIfoodPlan]       = useState(() => localStorage.getItem('bc_ifood_plan') || 'basico')
  const [directQty, setDirectQty]       = useState({})
  const [ifoodQty, setIfoodQty]         = useState({})
  const [rawVals, setRawVals]           = useState({})
  const [directClosed, setDirectClosed] = useState(false)
  const [ifoodClosed, setIfoodClosed]   = useState(false)
  const [history, setHistory]           = useState([])
  const [showSummary, setShowSummary]   = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError]       = useState(null)
  const [expandedDay, setExpandedDay]   = useState(null)

  // Unified item list (products first, then combos)
  const allItems = [
    ...enrichedProducts.map(p => ({ ...p, type: 'product' })),
    ...enrichedCombos.map(c => ({ ...c, type: 'combo' })),
  ]

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { localStorage.setItem('bc_ifood_plan', ifoodPlan) }, [ifoodPlan])

  useEffect(() => {
    if (!user) return
    loadDayData(date)
    setRawVals({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user])

  useEffect(() => { if (!directClosed) saveDraft(date, 'direto', directQty) }, [directQty, date, directClosed])
  useEffect(() => { if (!ifoodClosed)  saveDraft(date, 'ifood',  ifoodQty)  }, [ifoodQty,  date, ifoodClosed])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) loadHistory() }, [user])

  const loadDayData = async (d) => {
    const { data } = await supabase
      .from('vendas_dia')
      .select('*, vendas_itens(produto_id, combo_id, quantidade, preco_venda, custo)')
      .eq('user_id', user.id)
      .eq('data', d)

    const restore = (items) => {
      const q = {}
      items?.forEach(i => { const id = i.combo_id || i.produto_id; if (id) q[id] = i.quantidade })
      return q
    }

    const direct = data?.find(vd => vd.canal === 'direto')
    const ifood  = data?.find(vd => vd.canal === 'ifood')

    if (direct?.fechado) { setDirectClosed(true); setDirectQty(restore(direct.vendas_itens)) }
    else { setDirectClosed(false); setDirectQty(loadDraft(d, 'direto')) }

    if (ifood?.fechado) { setIfoodClosed(true); setIfoodQty(restore(ifood.vendas_itens)) }
    else { setIfoodClosed(false); setIfoodQty(loadDraft(d, 'ifood')) }
  }

  const loadHistory = async () => {
    const { data } = await supabase
      .from('vendas_dia')
      .select('*, vendas_itens(produto_id, combo_id, quantidade, preco_venda, custo)')
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

  const commitQty = (id, raw) => {
    const n = Math.max(0, Number(raw) || 0)
    setActiveQty(prev => ({ ...prev, [id]: n }))
    setRawVals(rv => { const r = { ...rv }; delete r[id]; return r })
  }
  const handleInc = (id) => {
    setActiveQty(prev => ({ ...prev, [id]: (Number(prev[id]) || 0) + 1 }))
    setRawVals(rv => { const r = { ...rv }; delete r[id]; return r })
  }
  const handleDec = (id) => {
    const curr = Number(activeQty[id]) || 0
    if (curr > 0) {
      setActiveQty(prev => ({ ...prev, [id]: curr - 1 }))
      setRawVals(rv => { const r = { ...rv }; delete r[id]; return r })
    }
  }

  // ── Summaries ──
  const ifoodComissao  = IFOOD_PLANS[ifoodPlan].comissao
  const directSummary  = calcSummary(directQty, allItems, totalExpenses, 0)
  const ifoodSummary   = calcSummary(ifoodQty,  allItems, totalExpenses, ifoodComissao)
  const currentSummary = channel === 'direto' ? directSummary : ifoodSummary

  // ── Close day ──
  const confirmClose = async () => {
    setSaving(true)
    setSaveError(null)
    let closedDireto = directClosed
    let closedIfood  = ifoodClosed
    let anyChannel   = false

    try {
      for (const ch of ['direto', 'ifood']) {
        const chQty = ch === 'direto' ? directQty : ifoodQty
        const items = allItems
          .filter(item => Number(chQty[item.id]) > 0)
          .map(item => ({
            ...(item.type === 'combo'
              ? { combo_id: item.id, produto_id: null }
              : { produto_id: item.id, combo_id: null }),
            quantidade:  Number(chQty[item.id]),
            preco_venda: item.salePrice,
            custo:       item.ingredientCost,
          }))

        console.log(`[Vendas] canal="${ch}" itens=${items.length}`, items)
        if (items.length === 0) continue
        anyChannel = true

        // Passo 1: verificar se já existe registro para esse dia/canal
        const { data: existing, error: errSelect } = await supabase
          .from('vendas_dia').select('id')
          .eq('user_id', user.id).eq('data', date).eq('canal', ch).maybeSingle()
        if (errSelect) throw new Error(`Erro ao consultar vendas_dia (${ch}): ${errSelect.message}`)

        let dayId
        if (existing) {
          // Passo 2a: atualiza registro existente
          dayId = existing.id
          console.log(`[Vendas] atualizando venda_dia id=${dayId}`)
          const { error: errUpdate } = await supabase.from('vendas_dia').update({ fechado: true }).eq('id', dayId)
          if (errUpdate) throw new Error(`Erro ao atualizar vendas_dia: ${errUpdate.message}`)
          const { error: errDel } = await supabase.from('vendas_itens').delete().eq('venda_dia_id', dayId)
          if (errDel) throw new Error(`Erro ao limpar itens anteriores: ${errDel.message}`)
        } else {
          // Passo 2b: cria novo registro
          console.log(`[Vendas] criando venda_dia canal="${ch}" data="${date}"`)
          const { data: newDay, error: errInsertDay } = await supabase
            .from('vendas_dia')
            .insert({ user_id: user.id, data: date, canal: ch, fechado: true })
            .select('id')
            .single()
          if (errInsertDay) throw new Error(`Erro ao criar vendas_dia (${ch}): ${errInsertDay.message}`)
          dayId = newDay.id
          console.log(`[Vendas] venda_dia criada id=${dayId}`)
        }

        // Passo 3: inserir itens
        const rows = items.map(i => ({ ...i, venda_dia_id: dayId }))
        console.log(`[Vendas] inserindo ${rows.length} itens em vendas_itens`, rows)
        const { error: errItems } = await supabase.from('vendas_itens').insert(rows)
        if (errItems) throw new Error(`Erro ao salvar itens (${ch}): ${errItems.message}`)

        clearDraft(date, ch)
        if (ch === 'direto') closedDireto = true
        if (ch === 'ifood')  closedIfood  = true
        console.log(`[Vendas] canal="${ch}" fechado com sucesso`)
      }

      if (!anyChannel) {
        setSaveError('Adicione pelo menos um produto antes de fechar o dia.')
        return
      }

      // Passo 4: tudo salvo — atualiza estado e fecha modal
      setDirectClosed(closedDireto)
      setIfoodClosed(closedIfood)
      setShowSummary(false)
      loadHistory()
    } catch (err) {
      console.error('[Vendas] Erro ao fechar dia:', err)
      setSaveError(err.message || 'Erro inesperado ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Card grid renderer ──
  const renderGrid = (items, label) => {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">{label}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map(item => (
            <SaleCard
              key={item.id} item={item}
              qty={activeQty[item.id] || 0}
              rawVal={rawVals[item.id]}
              onRaw={(v) => setRawVals(rv => ({ ...rv, [item.id]: v }))}
              onBlur={(v) => commitQty(item.id, v)}
              onInc={() => handleInc(item.id)}
              onDec={() => handleDec(item.id)}
              disabled={isClosed}
            />
          ))}
        </div>
      </div>
    )
  }

  const bothClosed = directClosed && ifoodClosed

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendas</h1>
          <p className="text-gray-400 text-sm mt-1">Registro diário de vendas</p>
        </div>
        <button
          onClick={() => setShowSummary(true)} disabled={bothClosed}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 disabled:shadow-none"
        >
          <CheckCircle size={16} />Fechar Dia
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative max-w-xs w-full">
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
              {label}{closed && <Lock size={11} className="opacity-70" />}
            </button>
          )
        })}
      </div>

      {/* iFood — Configurações */}
      {channel === 'ifood' && !ifoodClosed && (
        <div className="mb-5 p-4 bg-gray-900 border border-gray-800 rounded-xl space-y-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">⚙️ Configurações iFood</p>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm shrink-0">Plano de comissão:</span>
            <div className="relative flex-1">
              <select
                value={ifoodPlan} onChange={(e) => setIfoodPlan(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
              >
                {Object.entries(IFOOD_PLANS).map(([key, { label, comissao }]) => (
                  <option key={key} value={key}>{label} ({(comissao * 100).toFixed(0)}%)</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800 rounded-lg p-2 text-center">
              <p className="text-gray-500">Comissão</p>
              <p className="text-red-400 font-bold mt-0.5">−{(ifoodComissao * 100).toFixed(0)}%</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-2 text-center">
              <p className="text-gray-500">Taxa transação</p>
              <p className="text-red-400 font-bold mt-0.5">−3,2%</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center">
              <p className="text-gray-500">Total descontado</p>
              <p className="text-orange-400 font-bold mt-0.5">−{((ifoodComissao + TAXA_TRANSACAO) * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Closed indicator */}
      {isClosed && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 mb-5">
          <Lock size={14} className="text-green-400 shrink-0" />
          <p className="text-green-300 text-sm">Dia fechado — este registro está finalizado.</p>
        </div>
      )}

      {/* Product & combo grids */}
      {enrichedProducts.length === 0 && enrichedCombos.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-14 text-center border border-gray-800 mb-6">
          <ShoppingCart size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum produto cadastrado.</p>
        </div>
      ) : (
        <>
          {renderGrid(enrichedProducts.map(p => ({ ...p, type: 'product' })), '🍔 Produtos')}
          {renderGrid(enrichedCombos.map(c => ({ ...c, type: 'combo' })), '🍟 Combos')}
        </>
      )}

      {/* Running totals */}
      {currentSummary.totalItems > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
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
              const iSum = day.channels.ifood  ? calcSummaryFromItems(day.channels.ifood.vendas_itens  || [], totalExpenses, ifoodComissao) : null
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
                      <p className="text-gray-500 text-xs mt-0.5">
                        {totItems} itens · {day.channels.direto ? '🟢 Direto' : ''}{day.channels.direto && day.channels.ifood ? ' + ' : ''}{day.channels.ifood ? '🟠 iFood' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 font-bold text-sm">{formatCurrency(totRevenue)}</p>
                      <p className={`text-xs font-medium ${totProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>Lucro: {formatCurrency(totProfit)}</p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-xs pt-4">
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
                          <p className="text-gray-500">Comissão: −{formatCurrency(iSum.comissao)}</p>
                          <p className="text-gray-500">Taxa transação: −{formatCurrency(iSum.taxaTransacao)}</p>
                          <p className="text-gray-400">Líquido: {formatCurrency(iSum.netRevenue)}</p>
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

      <SummaryModal
        isOpen={showSummary}
        onClose={() => { setShowSummary(false); setSaveError(null) }}
        onConfirm={confirmClose}
        directSummary={directSummary}
        ifoodSummary={ifoodSummary}
        date={date}
        ifoodPlan={ifoodPlan}
        ifoodComissao={ifoodComissao}
        saving={saving}
        saveError={saveError}
      />
    </div>
  )
}
