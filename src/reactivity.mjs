// @flow

const genSecret = () =>
  Math.random()
    .toString()
    .split('')
    .slice(2)
    .map((d) => String.fromCharCode(97 + (parseInt(d) % (122 - 97))))
    .join('')
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

// export type Reactive<T> = {
//   (): T,
//   _setShouldUpdate: (prev: any, next: any) => boolean,
//   _dependents: Array<CreationContext>,
//   _creationContext: CreationContext,
//   ...T
// }
export type Reactive<T> = T

function reactive<T>(init: T, name?: ?string): Reactive<T> {
  // console.log('name', name)

  const isR = isReactive(init)
  if (isR) {
    return isR
  }

  const defaultFunction = () => {
    // return isPrimitive(init) ? init : null
    return init
  }
  const defaultState = isPrimitive(init) ? { value: init } : {}

  const recompute: () => any =
    // $FlowFixMe
    typeof init === 'function' ? init : defaultFunction
  const state = typeof init === 'object' || init.__isProxy ? init : defaultState
  const observerRegistry = new WeakMap()
  const dependents: Array<CreationContext> = []
  const creations = []
  let shouldUpdate = (prev, next) => prev !== next

  const registerContextAsDependent = () => {
    // console.log('registerContextAsDependent', name)
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
  Object.defineProperty(unboxCache, 'name', {value: name || 'reactive'})

  const createContext: CreationContext = {
    onChange: () => {
      recomputeContexts.push({ index: 0, creations })
      const nextValue: any = recompute()
      recomputeContexts.pop()
      const prevValue = cachedValue // setting should not causes registrations as dependent.
      if (
        isEl(nextValue) &&
        !!nextValue?.replaceWith &&
        isEl(prevValue) &&
        !!prevValue?.replaceWith
      ) {
        // .replaceWith is how fine grained page updates happen.
        // console.log('replaceWith')
        prevValue.replaceWith(nextValue)
      }

      if (shouldUpdate(prevValue, nextValue)) {
        cachedValue = nextValue
        for (const ctx of dependents) {
          // Whenever there is a change, notify dependents.
          // todo: batch updates
          //   Allow set to be called multiple times before callbacks are called.
          ctx.onChange()
        }
      }

      return nextValue
    },
    registerCreation: (reactiveObj) => {
      creations.push(reactiveObj)
    },
    handle: recompute,
    id: genSecret(),
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
    //  diallow setting within an observer.
    //  eventually allow setting within an observer.
    // console.log('dependents', dependents)
    for (const ctx of dependents) {
      // Whenever there is a change, notify dependents.
      // todo: batch updates
      //   Allow set to be called multiple times before callbacks are called.
      ctx.onChange()
    }
  }

  function set(obj, prop, value) {
    // console.log('set', name, prop, obj, value)
    // $FlowFixMe
    const currentValue = state[prop]
    // console.log('currentValue', currentValue)
    // console.log('shouldUpdate(currentValue, value)', shouldUpdate(currentValue, value))

    if (shouldUpdate(currentValue, value)) {
      // $FlowFixMe
      state[prop] = value
      updateDependents()
    }
    return true
  }

  // $FlowFixMe
  const proxy: Reactive<T> = new Proxy(unboxCache, {
    get(parent, prop) {
      registerContextAsDependent()

      if (prop === secret) {
        return true
      }
      if (prop === 'toString' && parent().__isBeam) {
        return state?.toString
      }
      if (
        prop === 'toString' ||
        prop === 'valueOf' ||
        prop === Symbol.toStringTag ||
        prop === Symbol.toPrimitive
      ) {
        return unboxCache()
      }
      if (prop === '_setShouldUpdate') {
        return (func) => {
          shouldUpdate = func
        }
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
      if (parent().__isBeam) {
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
            // new leaf
            // it is wrapped with reactive,
            return value().__value
          } else {
            // resolved
            return value
          }
        }
      }
      // const arr = parent()
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

      // $FlowFixMe
      return state?.[prop]
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
          const value = init(...args)
          if (!value.__isResolved) {
            // value is a beam proxy, unboxed once.
            // In general a beam proxy should never be exposed;
            // only a reactive proxy or a resolved value.
            return proxy // allows ability to chain listener registration.
          } else {
            // value is the resolved value, unboxed twice.
            return value
          }
        }
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
}
