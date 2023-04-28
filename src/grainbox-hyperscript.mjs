var split = (function split(undef) {
  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec('')[1] === undef,
    // NPCG: nonparticipating capturing group
    self

  self = function (str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== '[object RegExp]') {
      return nativeSplit.call(str, separator, limit)
    }
    var output = [],
      flags =
        (separator.ignoreCase ? 'i' : '') +
        (separator.multiline ? 'm' : '') +
        (separator.extended ? 'x' : '') + // Proposed for ES6
        (separator.sticky ? 'y' : ''),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + 'g'),
      separator2,
      match,
      lastIndex,
      lastLength
    str += '' // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp('^' + separator.source + '$(?!\\s)', flags)
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit =
      limit === undef
        ? -1 >>> 0 // Math.pow(2, 32) - 1
        : limit >>> 0 // ToUint32(limit)
    while ((match = separator.exec(str))) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index))
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function () {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef
              }
            }
          })
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1))
        }
        lastLength = match[0].length
        lastLastIndex = lastIndex
        if (output.length >= limit) {
          break
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++ // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test('')) {
        output.push('')
      }
    } else {
      output.push(str.slice(lastLastIndex))
    }
    return output.length > limit ? output.slice(0, limit) : output
  }

  return self
})()

var indexOf = [].indexOf

var indexof = function (arr, obj) {
  if (indexOf) return arr.indexOf(obj)
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i
  }
  return -1
}

function ClassList(elem) {
  var cl = elem.classList

  if (cl) {
    return cl
  }

  var classList = {
    add: add,
    remove: remove,
    contains: contains,
    toggle: toggle,
    toString: $toString,
    length: 0,
    item: item,
  }

  return classList

  function add(token) {
    var list = getTokens()
    if (indexof(list, token) > -1) {
      return
    }
    list.push(token)
    setTokens(list)
  }

  function remove(token) {
    var list = getTokens(),
      index = indexof(list, token)

    if (index === -1) {
      return
    }

    list.splice(index, 1)
    setTokens(list)
  }

  function contains(token) {
    return indexof(getTokens(), token) > -1
  }

  function toggle(token) {
    if (contains(token)) {
      remove(token)
      return false
    } else {
      add(token)
      return true
    }
  }

  function $toString() {
    return elem.className
  }

  function item(index) {
    var tokens = getTokens()
    return tokens[index] || null
  }

  function getTokens() {
    var className = elem.className

    return filter(className.split(' '), isTruthy)
  }

  function setTokens(list) {
    var length = list.length

    elem.className = list.join(' ')
    classList.length = length

    for (var i = 0; i < list.length; i++) {
      classList[i] = list[i]
    }

    delete list[length]
  }
}

function filter(arr, fn) {
  var ret = []
  for (var i = 0; i < arr.length; i++) {
    if (fn(arr[i])) ret.push(arr[i])
  }
  return ret
}

function isTruthy(value) {
  return !!value
}

var w = await (typeof window === 'undefined' ? import('html-element') : Promise.resolve(window))
var document = w.document
var Text = w.Text

const lifecyleMethods = [
  'onconnected',
  'onmount',
  'ondisconnected',
  'onunmount',
]

