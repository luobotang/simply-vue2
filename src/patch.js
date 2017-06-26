import * as nodeOps from './runtime/node-ops'
import { createPatchFunction } from './vdom/patch'
import baseModules from './vdom/modules'
import platformModules from './runtime/modules'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

export const patch = createPatchFunction({ nodeOps, modules })