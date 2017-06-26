import { parse } from './parser'
import { optimize } from './optimizer'
import { generate } from './codegen'
import { extend, noop } from '../util'

function baseCompile(template, options) {
    const ast = parse(template.trim(), options)
    optimize(ast, options)
    const code = generate(ast, options)
    return {
        ast,
        render: code.render,
        staticRenderFns: code.staticRenderFns
    }
}

function makeFunction(code, errors) {
    try {
        return new Function(code)
    } catch (err) {
        errors.push({
            err,
            code
        })
        return noop
    }
}

export function createCompiler(baseOptions) {
    const functionCompileCache = Object.create(null)

    function compile(template, options) {
        const finalOptions = Object.create(baseOptions)
        const errors = []
        const tips = []
        finalOptions.warn = (msg, tip) => {
            (tip ? tips : errors).push(msg)
        }

        if (options) {
            // merge custom modules
            if (options.modules) {
                finalOptions.modules = (baseOptions.modules || []).concat(options.modules)
            }
            // merge custom directives
            if (options.directives) {
                finalOptions.directives = extend(
                    Object.create(baseOptions.directives),
                    options.directives
                )
            }
            // copy other options
            for (const key in options) {
                if (key !== 'modules' && key !== 'directives') {
                    finalOptions[key] = options[key]
                }
            }
        }

        const compiled = baseCompile(template, finalOptions)
        compiled.errors = errors
        compiled.tips = tips
        return compiled
    }

    function compileToFunctions(template, options) {
        options = options || {}

        // check cache
        const key = options.delimiters ?
            String(options.delimiters) + template :
            template
        if (functionCompileCache[key]) {
            return functionCompileCache[key]
        }

        // compile
        const compiled = compile(template, options)

        // turn code into functions
        const res = {}
        const fnGenErrors = []
        res.render = makeFunction(compiled.render, fnGenErrors)
        const l = compiled.staticRenderFns.length
        res.staticRenderFns = new Array(l)
        for (let i = 0; i < l; i++) {
            res.staticRenderFns[i] = makeFunction(compiled.staticRenderFns[i], fnGenErrors)
        }

        return (functionCompileCache[key] = res)
    }

    return {
        compile,
        compileToFunctions
    }
}
