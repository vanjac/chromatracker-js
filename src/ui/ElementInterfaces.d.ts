// Interfaces between elements

interface JamTarget {
    _jamPlay(id: number, cell: Readonly<Cell>, options?: {useChannel?: boolean}): void
    _jamRelease(id: number): void
}

interface ModuleEditTarget {
    _changeModule(callback: (mod: Readonly<Module>) => Readonly<Module>,
        options?: {refresh?: boolean, combineTag?: string}): void
    _clearUndoCombine(tag: string): void
}

interface PatternTableTarget {
    _setMute(c: number, mute: boolean): void
}

interface CellEntryTarget {
    _putCell(cell: Readonly<Cell>, parts: CellPart): void
    _updateCell(): void
    _selCell(): Readonly<Cell>
    _updateEntryParts(): void
}

interface PianoKeyboardTarget {
    _pitchChanged(): void
    _getJamCell(): Cell
}

interface FileToolbarTarget {
    readonly _module: Readonly<Module>
    _moduleLoaded(mod: Readonly<Module>): void
    _moduleSaved(): void
}

interface PlaybackControlsTarget {
    _resetPlayback(options?: {restoreSpeed?: boolean, restorePos?: boolean, restoreRow?: boolean})
        : void
    _play(): void
    _pause(): void
    _updatePlaySettings(): void
    _undo(): void
}

// Element type extensions
interface HTMLElementTagNameMap {
    'alert-dialog': AlertDialogElement
    'amplify-effect': AmplifyEffectElement
    'cell-entry': CellEntryElement
    'cli-dialog': CLIDialogElement
    'confirm-dialog': ConfirmDialogElement
    'file-toolbar': FileToolbarElement
    'filter-effect': FilterEffectElement
    'input-dialog': InputDialogElement
    'module-properties': ModulePropertiesElement
    'pattern-edit': PatternEditElement
    'pattern-table': PatternTableElement
    'piano-keyboard': PianoKeyboardElement
    'playback-controls': PlaybackControlsElement
    'sample-edit': SampleEditElement
    'samples-list': SamplesListElement
    'sequence-edit': SequenceEditElement
    'wait-dialog': WaitDialogElement
}
