export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

export const formatPercent = (value) => `${(value || 0).toFixed(1)}%`

export const generateId = () => crypto.randomUUID()

/**
 * Retorna as informações de conversão de unidade para um insumo.
 * Regras:
 *   kg    → usuário digita em gramas; priceRef = price/kg; costPerUnit = price/1000
 *   litro → usuário digita em ml;     priceRef = price/litro; costPerUnit = price/1000
 *   g     → usuário digita em gramas; custo = (price ÷ quantity) × g usadas
 *   ml    → usuário digita em ml;     custo = (price ÷ quantity) × ml usados
 *   unidade → direto; custo = price × quantidade usada
 */
export function getIngredientRecipeInfo(ing) {
  const unit = (ing.unit || '').toLowerCase()
  const p = Number(ing.price)
  const q = Number(ing.quantity)

  if (unit === 'kg') {
    return { inputUnit: 'g',  placeholder: 'gramas',    priceRef: p, unitRef: 'kg',    costPerUnit: p / 1000 }
  }
  if (unit === 'litro') {
    return { inputUnit: 'ml', placeholder: 'ml',        priceRef: p, unitRef: 'litro', costPerUnit: p / 1000 }
  }
  if (unit === 'g') {
    return { inputUnit: 'g',  placeholder: 'gramas',    priceRef: p, unitRef: `${q}g`, costPerUnit: q > 0 ? p / q : 0 }
  }
  if (unit === 'ml') {
    return { inputUnit: 'ml', placeholder: 'ml',        priceRef: p, unitRef: `${q}ml`,costPerUnit: q > 0 ? p / q : 0 }
  }
  // unidade ou qualquer outro
  return { inputUnit: ing.unit || 'un', placeholder: ing.unit || 'un', priceRef: p, unitRef: ing.unit || 'un', costPerUnit: p }
}
