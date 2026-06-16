import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import { uploadPhotoIfNeeded } from './lib/storage'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Ingredients from './components/Ingredients'
import Expenses from './components/Expenses'
import Analytics from './components/Analytics'
import InstallBanner from './components/InstallBanner'
import { getIngredientRecipeInfo } from './utils'

// ── Field mapping: DB (PT) → app (EN) ──
const ingFromDB = (r) => ({
  id: r.id, name: r.nome, price: Number(r.preco),
  quantity: Number(r.quantidade), unit: r.unidade,
})

const prodFromDB = (r) => ({
  id: r.id, name: r.nome, salePrice: Number(r.preco_venda),
  emoji: r.emoji || '🍔', category: r.categoria || 'Hambúrguer',
  image: r.foto_url || '', isNew: r.is_novo ?? false,
  ingredientCost: Number(r.custo_manual || 0),
  recipe: (r.receita_ingredientes || []).map((ri) => ({
    ingredientId: ri.ingrediente_id, quantity: Number(ri.quantidade),
  })),
})

const expFromDB = (r) => ({
  id: r.id, name: r.nome, monthlyAmount: Number(r.valor),
})

const comboFromDB = (r) => ({
  id: r.id, name: r.nome, salePrice: Number(r.preco_venda),
  image: r.foto_url || '', isNew: r.is_novo ?? false,
  products: (r.combo_produtos || []).map((cp) => ({ productId: cp.produto_id })),
  extras: (r.combo_extras || []).map((ce) => ({
    ingredientId: ce.ingrediente_id, quantity: Number(ce.quantidade),
  })),
})

