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

  useEffect(() => {
    chrome.storage.local.get(
      { blockedDomains: DEFAULT_DOMAINS },
      (result) => {
        setDomains(
          Array.isArray(result.blockedDomains)
            ? result.blockedDomains
            : DEFAULT_DOMAINS
        )
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

  const addRecommended = (domain: string) => {
    const normalized = normalizeDomain(domain)
    if (!normalized || domainSet.has(normalized)) return
    saveDomains([...domains, normalized])
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
        <div className="popup__list">
          {RECOMMENDED_DOMAINS.map((domain) => (
            <div className="popup__item" key={domain}>
              <span className="popup__domain">{domain}</span>
              <button
                className={`popup__action ${
                  domainSet.has(normalizeDomain(domain)) ? "is-disabled" : ""
                }`}
                onClick={() => addRecommended(domain)}
                disabled={domainSet.has(normalizeDomain(domain))}>
                添加
              </button>
            </div>
          ))}
        </div>
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
