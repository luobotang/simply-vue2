let uid = 0

export default class Vue {
    constructor(options) {
        this._init(options)
    }

    _init(options) {
        const vm = this
        vm._uid = uid++
        vm.$options = Object.assign({}, options)

        initLifecycle(vm)
    }

    _update(vnode) {
        const vm = this
        const prevEl = vm.$el
        const prevVnode = vm._vnode

        vm._vnode = vnode
        if (!prevVnode) {
            vm.$el = vm.__patch__(vm.$el, vnode)
        } else {
            vm.$el = vm.__patch__(prevVnode, vnode)
        }

        if (prevEl) {
            prevEl.__vue__ = null
        }
        if (vm.$el) {
            vm.$el.__vue__ = vm
        }
    }
}

function initLifecycle(vm) {
    vm.$root = vm
    vm.$children = []
    vm._watcher = null
    vm._isMounted = false
}