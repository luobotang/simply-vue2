export function isUndef (v) {
    return v === undefined || v === null
}

export function isDef (v) {
    return v !== undefined && v !== null
}

export function isTrue (v) {
    return v === true
}

export function isFalse (v) {
    return v === false
}

export function isPrimitive (value) {
    return typeof value === 'string' || typeof value === 'number'
}

export function isObject (obj) {
    return obj !== null && typeof obj === 'object'
}

const _toString = Object.prototype.toString

export function isPlainObject (obj) {
    return _toString.call(obj) === '[object Object]'
}

export function isRegExp (v) {
    return _toString.call(v) === '[object RegExp]'
}

export function resolveAsset (options, type, id) {
    if (typeof id !== 'string') {
        return
    }
    const assets = options[type]
    if (hasOwn(assets, id)) return assets[id]
    const camelizedId = camelize(id)
    if (hasOwn(assets, camelizedId)) return assets[camelizedId]
    const PascalCaseId = capitalize(camelizedId)
    if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
    const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
    return res
}

export function remove (arr, item) {
    if (arr.length) {
        const index = arr.indexOf(item)
        if (index > -1) {
            return arr.splice(index, 1)
        }
    }
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn (obj, key) {
    return hasOwnProperty.call(obj, key)
}

const camelizeRE = /-(\w)/g
export const camelize = (str) => {
    return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
}

export const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

export function toArray (list, start) {
    start = start || 0
    let i = list.length - start
    const ret = new Array(i)
    while (i--) {
        ret[i] = list[i + start]
    }
    return ret
}

export const nextTick = (function () {
    const callbacks = []
    let pending = false

    function nextTickHandler () {
        pending = false
        const copies = callbacks.slice(0)
        callbacks.length = 0
        for (let i = 0; i < copies.length; i++) {
            copies[i]()
        }
    }

    return function (cb, ctx) {
        callbacks.push(() => {
            cb && cb.call(ctx)
        })
        if (!pending) {
            pending = true
            setTimeout(nextTickHandler, 0)
        }
    }
})()

export function bind (fn, ctx) {
    function boundFn () {
        return fn.call(ctx, arguments)
    }
    boundFn._length = fn.length
    return boundFn
}

export function noop () {}

export const no = () => false

export const hasProto = '__proto__' in {}

export function def (obj, key, val, enumerable) {
    Object.defineProperty(obj, key, {
        value: val,
        enumerable: !!enumerable,
        writable: true,
        configurable: true
    })
}

export function extend (to, _from) {
    for (const key in _from) {
        to[key] = _from[key]
    }
    return to
}

export function isNative (Ctor) {
    return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

let _SetDef
if (typeof Set !== 'undefined' && isNative(Set)) { // eslint-disable-line no-undef
    _SetDef = Set // eslint-disable-line no-undef
} else {
    _SetDef = class Set {
        constructor () {
            this.set = Object.create(null)
        }
        has (key) {
            return this.set[key] === true
        }
        add (key) {
            this.set[key] = true
        }
        clear () {
            this.set = Object.create(null)
        }
    }
}

export let _Set = _SetDef

export function query (el) {
    if (typeof el === 'string') {
        const selected = document.querySelector(el)
        if (!selected) {
            return document.createElement('div')
        }
        return selected
    } else {
        return el
    }
}

export function makeMap (str, expectsLowerCase) {
    const map = Object.create(null)
    const list = str.split(',')
    for (let i = 0; i < list.length; i++) {
        map[list[i]] = true
    }
    return expectsLowerCase
        ? val => map[val.toLowerCase()]
        : val => map[val]
}

export function genStaticKeys (modules) {
    return modules.reduce((keys, m) => {
        return keys.concat(m.staticKeys || [])
    }, []).join(',')
}

export const isPreTag = (tag) => tag === 'pre'

export const isReservedTag = makeMap(
    'template,script,style,element,content,slot,link,meta,svg,view,' +
    'a,div,img,image,text,span,richtext,input,switch,textarea,spinner,select,' +
    'slider,slider-neighbor,indicator,trisition,trisition-group,canvas,' +
    'list,cell,header,loading,loading-indicator,refresh,scrollable,scroller,' +
    'video,web,embed,tabbar,tabheader,datepicker,timepicker,marquee,countdown',
    true
)

export function mustUseProp () { /* console.log('mustUseProp') */ }
export function getTagNamespace () { /* console.log('getTagNamespace') */ }
export function isUnknownElement () { /* console.log('isUnknownElement') */ }

const bailRE = /[^\w.$]/
export function parsePath (path) {
    if (bailRE.test(path)) {
        return
    }
    const segments = path.split('.')
    return function (obj) {
        for (let i = 0; i < segments.length; i++) {
            if (!obj) return
            obj = obj[segments[i]]
        }
        return obj
    }
}