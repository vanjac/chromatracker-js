import {CellEntryElement} from './CellEntry.js'
import {FileToolbarElement} from './FileToolbar.js'
import {ModulePropertiesElement} from './ModuleProperties.js'
import {PatternEditElement} from './PatternEdit.js'
import {PatternTableElement} from './PatternTable.js'
import {PianoKeyboardElement} from './PianoKeyboard.js'
import {PlaybackControlsElement} from './PlaybackControls.js'
import {SamplesListElement} from './SamplesList.js'
import {SequenceEditElement} from './SequenceEdit.js'

declare global {
    // Element type extensions
    interface HTMLElementTagNameMap {
        'cell-entry': CellEntryElement
        'file-toolbar': FileToolbarElement
        'module-properties': ModulePropertiesElement
        'pattern-edit': PatternEditElement
        'pattern-table': PatternTableElement
        'piano-keyboard': PianoKeyboardElement
        'playback-controls': PlaybackControlsElement
        'samples-list': SamplesListElement
        'sequence-edit': SequenceEditElement
    }
}
