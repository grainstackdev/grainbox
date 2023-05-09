// @flow

import 'history-events'
import * as qss from 'qss'
import { reactive } from './reactive.mjs'

const w = await (typeof window === 'undefined' ? import('html-element') : Promise.resolve(window))

const push = (
  path: string,
  options?: ?{
    search?: string,
    state?: any,
    hash?: string,
  },
) => {
  const { search, state, hash } = options ?? {}
  let url = path
  if (search) {
    url += qss.encode(search)
  }
  if (hash) {
    url += `#${hash}`
  }
  w.history.pushState(state, '', url)
}

const replace = (
  path: string,
  options?: ?{
    search?: string,
    state?: any,
    hash?: string,
  },
) => {
  const { search, state, hash } = options ?? {}
  let url = path
  if (search) {
    url += qss.encode(search)
  }
  if (hash) {
    url += `#${hash}`
  }
  w.history.replaceState(state, '', url)
}

export const history: {
  location: Location,
  push: (
    path: string,
    options?: ?{ search?: { ... }, state?: { ... }, hash?: string },
  ) => void,
  clearSearch: () => void,
} = reactive({
  location: {
    ...w.location,
  },
  push,
  replace,
  clearSearch: () => {
    replace(w.location.pathname)
  },
})

if (w.addEventListener) {
  w.addEventListener('changestate', () => {
    history.location = { ...w.location }
  })
}
