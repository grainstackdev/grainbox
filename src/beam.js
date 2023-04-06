// @flow

import {reactive} from './reactivity.mjs'

type BeamConfig = {
  name: string,
  serverUrl: string,
  disableLogger: boolean,
  headers: {[string]: string}
}

type Beam = {
  (...args: any): Beam,
  [any]: Beam,
  __children: {[string]: Beam},
  __args: Array<{[string]: any}>,
  __resolve: (any) => void,
  __isProxy: true,
  __isBeam: true,
}

export function beam(config: BeamConfig): Beam {
  // if (!config.name) {
  //   config.name = ''
  // }

  // proxy.children
  // What happens each time get or apply is called?
  // - On get, add prop as a key to children, and the value is the next proxy.
  // - On apply, proxy.args is created on the prevProxy.
  //    If different args are provide to multiple apply calls, then these are aliased queries.

  // How is the query built?
  // - On the next frame, and after introspection is complete, use .children to navigate the tree.
  // - Each child which appears in the schema is added to the selection being built.
  // - If a child has .args, then these are added to the selection also.

  const makeProxy = (propName: string): Beam => {
    // console.log('new beam proxy', propName)
    const __children = {}
    const __args = []

    let __resolved = false
    let __value
    const __resolve = (value) => {
      __value = value
      __resolved = true
    }

    let beamProxy
    const reflectBeam: () => Beam = () => beamProxy
    beamProxy = new Proxy(reflectBeam, {
      /*
        Example:
          const data = beam() // data is a proxy.

          // Build a query for {viewer(token: $token)}:
          const viewer = data.viewer({sessionToken}) // viewer is a proxy.

          // Include {currentUser} in the query builder:
          const user = viewer.currentUser // user is a proxy.
      */
      get(reflect: () => Beam, prop: string) {
        const prevBeamProxy = reflect()

        // Examples of when this is called:
        // data.viewer.users.map
        // data.viewer.users[0]
        // data.viewer.currentUser

        if (prop === '__children') {
          return __children
        } else if (prop === '__args') {
          return __args
        } else if (prop === '__resolve') {
          return __resolve
        } else if (prop === '__isResolved') {
          return __resolved
        } else if (prop === '__isProxy') {
          return true
        } else if (prop === '__isBeam') {
          return true
        }

        if (prop === '__value' || __resolved) {
          return __value
        }

        const nextReactiveProxy = makeProxy(prop)

        prevBeamProxy.__children[prop] = nextReactiveProxy

        return nextReactiveProxy
      },
      apply(reflect: () => Beam, thisArg, args) {
        const prevBeamProxy = reflect()

        // Examples of when this is called:
        // data.viewer({token: token1})
        // data.viewer({token: token2})
        // data.viewer.users.map(() => {})

        if (__resolved) {
          return __value
        }

        if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          // only when args is an object could it be part of a graphql query.
          prevBeamProxy.__args.push(args[0])
        }
        return prevBeamProxy // returns the beam proxy
      },
      set(obj, prop, value) {
        throw new Error('Writing to the server via assignment is not supported.')
      }
    })

    const reactiveProxy = reactive(beamProxy, `reactive(beam(${propName}))`)
    // $FlowFixMe
    return reactiveProxy
  }

  const proxy = makeProxy('data')

  const constructQuery = () => {
    if (config.name) {
      const query = `query ${config.name} ${getSubQuery(proxy)}`
      return query
    } else {
      const query = `query ${getSubQuery(proxy)}`
      return query
    }
  }

  const sendQuery = async (query) => {
    const payload = await sendGraphQLQuery(config, query)
    return payload
  }

  const hydrateLeafProxies = (schema, payload) => {
    const flatDataMap = flattenPayload(payload.data)
    const flatProxyMap = getFlatProxyMap(proxy)

    // console.log('flatDataMap', flatDataMap)
    // console.log('flatProxyMap', flatProxyMap)

    for (const key of Object.keys(flatProxyMap)) {
      const selectionPath = key.slice(5)
      const leafType = getType(selectionPath, schema)

      if (leafType === 'SCALAR') {
        flatProxyMap[key].__resolve(flatDataMap[key] ?? null)
      }
    }
  }

  Promise.resolve().then(async () => {
    try {
      const schema = await introspect(config)
      const query = constructQuery()
      const response = await sendQuery(query)
      hydrateLeafProxies(schema, response)
    } catch (err) {
      console.error(err)
    }
  })

  return proxy
}

