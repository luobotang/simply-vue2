import { getAndRemoveAttr, getBindingAttr } from './compiler/helpers'

function transformNode (el) {
    const staticClass = getAndRemoveAttr(el, 'class')
    if (staticClass) {
        el.staticClass = JSON.stringify(staticClass)
    }
    const classBinding = getBindingAttr(el, 'class', false /* getStatic */)
    if (classBinding) {
        el.classBinding = classBinding
    }
}

function genData (el) {
    let data = ''
    if (el.staticClass) {
        data += `staticClass:${el.staticClass},`
    }
    if (el.classBinding) {
        data += `class:${el.classBinding},`
    }
    return data
}

const klass = {
    staticKeys: ['staticClass'],
    transformNode,
    genData
}

export default [klass]