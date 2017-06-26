export default class VNode {
    constructor (
        tag,
        data,
        children,
        text,
        elm,
        context,
        componentOptions
    ) {
        this.tag = tag
        this.data = data
        this.children = children
        this.text = text
        this.elm = elm
        this.ns = undefined
        this.context = context
        this.functionalContext = undefined
        this.key = data && data.key
        this.componentOptions = componentOptions
        this.componentInstance = undefined
        this.parent = undefined
        this.raw = false
        this.isStatic = false
        this.isRootInsert = true
        this.isComment = false
        this.isCloned = false
        this.isOnce = false
    }
}

export const createEmptyVNode = () => {
    const node = new VNode()
    node.text = ''
    node.isComment = true
    return node
}

export function createTextVNode (val) {
    return new VNode(undefined, undefined, undefined, String(val))
}

export function cloneVNode (vnode) {
    const cloned = new VNode(
        vnode.tag,
        vnode.data,
        vnode.children,
        vnode.text,
        vnode.elm,
        vnode.context,
        vnode.componentOptions
    )
    cloned.ns = vnode.ns
    cloned.isStatic = vnode.isStatic
    cloned.key = vnode.key
    cloned.isComment = vnode.isComment
    cloned.isCloned = true
    return cloned
}

export function cloneVNodes (vnodes) {
    const len = vnodes.length
    const res = new Array(len)
    for (let i = 0; i < len; i++) {
        res[i] = cloneVNode(vnodes[i])
    }
    return res
}