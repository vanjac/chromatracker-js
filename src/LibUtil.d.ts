// Custom overrides for TypeScript's built-in libraries

interface ImportMeta {
    // Replete compatibility
    // https://docs.deno.com/runtime/reference/deno_namespace_apis/#import.meta.main
    main: boolean
}

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

type TypedArray =
    | Int8Array | Uint8Array | Uint8ClampedArray
    | Int16Array | Uint16Array
    | Int32Array | Uint32Array
    | Float32Array | Float64Array

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
// This is incomplete
type Serializable =
    | null
    | undefined
    | boolean
    | number
    | bigint
    | string
    | ArrayBuffer
    | TypedArray
    | DataView
    | Date
    | Error
    | RegExp
    | Blob
    | DOMMatrixReadOnly
    | DOMPointReadOnly
    | DOMQuad
    | DOMRectReadOnly
    | FileList
    | ImageBitmap
    | ImageData
    | SerializableObject
    | SerializableArray
    | SerializableMap
    | SerializableSet
type SerializableObject = { [key: string]: Serializable }
type SerializableArray = Serializable[] | readonly Serializable[]
type SerializableMap = Map<Serializable, Serializable>
type SerializableSet = Set<Serializable>
