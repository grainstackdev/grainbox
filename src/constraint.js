// @flow

import {reactive, setConstraintRecorder, setConstraintTrace} from './reactive.mjs'

// When the predicate becomes true,
// a constraint callback is setup,
// the setter will be ran, recording the initial values,
// Locks will be set on those proxies.
// Any future sets will respect the lock.

// When the predicate becomes false,
// the lock is removed, and
// each of the recorded values is set.
// Then the unsetter function is ran.
export function constraint(predicate, setter, unsetter, name) {
  const error = new Error(name || 'Constraint')

  let activated = false
  let cleanupCommands = []
  const record = (proxy, prop, originalValue) => {
    cleanupCommands.push([proxy, prop, originalValue])
  }
  const trace = () => {
    return error
  }
  const lock = () => {
    for (const command of cleanupCommands) {
      command[0](() => ({lock: true, trace: error}))
    }
  }
  const unlock = () => {
    for (const command of cleanupCommands) {
      command[0](() => ({unlock: true}))
    }
  }
  const restore = () => {
    for (const command of cleanupCommands) {
      command[0][command[1]] = command[2]
    }
  }

  reactive(() => {
    const p = !!predicate()
    if (p === activated) {
      // no change
      return
    }
    if (p) {
      activated = true
      cleanupCommands = []
      setConstraintRecorder(record)
      setConstraintTrace(trace)
      // When a constraint context is set, reactive registration does not happen.
      // The record function may be called multiple times during setter's execution.
      setter()
      // It is possible to detect if any variables in the setter are locked.
      // If it tries to set on a locked proxy, then the set is recorded as pending during this frame.
      // If during this frame, it gets unlocked, then the pending set is applied.
      // If at the beginning of the next frame, there are still some pending sets unapplied,
      // then it means two or more constraints are conflicting.
      setConstraintRecorder(null)
      setConstraintTrace(null)
      lock()
    } else {
      activated = false
      unlock()
      restore()
      if (unsetter) unsetter()
    }
  })
}

// todo
//  run deactivating constraints before activating constraints
//  detect when there are two conflicting constraints