// @ts-nocheck
'use client'
import { useEffect } from 'react'

export interface UTMData {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_ad_group: string | null
  utm_term: string | null
  utm_content: string | null
  gclid: string | null
  referrer_url: string | null
  landing_page: string | null
  source_type: 'paid_search' | 'organic' | 'direct' | 'referral' | 'social' | 'email' | 'manual'
  session_id: string
}

const COOKIE_NAME = 'bookdin_attribution'
const COOKIE_DAYS = 30
const STORAGE_KEY = 'bookdin_attribution'

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

function deriveSourceType(params: URLSearchParams, referrer: string): UTMData['source_type'] {
  const gclid = params.get('gclid')
  const medium = params.get('utm_medium')?.toLowerCase()
  const source = params.get('utm_source')?.toLowerCase()

  if (gclid || medium === 'cpc' || medium === 'ppc' || medium === 'paid') return 'paid_search'
  if (medium === 'email') return 'email'
  if (medium === 'social' || source === 'facebook' || source === 'instagram' || source === 'linkedin') return 'social'
  if (referrer && !referrer.includes(window.location.hostname)) {
    const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo']
    const isSearchEngine = searchEngines.some(se => referrer.includes(se))
    if (isSearchEngine) return 'organic'
    return 'referral'
  }
  if (!referrer || referrer === '') return 'direct'
  return 'organic'
}

export function captureUTM(): UTMData {
  const params = new URLSearchParams(window.location.search)
  const referrer = document.referrer

  // Check if we already have attribution stored (returning visitor)
  const existing = getCookie(COOKIE_NAME) || localStorage.getItem(STORAGE_KEY)
  if (existing) {
    try {
      const parsed = JSON.parse(existing)
      // Only override if new UTM params or gclid present in URL
      const hasNewParams = params.get('gclid') || params.get('utm_source')
      if (!hasNewParams) return parsed
    } catch {}
  }

  const gclid = params.get('gclid')
  const utm_source = params.get('utm_source')
  const utm_medium = params.get('utm_medium')
  const utm_campaign = params.get('utm_campaign')
  const utm_ad_group = params.get('utm_ad_group') || params.get('utm_adgroup')
  const utm_term = params.get('utm_term')
  const utm_content = params.get('utm_content')

  const data: UTMData = {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_ad_group,
    utm_term,
    utm_content,
    gclid,
    referrer_url: referrer || null,
    landing_page: window.location.pathname,
    source_type: deriveSourceType(params, referrer),
    session_id: generateSessionId(),
  }

  const json = JSON.stringify(data)
  setCookie(COOKIE_NAME, json, COOKIE_DAYS)
  try { localStorage.setItem(STORAGE_KEY, json) } catch {}

  return data
}

export function getStoredUTM(): UTMData | null {
  try {
    const raw = getCookie(COOKIE_NAME) || localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearUTM() {
  setCookie(COOKIE_NAME, '', -1)
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// React hook — call at top of booking form component
export function useUTMCapture(): UTMData | null {
  useEffect(() => {
    captureUTM()
  }, [])
  return getStoredUTM()
}
