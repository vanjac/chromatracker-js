// Custom overrides for TypeScript's built-in libraries

interface ImportMeta {
    // Replete compatibility
    // https://docs.deno.com/runtime/reference/deno_namespace_apis/#import.meta.main
    main: boolean
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
    | BigInt64Array | BigUint64Array

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
type Serializable =
    // Primitive types
    | null
    | undefined
    | boolean
    | number
    | bigint
    | string
    // JavaScript Types
    | ArrayBuffer
    | DataView
    | Date
    | Error
    | RegExp
    | TypedArray
    // Web API Types (incomplete)
    | Blob
    | DOMMatrixReadOnly
    | DOMPointReadOnly
    | DOMQuad
    | DOMRectReadOnly
    | FileList
    | ImageBitmap
    | ImageData
    // Aggregate Types
    | SerializableObject
    | SerializableArray
    | SerializableMap
    | SerializableSet
type SerializableObject = { [key: string]: Serializable }
type SerializableArray = Serializable[] | readonly Serializable[]
type SerializableMap = Map<Serializable, Serializable>
type SerializableSet = Set<Serializable>
