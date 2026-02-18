type Mode = "locked" | "focusing" | "unlocked"

const FOCUS_REQUIRED_MS = 60 * 60 * 1000
const UNLOCK_DURATION_MS = 10 * 60 * 1000

let mode: Mode = "locked"
let remainingFocusMs = FOCUS_REQUIRED_MS
let focusStartedAt: number | null = null
let unlockEndsAt: number | null = null

const completeUnlock = (now: number) => {
  mode = "unlocked"
  remainingFocusMs = 0
  unlockEndsAt = now + UNLOCK_DURATION_MS
  focusStartedAt = null
}

const normalizeState = (now: number) => {
  if (mode === "unlocked" && unlockEndsAt && now >= unlockEndsAt) {
    mode = "locked"
    remainingFocusMs = FOCUS_REQUIRED_MS
    unlockEndsAt = null
    focusStartedAt = null
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
    unlockEndsAt
  }
}

const startFocusChallenge = () => {
  if (mode !== "locked") return getStatus()
  mode = "focusing"
  remainingFocusMs = FOCUS_REQUIRED_MS
  unlockEndsAt = null
  focusStartedAt = Date.now()
  return getStatus()
}

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

  return false
})
