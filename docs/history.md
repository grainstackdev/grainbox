# grainbox/history

`history` uses [`history-events`](https://www.npmjs.com/package/history-events) to detect changes in the URL bar.
These changes are then propagated to dependent functions system using [`reactive()`](./reactivity.md).

```js
import { reactive, history } from 'grainbox'
reactive(() => {
  // Changes in history are reactive.
  history()
})
```