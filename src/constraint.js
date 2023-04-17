// @flow

import {reactive, setConstraintRecorder} from './reactivity.mjs'

// When the predicate becomes true,
// a constraint callback is setup,
// the setter will be ran, recording the initial values,
// Locks will be set on those proxies.
// Any future sets will respect the lock.

// When the predicate becomes false,
// the lock is removed, and
// each of the recorded values is set.
// Then the unsetter function is ran.
export function constraint(predicate, setter, unsetter) {
  let activated = false
  const cleanupCommands = []
  const record = (proxy, prop, originalValue) => {
    cleanupCommands.push([proxy, prop, originalValue])
  }
  const lock = () => {
    for (const command of cleanupCommands) {
      command[0]({lock: true})
    }
  }
  const unlock = () => {
    for (const command of cleanupCommands) {
      command[0]({unlock: true})
    }
  }
  const restore = () => {
    console.log('cleanupCommands', cleanupCommands)
    for (const command of cleanupCommands) {
      command[0][command[1]] = command[2]
    }
  }

  reactive(() => {
    if (predicate()) {
      activated = true
      setConstraintRecorder(record)
      // When a constraint context is set, reactive registration does not happen.
      setter()
      setConstraintRecorder(null)
      lock()
    } else if (activated) {
      unlock()
      restore()
      if (unsetter) unsetter()
    }
  })
}