import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Plus, Pencil, Trash2, Camera, X, ImageOff, Layers, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import Modal from './Modal'
import { formatCurrency, formatPercent, getIngredientRecipeInfo } from '../utils'
import { getDraftKey, saveDraftLS, loadDraftLS, clearDraftLS } from '../hooks/useDraft'
import { compressImage, formatFileSize } from '../lib/compress'

const EMPTY_FORM = {
  name: '', image: '', salePrice: '',
  products: [{ productId: '' }, { productId: '' }],
  extras: [], isNew: false,
}
const STEPS = ['Produtos', 'Extras', 'Precificação']
const PREFIX = 'combo'

const CombosTab = forwardRef(function CombosTab(
  { combos, onSave, onDelete, enrichedCombos, products, ingredients, expensePerUnit = 0 },
  ref
) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [step, setStep] = useState(1)
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

  useImperativeHandle(ref, () => ({ triggerOpen: openAdd }))

  const productsCost = form.products.reduce((sum, cp) => {
    const p = products.find((pr) => pr.id === cp.productId)
    return sum + (p ? Number(p.ingredientCost) : 0)
  }, 0)
  const extrasCost = form.extras.reduce((sum, ex) => {
    const ing = ingredients.find((i) => i.id === ex.ingredientId)
    if (!ing || !ex.quantity || Number(ex.quantity) <= 0) return sum
    return sum + Number(ex.quantity) * getIngredientRecipeInfo(ing).costPerUnit
  }, 0)
  const totalCost = productsCost + extrasCost
  const salePrice = Number(form.salePrice)
  const grossProfit = salePrice - totalCost
  const grossMargin = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0
  const realProfit = grossProfit - expensePerUnit
  const realMargin = salePrice > 0 ? (realProfit / salePrice) * 100 : 0
  const validProductCount = form.products.filter((p) => p.productId).length

  // Auto-save draft (form + current step) while modal is open
  useEffect(() => {
    if (!modalOpen) return
    saveDraftLS(getDraftKey(PREFIX, editing), { form, step })
  }, [form, step, modalOpen, editing])

  const addProduct = () => setForm((f) => ({ ...f, products: [...f.products, { productId: '' }] }))
  const removeProduct = (i) => setForm((f) => ({ ...f, products: f.products.filter((_, idx) => idx !== i) }))
  const updateProduct = (i, productId) =>
    setForm((f) => ({ ...f, products: f.products.map((p, idx) => (idx === i ? { productId } : p)) }))
  const addExtra = () => setForm((f) => ({ ...f, extras: [...f.extras, { ingredientId: '', quantity: '' }] }))
  const removeExtra = (i) => setForm((f) => ({ ...f, extras: f.extras.filter((_, idx) => idx !== i) }))
  const updateExtra = (i, field, value) =>
    setForm((f) => ({ ...f, extras: f.extras.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)) }))

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

  const openAdd = () => {
    const key = getDraftKey(PREFIX, null)
    const draft = loadDraftLS(key)
    const meaningful = draft?.form?.name?.trim() || draft?.form?.products?.some((p) => p.productId)
    setEditing(null)
    setOriginalForm(EMPTY_FORM)
    if (meaningful) {
      setForm(draft.form)
      setStep(draft.step || 1)
      setHasDraft(true)
    } else {
      setForm(EMPTY_FORM)
      setStep(1)
      setHasDraft(false)
    }
    setImageError('')
    setCompressInfo(null)
    setModalOpen(true)
  }

  const openEdit = (combo) => {
    const key = getDraftKey(PREFIX, combo.id)
    const draft = loadDraftLS(key)
    const original = {
      name: combo.name, image: combo.image || '', salePrice: combo.salePrice,
      products: combo.products?.length ? combo.products : [{ productId: '' }, { productId: '' }],
      extras: combo.extras || [], isNew: combo.isNew || false,
    }
    const isDiff = draft?.form && JSON.stringify(draft.form) !== JSON.stringify(original)
    setEditing(combo.id)
    setOriginalForm(original)
    if (isDiff) {
      setForm(draft.form)
      setStep(draft.step || 1)
      setHasDraft(true)
    } else {
      setForm(original)
      setStep(1)
      setHasDraft(false)
    }
    setImageError('')
    setCompressInfo(null)
    setModalOpen(true)
  }

  const discardDraft = () => {
    clearDraftLS(getDraftKey(PREFIX, editing))
    setForm(originalForm)
    setStep(1)
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
    const validProducts = form.products.filter((p) => p.productId)
    const validExtras = form.extras.filter((e) => e.ingredientId && Number(e.quantity) > 0)
    const data = { ...form, salePrice: Number(form.salePrice), products: validProducts, extras: validExtras }
    setSaving(true)
    try {
      const result = await onSave(data, editing, totalCost)
      clearDraftLS(getDraftKey(PREFIX, editing))
      setHasDraft(false)
      setModalOpen(false)
      if (result?.photoUploadFailed) {
        setPhotoWarning('Foto não foi salva, tente novamente. Edite o combo para adicionar a foto.')
      }
    } catch (err) {
      console.error('Erro ao salvar combo:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try { await onDelete(id) } catch (err) { console.error('Erro ao excluir combo:', err) }
    setDeleteId(null)
  }

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((label, i) => {
        const s = i + 1; const done = step > s; const active = step === s
        return (
          <div key={s} className={`flex items-center gap-1 ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                {done ? <Check size={12} /> : s}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-white' : 'text-gray-600'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ml-1 ${done ? 'bg-green-500/40' : 'bg-gray-700'}`} />}
          </div>
        )
      })}
    </div>
  )

  const DraftBanner = () => hasDraft ? (
    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 mb-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
        <span className="text-amber-300 text-xs font-medium">Rascunho restaurado</span>
      </div>
      <button type="button" onClick={discardDraft} className="text-amber-400 hover:text-amber-300 text-xs cursor-pointer ml-2 shrink-0">
        Descartar rascunho
      </button>
    </div>
  ) : null

  return (
    <div>
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

      {combos.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-14 text-center border border-gray-800">
          <Layers size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum combo cadastrado ainda.</p>
          <button onClick={openAdd} className="mt-4 text-orange-500 hover:text-orange-400 text-sm font-medium cursor-pointer">Criar primeiro combo →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {enrichedCombos.map((combo) => (
            <div key={combo.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                {combo.image ? <img src={combo.image} alt={combo.name} className="w-full h-full object-cover" /> : <Layers size={20} className="text-orange-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <h3 className="font-semibold text-white text-sm">{combo.name}</h3>
                  <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium">Combo</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {combo.enrichedProducts?.map((cp, i) => (
                    <span key={i} className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-md">{cp.emoji} {cp.name}</span>
                  ))}
                  {combo.enrichedExtras?.length > 0 && (
                    <span className="text-xs text-gray-600 self-center">+{combo.enrichedExtras.length} extra{combo.enrichedExtras.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-xs text-gray-500">Venda: <span className="text-white font-medium">{formatCurrency(combo.salePrice)}</span></span>
                  <span className="text-xs text-gray-500">Custo: <span className="text-orange-400 font-medium">{formatCurrency(combo.ingredientCost)}</span></span>
                  <span className="text-xs text-gray-500">Margem bruta: <span className="text-green-400 font-medium">{formatPercent(combo.grossMargin)}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(combo)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"><Pencil size={14} /></button>
                <button onClick={() => setDeleteId(combo.id)} className="w-9 h-9 bg-gray-800 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar Combo' : 'Novo Combo'}>
        <StepIndicator />
        <DraftBanner />

        {/* STEP 1 — Produtos */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-300 mb-0.5">Produtos do Combo</p>
              <p className="text-gray-600 text-xs mb-3">Selecione os produtos do cardápio que compõem este combo</p>
            </div>
            {products.length === 0 ? (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-yellow-300/80 text-sm">
                Nenhum produto cadastrado. Cadastre produtos antes de criar um combo.
              </div>
            ) : (
              <div className="space-y-2">
                {form.products.map((cp, i) => {
                  const p = products.find((pr) => pr.id === cp.productId)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select value={cp.productId} onChange={(e) => updateProduct(i, e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors">
                        <option value="">Selecionar produto</option>
                        {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.emoji} {pr.name}</option>)}
                      </select>
                      {p && <span className="text-orange-400 text-sm font-semibold shrink-0 w-20 text-right">{formatCurrency(p.ingredientCost)}</span>}
                      <button onClick={() => removeProduct(i)} disabled={form.products.length <= 1}
                        className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-red-500/20 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  )
                })}
                <button onClick={addProduct} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-700 hover:border-orange-500/50 rounded-xl py-2.5 text-gray-500 hover:text-orange-400 text-sm transition-colors cursor-pointer">
                  <Plus size={14} />Adicionar produto
                </button>
                {validProductCount > 0 && (
                  <div className="flex items-center justify-between bg-gray-900 rounded-xl border border-gray-700 px-4 py-2.5">
                    <span className="text-gray-400 text-sm">{validProductCount} produto{validProductCount !== 1 ? 's' : ''}</span>
                    <span className="text-orange-400 font-bold">{formatCurrency(productsCost)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">Cancelar</button>
              <button onClick={() => setStep(2)} disabled={validProductCount < 1}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-center gap-2">
                Próximo<ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Extras */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-300 mb-0.5">Extras do Combo <span className="text-gray-600 font-normal">(opcional)</span></p>
              <p className="text-gray-600 text-xs mb-3">Bebidas, molhos ou acompanhamentos adicionados como insumos</p>
            </div>
            <div className="space-y-2">
              {form.extras.length === 0 && <p className="text-gray-600 text-sm text-center py-2">Nenhum extra adicionado.</p>}
              {form.extras.map((ex, i) => {
                const ing = ingredients.find((ing) => ing.id === ex.ingredientId)
                const info = ing ? getIngredientRecipeInfo(ing) : null
                const cost = info && ex.quantity ? Number(ex.quantity) * info.costPerUnit : 0
                return (
                  <div key={i} className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                    <div className="flex items-center gap-2 p-2.5">
                      <select value={ex.ingredientId} onChange={(e) => updateExtra(i, 'ingredientId', e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors">
                        <option value="">Selecionar ingrediente</option>
                        {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                      </select>
                      <button onClick={() => removeExtra(i)} className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-500/20 flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"><X size={13} /></button>
                    </div>
                    {ex.ingredientId && info && (
                      <div className="flex items-center gap-3 px-2.5 pb-2.5">
                        <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden focus-within:border-orange-500 transition-colors">
                          <input type="number" value={ex.quantity} onChange={(e) => updateExtra(i, 'quantity', e.target.value)}
                            placeholder="0" min="0" step="0.1"
                            className="w-20 px-3 py-1.5 text-white text-sm bg-transparent focus:outline-none placeholder-gray-600" />
                          <span className="text-orange-400 text-xs font-semibold pr-3 shrink-0 border-l border-gray-700 pl-2">{info.inputUnit}</span>
                        </div>
                        <span className="text-gray-600 text-xs shrink-0">{formatCurrency(info.priceRef)}/{info.unitRef}</span>
                        <span className={`text-sm font-bold ml-auto shrink-0 ${cost > 0 ? 'text-orange-400' : 'text-gray-700'}`}>{cost > 0 ? formatCurrency(cost) : '—'}</span>
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={addExtra} className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-700 hover:border-orange-500/50 rounded-xl py-2.5 text-gray-500 hover:text-orange-400 text-sm transition-colors cursor-pointer">
                <Plus size={14} />Adicionar extra
              </button>
              <div className="bg-gray-900 rounded-xl border border-gray-700 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Produtos ({validProductCount})</span>
                  <span className="text-gray-300 font-medium">{formatCurrency(productsCost)}</span>
                </div>
                {extrasCost > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Extras</span>
                    <span className="text-gray-300 font-medium">{formatCurrency(extrasCost)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-700 pt-1.5">
                  <span className="text-gray-400 text-sm font-medium">Custo total do combo</span>
                  <span className="text-orange-400 font-bold text-base">{formatCurrency(totalCost)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer"><ChevronLeft size={16} />Voltar</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-center gap-2">Próximo<ChevronRight size={16} /></button>
            </div>
          </div>
        )}

        {/* STEP 3 — Precificação */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Combo *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Combo Smash Duplo" autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Preço de Venda (R$) *</label>
              <input type="number" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                placeholder="0,00" min="0" step="0.01"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Foto do Combo</label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
              {form.image ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-700 h-36">
                  <img src={form.image} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
                  <button type="button" onClick={() => { setForm((f) => ({ ...f, image: '' })); setImageError(''); setCompressInfo(null) }}
                    className="absolute top-2 right-2 w-8 h-8 bg-gray-900/80 rounded-full flex items-center justify-center text-gray-300 hover:text-white cursor-pointer"><X size={14} /></button>
                  <button type="button" onClick={() => fileInputRef.current.click()}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-gray-900/80 text-gray-300 hover:text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer"><Camera size={12} />Trocar</button>
                </div>
              ) : (
                <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop} onClick={() => fileInputRef.current.click()}
                  className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${dragging ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800/50 hover:border-orange-500/60 hover:bg-gray-800'}`}>
                  <Camera size={20} className={dragging ? 'text-orange-400' : 'text-gray-600'} />
                  <p className="text-gray-500 text-xs">{dragging ? 'Solte aqui!' : 'Clique ou arraste uma foto'}</p>
                </div>
              )}
              {imageError && <div className="flex items-center gap-2 mt-2 text-red-400 text-xs"><ImageOff size={12} />{imageError}</div>}
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

            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Composição do custo</p>
              <div className="space-y-1 text-xs">
                {form.products.filter((p) => p.productId).map((cp, i) => {
                  const p = products.find((pr) => pr.id === cp.productId)
                  return p ? (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-500">{p.emoji} {p.name}</span>
                      <span className="text-gray-400 font-medium">{formatCurrency(p.ingredientCost)}</span>
                    </div>
                  ) : null
                })}
                {form.extras.filter((e) => e.ingredientId && Number(e.quantity) > 0).map((ex, i) => {
                  const ing = ingredients.find((ing) => ing.id === ex.ingredientId)
                  if (!ing) return null
                  const info = getIngredientRecipeInfo(ing)
                  return (
                    <div key={`ex-${i}`} className="flex justify-between">
                      <span className="text-gray-500">+ {ing.name} ({ex.quantity}{info.inputUnit})</span>
                      <span className="text-gray-400 font-medium">{formatCurrency(Number(ex.quantity) * info.costPerUnit)}</span>
                    </div>
                  )
                })}
              </div>
              <div className={`border-t border-gray-700 pt-3 ${salePrice > 0 ? 'space-y-3' : 'flex justify-between'}`}>
                {salePrice > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div><p className="text-xs text-gray-500 mb-1">Custo Total</p><p className="text-orange-400 font-bold text-sm">{formatCurrency(totalCost)}</p></div>
                      <div><p className="text-xs text-gray-500 mb-1">Lucro Bruto</p><p className={`font-bold text-sm ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(grossProfit)}</p></div>
                      <div><p className="text-xs text-gray-500 mb-1">Margem Bruta</p><p className={`font-bold text-sm ${grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(grossMargin)}</p></div>
                    </div>
                    {expensePerUnit > 0 && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700/60">
                        <div><p className="text-xs text-gray-500 mb-1">Lucro Real</p><p className={`font-bold text-sm ${realProfit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatCurrency(realProfit)}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Margem Real</p><p className={`font-bold text-sm ${realMargin >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{formatPercent(realMargin)}</p></div>
                      </div>
                    )}
                  </>
                ) : (
                  <><span className="text-gray-400 text-sm font-medium">Custo Total</span><span className="text-orange-400 font-bold">{formatCurrency(totalCost)}</span></>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setStep(2)} className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer"><ChevronLeft size={16} />Voltar</button>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.salePrice || saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors cursor-pointer">
                {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Criar Combo'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar Exclusão">
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-400" /></div>
          <p className="text-gray-300 mb-1">Excluir este combo?</p>
          <p className="text-gray-500 text-sm mb-6">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">Cancelar</button>
            <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium transition-colors cursor-pointer">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  )
})

export default CombosTab
