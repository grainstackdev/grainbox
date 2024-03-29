// @flow

import { reactive } from './reactive.mjs'
import {nullProxy} from './nullProxy.js'

// todo:
//  error when assigned to more than one element.

// todo: Like in surplus, prop changes on ref cause
// const addButton = ref({
//   onClick: handleClick
// })
//
// reactive(() => (
//   <addButton>+</addButton>
// ))
//
// delete addButton.onClick
// addButton.style = {}

export function ref() {
  let initialization = true
  let focus = false
  let element
  // When an element is created with a ref, an apply operation is performed
  // first going through the reactive proxy, and then into the ref proxy
  // which then calls onRef.
  //
  // Usage of a ref when it is passed in as a prop is different from other places
  // where it is used. There should only be one place it is passed in as a prop.
  //
  // The only reason a ref needs the apply is to call onRef or unbox the element.
  // Unboxing the element might need to happen reactively.
  // The only place where onRef is called is inside of hyperscript which is the
  // first time the referenced element is being created.
  //
  // To prevent reactive(() => <input ref={textInput}/>) from reactively connecting
  // the ref with the function, hyperscript performs the apply with args.
  // An apply with args versus without args can handled differently, allowing
  // reactive registration to be skipped while still unboxing.
  const onRef = (_element, registerEvent) => {
    element = _element

    if (element?.tagName === 'INPUT' && element?.type === 'text') {
      registerEvent('input', (e) => {
        const activeElement = document.activeElement
        reactiveProxy.__updateDependents()
        // replaceWith can cause focus to be lost even when the focused element
        // is a child of nextValue and unchanged.
        activeElement?.focus()
      })
    }

    if (element) {
      registerEvent('focus', (e) => {
        focus = true
        reactiveProxy.__updateDependents()
      })
      registerEvent('blur', (e) => {
        focus = false
        reactiveProxy.__updateDependents()
      })
    }

    // refProxy must be returned for reactive initialization.
    return element
  }

  const refProxy = new Proxy(onRef, {
    get(parent, prop) {
      if (prop === '__isProxy') {
        return true
      } else if (prop === '__isRef') {
        return true
      } else if (prop === '__isResolved') {
        return !!element
      }

      if (element) {
        if (prop === 'hasFocus') {
          return () => focus
        }
        return element[prop]
      }
    },
    apply(target, thisArg, args) {
      if (args.length) {
        return onRef(...args)
      } else {
        if (element) {
          return element
        } else {
          if (initialization) {
            return refProxy
          }
          // unboxing unresolved async proxy returns a null proxy.
          return nullProxy()
        }
      }
    }
  })

  const reactiveProxy = reactive(refProxy, 'Ref')

  initialization = false

  return reactiveProxy
}