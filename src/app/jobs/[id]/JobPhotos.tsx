// @ts-nocheck
'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, X, Upload, Loader2 } from 'lucide-react'

export default function JobPhotos({ jobId, businessId, initialPhotos = [] }: {
  jobId: string
  businessId: string
  initialPhotos?: { id: string; url: string; path: string; label?: string }[]
}) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setError('')

    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()
        const path = `${businessId}/${jobId}/${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(path, file, { upsert: false })

        if (uploadError) throw uploadError

        const { data: { signedUrl } } = await supabase.storage
          .from('job-photos')
          .createSignedUrl(path, 60 * 60 * 24 * 7) // 7 day signed URL

        setPhotos(prev => [...prev, { id: path, url: signedUrl, path }])
      } catch (err: any) {
        setError(err.message || 'Upload failed')
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDelete(photo: { path: string }) {
    const { error } = await supabase.storage
      .from('job-photos')
      .remove([photo.path])

    if (!error) {
      setPhotos(prev => prev.filter(p => p.path !== photo.path))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Photos</h2>
        <span className="text-xs text-gray-400">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <div key={photo.path} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img
                src={photo.url}
                alt="Job photo"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleDelete(photo)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
        ) : (
          <><Camera className="w-4 h-4" /> Add photos</>
        )}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
