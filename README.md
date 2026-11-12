# fluentui-37136-repro

Reproduction for [microsoft/fluentui#37136](https://github.com/microsoft/fluentui/issues/37136): `ToastOptions.priority` is documented as "Higher priority toasts will be rendered before lower priority toasts", but the queue promotes the lowest value first.

## Run it

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/jakesalvesen/fluentui-37136-repro)

Or locally:

```shell
npm install
npm run dev
```

## What it does

A `Toaster` is mounted with `limit={1}`, so exactly one toast is visible at a time.

1. Dispatch Toast A with the default priority. It becomes visible.
2. Queue Toast B with `priority: 1`.
3. Queue Toast C with `priority: 10`.
4. Dismiss Toast A.
5. Observe which queued toast is promoted.

Both queued toasts are given a long `timeout` so the default auto-dismiss cannot promote a toast behind the sequence.

## Observed

Toast B is promoted, so the lower `priority` value wins. That is the opposite of the documented ordering.

Verified on `@fluentui/react-toast` 9.8.5 with `@fluentui/react-components` 9.74.10, React 19.3.1.

The relevant implementation is `createToaster.ts`, which builds a min heap with `return a.priority - b.priority`. The existing test `should dequeue toasts in priority` asserts the same lower-first order, so the behaviour is intentional in code and contradicted only by the doc comment in `types.ts`.
