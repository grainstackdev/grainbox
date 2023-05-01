# ref

```js
const textInput = ref()
const element = reactive(() => (<input type="text" ref={textInput}/>))
reactive(() => {
  console.log('textInput.value', textInput.value)
})
reactive(() => {
  console.log('textInput.hasFocus()', textInput.hasFocus())
})
```

A ref proxy has these features:
* When attached to any element, `focus` and `blur` listeners are attached. This allows `.hasFocus()` to be called on the ref handle. `.hasFocus()` is reactive.
* When attached to an input, an `input` listener is attached so that value changes to the input cause reactive updates. IOW, `.value` is reactive.
