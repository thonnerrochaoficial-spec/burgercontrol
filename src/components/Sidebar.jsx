import { LayoutDashboard, ShoppingBag, Package, Receipt, BarChart3, ChefHat, Settings, LogOut } from 'lucide-react'
import { formatCurrency } from '../utils'

const navItems = [
  { tab: 'dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
  { tab: 'products',    label: 'Produtos',      icon: ShoppingBag },
  { tab: 'ingredients', label: 'Insumos',       icon: Package },
  { tab: 'ingredients', label: 'Receitas',      icon: ChefHat },
  { tab: 'expenses',    label: 'Despesas',      icon: Receipt },
  { tab: 'analytics',  label: 'Análises',      icon: BarChart3 },
  { tab: null,          label: 'Configurações', icon: Settings },
]

export default function Sidebar({ activeTab, setActiveTab, expenses = [], totalExpenses = 0, userName = 'Burger Boss', userEmail = '', onSignOut }) {
  const topExpenses = [...expenses]
    .sort((a, b) => Number(b.monthlyAmount) - Number(a.monthlyAmount))
    .slice(0, 4)

  return (
    <aside className="hidden md:flex flex-col w-60 bg-gray-900 border-r border-gray-800 h-screen shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-orange-500/30 shrink-0">
            🍔
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">
              <span className="text-orange-500">Burger</span>
              <span className="text-white">Control</span>
            </h1>
            <p className="text-gray-500 text-[11px]">Gestão de Hamburgueria</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2 space-y-0.5 mt-1">
        {navItems.map(({ tab, label, icon: Icon }) => {
          const isActive = tab && activeTab === tab
          return (
            <button
              key={label}
              onClick={() => tab && setActiveTab(tab)}
              disabled={!tab}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                !tab
                  ? 'text-gray-700 cursor-not-allowed'
                  : isActive
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Resumo de Despesas */}
      {expenses.length > 0 && (
        <div className="mx-2 mt-3 bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Resumo de Despesas</p>
          <p className="text-orange-400 font-bold text-xl mb-4">{formatCurrency(totalExpenses)}</p>
          <div className="space-y-3">
            {topExpenses.map((e) => {
              const pct = totalExpenses > 0 ? (Number(e.monthlyAmount) / totalExpenses) * 100 : 0
              return (
                <div key={e.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs truncate pr-2">{e.name}</span>
                    <span className="text-gray-300 text-xs font-medium shrink-0">{formatCurrency(e.monthlyAmount)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-orange-500 h-1 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* User Profile */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{userName}</p>
            <p className="text-gray-500 text-[11px] truncate">{userEmail}</p>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sair"
              className="w-8 h-8 bg-gray-800 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
