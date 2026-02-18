import { useEffect, useMemo, useState } from "react"

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

type Status = {
  mode: "locked" | "focusing" | "unlocked"
  remainingFocusMs: number
}

const DEFAULT_DOMAINS = ["bilibili.com", "b23.tv"]

const normalizeDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ""
  try {
    const withScheme = trimmed.includes("://")
      ? trimmed
      : `https://${trimmed}`
    return new URL(withScheme).hostname.replace(/^www\./, "")
  } catch {
    return trimmed.replace(/^www\./, "")
  }
}

const isBlockedHost = (host: string, domains: string[]) => {
  const normalizedHost = host.replace(/^www\./, "")
  return domains.some((domain) => {
    const normalizedDomain = normalizeDomain(domain)
    return (
      normalizedHost === normalizedDomain ||
      normalizedHost.endsWith(`.${normalizedDomain}`)
    )
  })
}

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, "0")
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${minutes}:${pad(seconds)}`
}

const useStatus = () => {
  const [status, setStatus] = useState<Status>({
    mode: "locked",
    remainingFocusMs: 60 * 60 * 1000
  })

  useEffect(() => {
    let mounted = true

    const fetchStatus = () => {
      chrome.runtime.sendMessage({ type: "getStatus" }, (response: Status) => {
        if (mounted && response) {
          setStatus(response)
        }
      })
    }

    fetchStatus()
    const timer = setInterval(fetchStatus, 1000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return status
}

const useBlockedDomains = () => {
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS)

  useEffect(() => {
    chrome.storage.local.get(
      { blockedDomains: DEFAULT_DOMAINS },
      (result) => {
        setDomains(Array.isArray(result.blockedDomains) ? result.blockedDomains : DEFAULT_DOMAINS)
      }
    )

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.blockedDomains?.newValue) {
        setDomains(changes.blockedDomains.newValue)
      }
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  return domains
}

const Overlay = () => {
  const status = useStatus()
  const domains = useBlockedDomains()
  const isBlocked = isBlockedHost(window.location.hostname, domains)

  const shouldShow = status.mode !== "unlocked" && isBlocked
  const isLocked = status.mode === "locked"
  const isFocusing = status.mode === "focusing"

  const remainingLabel = useMemo(
    () => formatDuration(status.remainingFocusMs),
    [status.remainingFocusMs]
  )

  const startChallenge = () => {
    chrome.runtime.sendMessage({ type: "startFocus" })
  }

  const closeTab = () => {
    chrome.runtime.sendMessage({ type: "closeTab" })
  }

  if (!shouldShow) {
    return null
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
      }}>
      <div
        style={{
          width: 320,
          borderRadius: 16,
          background: "rgba(255,255,255,0.96)",
          padding: "24px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          textAlign: "center"
        }}>
        {isLocked && (
          <>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              你现在没有观看时间
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: "#444" }}>
              开始专注挑战？
            </div>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 12,
                justifyContent: "center"
              }}>
              <button
                onClick={startChallenge}
                style={{
                  minWidth: 110,
                  height: 36,
                  borderRadius: 10,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer"
                }}>
                确定
              </button>
              <button
                onClick={closeTab}
                style={{
                  minWidth: 110,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: "#222",
                  fontSize: 14,
                  cursor: "pointer"
                }}>
                取消
              </button>
            </div>
          </>
        )}
        {isFocusing && (
          <>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              专注挑战进行中
            </div>
            <div style={{ marginTop: 12, fontSize: 22, fontWeight: 700 }}>
              剩余：{remainingLabel}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Overlay
