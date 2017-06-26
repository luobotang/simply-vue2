import { pluckModuleFunction } from './helpers'
import baseDirectives from './directives'
import { camelize, no } from '../util'

// configurable state
let warn
let transforms
let dataGenFns
let platformDirectives
let isPlatformReservedTag
let staticRenderFns
let onceCount
let currentOptions

export function generate (ast, options) {
    // save previous staticRenderFns so generate calls can be nested
    const prevStaticRenderFns = staticRenderFns
    const currentStaticRenderFns = staticRenderFns = []
    const prevOnceCount = onceCount
    onceCount = 0
    currentOptions = options
    transforms = pluckModuleFunction(options.modules, 'transformCode')
    dataGenFns = pluckModuleFunction(options.modules, 'genData')
    platformDirectives = options.directives || {}
    isPlatformReservedTag = options.isReservedTag || no
    const code = ast ? genElement(ast) : '_c("div")'
    staticRenderFns = prevStaticRenderFns
    onceCount = prevOnceCount
    return {
        render: `with(this){return ${code}}`,
        staticRenderFns: currentStaticRenderFns
    }
}

function genElement (el) {
    if (el.staticRoot && !el.staticProcessed) {
        return genStatic(el)
    } else if (el.once && !el.onceProcessed) {
        return genOnce(el)
    } else if (el.for && !el.forProcessed) {
        return genFor(el)
    } else if (el.if && !el.ifProcessed) {
        return genIf(el)
    } else if (el.tag === 'template' && !el.slotTarget) {
        return genChildren(el) || 'void 0'
    } else if (el.tag === 'slot') {
        return genSlot(el)
    } else {
        // component or element
        let code
        if (el.component) {
            code = genComponent(el.component, el)
        } else {
            const data = el.plain ? undefined : genData(el)

            const children = el.inlineTemplate ? null : genChildren(el, true)
            code = `_c('${el.tag}'${
                data ? `,${data}` : '' // data
            }${
                children ? `,${children}` : '' // children
            })`
        }
        // module transforms
        for (let i = 0; i < transforms.length; i++) {
            code = transforms[i](el, code)
        }
        return code
    }
}

// hoist static sub-trees out
function genStatic (el) {
    el.staticProcessed = true
    staticRenderFns.push(`with(this){return ${genElement(el)}}`)
    return `_m(${staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}

// v-once
function genOnce (el) {
    el.onceProcessed = true
    if (el.if && !el.ifProcessed) {
        return genIf(el)
    } else if (el.staticInFor) {
        let key = ''
        let parent = el.parent
        while (parent) {
            if (parent.for) {
                key = parent.key
                break
            }
            parent = parent.parent
        }
        if (!key) {
            process.env.NODE_ENV !== 'production' && warn(
                `v-once can only be used inside v-for that is keyed. `
            )
            return genElement(el)
        }
        return `_o(${genElement(el)},${onceCount++}${key ? `,${key}` : ``})`
    } else {
        return genStatic(el)
    }
}

function genIf (el) {
    el.ifProcessed = true // avoid recursion
    return genIfConditions(el.ifConditions.slice())
}

function genIfConditions (conditions) {
    if (!conditions.length) {
        return '_e()'
    }

    const condition = conditions.shift()
    if (condition.exp) {
        return `(${condition.exp})?${genTernaryExp(condition.block)}:${genIfConditions(conditions)}`
    } else {
        return `${genTernaryExp(condition.block)}`
    }

    // v-if with v-once should generate code like (a)?_m(0):_m(1)
    function genTernaryExp (el) {
        return el.once ? genOnce(el) : genElement(el)
    }
}

function genFor (el) {
    const exp = el.for
    const alias = el.alias
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

    if (
        process.env.NODE_ENV !== 'production' &&
        maybeComponent(el) && el.tag !== 'slot' && el.tag !== 'template' && !el.key
    ) {
        warn(
            `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
            `v-for should have explicit keys. ` +
            `See https://vuejs.org/guide/list.html#key for more info.`,
            true /* tip */
        )
    }

    el.forProcessed = true // avoid recursion
    return `_l((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +
            `return ${genElement(el)}` +
        '})'
}

function genData (el) {
    let data = '{'

    // directives first.
    // directives may mutate the el's other properties before they are generated.
    const dirs = genDirectives(el)
    if (dirs) data += dirs + ','

    // key
    if (el.key) {
        data += `key:${el.key},`
    }
    // ref
    if (el.ref) {
        data += `ref:${el.ref},`
    }
    if (el.refInFor) {
        data += `refInFor:true,`
    }
    // pre
    if (el.pre) {
        data += `pre:true,`
    }
    // record original tag name for components using "is" attribute
    if (el.component) {
        data += `tag:"${el.tag}",`
    }
    // module data generation functions
    for (let i = 0; i < dataGenFns.length; i++) {
        data += dataGenFns[i](el)
    }
    // attributes
    if (el.attrs) {
        data += `attrs:{${genProps(el.attrs)}},`
    }
    // DOM props
    if (el.props) {
        data += `domProps:{${genProps(el.props)}},`
    }
    // event handlers
    if (el.events) {
        data += `${genHandlers(el.events, false, warn)},`
    }
    if (el.nativeEvents) {
        data += `${genHandlers(el.nativeEvents, true, warn)},`
    }
    // slot target
    if (el.slotTarget) {
        data += `slot:${el.slotTarget},`
    }
    // scoped slots
    if (el.scopedSlots) {
        data += `${genScopedSlots(el.scopedSlots)},`
    }
    // component v-model
    if (el.model) {
        data += `model:{value:${
            el.model.value
        },callback:${
            el.model.callback
        },expression:${
            el.model.expression
        }},`
    }
    // inline-template
    if (el.inlineTemplate) {
        const inlineTemplate = genInlineTemplate(el)
        if (inlineTemplate) {
            data += `${inlineTemplate},`
        }
    }
    data = data.replace(/,$/, '') + '}'
    // v-bind data wrap
    if (el.wrapData) {
        data = el.wrapData(data)
    }
    return data
}

function genDirectives (el) {
    const dirs = el.directives
    if (!dirs) return
    let res = 'directives:['
    let hasRuntime = false
    let i, l, dir, needRuntime
    for (i = 0, l = dirs.length; i < l; i++) {
        dir = dirs[i]
        needRuntime = true
        const gen = platformDirectives[dir.name] || baseDirectives[dir.name]
        if (gen) {
            // compile-time directive that manipulates AST.
            // returns true if it also needs a runtime counterpart.
            needRuntime = !!gen(el, dir, warn)
        }
        if (needRuntime) {
            hasRuntime = true
            res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
                dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
            }${
                dir.arg ? `,arg:"${dir.arg}"` : ''
            }${
                dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
            }},`
        }
    }
    if (hasRuntime) {
        return res.slice(0, -1) + ']'
    }
}

