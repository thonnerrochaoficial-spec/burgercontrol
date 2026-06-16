import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import Modal from './Modal'
import { formatCurrency } from '../utils'
import { getDraftKey, saveDraftLS, loadDraftLS, clearDraftLS } from '../hooks/useDraft'

const EMPTY_FORM = { name: '', monthlyAmount: '' }
const PREFIX = 'despesa'

export default function Expenses({ expenses, onSave, onDelete, totalExpenses, monthlyUnits, setMonthlyUnits, expensePerUnit }) {
  const [rawUnits, setRawUnits] = useState(String(monthlyUnits))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [originalForm, setOriginalForm] = useState(EMPTY_FORM)
  const [hasDraft, setHasDraft] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRawUnits(String(monthlyUnits)) }, [monthlyUnits])

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
    const original = { name: item.name, monthlyAmount: item.monthlyAmount }
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
    if (!form.name.trim() || !form.monthlyAmount) return
    const data = { ...form, monthlyAmount: Number(form.monthlyAmount) }
    setSaving(true)
    try {
      await onSave(data, editing)
      clearDraftLS(getDraftKey(PREFIX, editing))
      setHasDraft(false)
      setModalOpen(false)
    } catch (err) {
      console.error('Erro ao salvar despesa:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await onDelete(id)
    } catch (err) {
      console.error('Erro ao excluir despesa:', err)
    }
    setDeleteId(null)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white">Despesas Fixas</h1>
          <p className="text-gray-400 text-sm mt-1">Custos mensais do negócio</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-orange-500/20"
        >
          <Plus size={16} />
          Nova Despesa
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <p className="text-gray-400 text-xs">Total de Despesas Mensais</p>
            <Receipt size={16} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Custo Fixo por Venda</p>
          <p className="text-2xl font-bold text-orange-400">{formatCurrency(expensePerUnit)}</p>
          <p className="text-gray-600 text-xs mt-1">despesas ÷ vendas mensais</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-2">Vendas Mensais Estimadas</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={rawUnits}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*/, '$1')
                setRawUnits(v)
              }}
              onBlur={() => {
                const n = Number(rawUnits)
                const valid = rawUnits === '' || isNaN(n) ? 0 : n
                setMonthlyUnits(valid)
                setRawUnits(String(valid))
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-base font-bold focus:outline-none focus:border-orange-500 transition-colors"
            />
            <span className="text-gray-500 text-sm shrink-0">unid/mês</span>
          </div>
        </div>
      </div>

      <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 mb-6">
        <p className="text-orange-300/80 text-xs leading-relaxed">
          💡 O <span className="font-medium text-orange-400">custo fixo por venda</span> é calculado dividindo as despesas mensais pelo número estimado de vendas. Ajuste as vendas mensais para obter margens reais precisas.
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-14 text-center border border-gray-800">
          <Receipt size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma despesa cadastrada ainda.</p>
          <button onClick={openAdd} className="mt-4 text-orange-500 hover:text-orange-400 text-sm font-medium cursor-pointer">
            Adicionar primeira despesa →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((item) => {
            const percent = totalExpenses > 0 ? (Number(item.monthlyAmount) / totalExpenses) * 100 : 0
            return (
              <div key={item.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-white text-sm">{item.name}</p>
                      <p className="text-orange-400 font-semibold text-sm shrink-0 ml-3">{formatCurrency(item.monthlyAmount)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                        <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <span className="text-gray-500 text-xs shrink-0 w-10 text-right">{percent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-1">
                    <button onClick={() => openEdit(item)} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteId(item.id)} className="w-9 h-9 bg-gray-800 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Editar Despesa' : 'Nova Despesa Fixa'}>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Despesa *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Aluguel, Salários, Energia..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Valor Mensal (R$) *</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.monthlyAmount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*/, '$1')
                setForm((f) => ({ ...f, monthlyAmount: v }))
              }}
              onBlur={() => setForm((f) => ({ ...f, monthlyAmount: f.monthlyAmount === '' ? '0' : f.monthlyAmount }))}
              placeholder="0,00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {form.monthlyAmount > 0 && totalExpenses > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-gray-400 text-xs mb-2">Participação no total atual</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min((Number(form.monthlyAmount) / (totalExpenses + Number(form.monthlyAmount))) * 100, 100)}%` }} />
                </div>
                <span className="text-orange-400 text-sm font-medium shrink-0">
                  {((Number(form.monthlyAmount) / (totalExpenses + Number(form.monthlyAmount))) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={closeModal} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors cursor-pointer">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.monthlyAmount || saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors cursor-pointer"
            >
              {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Adicionar Despesa'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar Exclusão">
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-red-400" />
          </div>
          <p className="text-gray-300 mb-1">Excluir esta despesa?</p>
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
