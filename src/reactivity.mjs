// @flow

const genSecret = () =>
  Math.random()
    .toString()
    .split('')
    .slice(2)
    .map((d) => String.fromCharCode(97 + (parseInt(d) % (122 - 97))))
    .join('')
// todo: make id generation unique
const secret = genSecret()

export type CreationContext = {
  onChange: () => any,
  registerCreation: (reactiveObj: Reactive<any>) => any,
  handle: () => any,
  id: string,
}

type RecomputeContext = {
  creations: Array<any>,
  index: number,
}

let creationContexts: Array<CreationContext> = []
let recomputeContexts: Array<RecomputeContext> = []
let finishedRecomputes = {}

function isEl(obj) {
  const canUseDOM = !!(
    typeof window !== 'undefined' &&
    window.document &&
    window.document.createElement
  )

  if (!canUseDOM) {
    return
  }

  const isObject = typeof obj === 'object' && obj !== null
  const isWindow = window === Object(window) && window === window.window
  if (!isObject || !isWindow || !(`Node` in window)) {
    return false
  }
  return typeof obj.nodeType === `number` && typeof obj.nodeName === `string`
}

function peek<T>(a: Array<T>): ?T {
  if (!a || !Array.isArray(a)) {
    return null
  }
  return a[a.length - 1]
}

function isReactive(obj: any): Reactive<any> | null %checks {
  return typeof obj === 'function' &&
  !obj?.__isBeam &&
  obj?.[secret] &&
  obj?._setShouldUpdate &&
  obj?._dependents
    ? obj
    : null
}

function setShouldUpdate(
  obj: any,
  shouldUpdate: (prev: any, next: any) => boolean,
) {
  if (isReactive(obj)) {
    const objR = (obj: Reactive<any>)
    objR._setShouldUpdate(shouldUpdate)
  }
}

function fromPromise<T>(p: Promise<T>): Reactive<{ value: ?T, state: string }> {
  const s: { value: ?T, state: string } = {
    value: null,
    state: 'pending',
  }
  const state = reactive(s)

  p.then((value: any) => {
    setShouldUpdate(state, (prev, next) => {
      return JSON.stringify(prev) !== JSON.stringify(next)
    })
    // todo: state() may cause unwanted registration.
    //  In theory, when the promise resolve, there should be no reactive context in the call stack.
    //  So, there should be no problem.
    state.value = value
    state.state = 'fulfilled'
  })

  return state
}

// a isDependent on b
function hasDependent(a: any, b: any): boolean %checks {
  return (
    !!isReactive(b) &&
    !!isReactive(a) &&
    !!a._dependents.find((c) => c._creationContext === c)
  )
}

function getDependents(a: Reactive<any>): Array<CreationContext> {
  return a._dependents
}

function getCreationContext(a: Reactive<any>): CreationContext {
  return a._creationContext
}

function isPrimitive(test: any): boolean {
  return test !== Object(test)
}

let constraintRecorder
function setConstraintRecorder(value) {
  constraintRecorder = value
}

let constraintTrace
function setConstraintTrace(value) {
  constraintTrace = value
}

const debounce = (func, timeout) => {
  let timer

  return (...args) => {
    const deferred = () => {
      timer = null;
      func(...args);
    };

    timer && clearTimeout(timer)
    timer = setTimeout(deferred, timeout)
  };
}

// export type Reactive<T> = {
//   (): T,
//   _setShouldUpdate: (prev: any, next: any) => boolean,
//   _dependents: Array<CreationContext>,
//   _creationContext: CreationContext,
//   ...T
// }
export type Reactive<T> = T
type Extra = string | {debounce: number}

