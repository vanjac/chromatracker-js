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
        'cell-entry': InstanceType<typeof CellEntryElement>
        'file-toolbar': InstanceType<typeof FileToolbarElement>
        'module-properties': InstanceType<typeof ModulePropertiesElement>
        'pattern-edit': InstanceType<typeof PatternEditElement>
        'pattern-table': InstanceType<typeof PatternTableElement>
        'piano-keyboard': InstanceType<typeof PianoKeyboardElement>
        'playback-controls': InstanceType<typeof PlaybackControlsElement>
        'samples-list': InstanceType<typeof SamplesListElement>
        'sequence-edit': InstanceType<typeof SequenceEditElement>
    }
}
