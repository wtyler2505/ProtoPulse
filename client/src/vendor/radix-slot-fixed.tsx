/**
 * Patched local copy of @radix-ui/react-slot@1.2.4 to fix a React 19 infinite loop.
 *
 * Why: Radix SlotClone composed refs inline with `composeRefs(forwardedRef, childrenRef)`
 * on every render. In React 19, callback refs have "ref effect" semantics — a new function
 * identity on every render causes React to run cleanup (setting null) and re-attach on
 * every commit. When the underlying ref sets Radix internal state (Popper anchor, Toast
 * viewport, DismissableLayer node), that setState triggers a re-render → new composeRefs
 * callback → cleanup → setState → loop → "Maximum update depth exceeded".
 *
 * Fix: use `useComposedRefs` (memoized via useCallback) so the composed ref keeps a stable
 * identity across renders when the underlying refs don't change.
 *
 * Aliased in vite.config.ts: `'@radix-ui/react-slot'` → this file.
 */
import * as React from 'react';
import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { Fragment as ReactFragment, jsx } from 'react/jsx-runtime';

declare module 'react' {
  interface ReactElement {
    $$typeof?: symbol | string;
  }
}

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

interface LazyElement {
  $$typeof: symbol;
  _payload: PromiseLike<unknown>;
}

interface ReactElementWithRef {
  type: unknown;
  props: Record<string, unknown>;
  ref?: unknown;
}

interface SlottableMarker {
  __radixId: symbol;
}

type ReactWithUse = {
  [key: string]: unknown;
};

const REACT_LAZY_TYPE = Symbol.for('react.lazy');
// React 19 `use` hook — accessed via dynamic property to avoid crashing on older Reacts.
const reactUse = (React as unknown as ReactWithUse)[' use '.trim()] as
  | (<T>(usable: PromiseLike<T>) => T)
  | undefined;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value;
}

function isLazyComponent(element: unknown): element is LazyElement {
  if (element == null || typeof element !== 'object') {
    return false;
  }
  const el = element as Record<string, unknown>;
  return (
    '$$typeof' in el &&
    el.$$typeof === REACT_LAZY_TYPE &&
    '_payload' in el &&
    isPromiseLike(el._payload)
  );
}

function resolveChildren(children: React.ReactNode): React.ReactNode {
  if (isLazyComponent(children) && typeof reactUse === 'function') {
    return reactUse(children._payload) as React.ReactNode;
  }
  return children;
}

function createSlot(
  ownerName: string,
): React.ForwardRefExoticComponent<SlotProps & React.RefAttributes<HTMLElement>> {
  const SlotClone = createSlotClone(ownerName);
  const Slot = React.forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
    const { children: rawChildren, ...slotProps } = props;
    const children = resolveChildren(rawChildren);
    const childrenArray = React.Children.toArray(children);
    const slottable = childrenArray.find(isSlottable);
    if (slottable) {
      const slottableElement = slottable as React.ReactElement<{ children?: React.ReactNode }>;
      const newElement = slottableElement.props.children;
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (React.Children.count(newElement) > 1) {
            return React.Children.only(null);
          }
          if (React.isValidElement(newElement)) {
            const typed = newElement as React.ReactElement<{ children?: React.ReactNode }>;
            return typed.props.children;
          }
          return null;
        }
        return child;
      });
      const clonedChildren = React.isValidElement(newElement)
        ? React.cloneElement(newElement, undefined, newChildren)
        : null;
      return jsx(SlotClone, { ...slotProps, ref: forwardedRef, children: clonedChildren });
    }
    return jsx(SlotClone, { ...slotProps, ref: forwardedRef, children });
  });
  Slot.displayName = `${ownerName}.Slot`;
  return Slot;
}

const Slot = createSlot('Slot');

