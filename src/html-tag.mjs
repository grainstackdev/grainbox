import _htm from 'htm'
import _hyperscript from './grainbox-hyperscript.mjs'

function h(name, props, ...children) {
  if (typeof name === 'function') {
    return name({
      ...props,
      children,
    })
  }
  return _hyperscript(name, props, ...children)
}
const html = _htm.bind(h)

export const htm = _htm
export const hyperscript = _hyperscript

export default html