// ── One-time migration from localStorage ──
function tryParse(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

async function migrateFromLocalStorage(userId) {
  const lsIngs = tryParse('bc_ingredients') || []
  const lsProds = tryParse('bc_products_v3') || []
  const lsExps = tryParse('bc_expenses_v2') || []
  const lsCombos = tryParse('bc_combos') || []

  if (!lsIngs.length && !lsProds.length && !lsExps.length && !lsCombos.length) return

  const ingIdMap = {}
  const prodIdMap = {}

  if (lsIngs.length > 0) {
    const { data: created } = await supabase.from('insumos').insert(
      lsIngs.map((i) => ({ nome: i.name, preco: Number(i.price), quantidade: Number(i.quantity), unidade: i.unit, user_id: userId }))
    ).select()
    if (created) lsIngs.forEach((i, idx) => { ingIdMap[i.id] = created[idx]?.id })
  }

  for (const p of lsProds) {
    let foto_url = p.image || ''
    if (foto_url.startsWith('data:')) {
      try { foto_url = await uploadPhotoIfNeeded(foto_url) } catch { foto_url = '' }
    }
    const { data: created } = await supabase.from('produtos').insert({
      nome: p.name, preco_venda: Number(p.salePrice), emoji: p.emoji || '🍔',
      categoria: p.category || 'Hambúrguer', foto_url, is_novo: p.isNew || false,
      custo_manual: Number(p.ingredientCost || 0), user_id: userId,
    }).select().single()
    if (!created) continue
    prodIdMap[p.id] = created.id
    const validRecipe = (p.recipe || []).filter((r) => r.ingredientId && ingIdMap[r.ingredientId])
    if (validRecipe.length > 0) {
      await supabase.from('receita_ingredientes').insert(
        validRecipe.map((r) => ({ produto_id: created.id, ingrediente_id: ingIdMap[r.ingredientId], quantidade: Number(r.quantity) }))
      )
    }
  }

  if (lsExps.length > 0) {
    await supabase.from('despesas').insert(
      lsExps.map((e) => ({ nome: e.name, valor: Number(e.monthlyAmount), user_id: userId }))
    )
  }

  for (const combo of lsCombos) {
    let foto_url = combo.image || ''
    if (foto_url.startsWith('data:')) {
      try { foto_url = await uploadPhotoIfNeeded(foto_url) } catch { foto_url = '' }
    }
    const { data: created } = await supabase.from('combos').insert({
      nome: combo.name, preco_venda: Number(combo.salePrice), foto_url, is_novo: combo.isNew || false, user_id: userId,
    }).select().single()
    if (!created) continue
    const vProds = (combo.products || []).filter((cp) => cp.productId && prodIdMap[cp.productId])
    if (vProds.length > 0) {
      await supabase.from('combo_produtos').insert(vProds.map((cp) => ({ combo_id: created.id, produto_id: prodIdMap[cp.productId] })))
    }
    const vExtras = (combo.extras || []).filter((e) => e.ingredientId && ingIdMap[e.ingredientId])
    if (vExtras.length > 0) {
      await supabase.from('combo_extras').insert(vExtras.map((e) => ({ combo_id: created.id, ingrediente_id: ingIdMap[e.ingredientId], quantidade: Number(e.quantity) })))
    }
  }

  localStorage.removeItem('bc_products_v3')
  localStorage.removeItem('bc_ingredients')
  localStorage.removeItem('bc_expenses_v2')
  localStorage.removeItem('bc_combos')
}

// ── Authenticated app ──
function AppInner() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [products, setProducts] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [expenses, setExpenses] = useState([])
  const [combos, setCombos] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [monthlyUnits, setMonthlyUnitsState] = useState(() => {
    try { return Number(localStorage.getItem('bc_monthly_units') || 1000) } catch { return 1000 }
  })
  const userName = user?.email?.split('@')[0] || 'Burger Boss'

  const setMonthlyUnits = (v) => {
    setMonthlyUnitsState(v)
    localStorage.setItem('bc_monthly_units', String(v))
  }

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    setDataLoading(true)
    const [ingsRes, prodsRes, expsRes, combosRes] = await Promise.all([
      supabase.from('insumos').select('*'),
      supabase.from('produtos').select('*, receita_ingredientes(ingrediente_id, quantidade)'),
      supabase.from('despesas').select('*'),
      supabase.from('combos').select('*, combo_produtos(produto_id), combo_extras(ingrediente_id, quantidade)'),
    ])

    const ings = (ingsRes.data || []).map(ingFromDB)
    const prods = (prodsRes.data || []).map(prodFromDB)
    const exps = (expsRes.data || []).map(expFromDB)
    const cmbs = (combosRes.data || []).map(comboFromDB)

    // Migrate localStorage data on first login (only if Supabase is empty)
    if (ings.length === 0 && prods.length === 0 && exps.length === 0) {
      try {
        await migrateFromLocalStorage(user.id)
        const [i2, p2, e2, c2] = await Promise.all([
          supabase.from('insumos').select('*'),
          supabase.from('produtos').select('*, receita_ingredientes(ingrediente_id, quantidade)'),
          supabase.from('despesas').select('*'),
          supabase.from('combos').select('*, combo_produtos(produto_id), combo_extras(ingrediente_id, quantidade)'),
        ])
        setIngredients((i2.data || []).map(ingFromDB))
        setProducts((p2.data || []).map(prodFromDB))
        setExpenses((e2.data || []).map(expFromDB))
        setCombos((c2.data || []).map(comboFromDB))
      } catch {
        setIngredients(ings)
        setProducts(prods)
        setExpenses(exps)
        setCombos(cmbs)
      }
    } else {
      setIngredients(ings)
      setProducts(prods)
      setExpenses(exps)
      setCombos(cmbs)
    }
    setDataLoading(false)
  }

  // ── Ingredient CRUD ──
  const handleIngredientSave = async (form, editingId) => {
    const dbData = { nome: form.name, preco: Number(form.price), quantidade: Number(form.quantity), unidade: form.unit, user_id: user.id }
    if (editingId) {
      const { data, error } = await supabase.from('insumos').update(dbData).eq('id', editingId).select().single()
      if (error) throw error
      setIngredients((prev) => prev.map((i) => (i.id === editingId ? ingFromDB(data) : i)))
    } else {
      const { data, error } = await supabase.from('insumos').insert(dbData).select().single()
      if (error) throw error
      setIngredients((prev) => [...prev, ingFromDB(data)])
    }
  }

  const handleIngredientDelete = async (id) => {
    const { error } = await supabase.from('insumos').delete().eq('id', id)
    if (error) throw error
    setIngredients((prev) => prev.filter((i) => i.id !== id))
  }

  // ── Expense CRUD ──
  const handleExpenseSave = async (form, editingId) => {
    const dbData = { nome: form.name, valor: Number(form.monthlyAmount), user_id: user.id }
    if (editingId) {
      const { data, error } = await supabase.from('despesas').update(dbData).eq('id', editingId).select().single()
      if (error) throw error
      setExpenses((prev) => prev.map((e) => (e.id === editingId ? expFromDB(data) : e)))
    } else {
      const { data, error } = await supabase.from('despesas').insert(dbData).select().single()
      if (error) throw error
      setExpenses((prev) => [...prev, expFromDB(data)])
    }
  }

  const handleExpenseDelete = async (id) => {
    const { error } = await supabase.from('despesas').delete().eq('id', id)
    if (error) throw error
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  // ── Product CRUD ──
  const handleProductSave = async (form, editingId, recipeTotal) => {
    const uploadedUrl = await uploadPhotoIfNeeded(form.image, 'produtos')
    // null = upload falhou; '' = sem foto
    const foto_url = uploadedUrl ?? ''
    const photoUploadFailed = form.image && !form.image.startsWith('http') && uploadedUrl === null

    const dbData = {
      nome: form.name, preco_venda: Number(form.salePrice), emoji: form.emoji,
      categoria: form.category, foto_url, is_novo: form.isNew,
      custo_manual: recipeTotal, user_id: user.id,
    }
    const validRecipe = (form.recipe || []).filter((r) => r.ingredientId && Number(r.quantity) > 0)

    if (editingId) {
      const { data, error } = await supabase.from('produtos').update(dbData).eq('id', editingId).select().single()
      if (error) throw error
      await supabase.from('receita_ingredientes').delete().eq('produto_id', editingId)
      if (validRecipe.length > 0) {
        await supabase.from('receita_ingredientes').insert(
          validRecipe.map((r) => ({ produto_id: editingId, ingrediente_id: r.ingredientId, quantidade: Number(r.quantity) }))
        )
      }
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...prodFromDB(data), recipe: validRecipe } : p)))
    } else {
      const { data, error } = await supabase.from('produtos').insert(dbData).select().single()
      if (error) throw error
      if (validRecipe.length > 0) {
        await supabase.from('receita_ingredientes').insert(
          validRecipe.map((r) => ({ produto_id: data.id, ingrediente_id: r.ingredientId, quantidade: Number(r.quantity) }))
        )
      }
      setProducts((prev) => [...prev, { ...prodFromDB(data), recipe: validRecipe }])
    }

    return { photoUploadFailed }
  }

  const handleProductDelete = async (id) => {
    await supabase.from('receita_ingredientes').delete().eq('produto_id', id)
    const { error } = await supabase.from('produtos').delete().eq('id', id)
    if (error) throw error
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  // ── Combo CRUD ──
  const handleComboSave = async (form, editingId, totalCost) => {
    const uploadedUrl = await uploadPhotoIfNeeded(form.image, 'combos')
    const foto_url = uploadedUrl ?? ''
    const photoUploadFailed = form.image && !form.image.startsWith('http') && uploadedUrl === null
    const dbData = {
      nome: form.name, preco_venda: Number(form.salePrice),
      foto_url, is_novo: form.isNew, user_id: user.id,
    }
    const validProducts = (form.products || []).filter((p) => p.productId)
    const validExtras = (form.extras || []).filter((e) => e.ingredientId && Number(e.quantity) > 0)

    if (editingId) {
      const { data, error } = await supabase.from('combos').update(dbData).eq('id', editingId).select().single()
      if (error) throw error
      await supabase.from('combo_produtos').delete().eq('combo_id', editingId)
      await supabase.from('combo_extras').delete().eq('combo_id', editingId)
      if (validProducts.length > 0) {
        await supabase.from('combo_produtos').insert(validProducts.map((p) => ({ combo_id: editingId, produto_id: p.productId })))
      }
      if (validExtras.length > 0) {
        await supabase.from('combo_extras').insert(validExtras.map((e) => ({ combo_id: editingId, ingrediente_id: e.ingredientId, quantidade: Number(e.quantity) })))
      }
      setCombos((prev) => prev.map((c) => (c.id === editingId ? { ...comboFromDB(data), products: validProducts, extras: validExtras } : c)))
    } else {
      const { data, error } = await supabase.from('combos').insert(dbData).select().single()
      if (error) throw error
      if (validProducts.length > 0) {
        await supabase.from('combo_produtos').insert(validProducts.map((p) => ({ combo_id: data.id, produto_id: p.productId })))
      }
      if (validExtras.length > 0) {
        await supabase.from('combo_extras').insert(validExtras.map((e) => ({ combo_id: data.id, ingrediente_id: e.ingredientId, quantidade: Number(e.quantity) })))
      }
      setCombos((prev) => [...prev, { ...comboFromDB(data), products: validProducts, extras: validExtras }])
    }

    return { photoUploadFailed }
  }

  const handleComboDelete = async (id) => {
    await supabase.from('combo_produtos').delete().eq('combo_id', id)
    await supabase.from('combo_extras').delete().eq('combo_id', id)
    const { error } = await supabase.from('combos').delete().eq('id', id)
    if (error) throw error
    setCombos((prev) => prev.filter((c) => c.id !== id))
  }

  // ── Enriched data ──
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.monthlyAmount), 0)
  const expensePerUnit = Number(monthlyUnits) > 0 ? totalExpenses / Number(monthlyUnits) : 0

  const enrichedProducts = products.map((p) => {
    const salePrice = Number(p.salePrice)
    const ingredientCost = Number(p.ingredientCost)
    const grossProfit = salePrice - ingredientCost
    const grossMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0
    const realProfit = grossProfit - expensePerUnit
    const realMargin = salePrice > 0 ? (realProfit / salePrice) * 100 : 0
    const expenseImpact = salePrice > 0 ? (expensePerUnit / salePrice) * 100 : 0
    const impactLevel = expenseImpact < 15 ? 'low' : expenseImpact < 30 ? 'medium' : 'high'
    const enrichedRecipe = (p.recipe || []).map((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId)
      if (!ing) return null
      const info = getIngredientRecipeInfo(ing)
      return { ...item, name: ing.name, unit: info.inputUnit, cost: Number(item.quantity) * info.costPerUnit }
    }).filter(Boolean)
    return { ...p, salePrice, ingredientCost, grossProfit, grossMargin, realProfit, realMargin, expenseImpact, impactLevel, enrichedRecipe }
  })

  const enrichedCombos = combos.map((combo) => {
    const salePrice = Number(combo.salePrice)
    const productsCost = (combo.products || []).reduce((sum, cp) => {
      const p = products.find((pr) => pr.id === cp.productId)
      return sum + (p ? Number(p.ingredientCost) : 0)
    }, 0)
    const extrasCost = (combo.extras || []).reduce((sum, ex) => {
      const ing = ingredients.find((i) => i.id === ex.ingredientId)
      if (!ing || !ex.quantity || Number(ex.quantity) <= 0) return sum
      return sum + Number(ex.quantity) * getIngredientRecipeInfo(ing).costPerUnit
    }, 0)
    const ingredientCost = productsCost + extrasCost
    const grossProfit = salePrice - ingredientCost
    const grossMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0
    const realProfit = grossProfit - expensePerUnit
    const realMargin = salePrice > 0 ? (realProfit / salePrice) * 100 : 0
    const expenseImpact = salePrice > 0 ? (expensePerUnit / salePrice) * 100 : 0
    const impactLevel = expenseImpact < 15 ? 'low' : expenseImpact < 30 ? 'medium' : 'high'
    const enrichedProducts = (combo.products || []).map((cp) => {
      const p = products.find((pr) => pr.id === cp.productId)
      return p ? { ...cp, name: p.name, emoji: p.emoji, cost: Number(p.ingredientCost) } : null
    }).filter(Boolean)
    const enrichedExtras = (combo.extras || []).map((ex) => {
      const ing = ingredients.find((i) => i.id === ex.ingredientId)
      if (!ing) return null
      const info = getIngredientRecipeInfo(ing)
      return { ...ex, name: ing.name, unit: info.inputUnit, cost: Number(ex.quantity) * info.costPerUnit }
    }).filter(Boolean)
    return { ...combo, type: 'combo', salePrice, ingredientCost, productsCost, extrasCost, grossProfit, grossMargin, realProfit, realMargin, expenseImpact, impactLevel, enrichedProducts, enrichedExtras }
  })

  if (dataLoading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 animate-pulse">🍔</div>
          <p className="text-gray-400 text-sm">Carregando dados...</p>
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            enrichedProducts={enrichedProducts}
            enrichedCombos={enrichedCombos}
            totalExpenses={totalExpenses}
            ingredientsCount={ingredients.length}
            expenses={expenses}
            userName={userName}
            setActiveTab={setActiveTab}
            expensePerUnit={expensePerUnit}
          />
        )
      case 'products':
        return (
          <Products
            products={products}
            onProductSave={handleProductSave}
            onProductDelete={handleProductDelete}
            ingredients={ingredients}
            expensePerUnit={expensePerUnit}
            combos={combos}
            onComboSave={handleComboSave}
            onComboDelete={handleComboDelete}
            enrichedCombos={enrichedCombos}
          />
        )
      case 'ingredients':
        return (
          <Ingredients
            ingredients={ingredients}
            onSave={handleIngredientSave}
            onDelete={handleIngredientDelete}
          />
        )
      case 'expenses':
        return (
          <Expenses
            expenses={expenses}
            onSave={handleExpenseSave}
            onDelete={handleExpenseDelete}
            totalExpenses={totalExpenses}
            monthlyUnits={monthlyUnits}
            setMonthlyUnits={setMonthlyUnits}
            expensePerUnit={expensePerUnit}
          />
        )
      case 'analytics':
        return (
          <Analytics
            enrichedProducts={enrichedProducts}
            enrichedCombos={enrichedCombos}
            totalExpenses={totalExpenses}
            expensePerUnit={expensePerUnit}
            monthlyUnits={monthlyUnits}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="h-screen flex bg-gray-950 text-white overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        expenses={expenses}
        totalExpenses={totalExpenses}
        userName={userName}
        userEmail={user?.email || ''}
        onSignOut={signOut}
      />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {renderPage()}
      </main>
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <InstallBanner />
    </div>
  )
}

// ── Auth gate ──
function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 animate-pulse">🍔</div>
          <p className="text-gray-400 text-sm">Iniciando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Auth />

  return <AppInner />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
