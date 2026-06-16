// Returns size in KB from a base64 data URL
function base64SizeKB(dataUrl) {
  const base64 = dataUrl.split(',')[1] || dataUrl
  const padding = (base64.match(/=/g) || []).length
  return Math.round(((base64.length * 3) / 4 - padding) / 1024)
}

/**
 * Compresses a base64 image using the Canvas API.
 * @returns {{ compressed: string, originalKB: number, finalKB: number, skipped: boolean }}
 */
export function compressImage(base64, options = {}) {
  const { maxDim = 800, quality = 0.75, maxSizeKB = 200 } = options
  const originalKB = base64SizeKB(base64)

  // Already within limit — skip compression
  if (originalKB <= maxSizeKB) {
    return Promise.resolve({ compressed: base64, originalKB, finalKB: originalKB, skipped: true })
  }

  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      let { width, height } = img

      // Scale down preserving aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim)
          width = maxDim
        } else {
          width = Math.round((width / height) * maxDim)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      // Try WEBP at desired quality; reduce iteratively until under limit
      let q = quality
      let dataUrl = canvas.toDataURL('image/webp', q)

      while (base64SizeKB(dataUrl) > maxSizeKB && q > 0.2) {
        q = Math.round((q - 0.1) * 10) / 10
        dataUrl = canvas.toDataURL('image/webp', q)
      }

      resolve({
        compressed: dataUrl,
        originalKB,
        finalKB: base64SizeKB(dataUrl),
        skipped: false,
      })
    }

    img.onerror = () => reject(new Error('Falha ao carregar a imagem para compressão'))
    img.src = base64
  })
}

// Formats KB for display: "1.2MB" if >= 1024, else "487KB"
export function formatFileSize(kb) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`
}
