// @flow

/*
Null proxies allows declarative code on unresolved async proxies to be written.
It is like being able to perform gets and applies on null or undefined.

Null proxies render as empty strings.
Gets and applies on null proxies return another null proxy.
* */
export function nullProxy() {
  const proxy = new Proxy(() => {}, {
    get(parent, prop) {
      if (prop === '__isNullProxy') {
        return true
      }

      return proxy
    },
    apply(target, thisArg, args) {
      return proxy
    }
  })
  return proxy
}
