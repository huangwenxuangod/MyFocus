import { useEffect, useMemo, useState } from "react"

import "./styles/globals.scss"

const DEFAULT_DOMAINS = ["bilibili.com", "b23.tv"]
const DEFAULT_FOCUS_MINUTES = 60
const DEFAULT_UNLOCK_MINUTES = 10

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

function OptionsPage() {
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS)
  const [inputValue, setInputValue] = useState("")
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES)
  const [unlockMinutes, setUnlockMinutes] = useState(DEFAULT_UNLOCK_MINUTES)

  useEffect(() => {
    chrome.storage.local.get(
      {
        blockedDomains: DEFAULT_DOMAINS,
        focusRequiredMinutes: DEFAULT_FOCUS_MINUTES,
        unlockMinutes: DEFAULT_UNLOCK_MINUTES
      },
      (result) => {
        setDomains(
          Array.isArray(result.blockedDomains)
            ? result.blockedDomains
            : DEFAULT_DOMAINS
        )
        if (typeof result.focusRequiredMinutes === "number") {
          setFocusMinutes(result.focusRequiredMinutes)
        }
        if (typeof result.unlockMinutes === "number") {
          setUnlockMinutes(result.unlockMinutes)
        }
      }
    )

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      if (changes.blockedDomains?.newValue) {
        setDomains(changes.blockedDomains.newValue)
      }
      if (typeof changes.focusRequiredMinutes?.newValue === "number") {
        setFocusMinutes(changes.focusRequiredMinutes.newValue)
      }
      if (typeof changes.unlockMinutes?.newValue === "number") {
        setUnlockMinutes(changes.unlockMinutes.newValue)
      }
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const domainSet = useMemo(
    () => new Set(domains.map((domain) => normalizeDomain(domain))),
    [domains]
  )

  const saveDomains = (nextDomains: string[]) => {
    setDomains(nextDomains)
    chrome.storage.local.set({ blockedDomains: nextDomains })
  }

  const addDomain = () => {
    const normalized = normalizeDomain(inputValue)
    if (!normalized || domainSet.has(normalized)) {
      setInputValue("")
      return
    }
    saveDomains([...domains, normalized])
    setInputValue("")
  }

  const removeDomain = (domain: string) => {
    const normalized = normalizeDomain(domain)
    saveDomains(domains.filter((item) => normalizeDomain(item) !== normalized))
  }

  const saveTimeSettings = () => {
    const nextFocus = Math.max(1, Math.floor(focusMinutes))
    const nextUnlock = Math.max(1, Math.floor(unlockMinutes))
    setFocusMinutes(nextFocus)
    setUnlockMinutes(nextUnlock)
    chrome.storage.local.set({
      focusRequiredMinutes: nextFocus,
      unlockMinutes: nextUnlock
    })
  }

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__title">Focus blocker</div>
        <div className="page__subtitle">专注域名设置</div>
      </div>
      <div className="page__card">
        <div className="page__section">
          <div className="page__section-title">专注时长设置</div>
          <div className="page__row">
            <div className="page__label">专注时间（分钟）</div>
            <input
              className="page__input"
              type="number"
              min={1}
              value={focusMinutes}
              onChange={(event) =>
                setFocusMinutes(Number(event.target.value))
              }
            />
          </div>
          <div className="page__row">
            <div className="page__label">可观看时长（分钟）</div>
            <input
              className="page__input"
              type="number"
              min={1}
              value={unlockMinutes}
              onChange={(event) =>
                setUnlockMinutes(Number(event.target.value))
              }
            />
          </div>
          <div className="page__actions">
            <button className="popup__button" onClick={saveTimeSettings}>
              保存设置
            </button>
          </div>
        </div>
        <div className="page__form">
          <input
            className="popup__input"
            placeholder="添加域名"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addDomain()
              }
            }}
          />
          <button className="popup__button" onClick={addDomain}>
            添加
          </button>
        </div>
        <div className="popup__list">
          {domains.map((domain) => (
            <div className="popup__item" key={domain}>
              <span className="popup__domain">{domain}</span>
              <button
                className="popup__remove"
                onClick={() => removeDomain(domain)}>
                移除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OptionsPage
