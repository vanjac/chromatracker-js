interface ObjectConstructor {
    // Cleaner return types for Object.assign()
    assign<T extends {}>(target: T, ...sources: Partial<T>[]): T
}

// These are the only types we care about
type NamedFormItem = HTMLInputElement | RadioNodeList | null
interface HTMLFormControlsCollection {
    namedItem(name: string): NamedFormItem
}

interface DocumentFragment {
    cloneNode(deep?: boolean): DocumentFragment
}
