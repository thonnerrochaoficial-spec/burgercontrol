export function getDraftKey(prefix, editingId) {
  return editingId ? `bc_draft_${prefix}_${editingId}` : `bc_draft_${prefix}_novo`
}

export function saveDraftLS(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota exceeded */ }
}

export function loadDraftLS(key) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null } catch { return null }
}

export function clearDraftLS(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}
