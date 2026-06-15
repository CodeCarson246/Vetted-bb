'use client'
import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

// Upload a photo to the public chat-photos bucket under the user's own
// folder. Compresses first (reuses browser-image-compression, already a dep).
// Returns { url } or { error }.
export async function uploadChatPhoto(file, userId) {
  if (!file || !userId) return { error: 'No file.' }
  if (!ALLOWED.includes(file.type)) return { error: 'Use a JPG, PNG or WebP image.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Image must be under 10MB.' }

  let toUpload = file
  try {
    toUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true })
  } catch {
    // fall back to the original on compression failure
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('chat-photos').upload(path, toUpload, { upsert: false })
  if (error) return { error: 'Upload failed. Please try again.' }

  const { data } = supabase.storage.from('chat-photos').getPublicUrl(path)
  return { url: data.publicUrl }
}
