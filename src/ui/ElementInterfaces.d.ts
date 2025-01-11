// Interfaces between elements

import {Cell, CellPart, Module} from '../Model.js'
import {CellEntryElement} from './CellEntry.js'
import {FileToolbarElement} from './FileToolbar.js'
import {ModulePropertiesElement} from './ModuleProperties.js'
import {PatternEditElement} from './PatternEdit.js'
import {PatternTableElement} from './PatternTable.js'
import {PianoKeyboardElement} from './PianoKeyboard.js'
import {PlaybackControlsElement} from './PlaybackControls.js'
import {SampleEditElement} from './SampleEdit.js'
import {SamplesListElement} from './SamplesList.js'
import {SequenceEditElement} from './SequenceEdit.js'
import {AmplifyEffectElement} from './dialogs/AmplifyEffect.js'
import {CLIDialogElement} from './dialogs/CLIDialog.js'
import {FilterEffectElement} from './dialogs/FilterEffect.js'
import {AlertDialogElement, ConfirmDialogElement, InputDialogElement, WaitDialogElement}
    from './dialogs/UtilDialogs.js'

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

} // global