function createSlotClone(
  ownerName: string,
): React.ForwardRefExoticComponent<SlotProps & React.RefAttributes<HTMLElement>> {
  const SlotClone = React.forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
    const { children: rawChildren, ...slotProps } = props;
    const children = resolveChildren(rawChildren);
    const isValid = React.isValidElement(children);
    const validChildren = isValid
      ? (children as React.ReactElement<Record<string, unknown>>)
      : null;
    const isNonFragment = validChildren !== null && validChildren.type !== React.Fragment;
    const childrenRef = isNonFragment && validChildren ? getElementRef(validChildren) : null;
    // THE FIX: stable composed ref via useCallback-memoized useComposedRefs.
    // Inline `composeRefs(forwardedRef, childrenRef)` creates a new function every render,
    // which triggers React 19 ref-effect cleanup/reattach loops in Radix internals.
    const composedRef = useComposedRefs(forwardedRef, childrenRef);
    if (!validChildren) {
      return React.Children.count(children) > 1 ? React.Children.only(null) : null;
    }
    const mergedProps: Record<string, unknown> = mergeProps(
      slotProps as Record<string, unknown>,
      validChildren.props,
    );
    if (isNonFragment) {
      mergedProps.ref = forwardedRef ? composedRef : childrenRef;
    }
    return React.cloneElement(validChildren, mergedProps);
  });
  SlotClone.displayName = `${ownerName}.SlotClone`;
  return SlotClone;
}

const SLOTTABLE_IDENTIFIER = Symbol('radix.slottable');

interface SlottableProps {
  children: React.ReactNode;
}

interface SlottableComponent extends React.FC<SlottableProps> {
  __radixId: symbol;
}

function createSlottable(ownerName: string): SlottableComponent {
  const SlottableFn = ({ children }: SlottableProps): React.ReactElement =>
    jsx(ReactFragment, { children }) as React.ReactElement;
  const Slottable = SlottableFn as SlottableComponent;
  Slottable.displayName = `${ownerName}.Slottable`;
  Slottable.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable;
}

const Slottable = createSlottable('Slottable');

function isSlottable(child: unknown): child is React.ReactElement {
  if (!React.isValidElement(child)) {
    return false;
  }
  const childType = (child as React.ReactElement<unknown, React.JSXElementConstructor<unknown>>).type;
  if (typeof childType !== 'function') {
    return false;
  }
  const marker = childType as unknown as Partial<SlottableMarker>;
  return marker.__radixId === SLOTTABLE_IDENTIFIER;
}

function mergeProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>,
): Record<string, unknown> {
  const overrideProps: Record<string, unknown> = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (typeof slotPropValue === 'function' && typeof childPropValue === 'function') {
        overrideProps[propName] = (...args: unknown[]): unknown => {
          const childHandler = childPropValue as (...a: unknown[]) => unknown;
          const slotHandler = slotPropValue as (...a: unknown[]) => unknown;
          const result = childHandler(...args);
          slotHandler(...args);
          return result;
        };
      } else if (typeof slotPropValue === 'function') {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === 'style') {
      overrideProps[propName] = {
        ...(slotPropValue as React.CSSProperties | undefined),
        ...(childPropValue as React.CSSProperties | undefined),
      };
    } else if (propName === 'className') {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(' ');
    }
  }
  return { ...slotProps, ...overrideProps };
}

function getElementRef(element: React.ReactElement): React.Ref<unknown> | null {
  const elWithRef = element as unknown as ReactElementWithRef;
  const props = elWithRef.props;
  let getter = Object.getOwnPropertyDescriptor(props, 'ref')?.get;
  let mayWarn =
    getter !== undefined &&
    'isReactWarning' in getter &&
    (getter as { isReactWarning?: boolean }).isReactWarning === true;
  if (mayWarn) {
    return (elWithRef.ref as React.Ref<unknown> | undefined) ?? null;
  }
  getter = Object.getOwnPropertyDescriptor(element, 'ref')?.get;
  mayWarn =
    getter !== undefined &&
    'isReactWarning' in getter &&
    (getter as { isReactWarning?: boolean }).isReactWarning === true;
  if (mayWarn) {
    return (props.ref as React.Ref<unknown> | undefined) ?? null;
  }
  const propsRef = props.ref as React.Ref<unknown> | undefined;
  if (propsRef !== undefined && propsRef !== null) {
    return propsRef;
  }
  return (elWithRef.ref as React.Ref<unknown> | undefined) ?? null;
}

export { Slot, Slot as Root, Slottable, createSlot, createSlottable };
export type { SlotProps };
