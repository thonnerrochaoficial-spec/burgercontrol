import { useState, useEffect } from 'react'

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-2xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
          B
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Instalar BurgerControl</p>
          <p className="text-gray-400 text-xs mt-0.5">Acesse mais rápido pela tela inicial</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
