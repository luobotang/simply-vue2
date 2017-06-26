// src/platforms/web/runtime-with-compiler.js

import Vue from './vue'
import {
    isPreTag,
    mustUseProp,
    isReservedTag,
    getTagNamespace,
    query,
    genStaticKeys,
    makeMap
} from './util'
import { createCompiler } from './compiler/index'
import directives from './directives'
import modules from './modules'
import { patch } from './patch'

const isUnaryTag = makeMap(
    'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
    'link,meta,param,source,track,wbr'
)

const canBeLeftOpenTag = makeMap(
    'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
)

const baseOptions = {
    expectHTML: true,
    modules,
    directives,
    isPreTag,
    isUnaryTag,
    mustUseProp,
    canBeLeftOpenTag,
    isReservedTag,
    getTagNamespace,
    staticKeys: genStaticKeys(modules)
}

const { compileToFunctions } = createCompiler(baseOptions)

const idToTemplate = id => {
    const el = query(id)
    return el && el.innerHTML
}

const shouldDecodeNewlines = shouldDecode('\n', '&#10;')

Vue.prototype.__patch__ = patch

const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (el, hydrating) {
    el = el && query(el)

    if (el === document.body || el === document.documentElement) {
        return this
    }

    const options = this.$options

    let template = options.template
    if (template) {
        if (typeof template === 'string') {
            if (template.charAt(0) === '#') {
                template = idToTemplate(template)
            }
        } else if (template.nodeType) {
            template = template.innerHTML
        } else {
            return this
        }
    } else if (el) {
        template = getOuterHTML(el)
    }
    if (template) {
        const { render, staticRenderFns } = compileToFunctions(template, {
            shouldDecodeNewlines,
            delimiters: options.delimiters
        }, this)
        options.render = render
        options.staticRenderFns = staticRenderFns
    }

    return mount.call(this, el, hydrating)
}

function getOuterHTML (el) {
    if (el.outerHTML) {
        return el.outerHTML
    } else {
        const container = document.createElement('div')
        container.appendChild(el.cloneNode(true))
        return container.innerHTML
    }
}

Vue.compile = compileToFunctions

function shouldDecode (content, encoded) {
    const div = document.createElement('div')
    div.innerHTML = `<div a="${content}">`
    return div.innerHTML.indexOf(encoded) > 0
}

export default Vue