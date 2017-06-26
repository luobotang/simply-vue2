import { no, camelize } from '../util'
import { parseHTML } from './html-parser'
import { parseText, parseFilters } from './text-parser'
import { genAssignmentCode } from './directives_model'
import {
    getAndRemoveAttr,
    getBindingAttr,
    pluckModuleFunction,
    addProp,
    addAttr,
    addHandler,
    addDirective
} from './helpers'

let decoder

export function decode (html) {
    decoder = decoder || document.createElement('div')
    decoder.innerHTML = html
    return decoder.textContent
}

export let warn
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp

export const onRE = /^@|^v-on:/
export const dirRE = /^v-|^@|^:/
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/

const argRE = /:(.*)$/
const bindRE = /^:|^v-bind:/
const modifierRE = /\.[^.]+/g

export function parse (template, options) {
    warn = options.warn || (msg => { console.error(`[Vue compiler]: ${msg}`) })
    platformMustUseProp = options.mustUseProp || no
    platformIsPreTag = options.isPreTag || no
    preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
    transforms = pluckModuleFunction(options.modules, 'transformNode')
    postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')
    delimiters = options.delimiters

    const stack = []
    const preserveWhitespace = options.preserveWhitespace !== false
    let root
    let currentParent
    let inVPre = false
    let inPre = false
    let warned = false

    function warnOnce (msg) {
        if (!warned) {
            warned = true
            warn(msg)
        }
    }

    function endPre (element) {
        // check pre state
        if (element.pre) {
            inVPre = false
        }
        if (platformIsPreTag(element.tag)) {
            inPre = false
        }
    }

    parseHTML(template, {
        warn,
        expectHTML: options.expectHTML,
        isUnaryTag: options.isUnaryTag,
        canBeLeftOpenTag: options.canBeLeftOpenTag,
        shouldDecodeNewlines: options.shouldDecodeNewlines,
        start (tag, attrs, unary) {
            const element = {
                type: 1,
                tag,
                attrsList: attrs,
                attrsMap: makeAttrsMap(attrs),
                parent: currentParent,
                children: []
            }

            if (isForbiddenTag(element)) {
                element.forbidden = true
            }

            // apply pre-transforms
            for (let i = 0; i < preTransforms.length; i++) {
                preTransforms[i](element, options)
            }

            if (!inVPre) {
                processPre(element)
                if (element.pre) {
                    inVPre = true
                }
            }
            if (platformIsPreTag(element.tag)) {
                inPre = true
            }
            if (inVPre) {
                processRawAttrs(element)
            } else {
                processFor(element)
                processIf(element)
                processOnce(element)
                processKey(element)

                // determine whether this is a plain element after
                // removing structural attributes
                element.plain = !element.key && !attrs.length

                processRef(element)
                processSlot(element)
                processComponent(element)
                for (let i = 0; i < transforms.length; i++) {
                    transforms[i](element, options)
                }
                processAttrs(element)
            }

            function checkRootConstraints (el) {
                // ...
            }

            // tree management
            if (!root) {
                root = element
                checkRootConstraints(root)
            } else if (!stack.length) {
                // allow root elements with v-if, v-else-if and v-else
                if (root.if && (element.elseif || element.else)) {
                    checkRootConstraints(element)
                    addIfCondition(root, {
                        exp: element.elseif,
                        block: element
                    })
                }
            }
            if (currentParent && !element.forbidden) {
                if (element.elseif || element.else) {
                    processIfConditions(element, currentParent)
                } else if (element.slotScope) { // scoped slot
                    currentParent.plain = false
                    const name = element.slotTarget || '"default"'
                    ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
                } else {
                    currentParent.children.push(element)
                    element.parent = currentParent
                }
            }
            if (!unary) {
                currentParent = element
                stack.push(element)
            } else {
                endPre(element)
            }
            // apply post-transforms
            for (let i = 0; i < postTransforms.length; i++) {
                postTransforms[i](element, options)
            }
        },

        end () {
            // remove trailing whitespace
            const element = stack[stack.length - 1]
            const lastNode = element.children[element.children.length - 1]
            if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
                element.children.pop()
            }
            // pop stack
            stack.length -= 1
            currentParent = stack[stack.length - 1]
            endPre(element)
        },

        chars (text) {
            if (!currentParent) {
                return
            }

            const children = currentParent.children
            text = inPre || text.trim()
                ? isTextTag(currentParent) ? text : decode(text)
                // only preserve whitespace if its not right after a starting tag
                : preserveWhitespace && children.length ? ' ' : ''
            if (text) {
                let expression
                if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
                    children.push({
                        type: 2,
                        expression,
                        text
                    })
                } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
                    children.push({
                        type: 3,
                        text
                    })
                }
            }
        }
    })
    return root
}

function processPre (el) {
    if (getAndRemoveAttr(el, 'v-pre') != null) {
        el.pre = true
    }
}

function processRawAttrs (el) {
    const l = el.attrsList.length
    if (l) {
        const attrs = el.attrs = new Array(l)
        for (let i = 0; i < l; i++) {
            attrs[i] = {
                name: el.attrsList[i].name,
                value: JSON.stringify(el.attrsList[i].value)
            }
        }
    } else if (!el.pre) {
        // non root node in pre blocks with no attributes
        el.plain = true
    }
}

