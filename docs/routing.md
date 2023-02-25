# grainbox/routing

The full example can be found here: https://unpkg.com/grainbox/examples/routing/routing.html

This example will cause a web page to render with the word "send" displayed on the screen, then 2 seconds later, `history.push` is used to transition to the read page, upon which the word "read" will appear on screen.

```html
<body>
  <script type="module">
    import {registerRoute, history} from "https://unpkg.com/grainbox"

    registerRoute(document.body, "/one", () => import("./two.js"))
    registerRoute(document.body, "/two", () => import("./one.js"))

    history.push('/one')
    setTimeout(() => {
    history.push('/two')
  }, 2000)
  </script>
</body>
```

```js
// one.js
import {html} from "https://unpkg.com/grainbox";
const element = html`<div>one</div>`
export default element
```
```js
// two.js
import {html} from "https://unpkg.com/grainbox";
const element = html`<div>two</div>`
export default element
```

## Full API

```
function registerRoute(
  root: HTMLElement, 
  path: string, 
  callback: () => Promise<{ default: HTMLElement }>
)
```

* `root` - The page `element` will become a child of this root when the URL bar matches the path.
* `path` - See [`regexparam`](https://www.npmjs.com/package/regexparam) for more information on which kinds of path strings are supported.
* `callback` - This should be a function, which will be called when the URL matched the path, and which will return dynamic import of the element to be mounted.
