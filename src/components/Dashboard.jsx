import { useState } from 'react'
import {
  Search, Grid3X3, LayoutList, ChevronDown, Package,
  ShoppingBag, DollarSign, Star, TrendingDown,
  Zap, Receipt, BarChart3, ChefHat, Layers,
} from 'lucide-react'
import { formatCurrency, formatPercent } from '../utils'

const IMPACT_STYLE = {
  low:    { badge: 'bg-green-500/20 text-green-400 border border-green-500/30',    label: 'Baixo' },
  medium: { badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', label: 'Médio' },
  high:   { badge: 'bg-red-500/20 text-red-400 border border-red-500/30',           label: 'Alto'  },
}

const CATEGORY_BG = {
  'Hambúrguer':     'from-amber-950 via-orange-950 to-amber-900',
  'Bebida':         'from-blue-950 via-cyan-950 to-blue-900',
  'Acompanhamento': 'from-yellow-950 via-amber-950 to-yellow-900',
  'Sobremesa':      'from-pink-950 via-rose-950 to-pink-900',
  'Outro':          'from-gray-800 to-gray-700',
}

function ProductCardGrid({ product, expensePerUnit }) {
  const [expanded, setExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const impact = IMPACT_STYLE[product.impactLevel]
  const totalCost = product.ingredientCost + expensePerUnit

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-orange-500/40 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-200 flex flex-col">
      {/* Foto */}
      <div className="relative h-48 overflow-hidden shrink-0">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${CATEGORY_BG[product.category] || CATEGORY_BG['Outro']} flex items-center justify-center text-7xl`}>
            {product.emoji}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 via-transparent to-transparent" />
        {product.isNew && (
          <span className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
            Novo
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col flex-1">
        {/* Nome + badges */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-bold text-white text-sm leading-tight">{product.name}</h3>
            <span className="text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
              Ativo
            </span>
          </div>
          <span className="text-[11px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
            {product.category}
          </span>
        </div>

        {/* Métricas 2×2 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 mb-4">
          <div>
            <p className="text-gray-500 text-[11px] mb-0.5">Preço de venda</p>
            <p className="text-white font-bold text-sm">{formatCurrency(product.salePrice)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[11px] mb-0.5">Custo dos insumos</p>
            <p className="text-orange-400 font-bold text-sm">{formatCurrency(product.ingredientCost)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[11px] mb-0.5">Lucro bruto</p>
            <p className="text-green-400 font-bold text-sm">{formatCurrency(product.grossProfit)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[11px] mb-0.5">Margem bruta</p>
            <p className="text-green-400 font-bold text-sm">{formatPercent(product.grossMargin)}</p>
          </div>
        </div>

        {/* Lucro real / Margem real */}
        <div className="border-t border-gray-800 pt-3 mt-auto">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <p className="text-gray-500 text-[11px] mb-1">Impacto</p>
              <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${impact.badge}`}>
                {impact.label}
              </span>
            </div>
            <div>
              <p className="text-gray-500 text-[11px] mb-0.5">Lucro real</p>
              <p className={`font-bold text-sm ${product.realProfit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {formatCurrency(product.realProfit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px] mb-0.5">Margem real</p>
              <p className={`font-bold text-sm ${product.realMargin >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {formatPercent(product.realMargin)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-orange-400 transition-colors ml-auto cursor-pointer"
          >
            Ver detalhes
            <ChevronDown size={11} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-[11px] mb-0.5">Custo total/unidade</p>
                  <p className="text-white font-semibold text-sm">{formatCurrency(totalCost)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[11px] mb-0.5">Impacto no preço</p>
                  <p className="text-white font-semibold text-sm">{formatPercent(product.expenseImpact)}</p>
                </div>
              </div>

              {product.enrichedRecipe && product.enrichedRecipe.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ChefHat size={11} className="text-orange-400" />
                    <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide">Receita</p>
                  </div>
                  <div className="space-y-1.5">
                    {product.enrichedRecipe.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
                        <span className="text-gray-300 text-xs truncate flex-1 min-w-0 mr-2">{item.name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-gray-500 text-xs">{item.quantity} {item.unit}</span>
                          <span className="text-orange-400 text-xs font-semibold w-14 text-right">{formatCurrency(item.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProductCardList({ product }) {
  const [imgError, setImgError] = useState(false)
  const impact = IMPACT_STYLE[product.impactLevel]

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 flex items-center gap-4 overflow-hidden hover:border-gray-700 transition-colors">
      {/* Thumbnail */}
      <div className="w-20 h-20 shrink-0 overflow-hidden">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${CATEGORY_BG[product.category] || CATEGORY_BG['Outro']} flex items-center justify-center text-3xl`}>
            {product.emoji}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 py-3">
        {/* Nome + badges */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="font-bold text-white text-sm">{product.name}</h3>
          {product.isNew && (
            <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30">
              Novo
            </span>
          )}
          <span className="text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full">
            Ativo
          </span>
          <span className="text-[11px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{product.category}</span>
        </div>

        {/* Métricas */}
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span className="text-xs text-gray-500">Custo dos ingredientes: <span className="text-orange-400 font-semibold">{formatCurrency(product.ingredientCost)}</span></span>
          <span className="text-xs text-gray-500">Lucro bruto: <span className="text-green-400 font-semibold">{formatCurrency(product.grossProfit)}</span></span>
          <span className="text-xs text-gray-500">Margem bruta: <span className="text-green-400 font-semibold">{formatPercent(product.grossMargin)}</span></span>
          <span className="text-xs text-gray-500">Margem real: <span className={`font-semibold ${product.realMargin >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(product.realMargin)}</span></span>
        </div>
      </div>

      {/* Direita: Impacto + Ver detalhes */}
      <div className="shrink-0 pr-4 flex flex-col items-end gap-2">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${impact.badge}`}>
          {impact.label}
        </span>
        <span className="text-xs text-orange-500 hover:text-orange-400 font-medium cursor-pointer transition-colors">
          Ver detalhes →
        </span>
      </div>
    </div>
  )
}

function ComboCardGrid({ combo, expensePerUnit }) {
  const [expanded, setExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const impact = IMPACT_STYLE[combo.impactLevel]
  const totalCost = combo.ingredientCost + expensePerUnit

  return (
    <div className="bg-gray-900 rounded-2xl border border-orange-500/20 overflow-hidden hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-200 flex flex-col">
      <div className="relative h-48 overflow-hidden shrink-0">
        {combo.image && !imgError ? (
          <img src={combo.image} alt={combo.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-950 via-amber-950 to-orange-900 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-1">{combo.enrichedProducts?.slice(0, 2).map((p) => p.emoji).join(' ') || '🍔'}</div>
              <span className="text-orange-400/50 text-[10px] font-bold tracking-widest">COMBO</span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
          <Layers size={10} />Combo
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="mb-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-bold text-white text-sm leading-tight">{combo.name}</h3>
            <span className="text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full shrink-0">
              Ativo
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {combo.enrichedProducts?.map((cp, i) => (
              <span key={i} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{cp.emoji} {cp.name}</span>
            ))}
            {combo.enrichedExtras?.length > 0 && (
              <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">+{combo.enrichedExtras.length} extra{combo.enrichedExtras.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3 mb-4">
          <div><p className="text-gray-500 text-[11px] mb-0.5">Preço de venda</p><p className="text-white font-bold text-sm">{formatCurrency(combo.salePrice)}</p></div>
          <div><p className="text-gray-500 text-[11px] mb-0.5">Custo total</p><p className="text-orange-400 font-bold text-sm">{formatCurrency(combo.ingredientCost)}</p></div>
          <div><p className="text-gray-500 text-[11px] mb-0.5">Lucro bruto</p><p className="text-green-400 font-bold text-sm">{formatCurrency(combo.grossProfit)}</p></div>
          <div><p className="text-gray-500 text-[11px] mb-0.5">Margem bruta</p><p className="text-green-400 font-bold text-sm">{formatPercent(combo.grossMargin)}</p></div>
        </div>

        <div className="border-t border-gray-800 pt-3 mt-auto">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div><p className="text-gray-500 text-[11px] mb-1">Impacto</p><span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${impact.badge}`}>{impact.label}</span></div>
            <div><p className="text-gray-500 text-[11px] mb-0.5">Lucro real</p><p className={`font-bold text-sm ${combo.realProfit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatCurrency(combo.realProfit)}</p></div>
            <div><p className="text-gray-500 text-[11px] mb-0.5">Margem real</p><p className={`font-bold text-sm ${combo.realMargin >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(combo.realMargin)}</p></div>
          </div>

          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-orange-400 transition-colors ml-auto cursor-pointer">
            Ver detalhes<ChevronDown size={11} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-gray-500 text-[11px] mb-0.5">Custo total/venda</p><p className="text-white font-semibold text-sm">{formatCurrency(totalCost)}</p></div>
                <div><p className="text-gray-500 text-[11px] mb-0.5">Impacto no preço</p><p className="text-white font-semibold text-sm">{formatPercent(combo.expenseImpact)}</p></div>
              </div>
              {((combo.enrichedProducts?.length ?? 0) + (combo.enrichedExtras?.length ?? 0)) > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers size={11} className="text-orange-400" />
                    <p className="text-gray-500 text-[11px] font-medium uppercase tracking-wide">Composição</p>
                  </div>
                  <div className="space-y-1.5">
                    {combo.enrichedProducts?.map((cp, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
                        <span className="text-gray-300 text-xs">{cp.emoji} {cp.name}</span>
                        <span className="text-orange-400 text-xs font-semibold">{formatCurrency(cp.cost)}</span>
                      </div>
                    ))}
                    {combo.enrichedExtras?.map((ex, i) => (
                      <div key={`ex-${i}`} className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-1.5">
                        <span className="text-gray-400 text-xs">+ {ex.name} ({ex.quantity}{ex.unit})</span>
                        <span className="text-orange-400 text-xs font-semibold">{formatCurrency(ex.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ComboCardList({ combo }) {
  const [imgError, setImgError] = useState(false)
  const impact = IMPACT_STYLE[combo.impactLevel]
  return (
    <div className="bg-gray-900 rounded-xl border border-orange-500/20 flex items-center gap-4 overflow-hidden hover:border-orange-500/40 transition-colors">
      <div className="w-20 h-20 shrink-0 overflow-hidden bg-gradient-to-br from-orange-950 to-amber-900 flex items-center justify-center">
        {combo.image && !imgError
          ? <img src={combo.image} alt={combo.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          : <Layers size={22} className="text-orange-400/60" />}
      </div>
      <div className="flex-1 min-w-0 py-3">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <h3 className="font-bold text-white text-sm">{combo.name}</h3>
          <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold">Combo</span>
          <span className="text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full">Ativo</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {combo.enrichedProducts?.map((cp, i) => <span key={i} className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{cp.emoji} {cp.name}</span>)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs text-gray-500">Venda: <span className="text-white font-semibold">{formatCurrency(combo.salePrice)}</span></span>
          <span className="text-xs text-gray-500">Custo: <span className="text-orange-400 font-semibold">{formatCurrency(combo.ingredientCost)}</span></span>
          <span className="text-xs text-gray-500">Margem real: <span className={`font-semibold ${combo.realProfit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(combo.realMargin)}</span></span>
        </div>
      </div>
      <div className="shrink-0 pr-4 flex flex-col items-end gap-2">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${impact.badge}`}>{impact.label}</span>
        <span className="text-xs text-orange-500 font-medium cursor-pointer">Ver detalhes →</span>
      </div>
    </div>
  )
}

export default function Dashboard({ enrichedProducts, enrichedCombos = [], totalExpenses, ingredientsCount, userName, setActiveTab, expensePerUnit, expenses = [] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [viewMode, setViewMode] = useState('grid')

  const categories = ['Todas', ...new Set(enrichedProducts.map((p) => p.category))]

  const filtered = enrichedProducts.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = category === 'Todas' || p.category === category
    return matchSearch && matchCategory
  })

  const sortedByRealProfit = [...enrichedProducts].sort((a, b) => b.realProfit - a.realProfit)
  const mostProfitable = sortedByRealProfit[0]
  const leastProfitable = sortedByRealProfit[sortedByRealProfit.length - 1]

  const statsCards = [
    {
      label: 'Produtos Cadastrados',
      value: String(enrichedProducts.length),
      sub: 'Total de produtos',
      icon: ShoppingBag,
      iconBg: 'bg-purple-500/15',
      iconColor: 'text-purple-400',
      valueColor: 'text-white',
    },
    {
      label: 'Total de Combos',
      value: String(enrichedCombos.length),
      sub: 'Combos cadastrados',
      icon: Layers,
      iconBg: 'bg-teal-500/15',
      iconColor: 'text-teal-400',
      valueColor: 'text-white',
    },
    {
      label: 'Total de Despesas Fixas',
      value: formatCurrency(totalExpenses),
      sub: 'Em despesas fixas',
      icon: DollarSign,
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      valueColor: 'text-red-400',
    },
    {
      label: 'Produto Mais Lucrativo',
      value: mostProfitable ? formatPercent(mostProfitable.realMargin) : '—',
      sub: mostProfitable ? `${mostProfitable.emoji} ${mostProfitable.name}` : '',
      icon: Star,
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-400',
    },
    {
      label: 'Produto Menos Lucrativo',
      value: leastProfitable ? leastProfitable.name : '—',
      sub: leastProfitable ? `Margem real: ${formatPercent(leastProfitable.realMargin)}` : '',
      icon: TrendingDown,
      iconBg: 'bg-gray-700/40',
      iconColor: 'text-gray-500',
      valueColor: 'text-gray-300',
      emoji: leastProfitable?.emoji,
    },
  ]

  return (
    <div className="p-5 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {userName ? <><span className="text-orange-400 font-medium">Olá, {userName} 👋</span>{' · '}</> : ''}
            Visão geral do seu cardápio, custos, margens e despesas
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('ingredients')}
            className="flex items-center gap-2 border border-gray-700 hover:border-orange-500/60 text-gray-400 hover:text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer"
          >
            <ChefHat size={15} />
            Receitas
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            <Zap size={15} />
            Otimizar produto
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {statsCards.map((card, i) => (
          <div
            key={i}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                <card.icon size={15} className={card.iconColor} />
              </div>
              <p className="text-gray-500 text-[11px] leading-tight">{card.label}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {card.emoji && <span className="text-base">{card.emoji}</span>}
              <p className={`font-bold text-sm leading-tight truncate ${card.valueColor}`}>{card.value}</p>
            </div>
            {card.sub && <p className="text-gray-600 text-[11px] mt-1 truncate">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Busca + Filtro + Toggle */}
      <div className="flex items-center gap-2 md:gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-gray-400 text-sm focus:outline-none focus:border-orange-500 transition-colors cursor-pointer shrink-0"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'Todas' ? 'Todas Categorias' : c}
            </option>
          ))}
        </select>
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-0.5 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-white'}`}
            title="Grade"
          >
            <Grid3X3 size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-white'}`}
            title="Lista"
          >
            <LayoutList size={15} />
          </button>
        </div>
      </div>

      {/* Produtos */}
      {filtered.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-14 text-center border border-gray-800">
          <p className="text-5xl mb-4">🍔</p>
          <p className="text-gray-500 text-sm">
            {search || category !== 'Todas'
              ? 'Nenhum produto encontrado para essa busca.'
              : 'Nenhum produto cadastrado ainda.'}
          </p>
          {!search && category === 'Todas' && (
            <button
              onClick={() => setActiveTab('products')}
              className="mt-4 text-orange-500 hover:text-orange-400 text-sm font-medium cursor-pointer"
            >
              Adicionar primeiro produto →
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
          {filtered.map((p) => (
            <ProductCardGrid key={p.id} product={p} expensePerUnit={expensePerUnit} />
          ))}
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {filtered.map((p) => (
            <ProductCardList key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Combos */}
      {enrichedCombos.length > 0 && (() => {
        const filteredCombos = enrichedCombos.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        return filteredCombos.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <Layers size={18} className="text-orange-400" />
              <h2 className="text-base font-bold text-white">Combos</h2>
              <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-medium">
                {filteredCombos.length} combo{filteredCombos.length !== 1 ? 's' : ''}
              </span>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                {filteredCombos.map((c) => <ComboCardGrid key={c.id} combo={c} expensePerUnit={expensePerUnit} />)}
              </div>
            ) : (
              <div className="space-y-2 pb-4">
                {filteredCombos.map((c) => <ComboCardList key={c.id} combo={c} />)}
              </div>
            )}
          </div>
        ) : null
      })()}

      {/* Mobile: Acesso Rápido */}
      <div className="md:hidden mt-6">
        <p className="text-gray-500 text-sm font-semibold mb-3">Acesso rápido</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { id: 'ingredients', label: 'Insumos',  icon: Package,   color: 'text-blue-400',   bg: 'bg-blue-500/10' },
            { id: 'analytics',  label: 'Análises', icon: BarChart3, color: 'text-green-400',  bg: 'bg-green-500/10' },
            { id: 'expenses',   label: 'Despesas', icon: Receipt,   color: 'text-red-400',    bg: 'bg-red-500/10' },
            { id: 'products',   label: 'Produtos', icon: ShoppingBag, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors cursor-pointer"
            >
              <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
                <item.icon size={19} className={item.color} />
              </div>
              <span className="text-gray-500 text-[11px]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
