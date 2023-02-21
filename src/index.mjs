// @flow
import { reactive as _reactive } from './reactivity.mjs'
import { history as _history } from './history.mjs'
import { registerRoute as _registerRoute } from './routing.mjs'
import { default as _html } from './html-tag.mjs'
import { default as _h } from './grainbox-hyperscript.mjs'

export const reactive = _reactive
export const history = _history
export const registerRoute = _registerRoute
export const html = _html
export const h = _h

export default {
  reactive,
  history,
  registerRoute,
  html,
  h,
}
