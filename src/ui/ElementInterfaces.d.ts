// Interfaces between elements

import * as $fileToolbar from './FileToolbar.js'
import {Cell, CellPart, Module} from '../Model.js'
import {CellEntryElement} from './CellEntry.js'
import {ModulePropertiesElement} from './ModuleProperties.js'
import {PatternEditElement} from './PatternEdit.js'
import {PatternTableElement} from './PatternTable.js'
import {PianoKeyboardElement} from './PianoKeyboard.js'
import {PlaybackControlsElement} from './PlaybackControls.js'
import {SamplesListElement} from './SamplesList.js'
import {SequenceEditElement} from './SequenceEdit.js'

declare global {

interface JamTarget {
    _jamPlay(id: number, cell: Readonly<Cell>, options?: {useChannel?: boolean}): void
    _jamRelease(id: number): void
}

interface ModuleEditTarget {
    _changeModule(callback: (module: Readonly<Module>) => Readonly<Module>,
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
    _moduleLoaded(module: Readonly<Module>): void
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
    'cell-entry': CellEntryElement
    'file-toolbar': $fileToolbar.Elem
    'module-properties': ModulePropertiesElement
    'pattern-edit': PatternEditElement
    'pattern-table': PatternTableElement
    'piano-keyboard': PianoKeyboardElement
    'playback-controls': PlaybackControlsElement
    'samples-list': SamplesListElement
    'sequence-edit': SequenceEditElement
}

} // global