function reactive<T>(init: T, extra?: ?Extra): Reactive<T> {
  const name = typeof extra === 'string' ? extra : 'reactive'
  // console.log('name', name)
  const place = new Error(name || 'Reactive')
  const id = genSecret()

  const debounceSettings = extra?.debounce ? extra : null

  const isR = isReactive(init)
  if (isR) {
    return isR
  }

  const defaultState = isPrimitive(init) ? Object(init) : {}
  const defaultFunction = () => {
    // return isPrimitive(init) ? init : null
    return defaultState.valueOf()
  }
  const recompute: () => any =
    // $FlowFixMe
    typeof init === 'function' ? init : defaultFunction
  let state = typeof init === 'object' || init?.__isProxy ? init : defaultState

  const observerRegistry = new WeakMap()
  const dependents: Array<CreationContext> = []
  const creations = []
  let shouldUpdate = (prev, next) => prev !== next
  let setterLocked = false

  const registerContextAsDependent = () => {
    if (constraintRecorder) {
      return
    }
    if (recomputeContexts.length) {
      // When running as a recompute, do not register
      return
    }
    const createCtx = peek(creationContexts)
    if (
      createCtx &&
      !observerRegistry.has(createCtx?.handle || {}) // prevent duplicate registration
    ) {
      // Runs when one specials obj is accessed during the creation of another specials obj.
      // We will register the obj being created as a dependent
      // because its state depends on the state of obj being accessed.

      if (createCtx) {
        // console.log('registerContextAsDependent', name, createCtx.name)
        observerRegistry.set(createCtx.handle, true)
        dependents.push(createCtx)
      }
    }
  }

  // Register any observables used inside a computable.
  let cachedValue
  const unboxCache = () => {
    // console.log('cachedValue', cachedValue)
    registerContextAsDependent()
    return cachedValue
  }

  // For printing a reactive function:
  Object.defineProperty(unboxCache, 'name', {value: name})

  let onChange = () => {
    // Each recompute when happens during this macrotask should be recorded, recording the proxy's id.
    // If a proxy has already been recomputed this macrotask, then onChange is noop.
    // Microtasks are used to run before the next macrotask.
    // The microtask will clear out the recorded array so that the next macrotask has a fresh one.
    // todo: Later, microtasks can be used to batch updates.
    if (finishedRecomputes[id]) {
      console.error('Loop', place)
      return
    }
    finishedRecomputes[id] = true
    if (Object.keys(finishedRecomputes).length === 1) {
      // During the current macrotask's execution, if any recompute happens,
      // a microtask is queued, just once.
      // See https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide#batching_operations
      queueMicrotask(() => {
        finishedRecomputes = {}
      })
    }

    recomputeContexts.push({ index: 0, creations })
    const nextValue: any = recompute()
    recomputeContexts.pop()
    const prevValue = cachedValue // setting should not causes registrations as dependent.
    cachedValue = nextValue
    if (
      isEl(nextValue) &&
      !!nextValue?.replaceWith &&
      isEl(prevValue) &&
      !!prevValue?.replaceWith &&
      nextValue !== prevValue // See ref proxy
    ) {
      // .replaceWith is how page updates happen.
      // If a function which returns an HTML element is passed into reactive,
      // Then that function's return type should never change, always returning
      // an HTML element.
      // On recomputes, the previous value will be replaced with the new.
      // In cases where the function returns HTML, it is called a builder.
      prevValue.replaceWith(nextValue)

      // Reactive builders do not propagate their reactivity.
      // Instead, the DOM is the final destination of reactivity.
      return nextValue
    }

    if (shouldUpdate(prevValue, nextValue)) {
      updateDependents()
    }

    return nextValue
  }
  if (debounceSettings) {
    onChange = debounce(onChange, debounceSettings.debounce)
  }

  const createContext: CreationContext = {
    onChange,
    registerCreation: (reactiveObj) => {
      creations.push(reactiveObj)
    },
    handle: recompute,
    id,
    name
  }

  // A createContext is raised when
  creationContexts.push(createContext)
  // console.log(name, 'creationContexts', [...creationContexts])
  // console.log('init', init)
  cachedValue = recompute() // todo the first time this runs, it needs to record any reactive creations.
  // console.warn('null out')
  creationContexts.pop()

  function updateDependents() {
    // console.log('dependents', dependents)
    // todo
    //   disallow setting within an observer.
    //   eventually allow setting within an observer.
    // console.log('dependents', dependents)
    for (const ctx of dependents) {
      // Whenever there is a change, notify dependents.
      // todo: batch updates
      //   Allow set to be called multiple times before callbacks are called.
      // console.log('calling dep from', name, place)
      ctx.onChange()
    }
  }

  let lastLockingStack
  const pendingSets = []
  let pendingSetTimeout
  const reportPendingSets = () => {
    pendingSetTimeout = setTimeout(() => {
      pendingSetTimeout = null
      if (pendingSets.length) {
        // If there are any remaining pending sets still unapplied on the next frame,
        // then it means there are conflicting constraints enabled.
        console.group(`%cTwo or more constraints are conflicting: `, 'color: #ea2929;')
        console.error(lastLockingStack)
        for (const ps of pendingSets) {
          console.error(ps[1])
        }
        console.groupEnd()
      }
    })
  }

  function set(obj, prop, value) {
    // Performing a set should not cause dependency registration

    // $FlowFixMe
    const currentValue = isPrimitive(init) ? state.valueOf() : state[prop]
    const updateNeeded = shouldUpdate(currentValue, value)

    if (constraintRecorder && !setterLocked) {
      constraintRecorder(proxy, prop, currentValue)
    }
    if (setterLocked) {
      // todo:
      //  If locked, record this set as a pending operation.
      //  If during this frame the proxy is unlocked, then the pending set will by applied.
      if (constraintRecorder && updateNeeded) {
        const setConstraintRecorder = constraintRecorder
        const trace = constraintTrace()
        pendingSets.push([() => {
          proxy[prop] = value
          proxy(() => ({lock: true, trace}))
          // a reference to constraintRecorder must survive even after attempted locking.
          setConstraintRecorder(proxy, prop, currentValue)
        }, trace])
        reportPendingSets()
      }
      return true
    }

    if (updateNeeded) {
      const isInputRef = init?.__isRef && init?.__isResolved && init().tagName === 'INPUT' && init().type !== 'image'
      // $FlowFixMe
      if (isPrimitive(init)) {
        state = Object(value)
        cachedValue = state.valueOf()
      } else if (isInputRef) {
        init().value = value
      } else {
        state[prop] = value
        cachedValue = state
      }

      updateDependents()
    }
    return true
  }

  // $FlowFixMe
  const proxy: Reactive<T> = new Proxy(unboxCache, {
    get(unboxCache, prop) {
      if (
        prop !== '__isProxy' &&
        prop !== '__isRef' &&
        prop !== '__isBeam' &&
        prop !== '__isResolved' &&
        prop !== '__isNullProxy'
      ) {
        registerContextAsDependent()
      }

      if (prop === secret) {
        return true
      }
      if (prop === 'toString' && unboxCache().__isBeam) {
        return state?.toString
      }
      if (
        prop === 'toString' ||
        prop === 'valueOf'
      ) {
        return cachedValue
      }
      if (
        prop === Symbol.toStringTag ||
        prop === Symbol.toPrimitive
      ) {
        return () => cachedValue
      }
      if (prop === '_setShouldUpdate') {
        return (func) => {
          shouldUpdate = func
        }
      }
      if (prop === '__updateDependents') {
        return updateDependents
      }
      if (prop === '_dependents') {
        return dependents
      }
      if (prop === '_creationContext') {
        return createContext
      }
      if (prop === '__isProxy') {
        return true
      }
      if (prop === '__isReactive') {
        return true
      }
      if (init?.__isBeam) {
        if (prop === '__resolve') {
          // internally used when beam tries to resolve.
          const beamResolve = state?.[prop]
          return (value) => {
            beamResolve(value)
            updateDependents()
          }
        } else {
          // state is a beam proxy.
          const value = state?.[prop]
          // value is:
          //  - new reactive proxy when a new leaf is created
          //  - unboxed value when leaf is resolved
          if (value?.__isResolved) {
            // resolved
            // Return the value boxed still
            return value
          } else {
            // new leaf
            // it is wrapped with reactive
            return value
          }
        }
      }
      if (prop === '__isResolved' && !init?.__isBeam && !init?.__isRef) {
        return true
      }

      // $FlowFixMe
      return state?.[prop]
      // const arr = unboxCache()
      // console.log('arr', arr)
      // if (Array.isArray(arr)) {
      //   if (prop === 'map') {
      //     const originalProp = arr[prop].bind(arr)
      //
      //     const newMap = (...args) => {
      //       const cb = args[0]
      //
      //       // map should cause the source and destination arrays to become and stay parallel.
      //       // If items are added, removed, or moved, in the source then they react accordingly.
      //       const result = reactive(originalProp(...args), 'mapped')
      //
      //       parallelArrays(arr, result, cb)
      //
      //       // The new .map should return a reactive object and it should register itself as a dependent.
      //       creationContexts.push(createContext)
      //       result()
      //       creationContexts.pop()
      //
      //       // lines.map() is called outside of a reactive context.
      //       // This causes the newMap() to run, which creates a reactive result.
      //       // Registration as dependent happens on get, set, or (),
      //       // but only if there is a creation context.
      //       // A creation context is created whenever reactive(() => {}) is called.
      //       // The function passed in is called when reactive is called, but it is called within a creation context.
      //       // So a creation context can be thought of as a function which is running inside a reactive() call.
      //       // Any usage of other already instantiated reactive objects registers the new reactive object as a dependent.
      //       // Upstream changes in those objects will cause the function in reactive(() => {}) to recompute.
      //       // So .map creates a new reactive object, kind of like how reactive(() => {}) does.
      //       // And the returned reactive object should be listening to changes.
      //       // const outlines = reactive(() => {return lines.map(() => {})})
      //
      //
      //       return result
      //     }
      //     return newMap.bind(arr)
      //   }
      //   if (prop === 'push') {
      //     const originalProp = arr[prop].bind(arr)
      //     const newProp = (item) => {
      //       console.log('newPush', item)
      //       set(arr, arr.length, item)
      //       return originalProp(item)
      //     }
      //     return newProp.bind(arr)
      //   }
      // }
    },
    set,
    apply(target, thisArg, args) {
      if (args.length) {
        // Passing args in allows alternative behavior besides unboxing.
        // Normally, w empty args, reactive apply is used for:
        //  - unboxing
        //  - registering self as a listener to the outer reactive context.

        if (init.__isBeam) {
          // init is a beam proxy
          registerContextAsDependent()
          if (!init.__isResolved) {
            // value is a beam proxy, unboxed once.
            // In general a beam proxy should never be exposed.
            // only a reactive proxy or a resolved value.
            return proxy // allows ability to chain listener registration.
          } else {
            // the resolved value is unboxed.
            const value = init(...args)
            return value
          }
        } else if (args.length === 1 && typeof args[0] === 'function') {
          // Passing a function into an apply is a different kind of operation
          // than passing in a non-function value.
          // This is currently only used for the constraint system.
          // Passing in (() => {lock: true}) or (() => {unlock: true})
          // to lock or unlock the proxy.

          const specialArgs = args[0]()
          if (!!specialArgs && typeof specialArgs === 'object') {
            if (specialArgs?.lock) {
              if (!setterLocked) {
                lastLockingStack = specialArgs.trace
              }
              setterLocked = true
            } else if (specialArgs?.unlock) {
              const prevSetterLocked = setterLocked
              setterLocked = false
              if (prevSetterLocked && pendingSets.length) {
                const ps = pendingSets.shift()
                ps[0]()
              }
            } else if (specialArgs?.noRegister) {
              return cachedValue
            }
          }
          return
        } else if (args.length === 1 && typeof args[0] !== 'function') {
          // Passing in a non-function value will set.

          // If it is primitive:
          if (isPrimitive(args[0])) {
            // prop name is set to _ as a dummy name
            proxy._ = args[0]
          } else {
            // An object was passed in
            for (const key of Object.keys(args[0])) {
              proxy[key] = args[0][key]
            }
          }
          return
        }
      }
      if (init.__isBeam) {
        // init is a beam proxy
        registerContextAsDependent()
        // unbox:
        return init()
      }
      if (init.__isRef) {
        return unboxCache()()
      }
      return unboxCache()
    }
  })

  const createCtx = peek(creationContexts)
  // console.log('createCtx', createCtx)
  // console.log('init', init)
  if (createCtx) {
    // This runs during the first call of the recompute function.
    // Any specials objects created during a recompute
    // need to be blocked, and instead merged into the
    // the matching original object.
    // the observer is part of the specials which should remember creations made within its context.
    createCtx?.registerCreation(proxy)
    // console.warn('registerCreation', createCtx.init, init)
  }

  const recomputeCtx = peek(recomputeContexts)
  // console.log('recomputeCtx', recomputeCtx)
  // console.log('creations', creations)
  if (recomputeCtx) {
    // This runs when a subsequent recompute calls creates a specials obj.
    // Instead of returning a new specials obj in this case,
    // we need to return the same specials obj that was created the first time recompute function was called.
    const item = recomputeCtx.creations[recomputeCtx.index]
    recomputeCtx.index++
    if (item) {
      // console.warn('blocked specials obj')
      return item
    }
  }

  // console.warn('created new specials obj', init)
  // $FlowFixMe
  return proxy
}

export {
  reactive,
  isReactive,
  fromPromise,
  hasDependent,
  getDependents,
  getCreationContext,
  setConstraintRecorder,
  setConstraintTrace
}
