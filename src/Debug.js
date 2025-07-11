export default null

window.onerror = (message, source, line) => {
    alert(`Error at ${source}:${line}:

${message}`)
}
