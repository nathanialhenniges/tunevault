// ponytail: React 19's @types/react dropped the global `JSX` namespace (it now
// lives under `React.JSX`). Code here annotates return types as `JSX.Element`,
// so re-export the React namespace globally instead of codemodding every file.
// Delete this once all `JSX.*` references are migrated to `React.JSX.*`.
import type * as React from 'react'

declare global {
  namespace JSX {
    type ElementType = React.JSX.ElementType
    type Element = React.JSX.Element
    type ElementClass = React.JSX.ElementClass
    type ElementAttributesProperty = React.JSX.ElementAttributesProperty
    type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>
    type IntrinsicElements = React.JSX.IntrinsicElements
  }
}