function processKey (el) {
    const exp = getBindingAttr(el, 'key')
    if (exp) {
        el.key = exp
    }
}

function makeAttrsMap (attrs) {
    const map = {}
    for (let i = 0, l = attrs.length; i < l; i++) {
        map[attrs[i].name] = attrs[i].value
    }
    return map
}

function parseModifiers (name) {
    const match = name.match(modifierRE)
    if (match) {
        const ret = {}
        match.forEach(m => { ret[m.slice(1)] = true })
        return ret
    }
}

function isTextTag (el) {
    return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag (el) {
    return (
        el.tag === 'style' || (el.tag === 'script' && (
            !el.attrsMap.type || el.attrsMap.type === 'text/javascript'
        ))
    )
}

function processRef (el) {
    const ref = getBindingAttr(el, 'ref')
    if (ref) {
        el.ref = ref
        el.refInFor = checkInFor(el)
    }
}

function processFor (el) {
    let exp
    if ((exp = getAndRemoveAttr(el, 'v-for'))) {
        const inMatch = exp.match(forAliasRE)
        if (!inMatch) {
            return
        }
        el.for = inMatch[2].trim()
        const alias = inMatch[1].trim()
        const iteratorMatch = alias.match(forIteratorRE)
        if (iteratorMatch) {
            el.alias = iteratorMatch[1].trim()
            el.iterator1 = iteratorMatch[2].trim()
            if (iteratorMatch[3]) {
                el.iterator2 = iteratorMatch[3].trim()
            }
        } else {
            el.alias = alias
        }
    }
}

function processIf (el) {
    const exp = getAndRemoveAttr(el, 'v-if')
    if (exp) {
        el.if = exp
        addIfCondition(el, {
            exp: exp,
            block: el
        })
    } else {
        if (getAndRemoveAttr(el, 'v-else') != null) {
            el.else = true
        }
        const elseif = getAndRemoveAttr(el, 'v-else-if')
        if (elseif) {
            el.elseif = elseif
        }
    }
}

function processIfConditions (el, parent) {
    const prev = findPrevElement(parent.children)
    if (prev && prev.if) {
        addIfCondition(prev, {
            exp: el.elseif,
            block: el
        })
    }
}

function findPrevElement (children) {
    let i = children.length
    while (i--) {
        if (children[i].type === 1) {
            return children[i]
        } else {
            children.pop()
        }
    }
}

function addIfCondition (el, condition) {
    if (!el.ifConditions) {
        el.ifConditions = []
    }
    el.ifConditions.push(condition)
}

function processOnce (el) {
    const once = getAndRemoveAttr(el, 'v-once')
    if (once != null) {
        el.once = true
    }
}

function checkInFor (el) {
    let parent = el
    while (parent) {
        if (parent.for !== undefined) {
            return true
        }
        parent = parent.parent
    }
    return false
}

function processSlot (el) {
    if (el.tag === 'slot') {
        el.slotName = getBindingAttr(el, 'name')
    } else {
        const slotTarget = getBindingAttr(el, 'slot')
        if (slotTarget) {
            el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
        }
        if (el.tag === 'template') {
            el.slotScope = getAndRemoveAttr(el, 'scope')
        }
    }
}

function processComponent (el) {
    let binding
    if ((binding = getBindingAttr(el, 'is'))) {
        el.component = binding
    }
    if (getAndRemoveAttr(el, 'inline-template') != null) {
        el.inlineTemplate = true
    }
}

function processAttrs(el) {
    const list = el.attrsList
    let i, l, name, rawName, value, modifiers, isProp
    for (i = 0, l = list.length; i < l; i++) {
        name = rawName = list[i].name
        value = list[i].value
        if (dirRE.test(name)) {
            // mark element as dynamic
            el.hasBindings = true
            // modifiers
            modifiers = parseModifiers(name)
            if (modifiers) {
                name = name.replace(modifierRE, '')
            }
            if (bindRE.test(name)) { // v-bind
                name = name.replace(bindRE, '')
                value = parseFilters(value)
                isProp = false
                if (modifiers) {
                    if (modifiers.prop) {
                        isProp = true
                        name = camelize(name)
                        if (name === 'innerHtml') name = 'innerHTML'
                    }
                    if (modifiers.camel) {
                        name = camelize(name)
                    }
                    if (modifiers.sync) {
                        addHandler(
                            el,
                            `update:${camelize(name)}`,
                            genAssignmentCode(value, `$event`)
                        )
                    }
                }
                if (isProp || platformMustUseProp(el.tag, el.attrsMap.type, name)) {
                    addProp(el, name, value)
                } else {
                    addAttr(el, name, value)
                }
            } else if (onRE.test(name)) { // v-on
                name = name.replace(onRE, '')
                addHandler(el, name, value, modifiers, false, warn)
            } else { // normal directives
                name = name.replace(dirRE, '')
                // parse arg
                const argMatch = name.match(argRE)
                const arg = argMatch && argMatch[1]
                if (arg) {
                    name = name.slice(0, -(arg.length + 1))
                }
                addDirective(el, name, rawName, value, arg, modifiers)
            }
        } else {
            addAttr(el, name, JSON.stringify(value))
        }
    }
}