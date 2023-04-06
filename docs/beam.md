# beam.js

Beam is a GraphQL query builder and client with minimal API as the primary design goal.

As the developer, you just use server variable as if they already exist, and beam handles everything else.

```js
import {beam, reactive} from 'grainbox'

const conf = {
  serverUrl: 'https://fruits-api.netlify.app/graphql'
}

const data = beam({...conf})

reactive(() => {
  console.log(data.fruit({id: 30}).fruit_name)
})
// prints:

// First time reactive function is registered:
// Proxy { <target>: unboxCache(), <handler>: {…} }

// After server responds:
// Persimmon Fruit
```

## Basic introduction to proxies

## What happens each time get or apply operation happens?

## How is the query built?

## Loading Phase

Since usage of server values is used build the query,
returning early will not work.
Instead usages must be hoisted manually.
This might be a little cumbersome, but it solves some of the issue of
answering the question, "What server values does this page/component use".
In graphql clients, like useQuery, the graphql selection, using graphql-tag
specifies a contract between the component and the server about what values are needed.
This contract no longer exists in beam, so that comes with the problem of answering that question.
Hoisting the values is a good medium which makes the question answerable,
and still, the developer only has to specify a single source of truth.
The contract is a redundancy that is removed in grainbox.

There is a problem of default values while beam is in the unresolved state.
server.loading can be used to avoid usage of unresolved values,
but this seems unsafe, and puts too much onus on the developer.
Instead, if there were sensible defaults, then sometimes developers can
get away with using those, and not have to worry about checking server.loading.
Relying on server.loading all the time would mean every component which
uses server values would have to have a different loading state that must be
defined.
Reducing the number of things a developer has to define is one of the design goals of grainbox.
Note that the bare minimum of if (server.loading) {return} might be something
that can be implemented into grainbox by default.
That is, all reactive functions which use beam should return a default value, either null or a div,
until all server values the function relies on are resolved.
If the function references .loading, then this default behavior is disabled because the developer is handling themselves.

### Sub-Tree Loading

## Resolving Phase