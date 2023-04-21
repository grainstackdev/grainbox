// @flow

import { parse as regexparam } from 'regexparam'
import { history } from './history.mjs'
import { reactive } from './reactivity.mjs'

export type Page = HTMLElement

const routeRegistry = reactive({})
type RegisterRoute = (
  root: HTMLElement,
  path: string,
  cb: () => Promise<{ default: Page }>,
) => void
export const registerRoute: RegisterRoute = (root, path, cb) => {
  // $FlowFixMe
  routeRegistry[path] = {
    regexp: regexparam(path),
    cb,
    root,
  }
}

function findRoute(pathname: string) {
  // $FlowFixMe
  const registry = routeRegistry()
  console.log('registry', registry)
  for (const path of Object.keys(registry)) {
    const route = registry[path]

    const match = route.regexp.pattern.test(pathname)
    if (match) {
      return route
    }
  }
}

function exec(path: any, result: any) {
  let i = 0,
    out = {}
  let matches = result.pattern.exec(path)
  while (i < result.keys.length) {
    out[result.keys[i]] = matches[++i] || null
  }
  return out
}

export function getUrlParams(): { ... } {
  const route = findRoute(history.location.pathname)
  if (route) {
    return exec(history.location.pathname, route.regexp)
  } else {
    return {}
  }
}

let mountedRoute = null
reactive(() => {
  // $FlowFixMe
  history() // history changes are reactive

  const route = findRoute(history.location.pathname) // route registry changes are reactive
  if (!route) {
    // todo: 404
    return
  }

  if (mountedRoute === route) {
    return
  }
  mountedRoute = route

  const { cb: dynamicImport, root } = route

  // The route is a dynamic import.
  dynamicImport().then((moduleExport) => {
    if (route !== mountedRoute) return
    const page: Page = moduleExport.default
    // root.innerHTML = page.html
    // console.log("page.html", page.html)
    while (root.lastElementChild) {
      root.removeChild(root.lastElementChild)
    }
    if (page.__isReactive) {
      // Unboxing causes listener registration.
      // However, the only things which should cause this function to recompute
      // are history changes, and changes to the route registry.
      // If a page/component were to cause this function to recompute,
      // it would re-import, removeChild, and then appendChild
      // which is slower than a single replaceWith.
      console.error('A value boxed by reactive cannot be mounted. Try exporting the unboxed value instead. Use the "()" operator to unbox values.')
    }
    root.appendChild(page)
    // page.onMount()
  })
})
