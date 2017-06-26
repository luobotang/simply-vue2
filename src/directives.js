import { addHandler, addProp } from './compiler/helpers'
import { genAssignmentCode } from './compiler/directives_model'

// in some cases, the event used has to be determined at runtime
// so we used some reserved tokens during compile.
const RANGE_TOKEN = '__r'

function model (el, dir) {
    const value = dir.value
    const modifiers = dir.modifiers
    const tag = el.tag

    if (tag === 'input' || tag === 'textarea') {
        genDefaultModel(el, value, modifiers)
    }

    // ensure runtime directive metadata
    return true
}

function genDefaultModel (el, value, modifiers) {
    const type = el.attrsMap.type
    const { lazy, number, trim } = modifiers || {}
    const needCompositionGuard = !lazy && type !== 'range'
    const event = lazy
        ? 'change'
        : type === 'range'
            ? RANGE_TOKEN
            : 'input'

    let valueExpression = '$event.target.value'
    if (trim) {
        valueExpression = `$event.target.value.trim()`
    }
    if (number) {
        valueExpression = `_n(${valueExpression})`
    }

    let code = genAssignmentCode(value, valueExpression)
    if (needCompositionGuard) {
        code = `if($event.target.composing)return;${code}`
    }

    addProp(el, 'value', `(${value})`)
    addHandler(el, event, code, null, true)
    if (trim || number || type === 'number') {
        addHandler(el, 'blur', '$forceUpdate()')
    }
}

export default {
    model
}