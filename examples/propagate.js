import {reactive} from 'https://unpkg.com/grainbox'

const obj = reactive({
  value: 0
})
const nf1 = reactive(() => {
  const value = obj.value
  console.log('nf1', value)
  return value
})
const nf2 = reactive(() => {
  const value = nf1() + 1
  console.log('nf2', value)
  return value
})
const nf3 = reactive(() => {
  const value = nf2() + 1
  console.log('nf3', value)
  return value
})

console.log('setup done')

obj.value = 1

// prints:
// nf1 0
// nf2 1
// nf3 2
// setup done
// nf1 1
// nf2 2
// nf3 3
