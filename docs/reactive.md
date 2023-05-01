# reactive

Features:
* `reactive(() => {}, {debounce: 0})` - The reative function runs `x` ms after the last dependency changed.
* `reactive(() => {}, {timeout: 0})` - Any time a dependency changes, the reactive function is queued via `setTimeout`.
