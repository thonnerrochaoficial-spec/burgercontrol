import { LayoutDashboard, ShoppingBag, Package, Receipt, BarChart3 } from 'lucide-react'

const navItems = [
  { id: 'dashboard',   label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products',    label: 'Produtos',  icon: ShoppingBag },
  { id: 'ingredients', label: 'Insumos',   icon: Package },
  { id: 'expenses',    label: 'Despesas',  icon: Receipt },
  { id: 'analytics',  label: 'Análises',  icon: BarChart3 },
]

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/98 backdrop-blur-md border-t border-gray-800 flex z-50">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all cursor-pointer ${
            activeTab === id ? 'text-orange-500' : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  )
}
