import { useEffect, useMemo, useState } from "react"

import "./styles/globals.scss"

const DEFAULT_DOMAINS = ["bilibili.com", "b23.tv"]
const RECOMMENDED_DOMAINS = [
  "tiktok.com",
  "douyin.com",
  "xiaohongshu.com",
  "kuaishou.com",
  "weibo.com",
  "zhihu.com",
  "huya.com",
  "douban.com"
]

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

function IndexPopup() {
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS)
  const [inputValue, setInputValue] = useState("")
  const [activeTab, setActiveTab] = useState<"recommend" | "options">(
    "recommend"
  )
  const [recommendSelected, setRecommendSelected] = useState<Set<string>>(
    new Set()
  )
  const [lastRecommendKeys, setLastRecommendKeys] = useState<string | null>(null)

  useEffect(() => {
    chrome.storage.local.get(
      { blockedDomains: DEFAULT_DOMAINS, hasOpenedPopup: false },
      (result) => {
        setDomains(
          Array.isArray(result.blockedDomains)
            ? result.blockedDomains
            : DEFAULT_DOMAINS
        )
        if (!result.hasOpenedPopup) {
          setActiveTab("recommend")
          chrome.storage.local.set({ hasOpenedPopup: true })
        } else {
          setActiveTab("options")
        }
      }
    )

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      if (changes.blockedDomains?.newValue) {
        setDomains(changes.blockedDomains.newValue)
      }
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const domainSet = useMemo(
    () => new Set(domains.map((domain) => normalizeDomain(domain))),
    [domains]
  )

  const availableRecommended = useMemo(
    () =>
      RECOMMENDED_DOMAINS.filter(
        (domain) => !domainSet.has(normalizeDomain(domain))
      ),
    [domainSet]
  )
  const availableKey = useMemo(
    () => availableRecommended.map((domain) => normalizeDomain(domain)).join(","),
    [availableRecommended]
  )

  useEffect(() => {
    if (!availableRecommended.length) {
      setRecommendSelected(new Set())
      setLastRecommendKeys(availableKey)
      return
    }
    if (lastRecommendKeys === null || lastRecommendKeys !== availableKey) {
      setRecommendSelected(
        new Set(availableRecommended.map((domain) => normalizeDomain(domain)))
      )
      setLastRecommendKeys(availableKey)
    }
  }, [availableRecommended, availableKey, lastRecommendKeys])

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

  const toggleRecommend = (domain: string) => {
    const normalized = normalizeDomain(domain)
    setRecommendSelected((prev) => {
      const next = new Set(prev)
      if (next.has(normalized)) {
        next.delete(normalized)
      } else {
        next.add(normalized)
      }
      return next
    })
  }

  const addAllRecommended = () => {
    if (recommendSelected.size === 0) return
    const merged = Array.from(
      new Set([
        ...domains.map((domain) => normalizeDomain(domain)),
        ...Array.from(recommendSelected)
      ])
    ).filter(Boolean)
    saveDomains(merged)
    setRecommendSelected(new Set())
  }

  const openMore = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="popup">
      <div className="popup__header">
        <div className="popup__title">Focus blocker</div>
        <button className="popup__more" onClick={openMore}>
          更多
        </button>
      </div>
      <div className="popup__tabs">
        <button
          className={`popup__tab ${
            activeTab === "recommend" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("recommend")}>
          Recommend
        </button>
        <button
          className={`popup__tab ${
            activeTab === "options" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("options")}>
          Options
        </button>
      </div>
      {activeTab === "recommend" && (
        <>
          <div className="popup__recommend">
            <div className="popup__recommend-title">推荐域名</div>
            <button
              className="popup__button"
              onClick={addAllRecommended}
              disabled={recommendSelected.size === 0}>
              一键添加
            </button>
          </div>
          <div className="popup__list">
            {availableRecommended.map((domain) => (
              <div className="popup__item" key={domain}>
                <label className="popup__checkbox">
                  <input
                    type="checkbox"
                    checked={recommendSelected.has(normalizeDomain(domain))}
                    onChange={() => toggleRecommend(domain)}
                  />
                  <span className="popup__checkmark" />
                  <span className="popup__domain">{domain}</span>
                </label>
              </div>
            ))}
            {availableRecommended.length === 0 && (
              <div className="popup__empty">暂无推荐</div>
            )}
          </div>
        </>
      )}
      {activeTab === "options" && (
        <>
          <div className="popup__form">
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
        </>
      )}
    </div>
  )
}

export default IndexPopup
