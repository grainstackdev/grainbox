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
