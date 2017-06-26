import { nextTick } from '../util'

export const MAX_UPDATE_COUNT = 100

const queue = []
const activatedChildren = []
let has = {}
let waiting = false
let flushing = false
let index = 0

function resetSchedulerState() {
    index = queue.length = activatedChildren.length = 0
    has = {}
    waiting = flushing = false
}

function flushSchedulerQueue() {
    flushing = true
    let watcher, id

    queue.sort((a, b) => a.id - b.id)

    for (index = 0; index < queue.length; index++) {
        watcher = queue[index]
        id = watcher.id
        has[id] = null
        watcher.run()
    }

    resetSchedulerState()
}

export function queueActivatedComponent(vm) {
    vm._inactive = false
    activatedChildren.push(vm)
}

export function queueWatcher(watcher) {
    const id = watcher.id
    if (has[id] == null) {
        has[id] = true
        if (!flushing) {
            queue.push(watcher)
        } else {
            let i = queue.length - 1
            while (i > index && queue[i].id > watcher.id) {
                i--
            }
            queue.splice(i + 1, 0, watcher)
        }
        if (!waiting) {
            waiting = true
            nextTick(flushSchedulerQueue)
        }
    }
}
