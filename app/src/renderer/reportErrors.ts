// Sends uncaught errors in this window to main's local log (see main/log.ts), which redacts keys before writing.
window.addEventListener('error', (event) => {
  window.sarthi.logError(`${event.message} at ${event.filename}:${event.lineno}`)
})
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  window.sarthi.logError(`Unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`)
})
