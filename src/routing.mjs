// @flow

import { parse as regexparam } from 'regexparam'
import { history } from './history.mjs'
import { reactive } from './reactivity.mjs'

export type Page = {
  element: HTMLElement,
}

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
  history() // reactive

  const route = findRoute(history.location.pathname) // reactive
  if (!route) {
    // todo: 404
    return
  }

  if (mountedRoute === route) {
    return
  }
  mountedRoute = route

  const { cb, root } = route

  // The route is a dynamic import.
  cb().then((moduleExport) => {
    if (route !== mountedRoute) return
    const page: Page = moduleExport.default
    // root.innerHTML = page.html
    // console.log("page.html", page.html)
    while (root.lastElementChild) {
      root.removeChild(root.lastElementChild)
    }
    root.appendChild(page.element)
    // page.onMount()
  })
})
