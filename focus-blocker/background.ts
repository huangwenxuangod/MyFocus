type Mode = "locked" | "focusing" | "unlocked"

const DEFAULT_FOCUS_REQUIRED_MS = 60 * 60 * 1000
const DEFAULT_UNLOCK_DURATION_MS = 10 * 60 * 1000

let mode: Mode = "locked"
let focusRequiredMs = DEFAULT_FOCUS_REQUIRED_MS
let unlockDurationMs = DEFAULT_UNLOCK_DURATION_MS
let remainingFocusMs = DEFAULT_FOCUS_REQUIRED_MS
let focusStartedAt: number | null = null
let unlockRemainingMs = 0
let unlockLastTickAt: number | null = null
let activeTabId: number | null = null
const tabBlockedVisible = new Map<number, boolean>()

const completeUnlock = (now: number) => {
  mode = "unlocked"
  remainingFocusMs = 0
  unlockRemainingMs = unlockDurationMs
  unlockLastTickAt = now
  focusStartedAt = null
}

const getActiveBlocked = () => {
  if (activeTabId === null) return false
  return tabBlockedVisible.get(activeTabId) === true
}

const normalizeState = (now: number) => {
  if (mode === "unlocked") {
    if (unlockLastTickAt !== null) {
      if (getActiveBlocked()) {
        unlockRemainingMs -= now - unlockLastTickAt
      }
    }
    unlockLastTickAt = now
    if (unlockRemainingMs <= 0) {
      mode = "locked"
      remainingFocusMs = focusRequiredMs
      unlockRemainingMs = 0
      unlockLastTickAt = null
      unlockEndsAt = null
    }
  }
}

const getStatus = () => {
  const now = Date.now()
  normalizeState(now)
  let remaining = remainingFocusMs
  if (mode === "focusing" && focusStartedAt) {
    remaining = remainingFocusMs - (now - focusStartedAt)
    if (remaining <= 0) {
      completeUnlock(now)
      remaining = 0
    }
  }
  return {
    mode,
    remainingFocusMs: Math.max(0, Math.ceil(remaining)),
    unlockRemainingMs: Math.max(0, Math.ceil(unlockRemainingMs))
  }
}

const startFocusChallenge = () => {
  if (mode !== "locked") return getStatus()
  mode = "focusing"
  remainingFocusMs = focusRequiredMs
  unlockRemainingMs = 0
  unlockLastTickAt = null
  focusStartedAt = Date.now()
  return getStatus()
}

const applySettings = (focusMinutes: number, unlockMinutes: number) => {
  focusRequiredMs = Math.max(1, Math.floor(focusMinutes)) * 60 * 1000
  unlockDurationMs = Math.max(1, Math.floor(unlockMinutes)) * 60 * 1000
  if (mode === "locked") {
    remainingFocusMs = focusRequiredMs
  } else if (mode === "focusing") {
    remainingFocusMs = Math.min(remainingFocusMs, focusRequiredMs)
  }
}

chrome.storage.local.get(
  { focusRequiredMinutes: 60, unlockMinutes: 10 },
  (result) => {
    applySettings(result.focusRequiredMinutes, result.unlockMinutes)
  }
)

chrome.storage.onChanged.addListener((changes) => {
  const focusValue =
    typeof changes.focusRequiredMinutes?.newValue === "number"
      ? changes.focusRequiredMinutes.newValue
      : null
  const unlockValue =
    typeof changes.unlockMinutes?.newValue === "number"
      ? changes.unlockMinutes.newValue
      : null
  if (focusValue !== null || unlockValue !== null) {
    applySettings(
      focusValue ?? focusRequiredMs / 60000,
      unlockValue ?? unlockDurationMs / 60000
    )
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "getStatus") {
    sendResponse(getStatus())
    return true
  }

  if (message?.type === "startFocus") {
    sendResponse(startFocusChallenge())
    return true
  }

  if (message?.type === "closeTab" && sender.tab?.id) {
    chrome.tabs.remove(sender.tab.id)
    return true
  }

  if (message?.type === "tabState" && sender.tab?.id) {
    tabBlockedVisible.set(sender.tab.id, !!message.isBlocked && !!message.isVisible)
    if (activeTabId === sender.tab.id) {
      normalizeState(Date.now())
    }
    return true
  }

  return false
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  activeTabId = tabId
  normalizeState(Date.now())
})

chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlockedVisible.delete(tabId)
  if (activeTabId === tabId) {
    activeTabId = null
  }
})
