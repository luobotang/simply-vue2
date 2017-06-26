import { observe } from './observer/index'
import Dep from './observer/dep'
import Watcher from './observer/watcher'
import {
    toArray,
    nextTick,
    bind,
    noop,
    isPlainObject,
    query
} from './util'
import { createElement } from './vdom/create-element'
import VNode, { createEmptyVNode } from './vdom/vnode'

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
        initEvents(vm)
        initRender(vm)

        initState(vm)
    }

    // lifecycle

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

    $mount(el, hydrating) {
        el = el ? query(el) : undefined
        return mountComponent(this, el, hydrating)
    }

    // events

    $on(event, fn) {
        const vm = this
        ;(vm._events[event] || (vm._events[event] = [])).push(fn)
    }

    $off(event, fn) {
        const vm = this
        const cbs = vm._events[event]
        if (!cbs) {
            return vm
        }
        if (arguments.length === 1) {
            vm._events[event] = null
            return vm
        }
        let cb
        let i = cbs.length
        while (i--) {
            cb = cbs[i]
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1)
                break
            }
        }
        return vm
    }

    $emit(event) {
        const vm = this
        let cbs = vm._events[event]
        if (cbs) {
            cbs = cbs.length > 1 ? toArray(cbs) : cbs
            const args = toArray(arguments, 1)
            for (let i = 0, l = cbs.length; i < l; i++) {
                cbs[i].apply(vm, args)
            }
        }
        return vm
    }

    // render

    $nextTick(fn) {
        return nextTick(fn, this)
    }

    _render() {
        const vm = this
        let vnode = vm._vnode
        if (!(vnode instanceof VNode)) {
            vnode = createEmptyVNode()
        }
        return vnode
    }
}

function initLifecycle(vm) {
    vm.$root = vm
    vm.$children = []
    vm._watcher = null
    vm._isMounted = false
}

function initEvents(vm) {
    vm._events = Object.create(null)
}

function initRender(vm) {
    vm._vnode = null
    vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
    vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
}

function initState (vm) {
    vm._watchers = []
    const opts = vm.$options
    if (opts.methods) initMethods(vm, opts.methods)
    if (opts.data) {
        initData(vm)
    } else {
        observe(vm._data = {}, true /* asRootData */)
    }
    if (opts.computed) initComputed(vm, opts.computed)
    if (opts.watch) initWatch(vm, opts.watch)
}

function initMethods (vm, methods) {
    for (const key in methods) {
        vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
    }
}

function initData (vm) {
    let data = vm.$options.data
    data = vm._data = typeof data === 'function'
        ? getData(data, vm)
        : data || {}
    if (!isPlainObject(data)) {
        data = {}
    }
    // proxy data on instance
    const keys = Object.keys(data)
    let i = keys.length
    while (i--) {
        proxy(vm, `_data`, keys[i])
    }
    // observe data
    observe(data, true /* asRootData */)
}

function getData (data, vm) {
    try {
        return data.call(vm)
    } catch (e) {
        return {}
    }
}

const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
}

function proxy (target, sourceKey, key) {
    sharedPropertyDefinition.get = function proxyGetter () {
        return this[sourceKey][key]
    }
    sharedPropertyDefinition.set = function proxySetter (val) {
        this[sourceKey][key] = val
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

function mountComponent (vm, el, hydrating) {
    vm.$el = el
    if (!vm.$options.render) {
        vm.$options.render = createEmptyVNode
    }

    let updateComponent

    updateComponent = () => {
        vm._update(vm._render(), hydrating)
    }

    vm._watcher = new Watcher(vm, updateComponent, noop)
    hydrating = false

    // manually mounted instance, call mounted on self
    // mounted is called for render-created child components in its inserted hook
    if (vm.$vnode == null) {
        vm._isMounted = true
    }
    return vm
}

function initComputed (vm, computed) {
    const watchers = vm._computedWatchers = Object.create(null)

    for (const key in computed) {
        const userDef = computed[key]
        let getter = typeof userDef === 'function' ? userDef : userDef.get
        // create internal watcher for the computed property.
        watchers[key] = new Watcher(vm, getter, noop, { lazy: true })

        // component-defined computed properties are already defined on the
        // component prototype. We only need to define computed properties defined
        // at instantiation here.
        if (!(key in vm)) {
            defineComputed(vm, key, userDef)
        }
    }
}

function defineComputed (target, key, userDef) {
    if (typeof userDef === 'function') {
        sharedPropertyDefinition.get = createComputedGetter(key)
        sharedPropertyDefinition.set = noop
    } else {
        sharedPropertyDefinition.get = userDef.get
            ? userDef.cache !== false
                ? createComputedGetter(key)
                : userDef.get
            : noop
        sharedPropertyDefinition.set = userDef.set
            ? userDef.set
            : noop
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
    return function computedGetter () {
        const watcher = this._computedWatchers && this._computedWatchers[key]
        if (watcher) {
            if (watcher.dirty) {
                watcher.evaluate()
            }
            if (Dep.target) {
                watcher.depend()
            }
            return watcher.value
        }
    }
}

function initWatch (vm, watch) {
    for (const key in watch) {
        const handler = watch[key]
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i])
            }
        } else {
            createWatcher(vm, key, handler)
        }
    }
}

function createWatcher (vm, key, handler) {
    let options
    if (isPlainObject(handler)) {
        options = handler
        handler = handler.handler
    }
    if (typeof handler === 'string') {
        handler = vm[handler]
    }
    vm.$watch(key, handler, options)
}