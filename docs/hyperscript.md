# hyperscript

`grainbox` uses a custom version of hyperscript.

It has added these features:
* Support props `onConnected` and `onDisconnected`, or `onMount` and `onUnmount`.
* Support prop `ref`. Input can be a function or a grainbox ref proxy.
* Support rendering unresolved proxies as empty strings.
* Support props `disabled` and `checked`.
* Support prop `class` as an alias of `className`.
