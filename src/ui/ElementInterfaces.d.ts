// Interfaces between elements

interface JamTarget {
    _jamDown(cell: Readonly<Cell>, e?: Event): void
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

interface CellEntryTarget {
    _putCell(cell: Readonly<Cell>, parts: CellParts): void
    _selCell(): Readonly<Cell>
    _advance(): void
    _updateEntryParts(): void
}

interface FileToolbarTarget {
    readonly _module: Readonly<Module>
    _moduleLoaded(mod: Readonly<Module>): void
    _moduleSaved(): void
}

interface PlaybackControlsTarget {
    _resetPlayback(): Playback
    _play(): void
    _pause(): void
    _updatePlaySettings(): void
    _selPos(): number
    _selRow(): number
    _undo(): void
}
