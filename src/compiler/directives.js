import { noop } from '../util'

export default {
    bind,
    cloak: noop
}

function bind (el, dir) {
    el.wrapData = (code) => {
        return `_b(${code},'${el.tag}',${dir.value}${
            dir.modifiers && dir.modifiers.prop ? ',true' : ''
        })`
    }
}