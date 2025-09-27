export default null

window.onerror = (message, source, line) => {
    alert(`Error at ${source}:${line}:

${message}`)
}
window.onunhandledrejection = ev => {
    alert(`Error in promise: ${ev.reason}`)
}
