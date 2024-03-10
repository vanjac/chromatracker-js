// Custom overrides for TypeScript's built-in libraries

interface ObjectConstructor {
    // Cleaner return types for Object.assign()
    assign<T extends {}>(target: T, ...sources: Partial<T>[]): T
}

// These are the only form element types we care about when using namedItem()
type NamedFormItem = HTMLInputElement | RadioNodeList | null
interface HTMLFormControlsCollection {
    namedItem(name: string): NamedFormItem
}

interface DocumentFragment {
    // Overrides Node.cloneNode()
    cloneNode(deep?: boolean): DocumentFragment
}
