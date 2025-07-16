const maxUndo = 100

/** @template T */
export class Undoable {
    /**
     * @param {T} value
     */
    constructor(value) {
        this.value = value
        /** @type {T[]} */
        this.undoStack = []
        /** @type {T[]} */
        this.redoStack = []
        this.isCommitted = true
        this.unsavedCount = 0
    }

    /**
     * @param {T} value
     * @param {boolean} commit
     * @returns {boolean} Value was changed
     */
    change(value, commit = true) {
        if (value == this.value) {
            console.log('No change!')
            this.isCommitted = this.isCommitted || commit
            return false
        } else {
            let oldValue = this.value
            this.value = value

            if (this.isCommitted) {
                this.undoStack.push(oldValue)
                if (this.undoStack.length > maxUndo) {
                    this.undoStack.shift()
                }
                this.unsavedCount++
            }
            this.redoStack = []
            this.isCommitted = commit
            return true
        }
    }

    /**
     * @param {(value: T) => T} fn
     * @param {boolean} commit
     * @returns {boolean} Value was changed
     */
    apply(fn, commit = true) {
        return this.change(fn(this.value), commit)
    }

    undo() {
        if (this.undoStack.length) {
            this.redoStack.push(this.value)
            this.value = /** @type {T} */(this.undoStack.pop())
            this.isCommitted = true
            this.unsavedCount--
            return true
        }
        return false
    }

    redo() {
        if (this.redoStack.length) {
            this.undoStack.push(this.value)
            this.value = /** @type {T} */(this.redoStack.pop())
            this.isCommitted = true
            this.unsavedCount++
            return true
        }
        return false
    }

    isUnsaved() {
        return this.unsavedCount != 0
    }

    saved() {
        this.unsavedCount = 0
    }
}
