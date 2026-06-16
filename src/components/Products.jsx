import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Camera, X, ImageOff, ChefHat, AlertCircle, Layers } from 'lucide-react'
import Modal from './Modal'
import CombosTab from './CombosTab'
import { formatCurrency, formatPercent, getIngredientRecipeInfo } from '../utils'
import { getDraftKey, saveDraftLS, loadDraftLS, clearDraftLS } from '../hooks/useDraft'
import { compressImage, formatFileSize } from '../lib/compress'

const CATEGORIES = ['Hambúrguer', 'Bebida', 'Acompanhamento', 'Sobremesa', 'Outro']
const FOOD_EMOJIS = ['🍔', '🍟', '🌮', '🌯', '🥤', '🍕', '🥪', '🌭', '🥗', '🍦', '🧁', '☕', '🧃', '🍺', '🧅', '🫕', '🍗', '🧆', '🥨', '🍩']
const EMPTY_FORM = { name: '', emoji: '🍔', category: 'Hambúrguer', salePrice: '', recipe: [], image: '', isNew: true }
const PREFIX = 'produto'

export default function Products({ products, onProductSave, onProductDelete, ingredients, expensePerUnit = 0, combos, onComboSave, onComboDelete, enrichedCombos }) {
  const [activeTab, setActiveTab] = useState('individual')
  const comboTabRef = useRef(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [originalForm, setOriginalForm] = useState(EMPTY_FORM)
  const [hasDraft, setHasDraft] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [imageError, setImageError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoWarning, setPhotoWarning] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [compressInfo, setCompressInfo] = useState(null)
  const fileInputRef = useRef(null)

  const recipeTotal = form.recipe.reduce((sum, item) => {
    const ing = ingredients.find((i) => i.id === item.ingredientId)
    if (!ing || !item.quantity || Number(item.quantity) <= 0) return sum
    return sum + Number(item.quantity) * getIngredientRecipeInfo(ing).costPerUnit
  }, 0)

  const salePrice = Number(form.salePrice)
  const grossProfit = salePrice - recipeTotal
  const grossMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0
  const realProfit = grossProfit - expensePerUnit
  const realMargin = salePrice > 0 ? (realProfit / salePrice) * 100 : 0

  // Auto-save draft while modal is open
  useEffect(() => {
    if (!modalOpen) return
    saveDraftLS(getDraftKey(PREFIX, editing), form)
  }, [form, modalOpen, editing])

  const processFile = (file) => {
    setImageError('')
    setCompressInfo(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImageError('Formato inválido. Use JPG, PNG ou WEBP.'); return }
    if (file.size > 15 * 1024 * 1024) { setImageError('Foto muito grande. O limite é 15 MB.'); return }
    const reader = new FileReader()
    reader.onload = async (e) => {
      setCompressing(true)
      try {
        const result = await compressImage(e.target.result)
        setForm((f) => ({ ...f, image: result.compressed }))
        setCompressInfo(result)
      } catch {
        setImageError('Erro ao processar a imagem.')
      } finally {
        setCompressing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e) => { const file = e.target.files[0]; if (file) processFile(file); e.target.value = '' }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) processFile(file) }

  const addRecipeItem = () => setForm((f) => ({ ...f, recipe: [...f.recipe, { ingredientId: '', quantity: '' }] }))
  const removeRecipeItem = (index) => setForm((f) => ({ ...f, recipe: f.recipe.filter((_, i) => i !== index) }))
  const updateRecipeItem = (index, field, value) =>
    setForm((f) => ({ ...f, recipe: f.recipe.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }))

  const openAdd = () => {
    const key = getDraftKey(PREFIX, null)
    const draft = loadDraftLS(key)
    const meaningful = draft && draft.name?.trim()
    setEditing(null)
    setOriginalForm(EMPTY_FORM)
    setForm(meaningful ? draft : EMPTY_FORM)
    setHasDraft(!!meaningful)
    setImageError('')
    setCompressInfo(null)
    setModalOpen(true)
  }

  const openEdit = (product) => {
    const key = getDraftKey(PREFIX, product.id)
    const draft = loadDraftLS(key)
    const original = {
      name: product.name, emoji: product.emoji, category: product.category,
      salePrice: product.salePrice, recipe: product.recipe || [],
      image: product.image || '', isNew: product.isNew || false,
    }
    const isDiff = draft && JSON.stringify(draft) !== JSON.stringify(original)
    setEditing(product.id)
    setOriginalForm(original)
    setForm(isDiff ? draft : original)
    setHasDraft(!!isDiff)
    setImageError('')
    setCompressInfo(null)
    setModalOpen(true)
  }

  const discardDraft = () => {
    clearDraftLS(getDraftKey(PREFIX, editing))
    setForm(originalForm)
    setHasDraft(false)
    setImageError('')
    setCompressInfo(null)
  }

  const closeModal = () => {
    clearDraftLS(getDraftKey(PREFIX, editing))
    setHasDraft(false)
    setModalOpen(false)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.salePrice) return
    const validRecipe = form.recipe.filter((r) => r.ingredientId && Number(r.quantity) > 0)
    const data = { ...form, salePrice: Number(form.salePrice), recipe: validRecipe }
    setSaving(true)
    try {
      const result = await onProductSave(data, editing, recipeTotal)
      clearDraftLS(getDraftKey(PREFIX, editing))
      setHasDraft(false)
      setModalOpen(false)
      if (result?.photoUploadFailed) {
        setPhotoWarning('Foto não foi salva, tente novamente. Edite o produto para adicionar a foto.')
      }
    } catch (err) {
      console.error('Erro ao salvar produto:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try { await onProductDelete(id) } catch (err) { console.error('Erro ao excluir produto:', err) }
    setDeleteId(null)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Produtos</h1>
          <p className="text-gray-400 text-sm mt-1">
            {activeTab === 'individual'
              ? `${products.length} produto${products.length !== 1 ? 's' : ''} cadastrado${products.length !== 1 ? 's' : ''}`
              : `${combos?.length ?? 0} combo${(combos?.length ?? 0) !== 1 ? 's' : ''} cadastrado${(combos?.length ?? 0) !== 1 ? 's' : ''}`}
          </p>
        </div>
        {activeTab === 'individual' ? (
          <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-orange-500/20">
            <Plus size={16} />Novo Produto
          </button>
        ) : (
          <button onClick={() => comboTabRef.current?.triggerOpen()} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-orange-500/20">
            <Layers size={16} />Novo Combo
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 bg-gray-800/60 rounded-xl p-1 w-fit mb-6">
        <button onClick={() => setActiveTab('individual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === 'individual' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
          Individuais ({products.length})
        </button>
        <button onClick={() => setActiveTab('combo')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${activeTab === 'combo' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
          Combos ({combos?.length ?? 0})
        </button>
      </div>

      {activeTab === 'combo' && (
        <CombosTab ref={comboTabRef} combos={combos ?? []} onSave={onComboSave} onDelete={onComboDelete}
          enrichedCombos={enrichedCombos ?? []} products={products} ingredients={ingredients} expensePerUnit={expensePerUnit} />
      )}

      {photoWarning && (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <ImageOff size={15} className="text-red-400 shrink-0" />
            <span className="text-red-300 text-sm">{photoWarning}</span>
          </div>
          <button onClick={() => setPhotoWarning('')} className="text-red-400 hover:text-red-300 ml-3 shrink-0 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {activeTab === 'individual' && (products.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-14 text-center border border-gray-800">
          <p className="text-5xl mb-4">🍔</p>
          <p className="text-gray-400">Nenhum produto cadastrado ainda.</p>
          <button onClick={openAdd} className="mt-4 text-orange-500 hover:text-orange-400 text-sm font-medium cursor-pointer">Adicionar primeiro produto →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const sp = Number(product.salePrice)
            const ic = Number(product.ingredientCost)
            const gm = sp > 0 ? ((sp - ic) / sp) * 100 : 0
            return (
              <div key={product.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                  {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : product.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white text-sm">{product.name}</h3>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{product.category}</span>
                    {product.recipe && product.recipe.length > 0 && (
                      <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
                        {product.recipe.length} ingrediente{product.recipe.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1.5 flex-wrap">
                    <span className="text-xs text-gray-500">Venda: <span className="text-white font-medium">{formatCurrency(sp)}</span></span>
                    <span className="text-xs text-gray-500">Custo: <span className="text-orange-400 font-medium">{formatCurrency(ic)}</span></span>
                    <span className="text-xs text-gray-500">Margem bruta: <span className="text-green-400 font-medium">{formatPercent(gm)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(product)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteId(product.id)} className="w-9 h-9 bg-gray-800 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          {hasDraft && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                <span className="text-amber-300 text-xs font-medium">Rascunho restaurado</span>
              </div>
              <button type="button" onClick={discardDraft} className="text-amber-400 hover:text-amber-300 text-xs cursor-pointer ml-2 shrink-0">
                Descartar rascunho
              </button>
            </div>
          )}

          {/* Emoji */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Emoji</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FOOD_EMOJIS.map((e) => (
                <button key={e} onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all cursor-pointer ${form.emoji === e ? 'bg-orange-500 ring-2 ring-orange-400 ring-offset-1 ring-offset-gray-900' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  {e}
                </button>
              ))}
            </div>
            <input type="text" value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-center text-xl focus:outline-none focus:border-orange-500" maxLength={2} />
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Produto *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Classic Smash"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Preço */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Preço de Venda (R$) *</label>
            <input type="number" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
              placeholder="0,00" min="0" step="0.01"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
          </div>

          {/* Receita */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChefHat size={15} className="text-orange-400" />
              <label className="text-sm font-medium text-gray-300">Receita / Ingredientes</label>
            </div>
            {ingredients.length === 0 ? (
              <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-yellow-300/80 text-sm">Nenhum insumo cadastrado. Vá em <span className="font-semibold text-yellow-400">Insumos</span> e cadastre seus ingredientes antes de montar a receita.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {form.recipe.length === 0 && <p className="text-gray-600 text-sm text-center py-3">Nenhum ingrediente na receita ainda.</p>}
                {form.recipe.map((item, index) => {
                  const ing = ingredients.find((i) => i.id === item.ingredientId)
                  const info = ing ? getIngredientRecipeInfo(ing) : null
                  const itemCost = info && item.quantity ? Number(item.quantity) * info.costPerUnit : 0
                  return (
                    <div key={index} className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                      <div className="flex items-center gap-2 p-2.5">
                        <select value={item.ingredientId} onChange={(e) => updateRecipeItem(index, 'ingredientId', e.target.value)}
                          className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors">
                          <option value="">Selecionar insumo</option>
                          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <button type="button" onClick={() => removeRecipeItem(index)}
                          className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-500/20 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors cursor-pointer shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                      {item.ingredientId && info && (
                        <div className="flex items-center gap-3 px-2.5 pb-2.5">
                          <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden focus-within:border-orange-500 transition-colors">
                            <input type="number" value={item.quantity} onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                              placeholder="0" min="0" step="0.1"
                              className="w-20 px-3 py-1.5 text-white text-sm bg-transparent focus:outline-none placeholder-gray-600" />
                            <span className="text-orange-400 text-xs font-semibold pr-3 shrink-0 border-l border-gray-700 pl-2">{info.inputUnit}</span>
                          </div>
                          <span className="text-gray-600 text-xs shrink-0">{formatCurrency(info.priceRef)}/{info.unitRef}</span>
                          <span className={`text-sm font-bold ml-auto shrink-0 ${itemCost > 0 ? 'text-orange-400' : 'text-gray-700'}`}>{itemCost > 0 ? formatCurrency(itemCost) : '—'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={addRecipeItem}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-700 hover:border-orange-500/50 rounded-xl py-2.5 text-gray-500 hover:text-orange-400 text-sm transition-colors cursor-pointer">
                  <Plus size={14} />Adicionar ingrediente
                </button>
                {form.recipe.length > 0 && (
                  <div className="bg-gray-900 rounded-xl border border-gray-700 p-3 flex items-center justify-between">
                    <span className="text-gray-400 text-sm font-medium">Custo total da receita</span>
                    <span className="text-orange-400 font-bold text-base">{formatCurrency(recipeTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Foto */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Foto do Produto</label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            {form.image ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-700 h-44">
                <img src={form.image} alt="preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
                <button type="button" onClick={() => { setForm((f) => ({ ...f, image: '' })); setImageError(''); setCompressInfo(null) }}
                  className="absolute top-2 right-2 w-8 h-8 bg-gray-900/80 hover:bg-gray-900 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors cursor-pointer"><X size={15} /></button>
                <button type="button" onClick={() => fileInputRef.current.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-gray-900/80 hover:bg-gray-900 text-gray-300 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"><Camera size={13} />Trocar foto</button>
              </div>
            ) : (
              <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                onDrop={handleDrop} onClick={() => fileInputRef.current.click()}
                className={`h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${dragging ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800/50 hover:border-orange-500/60 hover:bg-gray-800'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${dragging ? 'bg-orange-500/20' : 'bg-gray-700'}`}>
                  <Camera size={22} className={dragging ? 'text-orange-400' : 'text-gray-400'} />
                </div>
                <div className="text-center">
                  <p className="text-gray-300 text-sm font-medium">{dragging ? 'Solte aqui!' : 'Arraste uma foto ou clique para selecionar'}</p>
                  <p className="text-gray-600 text-xs mt-1">JPG, PNG ou WEBP · máx. 2 MB</p>
                </div>
              </div>
            )}
            {imageError && <div className="flex items-center gap-2 mt-2 text-red-400 text-xs"><ImageOff size={13} />{imageError}</div>}
            {compressing && (
              <div className="flex items-center gap-2 mt-2 text-gray-400 text-xs">
                <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin shrink-0" />
                Comprimindo imagem...
              </div>
            )}
            {compressInfo && !compressing && !imageError && (
              <div className="mt-2 text-xs">
                {compressInfo.skipped ? (
                  <span className="text-gray-500">✓ Imagem já otimizada ({formatFileSize(compressInfo.finalKB)})</span>
                ) : (
                  <span className="text-green-400">
                    ✓ Foto otimizada: {formatFileSize(compressInfo.originalKB)} → {formatFileSize(compressInfo.finalKB)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Badge Novo */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm((f) => ({ ...f, isNew: !f.isNew }))}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.isNew ? 'bg-orange-500' : 'bg-gray-700'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.isNew ? 'left-4' : 'left-0.5'}`} />
            </button>
            <label className="text-sm text-gray-300 cursor-pointer" onClick={() => setForm((f) => ({ ...f, isNew: !f.isNew }))}>
              Marcar como <span className="text-orange-400 font-medium">Novo</span>
            </label>
          </div>

          {/* Análise em tempo real */}
          {salePrice > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Análise em tempo real</p>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-xs text-gray-500 mb-1">Custo da Receita</p><p className="text-orange-400 font-bold text-sm">{formatCurrency(recipeTotal)}</p></div>
                <div><p className="text-xs text-gray-500 mb-1">Lucro Bruto</p><p className={`font-bold text-sm ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(grossProfit)}</p></div>
                <div><p className="text-xs text-gray-500 mb-1">Margem Bruta</p><p className={`font-bold text-sm ${grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(grossMargin)}</p></div>
              </div>
              {expensePerUnit > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-700/60">
                  <div><p className="text-xs text-gray-500 mb-1">Desp. por venda</p><p className="text-gray-400 font-bold text-sm">{formatCurrency(expensePerUnit)}</p></div>
                  <div><p className="text-xs text-gray-500 mb-1">Lucro Real</p><p className={`font-bold text-sm ${realProfit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatCurrency(realProfit)}</p></div>
                  <div><p className="text-xs text-gray-500 mb-1">Margem Real</p><p className={`font-bold text-sm ${realMargin >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(realMargin)}</p></div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={closeModal} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name.trim() || !form.salePrice || saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors cursor-pointer">
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Adicionar Produto'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar Exclusão">
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-400" /></div>
          <p className="text-gray-300 mb-1">Excluir este produto?</p>
          <p className="text-gray-500 text-sm mb-6">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">Cancelar</button>
            <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium transition-colors cursor-pointer">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
