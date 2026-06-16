import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, ChevronDown, ChevronUp, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils'

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseBRL(val) {
  if (val == null) return 0
  if (typeof val === 'number') return val
  const s = String(val)
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  return parseFloat(s) || 0
}

function parseISODate(val) {
  if (!val) return null
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(val)
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  return null
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${d}/${names[Number(m) - 1]}/${y}`
}

function normalize(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const found = headers.find(h => normalize(h) === normalize(c))
    if (found !== undefined) return found
  }
  return null
}

function topKey(obj) {
  const entries = Object.entries(obj)
  if (entries.length === 0) return ''
  return entries.reduce((a, b) => b[1] > a[1] ? b : a)[0]
}

// ── Component ────────────────────────────────────────────────────────────────

export default function IFoodImport() {
  const { user } = useAuth()
  const fileRef  = useRef(null)

  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)
  const [success,     setSuccess]     = useState(null)
  const [result,      setResult]      = useState(null)
  const [expandedDay, setExpandedDay] = useState(null)

  const processFile = (file) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSuccess(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) {
          setError('Arquivo vazio ou sem dados reconhecíveis.')
          setLoading(false)
          return
        }

        const headers = Object.keys(rows[0])

        const COL_STATUS  = findCol(headers, ['STATUS FINAL DO PEDIDO', 'STATUS DO PEDIDO', 'STATUS'])
        const COL_DATE    = findCol(headers, ['DATA DO PEDIDO', 'DATA PEDIDO', 'DATA'])
        const COL_VALOR   = findCol(headers, ['VALOR DOS ITENS', 'VALOR TOTAL DO PEDIDO', 'SUBTOTAL', 'VALOR DO PEDIDO'])
        const COL_TAXAS   = findCol(headers, ['TAXAS E COMISSOES', 'TAXAS E COMISSÕES', 'COMISSAO', 'COMISSÃO', 'TAXAS'])
        const COL_LIQUIDO = findCol(headers, ['VALOR LIQUIDO', 'VALOR LÍQUIDO', 'REPASSE', 'VALOR REPASSE'])
        const COL_PAGTO   = findCol(headers, ['FORMA DE PAGAMENTO', 'MEIO DE PAGAMENTO', 'PAGAMENTO'])

        if (!COL_STATUS || !COL_DATE) {
          setError(`Colunas obrigatórias não encontradas. Colunas detectadas: ${headers.join(', ')}`)
          setLoading(false)
          return
        }

        const concluidos = rows.filter(row => {
          const st = normalize(row[COL_STATUS] || '')
          return st === 'CONCLUIDO' || st === 'CONCLUIDO'
        })

        if (concluidos.length === 0) {
          setError('Nenhum pedido com status CONCLUÍDO encontrado. Verifique se o arquivo é o relatório de pedidos do iFood.')
          setLoading(false)
          return
        }

        // Group by date
        const byDate = {}
        concluidos.forEach(row => {
          const iso = parseISODate(row[COL_DATE])
          if (!iso) return
          if (!byDate[iso]) byDate[iso] = []
          byDate[iso].push(row)
        })

        const days = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dayRows]) => {
            const pedidos     = dayRows.length
            const faturamento = dayRows.reduce((s, r) => s + parseBRL(r[COL_VALOR]),   0)
            const taxas       = dayRows.reduce((s, r) => s + Math.abs(parseBRL(r[COL_TAXAS])),  0)
            const liquido     = COL_LIQUIDO
              ? dayRows.reduce((s, r) => s + parseBRL(r[COL_LIQUIDO]), 0)
              : faturamento - taxas

            const pagtoCount = {}
            if (COL_PAGTO) dayRows.forEach(r => { const p = String(r[COL_PAGTO] || '').trim(); if (p) pagtoCount[p] = (pagtoCount[p] || 0) + 1 })
            const pagto = topKey(pagtoCount)

            return { date, pedidos, faturamento, taxas, liquido, pagto }
          })

        const totalPedidos     = days.reduce((s, d) => s + d.pedidos, 0)
        const totalFaturamento = days.reduce((s, d) => s + d.faturamento, 0)
        const totalTaxas       = days.reduce((s, d) => s + d.taxas, 0)
        const totalLiquido     = days.reduce((s, d) => s + d.liquido, 0)
        const ticketMedio      = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0
        const periodoInicio    = days.length > 0 ? days[days.length - 1].date : null
        const periodoFim       = days.length > 0 ? days[0].date : null
        const melhorDia        = days.length > 0 ? days.reduce((a, b) => b.faturamento > a.faturamento ? b : a) : null

        setResult({ days, totalPedidos, totalFaturamento, totalTaxas, totalLiquido, ticketMedio, periodoInicio, periodoFim, melhorDia })
      } catch (err) {
        setError('Erro ao processar arquivo: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => { setError('Erro ao ler o arquivo.'); setLoading(false) }
    reader.readAsArrayBuffer(file)
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!result || !user) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('importacoes_ifood').insert({
        user_id:           user.id,
        periodo_inicio:    result.periodoInicio,
        periodo_fim:       result.periodoFim,
        total_pedidos:     result.totalPedidos,
        faturamento_bruto: result.totalFaturamento,
        total_taxas:       result.totalTaxas,
        valor_liquido:     result.totalLiquido,
        dados_json:        { days: result.days },
      })
      if (err) throw err
      setSuccess('Relatório salvo no histórico com sucesso!')
    } catch (err) {
      setError('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 border-t border-gray-800 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Importar Relatório iFood</h3>
          <p className="text-gray-500 text-xs mt-0.5">Importar .xlsx do painel iFood para análise do período</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-300 rounded-full animate-spin" />Processando...</>
            : <><FileSpreadsheet size={14} />Importar .xlsx</>}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-4">
          <CheckCircle size={14} className="text-green-400 shrink-0" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-gray-800/60 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Pedidos</p>
              <p className="text-white font-bold text-xl">{result.totalPedidos}</p>
            </div>
            <div className="bg-gray-800/60 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Faturamento</p>
              <p className="text-orange-400 font-bold text-sm">{formatCurrency(result.totalFaturamento)}</p>
            </div>
            <div className="bg-gray-800/60 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Taxas iFood</p>
              <p className="text-red-400 font-bold text-sm">−{formatCurrency(result.totalTaxas)}</p>
            </div>
            <div className="bg-gray-800/60 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">Valor Líquido</p>
              <p className="text-green-400 font-bold text-sm">{formatCurrency(result.totalLiquido)}</p>
            </div>
          </div>

          {/* Extra stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-800/40 rounded-xl px-3 py-2">
              <span className="text-gray-500">Ticket médio: </span>
              <span className="text-white font-medium">{formatCurrency(result.ticketMedio)}</span>
            </div>
            <div className="bg-gray-800/40 rounded-xl px-3 py-2">
              <span className="text-gray-500">Dias com vendas: </span>
              <span className="text-white font-medium">{result.days.length}</span>
            </div>
            {result.melhorDia && (
              <div className="bg-gray-800/40 rounded-xl px-3 py-2 col-span-2">
                <span className="text-gray-500">Melhor dia: </span>
                <span className="text-white font-medium">
                  {fmtDate(result.melhorDia.date)} — {formatCurrency(result.melhorDia.faturamento)} ({result.melhorDia.pedidos} pedidos)
                </span>
              </div>
            )}
            <div className="bg-gray-800/40 rounded-xl px-3 py-2 col-span-2">
              <span className="text-gray-500">Período: </span>
              <span className="text-white font-medium">
                {fmtDate(result.periodoInicio)} até {fmtDate(result.periodoFim)}
              </span>
            </div>
          </div>

          {/* Day-by-day list */}
          <div>
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Dia a dia</h4>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {result.days.map(day => {
                const isOpen = expandedDay === day.date
                return (
                  <div key={day.date} className="bg-gray-800/50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedDay(isOpen ? null : day.date)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{fmtDate(day.date)}</span>
                        <span className="text-gray-500 text-xs">{day.pedidos} pedidos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-sm font-semibold">{formatCurrency(day.faturamento)}</span>
                        <span className="text-green-400 text-xs hidden sm:inline">{formatCurrency(day.liquido)}</span>
                        {isOpen ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 border-t border-gray-700/60 pt-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Faturamento bruto</span>
                          <span className="text-white">{formatCurrency(day.faturamento)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Taxas iFood</span>
                          <span className="text-red-400">−{formatCurrency(day.taxas)}</span>
                        </div>
                        <div className="flex justify-between font-medium pt-0.5 border-t border-gray-700/40">
                          <span className="text-gray-400">Valor líquido</span>
                          <span className="text-green-400">{formatCurrency(day.liquido)}</span>
                        </div>
                        {day.pagto && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pagamento principal</span>
                            <span className="text-gray-300">{day.pagto}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !!success}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-600 text-white py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
              : success
                ? <><CheckCircle size={14} />Salvo</>
                : <><Save size={14} />Salvar no histórico</>}
          </button>
        </div>
      )}
    </div>
  )
}
