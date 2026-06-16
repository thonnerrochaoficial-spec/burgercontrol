import { useState } from 'react'
import { TrendingUp, Layers } from 'lucide-react'
import { formatCurrency, formatPercent } from '../utils'

function marginConfig(margin) {
  if (margin >= 40) return { bar: 'bg-green-500', text: 'text-green-400', badge: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Ótimo' }
  if (margin >= 20) return { bar: 'bg-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', label: 'Regular' }
  return { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Baixo' }
}

function RankingPanel({ items, getEmoji, getName }) {
  const byRealMargin = [...items].sort((a, b) => b.realMargin - a.realMargin)
  const byGrossMargin = [...items].sort((a, b) => b.grossMargin - a.grossMargin)
  const byRealProfit = [...items].sort((a, b) => b.realProfit - a.realProfit)
  const maxRealMargin = Math.max(...items.map((p) => Math.abs(p.realMargin)), 1)
  const maxGrossMargin = Math.max(...items.map((p) => p.grossMargin), 1)
  const maxRealProfit = Math.max(...items.map((p) => Math.abs(p.realProfit)), 1)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-base font-semibold text-white mb-0.5">Ranking por Margem Real</h2>
        <p className="text-gray-500 text-xs mb-6">Após rateio das despesas fixas mensais</p>
        <div className="space-y-5">
          {byRealMargin.map((item, index) => {
            const cfg = marginConfig(item.realMargin)
            const barWidth = maxRealMargin > 0 ? Math.max(0, (item.realMargin / maxRealMargin) * 100) : 0
            return (
              <div key={item.id}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold w-5 text-right shrink-0 ${index < 3 ? 'text-orange-400' : 'text-gray-600'}`}>#{index + 1}</span>
                  <span className="text-xl shrink-0">{getEmoji(item)}</span>
                  <span className="flex-1 text-white text-sm font-medium truncate">{getName(item)}</span>
                  <span className={`text-sm font-bold shrink-0 ${cfg.text}`}>{formatPercent(item.realMargin)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline ${cfg.badge}`}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-3 pl-8">
                  <div className="flex-1 bg-gray-800 rounded-full h-2.5">
                    <div className={`${cfg.bar} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="text-gray-500 text-xs w-24 text-right shrink-0">{formatCurrency(item.realProfit)}/venda</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-0.5">Maior Lucro Real</h2>
          <p className="text-gray-500 text-xs mb-4">Valor em reais por venda</p>
          <div className="space-y-3">
            {byRealProfit.map((item, index) => {
              const barWidth = maxRealProfit > 0 ? Math.max(0, (item.realProfit / maxRealProfit) * 100) : 0
              const isPositive = item.realProfit >= 0
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-600 text-xs w-4 shrink-0">#{index + 1}</span>
                      <span className="text-base shrink-0">{getEmoji(item)}</span>
                      <span className="text-gray-300 text-xs truncate">{getName(item)}</span>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ml-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(item.realProfit)}</span>
                  </div>
                  <div className="pl-6 bg-gray-800 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-0.5">Margem Bruta</h2>
          <p className="text-gray-500 text-xs mb-4">Sem considerar despesas fixas</p>
          <div className="space-y-3">
            {byGrossMargin.map((item, index) => {
              const cfg = marginConfig(item.grossMargin)
              const barWidth = maxGrossMargin > 0 ? (item.grossMargin / maxGrossMargin) * 100 : 0
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-600 text-xs w-4 shrink-0">#{index + 1}</span>
                      <span className="text-base shrink-0">{getEmoji(item)}</span>
                      <span className="text-gray-300 text-xs truncate">{getName(item)}</span>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ml-2 ${cfg.text}`}>{formatPercent(item.grossMargin)}</span>
                  </div>
                  <div className="pl-6 bg-gray-800 rounded-full h-1.5">
                    <div className={`${cfg.bar} h-1.5 rounded-full`} style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Analytics({ enrichedProducts, enrichedCombos = [], totalExpenses, expensePerUnit, monthlyUnits }) {
  const [activeTab, setActiveTab] = useState('individual')

  const hasProducts = enrichedProducts.length > 0
  const hasCombos = enrichedCombos.length > 0

  if (!hasProducts && !hasCombos) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <TrendingUp size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400">Sem dados para análise.</p>
          <p className="text-gray-600 text-sm mt-1">Cadastre produtos ou combos para ver as análises.</p>
        </div>
      </div>
    )
  }

  const avg = (arr, key) => arr.length > 0 ? arr.reduce((s, x) => s + x[key], 0) / arr.length : 0
  const avgIndividualReal = avg(enrichedProducts, 'realMargin')
  const avgComboReal = avg(enrichedCombos, 'realMargin')
  const avgIndividualGross = avg(enrichedProducts, 'grossMargin')
  const avgComboGross = avg(enrichedCombos, 'grossMargin')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Análises</h1>
        <p className="text-gray-400 text-sm mt-1">Ranking de rentabilidade</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-500 text-xs mb-1">Despesas Mensais</p>
          <p className="text-white font-bold text-lg">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-500 text-xs mb-1">Custo por Venda</p>
          <p className="text-orange-400 font-bold text-lg">{formatCurrency(expensePerUnit)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-500 text-xs mb-1">Vendas Mensais</p>
          <p className="text-white font-bold text-lg">{Number(monthlyUnits).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Comparison (only when both have data) */}
      {hasProducts && hasCombos && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs font-semibold mb-3 uppercase tracking-wide">Margem Real Média</p>
            <div className="flex items-end gap-5">
              <div>
                <p className="text-gray-500 text-[11px] mb-1">Individuais</p>
                <p className={`font-bold text-xl ${avgIndividualReal >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(avgIndividualReal)}</p>
              </div>
              <p className="text-gray-700 text-lg font-light pb-1">vs</p>
              <div>
                <p className="text-gray-500 text-[11px] mb-1 flex items-center gap-1"><Layers size={10} />Combos</p>
                <p className={`font-bold text-xl ${avgComboReal >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(avgComboReal)}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs font-semibold mb-3 uppercase tracking-wide">Margem Bruta Média</p>
            <div className="flex items-end gap-5">
              <div>
                <p className="text-gray-500 text-[11px] mb-1">Individuais</p>
                <p className="text-green-400 font-bold text-xl">{formatPercent(avgIndividualGross)}</p>
              </div>
              <p className="text-gray-700 text-lg font-light pb-1">vs</p>
              <div>
                <p className="text-gray-500 text-[11px] mb-1 flex items-center gap-1"><Layers size={10} />Combos</p>
                <p className="text-green-400 font-bold text-xl">{formatPercent(avgComboGross)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      {hasProducts && hasCombos && (
        <div className="flex items-center gap-1 bg-gray-800/60 rounded-xl p-1 w-fit mb-6">
          <button onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === 'individual' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            Individuais ({enrichedProducts.length})
          </button>
          <button onClick={() => setActiveTab('combo')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'combo' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            <Layers size={13} />Combos ({enrichedCombos.length})
          </button>
        </div>
      )}

      {/* Rankings */}
      {(!hasCombos || activeTab === 'individual') && hasProducts && (
        <RankingPanel items={enrichedProducts} getEmoji={(p) => p.emoji} getName={(p) => p.name} />
      )}
      {hasCombos && activeTab === 'combo' && (
        <RankingPanel
          items={enrichedCombos}
          getEmoji={(c) => c.enrichedProducts?.[0]?.emoji ?? '🍔'}
          getName={(c) => c.name}
        />
      )}
    </div>
  )
}
