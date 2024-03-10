interface ObjectConstructor {
    // Cleaner return types for Object.assign()
    assign<T extends {}>(target: T, ...sources: Partial<T>[]): T
}
