import { supabase } from './supabase'

// Returns: publicUrl string on success, null on failure, '' when no image
export async function uploadPhotoIfNeeded(image, folder = 'produtos') {
  if (!image) return ''
  if (image.startsWith('http')) return image

  try {
    const [header, data] = image.split(',')
    const mime = header.match(/:(.*?);/)[1]
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from('fotos-produtos')
      .upload(filename, blob, { contentType: mime })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('fotos-produtos')
      .getPublicUrl(filename)

    return publicUrl
  } catch (err) {
    console.error('[Storage] Falha no upload da foto:', err?.message || err)
    return null // null = falha no upload (diferente de '' = sem foto)
  }
}