function genInlineTemplate (el) {
    const ast = el.children[0]
    if (process.env.NODE_ENV !== 'production' && (
        el.children.length > 1 || ast.type !== 1
    )) {
        warn('Inline-template components must have exactly one child element.')
    }
    if (ast.type === 1) {
        const inlineRenderFns = generate(ast, currentOptions)
        return `inlineTemplate:{render:function(){${
            inlineRenderFns.render
        }},staticRenderFns:[${
            inlineRenderFns.staticRenderFns.map(code => `function(){${code}}`).join(',')
        }]}`
    }
}

function genScopedSlots (slots) {
    return `scopedSlots:_u([${
        Object.keys(slots).map(key => genScopedSlot(key, slots[key])).join(',')
    }])`
}

function genScopedSlot (key, el) {
    if (el.for && !el.forProcessed) {
        return genForScopedSlot(key, el)
    }
    return `{key:${key},fn:function(${String(el.attrsMap.scope)}){` +
    `return ${el.tag === 'template'
        ? genChildren(el) || 'void 0'
        : genElement(el)
    }}}`
}

function genForScopedSlot (key, el) {
    const exp = el.for
    const alias = el.alias
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''
    el.forProcessed = true // avoid recursion
    return `_l((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +
            `return ${genScopedSlot(key, el)}` +
        '})'
}

function genChildren (el, checkSkip) {
    const children = el.children
    if (children.length) {
        const el = children[0]
        // optimize single v-for
        if (children.length === 1 &&
            el.for &&
            el.tag !== 'template' &&
            el.tag !== 'slot'
        ) {
            return genElement(el)
        }
        const normalizationType = checkSkip ? getNormalizationType(children) : 0
        return `[${children.map(genNode).join(',')}]${
            normalizationType ? `,${normalizationType}` : ''
        }`
    }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
function getNormalizationType (children) {
    let res = 0
    for (let i = 0; i < children.length; i++) {
        const el = children[i]
        if (el.type !== 1) {
            continue
        }
        if (needsNormalization(el) ||
                (el.ifConditions && el.ifConditions.some(c => needsNormalization(c.block)))) {
            res = 2
            break
        }
        if (maybeComponent(el) ||
                (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))) {
            res = 1
        }
    }
    return res
}

function needsNormalization (el) {
    return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

function maybeComponent (el) {
    return !isPlatformReservedTag(el.tag)
}

function genNode (node) {
    if (node.type === 1) {
        return genElement(node)
    } else {
        return genText(node)
    }
}

function genText (text) {
    return `_v(${text.type === 2
        ? text.expression // no need for () because already wrapped in _s()
        : transformSpecialNewlines(JSON.stringify(text.text))
    })`
}

function genSlot (el) {
    const slotName = el.slotName || '"default"'
    const children = genChildren(el)
    let res = `_t(${slotName}${children ? `,${children}` : ''}`
    const attrs = el.attrs && `{${el.attrs.map(a => `${camelize(a.name)}:${a.value}`).join(',')}}`
    const bind = el.attrsMap['v-bind']
    if ((attrs || bind) && !children) {
        res += `,null`
    }
    if (attrs) {
        res += `,${attrs}`
    }
    if (bind) {
        res += `${attrs ? '' : ',null'},${bind}`
    }
    return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
function genComponent (componentName, el) {
    const children = el.inlineTemplate ? null : genChildren(el, true)
    return `_c(${componentName},${genData(el)}${
        children ? `,${children}` : ''
    })`
}

function genProps (props) {
    let res = ''
    for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        res += `"${prop.name}":${transformSpecialNewlines(prop.value)},`
    }
    return res.slice(0, -1)
}

// #3895, #4268
function transformSpecialNewlines (text) {
    return text
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}

// events.js

/* @flow */

const fnExpRE = /^\s*([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/
const simplePathRE = /^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?']|\[".*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*\s*$/

// keyCode aliases
const keyCodes = {
    esc: 27,
    tab: 9,
    enter: 13,
    space: 32,
    up: 38,
    left: 37,
    right: 39,
    down: 40,
    'delete': [8, 46]
}

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
const genGuard = condition => `if(${condition})return null;`

const modifierCode = {
    stop: '$event.stopPropagation();',
    prevent: '$event.preventDefault();',
    self: genGuard(`$event.target !== $event.currentTarget`),
    ctrl: genGuard(`!$event.ctrlKey`),
    shift: genGuard(`!$event.shiftKey`),
    alt: genGuard(`!$event.altKey`),
    meta: genGuard(`!$event.metaKey`),
    left: genGuard(`'button' in $event && $event.button !== 0`),
    middle: genGuard(`'button' in $event && $event.button !== 1`),
    right: genGuard(`'button' in $event && $event.button !== 2`)
}

function genHandlers (
    events,
    isNative
) {
    let res = isNative ? 'nativeOn:{' : 'on:{'
    for (const name in events) {
        const handler = events[name]
        res += `"${name}":${genHandler(name, handler)},`
    }
    return res.slice(0, -1) + '}'
}

function genHandler (
    name,
    handler
) {
    if (!handler) {
        return 'function(){}'
    }

    if (Array.isArray(handler)) {
        return `[${handler.map(handler => genHandler(name, handler)).join(',')}]`
    }

    const isMethodPath = simplePathRE.test(handler.value)
    const isFunctionExpression = fnExpRE.test(handler.value)

    if (!handler.modifiers) {
        return isMethodPath || isFunctionExpression
            ? handler.value
            : `function($event){${handler.value}}` // inline statement
    } else {
        let code = ''
        let genModifierCode = ''
        const keys = []
        for (const key in handler.modifiers) {
            if (modifierCode[key]) {
                genModifierCode += modifierCode[key]
                // left/right
                if (keyCodes[key]) {
                    keys.push(key)
                }
            } else {
                keys.push(key)
            }
        }
        if (keys.length) {
            code += genKeyFilter(keys)
        }
        // Make sure modifiers like prevent and stop get executed after key filtering
        if (genModifierCode) {
            code += genModifierCode
        }
        const handlerCode = isMethodPath
            ? handler.value + '($event)'
            : isFunctionExpression
                ? `(${handler.value})($event)`
                : handler.value
        return `function($event){${code}${handlerCode}}`
    }
}

function genKeyFilter (keys) {
    return `if(!('button' in $event)&&${keys.map(genFilterCode).join('&&')})return null;`
}

function genFilterCode (key) {
    const keyVal = parseInt(key, 10)
    if (keyVal) {
        return `$event.keyCode!==${keyVal}`
    }
    const alias = keyCodes[key]
    return `_k($event.keyCode,${JSON.stringify(key)}${alias ? ',' + JSON.stringify(alias) : ''})`
}