function context() {
  var cleanupFuncs = []

  function h() {
    // h('div', {onMount: () => {}}, [])
    // args = [props, assembledChildren]
    var args = [].slice.call(arguments),
      e = null

    const ref = args[1]?.ref
    const hasRefProxy = ref?.__isRef && ref?.__isResolved
    if (hasRefProxy) {
      // update existing element in place instead of creating a new one.
      e = ref(() => ({noRegister: true}))()
      return e
    }

    function item(l) {
      var r
      function parseClass(string) {
        // Our minimal parser doesn’t understand escaping CSS special
        // characters like `#`. Don’t use them. More reading:
        // https://mathiasbynens.be/notes/css-escapes .

        var m = split(string, /([\.#]?[^\s#.]+)/)
        if (/^\.|#/.test(m[1])) e = document.createElement('div')
        forEach(m, function (v) {
          var s = v.substring(1, v.length)
          if (!v) return
          if (!e) {
            const props = args[0]

            const hasLifecycle =
              typeof props === 'object' &&
              !!props &&
              !!Object.keys(props).find((k) =>
                lifecyleMethods.includes(k.toLowerCase()),
              )
            if (hasLifecycle) {
              class LifecycleWrapper extends HTMLElement {
                constructor() {
                  super()
                }

                connectedCallback() {
                  const callbacks = Object.keys(props)
                    .filter((k) =>
                      ['onmount', 'onconnected'].includes(k.toLowerCase()),
                    )
                    .map((k) => props[k])
                  callbacks.forEach((cb) => cb())
                }

                disconnectedCallback() {
                  const callbacks = Object.keys(props)
                    .filter((k) =>
                      ['onunmount', 'ondisconnected'].includes(k.toLowerCase()),
                    )
                    .map((k) => props[k])
                  callbacks.forEach((cb) => cb())
                }
              }
              customElements.define(`${v}-life`, LifecycleWrapper)
              e = document.createElement(`${v}-life`)
            } else {
              e = document.createElement(v)
            }
          } else if (v[0] === '.') ClassList(e).add(s)
          else if (v[0] === '#') e.setAttribute('id', s)
        })
      }

      const isUnresolvedBeam = l?.__isBeam && !l?.__isResolved
      const isNullProxy = l?.__isNullProxy === true

      if (l == null);
      else if (isUnresolvedBeam || isNullProxy) {
        if (!e) parseClass('')
        else e.appendChild((r = document.createTextNode('')))
      }
      else if ('string' === typeof l) {
        if (!e) parseClass(l)
        else e.appendChild((r = document.createTextNode(l)))
      } else if (
        'number' === typeof l ||
        'boolean' === typeof l ||
        l instanceof Date ||
        l instanceof RegExp
      ) {
        e.appendChild((r = document.createTextNode(l.toString())))
      }
      //there might be a better way to handle this...
      else if (isArray(l)) forEach(l, item)
      else if (isNode(l)) {
        e.appendChild((r = l))
      } else if (l instanceof Text) e.appendChild((r = l))
      else if ('object' === typeof l) {
        // l is object of props, where key is the prop name.
        for (var k in l) {
          // an unresolved proxy passed into ref -> register the ref
          // unresolved proxy into non-ref prop -> ignore prop
          // resolved proxy or non-proxy variable -> handle prop as usual
          const isUnresolvedRefProxy = l[k]?.__isProxy && l[k]?.__isRef && !l[k]?.__isResolved
          if (k.toLowerCase() === 'ref' && (isUnresolvedRefProxy || 'function' === typeof l[k])) {
            function r(ty, li, op) {
              e.addEventListener(ty, li, op)
              cleanupFuncs.push(function () {
                e.removeEventListener(
                  ty,
                  li,
                  op,
                )
              })
            }

            if (isUnresolvedRefProxy) {
              const ref = l[k](() => ({noRegister: true}))
              ref(e, r)
            } else if ('function' === typeof l[k]) {
              l[k](e)
            }
          } else if (!l[k]?.__isProxy || l[k]?.__isResolved) {
            // If proxy, register dependency:
            const p = l[k]?.__isProxy ? l[k]() : l[k]
            if ('function' === typeof p) {
              if (lifecyleMethods.includes(k.toLowerCase())) {
                // lifecycle methods already handled
              } else if (/^on\w+/.test(k)) {
                ;(function (k, l) {
                  // capture k, l in the closure
                  if (e.addEventListener) {
                    // console.log('e', e, l, p)
                    e.addEventListener(k.substring(2).toLowerCase(), p, false)
                    cleanupFuncs.push(function () {
                      e.removeEventListener(
                        k.substring(2).toLowerCase(),
                        p,
                        false,
                      )
                    })
                  } else {
                    e.attachEvent(k, p)
                    cleanupFuncs.push(function () {
                      e.detachEvent(k, p)
                    })
                  }
                })(k, l)
              } else {
                // observable
                e[k] = p()
                cleanupFuncs.push(
                  p(function (v) {
                    e[k] = v
                  }),
                )
              }
            } else if (k === 'style') {
              if ('string' === typeof p) {
                e.style.cssText = p
              } else {
                for (var s in p)
                  (function (s, v) {
                    if ('function' === typeof v) {
                      // observable
                      e.style.setProperty(s, v())
                      cleanupFuncs.push(
                        v(function (val) {
                          e.style.setProperty(s, val)
                        }),
                      )
                    } else var match = p[s].match(/(.*)\W+!important\W*$/)
                    if (match) {
                      e.style.setProperty(s, match[1], 'important')
                    } else {
                      e.style.setProperty(s, p[s])
                    }
                  })(s, p[s])
              }
            } else if (k === 'attrs') {
              for (var v in p) {
                e.setAttribute(v, p[v])
              }
            } else if (
              k.substr(0, 5) === 'data-' ||
              k === 'disabled' ||
              k === 'checked'
            ) {
              if (p !== undefined) {
                e.setAttribute(k, p)
              }
            } else if (k === 'class') {
              e.className = p
            } else if (p === undefined || p === null) {
              console.warn('undefined value for prop', e, k)
            } else {
              // console.log('e', e, k, l)
              e[k] = p
            }
          }
        }
      } else if ('function' === typeof l) {
        //assume it's an observable!
        var v = l()
        e.appendChild((r = isNode(v) ? v : document.createTextNode(v)))

        cleanupFuncs.push(
          l(function (v) {
            if (isNode(v) && r.parentElement)
              r.parentElement.replaceChild(v, r), (r = v)
            else r.textContent = v
          }),
        )
      }

      return r
    }

    while (args.length) item(args.shift())

    return e
  }

  h.cleanup = function () {
    console.log('h.cleanup')
    for (var i = 0; i < cleanupFuncs.length; i++) {
      cleanupFuncs[i]()
    }
    cleanupFuncs.length = 0
  }

  return h
}

var h = context()
h.context = context
export default h

function isNode(el) {
  return el && el.nodeName && el.nodeType
}

function forEach(arr, fn) {
  if (arr.forEach) return arr.forEach(fn)
  for (var i = 0; i < arr.length; i++) fn(arr[i], i)
}

function isArray(arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}
