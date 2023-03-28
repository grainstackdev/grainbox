// @flow

type BeamConfig = {
  name: string,
  serverUrl: string,
  enableLogger: boolean
}

async function sendGraphQLQuery(config: BeamConfig, query, variables) {
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

  if (payload.data && !payload.errors) {
    console.groupCollapsed(`%cQuery`, `color: #489bfd; font-weight: bold;`, config.name)
  } else if (payload.data && payload.errors) {
    console.groupCollapsed(`%cQuery`, `color: #f9e124; font-weight: bold;`, config.name)
  } else if (!payload.data && payload.errors) {
    console.groupCollapsed(`%cQuery`, `color: #ea2929; font-weight: bold;`, config.name)
  }

  if (payload.data) {
    console.log('Data', payload.data)
  }
  if (payload.errors) {
    console.log('Errors', payload.errors)
  }

  console.log('Send Time', new Date(startTime))
  console.log('Elapsed', Date.now() - startTime)

  console.groupEnd()

  return payload.data
}

async function introspect(config: BeamConfig) {
  const schemaQuery = await sendGraphQLQuery(config, `{
    __schema {
      types {
        name
        kind
      }
      queryType {
        fields {
          name
        }
      }
    }
  }`)
  console.log('schemaQuery', schemaQuery)
}

export function beam(config: BeamConfig) {
  console.log('beam')

  introspect(config).catch(err => {
    console.error(err)
  })

  return new Proxy({}, {
    get(target, prop) {
      /*
        on a read
        if the return value is itself an object,
        then another property access could happen,
        so the return object also needs to be turned into a proxy
        if the return value is an array, it is also like an object,
        because, in JS it can be treated just the same as an object,
        properties being accessed in the same way,
        so it also needs to be wrapped in a proxy.
        Each time a property is accessed, it needs to be recorded as part
        of the graphql selection
      * */
    },
    apply(target, thisArg, args) {
      /*
        When calling a beam object,
        a variables object is passed in as a parameter.

        This is used to perform a selection with variables.

        For example, if the code is:

        const data = beam(config)
        const user = data.user({userId})

        Then this would be equivalent to the gql selection:

        {
          user(userId: $userId) {
            id
          }
        }

        However, there is an issue, because data.user() is multiple steps.
        First .user calls the get trap with `user` as the prop.
        It should be followed by a call so that the apply trap is called.
        In some cases, all args are optional, so a get without an apply
        is equivalent to passing no arguments.
        If the apply trap is not called, and there were some args required,
        then schema introspection will invalidate the selection, throwing an error.
      */
    },
    set(obj, prop, value) {
      throw new Error('Writing to the server via assignment is not supported.')
    }
  })
}