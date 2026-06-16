import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import Modal from './Modal'
import { formatCurrency } from '../utils'
import { getDraftKey, saveDraftLS, loadDraftLS, clearDraftLS } from '../hooks/useDraft'

const UNITS = ['kg', 'g', 'litro', 'ml', 'unidade']
const EMPTY_FORM = { name: '', price: '', quantity: '', unit: 'kg' }
const PREFIX = 'insumo'

export default function Ingredients({ ingredients, onSave, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [originalForm, setOriginalForm] = useState(EMPTY_FORM)
  const [hasDraft, setHasDraft] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const totalValue = ingredients.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0)

  // Auto-save draft while modal is open
  useEffect(() => {
    if (!modalOpen) return
    saveDraftLS(getDraftKey(PREFIX, editing), form)
  }, [form, modalOpen, editing])

  const openAdd = () => {
    const key = getDraftKey(PREFIX, null)
    const draft = loadDraftLS(key)
    const meaningful = draft && draft.name?.trim()
    setEditing(null)
    setOriginalForm(EMPTY_FORM)
    setForm(meaningful ? draft : EMPTY_FORM)
    setHasDraft(!!meaningful)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    const key = getDraftKey(PREFIX, item.id)
    const draft = loadDraftLS(key)
    const original = { name: item.name, price: item.price, quantity: item.quantity, unit: item.unit }
    const isDiff = draft && JSON.stringify(draft) !== JSON.stringify(original)
    setEditing(item.id)
    setOriginalForm(original)
    setForm(isDiff ? draft : original)
    setHasDraft(!!isDiff)
    setModalOpen(true)
  }

  const discardDraft = () => {
    clearDraftLS(getDraftKey(PREFIX, editing))
    setForm(originalForm)
    setHasDraft(false)
  }

  const closeModal = () => {
    clearDraftLS(getDraftKey(PREFIX, editing))
    setHasDraft(false)
    setModalOpen(false)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return
    const data = { ...form, price: Number(form.price), quantity: Number(form.quantity) }
    setSaving(true)
    try {
      await onSave(data, editing)
      clearDraftLS(getDraftKey(PREFIX, editing))
      setHasDraft(false)
      setModalOpen(false)
    } catch (err) {
      console.error('Erro ao salvar insumo:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await onDelete(id)
    } catch (err) {
      console.error('Erro ao excluir insumo:', err)
    }
    setDeleteId(null)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white">Insumos</h1>
          <p className="text-gray-400 text-sm mt-1">{ingredients.length} ingredientes cadastrados</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-orange-500/20"
        >
          <Plus size={16} />
          Novo Insumo
        </button>
      </div>

      {ingredients.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Total de Itens</p>
            <p className="text-white font-bold text-xl">{ingredients.length}</p>
            <p className="text-gray-600 text-xs">ingredientes</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Valor em Estoque</p>
            <p className="text-orange-400 font-bold text-xl">{formatCurrency(totalValue)}</p>
            <p className="text-gray-600 text-xs">total investido</p>
          </div>
        </div>
      )}

      {ingredients.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-14 text-center border border-gray-800">
          <Package size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum insumo cadastrado ainda.</p>
          <button onClick={openAdd} className="mt-4 text-orange-500 hover:text-orange-400 text-sm font-medium cursor-pointer">
            Adicionar primeiro insumo →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {ingredients.map((item) => {
            const total = Number(item.price) * Number(item.quantity)
            return (
              <div key={item.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4 hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                  <Package size={18} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{item.name}</p>
                  <div className="flex gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">Preço: <span className="text-orange-400 font-medium">{formatCurrency(item.price)}/{item.unit}</span></span>
                    <span className="text-xs text-gray-500">Qtd: <span className="text-white font-medium">{item.quantity} {item.unit}</span></span>
                    <span className="text-xs text-gray-500">Total: <span className="text-green-400 font-medium">{formatCurrency(total)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(item)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteId(item.id)} className="w-9 h-9 bg-gray-800 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar Insumo' : 'Novo Insumo'}>
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Ingrediente *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Carne Bovina 80/20"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Preço Unitário (R$) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*/, '$1')
                  setForm((f) => ({ ...f, price: v }))
                }}
                onBlur={() => setForm((f) => ({ ...f, price: f.price === '' ? '0' : f.price }))}
                placeholder="0,00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Unidade</label>
              <select
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quantidade em Estoque</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.quantity}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*/, '$1')
                setForm((f) => ({ ...f, quantity: v }))
              }}
              onBlur={() => setForm((f) => ({ ...f, quantity: f.quantity === '' ? '0' : f.quantity }))}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {form.price > 0 && form.quantity > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-gray-400 text-xs mb-1">Valor total em estoque</p>
              <p className="text-green-400 font-bold text-lg">{formatCurrency(Number(form.price) * Number(form.quantity))}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={closeModal} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.price || saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors cursor-pointer"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Adicionar Insumo'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar Exclusão">
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-red-400" />
          </div>
          <p className="text-gray-300 mb-1">Excluir este insumo?</p>
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
