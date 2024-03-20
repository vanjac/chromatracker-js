// Custom overrides for TypeScript's built-in libraries

interface ObjectConstructor {
    // Cleaner return types for Object.assign()
    assign<T extends {}>(target: T, ...sources: Partial<T>[]): T
}

interface Array<T> {
    // https://github.com/microsoft/TypeScript/issues/31785#issuecomment-948012321
    fill<U>(value: U): Array<U>;
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
