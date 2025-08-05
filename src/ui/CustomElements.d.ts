import {CellEntryElement} from './CellEntry.js'
import {ModulePropertiesElement} from './ModuleProperties.js'
import {PatternEditElement} from './PatternEdit.js'
import {PatternTableElement} from './PatternTable.js'
import {PianoKeyboardElement} from './PianoKeyboard.js'
import {SamplesListElement} from './SamplesList.js'
import {SequenceEditElement} from './SequenceEdit.js'

declare global {
    // Element type extensions
    interface HTMLElementTagNameMap {
        'cell-entry': InstanceType<typeof CellEntryElement>
        'module-properties': InstanceType<typeof ModulePropertiesElement>
        'pattern-edit': InstanceType<typeof PatternEditElement>
        'pattern-table': InstanceType<typeof PatternTableElement>
        'piano-keyboard': InstanceType<typeof PianoKeyboardElement>
        'samples-list': InstanceType<typeof SamplesListElement>
        'sequence-edit': InstanceType<typeof SequenceEditElement>
    }
}