async function sendGraphQLQuery(config: BeamConfig, query: any, variables: any): Promise<{data: any}> {
  const startTime = Date.now()

  const res = await fetch(config.serverUrl, {
    method: "post",
    body: JSON.stringify({
      query,
      variables: variables || {}
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })
  const payload = await res.json()

  if (!config.disableLogger) {
    if (config.name) {
      if (payload.data && !payload.errors) {
        console.groupCollapsed(`%cQuery`, `color: #489bfd; font-weight: bold;`, config.name)
      } else if (payload.data && payload.errors) {
        console.group(`%cQuery`, `color: #f9e124; font-weight: bold;`, config.name)
      } else if (!payload.data && payload.errors) {
        console.group(`%cQuery`, `color: #ea2929; font-weight: bold;`, config.name)
      }
    } else {
      if (payload.data && !payload.errors) {
        console.groupCollapsed(`%cQuery`, `color: #489bfd; font-weight: bold;`)
      } else if (payload.data && payload.errors) {
        console.group(`%cQuery`, `color: #f9e124; font-weight: bold;`)
      } else if (!payload.data && payload.errors) {
        console.group(`%cQuery`, `color: #ea2929; font-weight: bold;`)
      }
    }

    console[payload.errors ? 'group' : 'groupCollapsed']('Selection')
    console.log(query)
    console.groupEnd()

    if (payload.data) {
      console.log('Data', payload.data)
    }
    if (payload.errors) {
      // console.log('Errors', payload.errors)
      console.group('Errors')
      for (const error of payload.errors) {
        console.log(error)
      }
      console.groupEnd()
    }

    console.log('Sent', (new Date(startTime)).toISOString())
    console.log('Elapsed', Date.now() - startTime)

    console.groupEnd()
  }

  return payload
}

async function introspect(config: BeamConfig) {
  const schema = await sendGraphQLQuery(config, `{
  __schema {
    types {
      name
      kind
      fields {
        name
        type {
          name
          kind
        }
        args {
          name
          type {
            name
            kind
          }
        }
      }
    }
  }
}
`)
  return schema
}

function getTypeMap(schema) {
  const map = {}
  for (const type of schema.data.__schema.types) {
    if (type.fields) {
      map[type.name] = map[type.name] || {}
      for (const field of type.fields) {
        if (field.type.kind === 'SCALAR') {
          map[type.name][field.name] = 'SCALAR'
        } else {
          map[type.name][field.name] = field.type.name
        }
      }
    }
  }
  return map
}

// Question:
// Given string like data.viewer.currentUser.userId,
// tell me the type of the last portion, userId.
function getType(selectionPath, schema) {
  if (!selectionPath) return 'OBJECT'

  // const selectionPath = 'viewer.currentUser.userId'
  const keywords = selectionPath.split('.')

  const typeMap = getTypeMap(schema)
  let parentType = 'Query'
  for (const field of keywords) {
    parentType = typeMap[parentType][field]

    if (typeof parentType === 'SCALAR') {
      break
    }
  }

  return parentType === 'SCALAR' ? 'SCALAR' : 'OBJECT'
}

function getSubQuery(proxy: Beam, indentN: number = 0): string {
  const indent = [...Array(indentN)].map(() => '  ').join('')

  let query = '{\n'

  for (const key of Object.keys(proxy.__children)) {
    const innerIndent = [...Array(indentN + 1)].map(() => '  ').join('')
    query += innerIndent + key

    const value = proxy.__children[key]
    if (value.__args.length) {
      // todo support multiple calls with different args
      const args = value.__args[0]
      const argString = Object.keys(args).map(key => `${key}: "${args[key]}"`).join(', ')
      query += `(${argString})`
    }

    const nPlus1Available = Object.keys(value.__children).length
    if (nPlus1Available) {
      query += ' ' + getSubQuery(value, indentN + 1)
    }

    query += '\n'
  }

  query += indent + '}'
  return query
}

function flattenPayload(data: {[string]: any}, level: string = 'data'): {[string]: any} {
  const map = {}
  map[level] = data

  if (typeof data === 'object' && data !== null) {
    for (const key of Object.keys(data)) {
      const mapKey = level + '.' + key
      const flatMap = flattenPayload(data[key], mapKey)

      for (const i of Object.keys(flatMap)) {
        map[i] = flatMap[i]
      }
    }
  }

  return map
}

function getFlatProxyMap(proxy: Beam, level: string = 'data'): {[string]: Beam} {
  const map = {}
  map[level] = proxy

  for (const key of Object.keys(proxy.__children)) {
    const mapKey = level + '.' + key
    const flatMap = getFlatProxyMap(proxy.__children[key], mapKey)

    for (const i of Object.keys(flatMap)) {
      map[i] = flatMap[i]
    }
  }

  return map
}
