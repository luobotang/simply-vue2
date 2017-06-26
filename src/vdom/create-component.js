import VNode from './vnode'

import {
    isUndef,
    isTrue,
    isObject
} from '../util'

export function createComponent(
    Ctor,
    data,
    context,
    children,
    tag
) {
    if (isUndef(Ctor)) {
        return
    }

    const baseCtor = context.$options._base

    if (isObject(Ctor)) {
        Ctor = baseCtor.extend(Ctor)
    }

    if (typeof Ctor !== 'function') {
        return
    }

    data = data || {}

    // // transform component v-model data into props & events
    // if (isDef(data.model)) {
    //     transformModel(Ctor.options, data)
    // }

    // extract props
    const propsData = extractPropsFromVNodeData(data, Ctor, tag)

    // // functional component
    // if (isTrue(Ctor.options.functional)) {
    //     return createFunctionalComponent(Ctor, propsData, data, context, children)
    // }

    // extract listeners, since these needs to be treated as
    // child component listeners instead of DOM listeners
    const listeners = data.on
    // replace with listeners with .native modifier
    data.on = data.nativeOn

    if (isTrue(Ctor.options.abstract)) {
        // abstract components do not keep anything
        // other than props & listeners
        data = {}
    }

    // // merge component management hooks onto the placeholder node
    // mergeHooks(data)

    // return a placeholder vnode
    const name = Ctor.options.name || tag
    const vnode = new VNode(
        `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data, undefined, undefined, undefined, context, {
            Ctor,
            propsData,
            listeners,
            tag,
            children
        }
    )
    return vnode
}

function extractPropsFromVNodeData() {
    // TODO
}