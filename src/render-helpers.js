import { isObject, isDef, extend, identity, resolveAsset } from './util'
import { cloneVNode, cloneVNodes } from './vdom/vnode'

export function renderList (
    val,
    render
) {
    let ret, i, l, keys, key
    if (Array.isArray(val) || typeof val === 'string') {
        ret = new Array(val.length)
        for (i = 0, l = val.length; i < l; i++) {
            ret[i] = render(val[i], i)
        }
    } else if (typeof val === 'number') {
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            ret[i] = render(i + 1, i)
        }
    } else if (isObject(val)) {
        keys = Object.keys(val)
        ret = new Array(keys.length)
        for (i = 0, l = keys.length; i < l; i++) {
            key = keys[i]
            ret[i] = render(val[key], key, i)
        }
    }
    if (isDef(ret)) {
        (ret)._isVList = true
    }
    return ret
}

export function renderSlot (
    name,
    fallback,
    props,
    bindObject
) {
    const scopedSlotFn = this.$scopedSlots[name]
    if (scopedSlotFn) { // scoped slot
        props = props || {}
        if (bindObject) {
            extend(props, bindObject)
        }
        return scopedSlotFn(props) || fallback
    } else {
        const slotNodes = this.$slots[name]

        return slotNodes || fallback
    }
}

export function resolveFilter (id) {
    return resolveAsset(this.$options, 'filters', id, true) || identity
}

export function renderStatic (
    index,
    isInFor
) {
    let tree = this._staticTrees[index]
    // if has already-rendered static tree and not inside v-for,
    // we can reuse the same tree by doing a shallow clone.
    if (tree && !isInFor) {
        return Array.isArray(tree)
            ? cloneVNodes(tree)
            : cloneVNode(tree)
    }
    // otherwise, render a fresh tree.
    tree = this._staticTrees[index] =
        this.$options.staticRenderFns[index].call(this._renderProxy)
    markStatic(tree, `__static__${index}`, false)
    return tree
}

export function markOnce (
    tree,
    index,
    key
) {
    markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
    return tree
}

function markStatic (
    tree,
    key,
    isOnce
) {
    if (Array.isArray(tree)) {
        for (let i = 0; i < tree.length; i++) {
            if (tree[i] && typeof tree[i] !== 'string') {
                markStaticNode(tree[i], `${key}_${i}`, isOnce)
            }
        }
    } else {
        markStaticNode(tree, key, isOnce)
    }
}

function markStaticNode (node, key, isOnce) {
    node.isStatic = true
    node.key = key
    node.isOnce = isOnce
}
