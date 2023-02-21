import {reactive} from 'https://unpkg.com/grainbox'

const obj = reactive({
  value: 0
})
const valueAsString = reactive(() => {
  return obj.value.toString()
})
reactive(() => {
  console.log(valueAsString())
})

obj.value = 1

// prints:
// 0
// 1