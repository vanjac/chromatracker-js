// Interfaces between elements

interface JamTarget {
    _jamDown(e?: Event, cell?: Readonly<Cell>): void
    _jamUp(e?: Event): void
}

interface ModuleEditTarget {
    _changeModule(callback: (mod: Readonly<Module>) => Readonly<Module>,
        options?: {refresh?: boolean, combineTag?: string}): void
    _clearUndoCombine(tag: string): void
    _refreshModule(): void
}

interface PatternTableTarget {
    _setMute(c: number, mute: boolean): void
}
