# grainbox

> A minimal reactivity solution sans compiling or bundling, allowing SPAs to be built without compilers, bundlers or even NPM. (30 kB)

There are multiple pieces needed to build an SPA, but at the core of `grainbox` is the reactivity:

1. Wrap an object with `reactive()` to make it an observable.
2. Wrap a function with `reactive()` to make it recompute whenever an observable changes.

### Inner Workings

`grainbox` uses the built-in [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) object to box values. Functions that make calls to a proxy's getter are observers of that proxy, and calling a proxy's setter causes its observers to recompute.

## Overview

`grainbox` is a collection of pieces necessary to make a single page app (SPA) without compilers or bundlers, and possibly without NPM.

| Sub-Package | Description  |
|---|---|
| `grainbox/reactivity` | Reactive state management similar to [`mobx`](https://www.npmjs.com/package/mobx). |
| `grainbox/history` | Reactive history. |
| `grainbox/routing` | Reactive routing. |
| `grainbox/hyperscript` | A custom implementation of [`hyperscript`](https://www.npmjs.com/package/hyperscript) with support for es modules, and it adds support for these props: `ref`, `onmount`, `unmount`, `disabled`, `checked`, `class`. |
| `grainbox/html-tag` | If you are not using JSX (maybe because you are avoiding compilers or bundlers), you can use this `html` template tag literal which was made by combining `grainbox/hyperscript` with standard [`htm`](https://www.npmjs.com/package/htm). |


## Import

### From `node_modules`

Most of the functions are exported from a single place:

```js
import grainbox from 'grainbox'
import {
  reactive,
  history,
  registerRoute,
  html,
  h,
} from 'grainbox'
```

There are sub-packages which have additional exports.
They can be imported using a subpath or a direct path to the file in either one of the `dist/esm` or `dist/cjs` folders.

```js
// subpath imports:
import * as reactivity from 'grainbox/reactivity'
import * as history from 'grainbox/history'
import * as routing from 'grainbox/routing'
import * as hyperscript from 'grainbox/hyperscript'
import * as htmlTag from 'grainbox/html-tag'

// direct imports:
import * as reactivity from 'grainbox/dist/esm/reactivity.mjs'
import * as reactivity from 'grainbox/dist/cjs/reactivity.js'
```

### From CDN

Using a CDN, NPM isn't needed anymore in order to build an SPA. It all just works, out of the box, thanks to ES Modules.

```js
import grainbox from 'https://unpkg.com/grainbox'
```

Some points to make about delivery:
* `import grainbox` is ~30 kB. It is not currently minified.
* Instead of using a CDN, `grainbox` can be used with [`web-imports`](https://npmjs.com/web-imports) to reliably serve `node_modules` to the client.

## Usage

`grainbox` should be easy to pick up if you are familiar with observable-observer mechanisms. Here is a comparison against an example from [`mobx`](https://npmjs.com/mobx):

### mobx

```js
import {observable, computed} from 'mobx'

class Proto {
  @observable value = 0
  @computed get valueAsString() {
    return value.toString()
  }
}

const obj = new Proto()

autorun(() => {
  console.log(obj.valueAsString)
})

obj.value++
```

When `obj.value++` runs, the autorun will log it to the console.

### grainbox

This how the mobx example above would be implemented using grainbox's `reactive()`:

```js
import {reactive} from 'grainbox'

const obj = reactive({
  value: 0 
})

const valueAsString = reactive(() => {
  return obj.value.toString()
})

reactive(() => {
  console.log(valueAsString())
})

obj.value++
```

## Examples

### Creating Observables

```js
// The only things that can be wrapped are objects and functions:
const ro = reactive({})
const rf = reactive(() => {})
```

### Listening to Observables

```js
const ro = reactive({value: 0})
const rf = reactive(() => {
  // Calling the getter causes it to become linked.
  return ro.value
})
reactive(() => {
  // Calling a function will also cause it to become linked.
  rf()
})
```

### Fine grained DOM updates

```html
<body>
  <script type="module">
    import {reactive} from 'https://unpkg.com/grainbox'
  
    const valueSpan = document.getElementById('value')
  
    const store = reactive({value: 0})
    reactive(() => {
      valueSpan.innerHTML = store.value.toString()
    })
  
    window.add = () => {
      store.value++
    }
  
    window.sub = () => {
      store.value--
    }
  </script>
  
  <span id="value">0</span>
  <button onclick="sub()">-</button>
  <button onclick="add()">+</button>
</body>
```

Run the code above: https://unpkg.com/grainbox/examples/fine-grained-reactivity.html

### Reactive JSX Components

```html
<body>
  <script type="module">
    import {reactive, html} from 'https://unpkg.com/grainbox'

    let count = reactive({
      counter: 0
    })

    // If the wrapped function's return value is a DOM element,
    // reactive use its .replaceWith method to cause this DOM element to update.
    const View = reactive(() => html`<span>Count: ${count.counter}</span>`)

    const App = () => html`
      <div>
        <h2>counter using reactive</h2>
        <${View}/>
        <button
          onclick=${() => {
            console.log('increment')
            count.counter++
          }}
        >
          Click
        </button>
      </div>
    `

    document.body.appendChild(App())
  </script>
</body>
```

Run the code above: https://unpkg.com/grainbox/examples/using-components.html

## Reactivity

In addition to `reactive`, there are additional functions which are exported from `grainbox/reactivity`:
```
export {
  reactive, // converts input into a proxy
  isReactive, // checks if something was wrapped with reactive
  fromPromise, // allows reactive functions to react to promises
  hasDependent, // a isDependent on b
  getDependents, // list of reactive objects and functions
  getCreationContext // useful for checking identity   
};
```

## History and Routing

Usually, the reactivity solution is tied into history and routing. Included in `grainbox` are solutions for these.

* [History](./docs/history.md)
* [Routing](./docs/routing.md)

## JSX

Supporting JSX currently requires compilation, however, browser may support it one day.

If you would like to use JSX instead of `html` template tag literals, you can do so using the [`jsx-to-hyperscript`](https://www.npmjs.com/package/jsx-to-hyperscript) package. Then, `h` must be present in any file which has JSX. This is similar to how `React` has to be present in any file which has JSX.

```js
// These imports are analogous to each other with respect to JSX being present in the file.  
import {React} from 'react'
import {h} from 'grainbox'

// `jsx-to-hyperscript` will transforms this into: const element = h('div')
const element = <div/>
```

## Notes

### Package Exports

* `unpkg.com` uses the `unpkg` field.
* `esm.run` uses the `exports` field, using the `default` conditional.
* `jsdelivr` uses the `main` field.