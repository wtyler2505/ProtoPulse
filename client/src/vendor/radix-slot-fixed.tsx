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
 *
 * Upstream: https://github.com/radix-ui/primitives (issue pending — will remove when fixed).
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/consistent-type-imports */
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

const REACT_LAZY_TYPE = Symbol.for('react.lazy');
// React 19 `use` hook — accessed via dynamic property to avoid older-React crashes.
const reactUse = (React as any)[' use '.trim()];

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in (value as any);
}

function isLazyComponent(element: any): boolean {
  return (
    element != null &&
    typeof element === 'object' &&
    '$$typeof' in element &&
    element.$$typeof === REACT_LAZY_TYPE &&
    '_payload' in element &&
    isPromiseLike((element as any)._payload)
  );
}

function createSlot(
  ownerName: string,
): React.ForwardRefExoticComponent<SlotProps & React.RefAttributes<HTMLElement>> {
  const SlotClone = createSlotClone(ownerName);
  const Slot = React.forwardRef<HTMLElement, SlotProps>((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    if (isLazyComponent(children) && typeof reactUse === 'function') {
      children = reactUse((children as any)._payload);
    }
    const childrenArray = React.Children.toArray(children);
    const slottable = childrenArray.find(isSlottable) as React.ReactElement<{ children?: React.ReactNode }> | undefined;
    if (slottable) {
      const newElement = slottable.props.children;
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (React.Children.count(newElement) > 1) return React.Children.only(null);
          return React.isValidElement(newElement)
            ? (newElement as React.ReactElement<{ children?: React.ReactNode }>).props.children
            : null;
        } else {
          return child;
        }
      });
      return jsx(SlotClone, {
        ...slotProps,
        ref: forwardedRef,
        children: React.isValidElement(newElement)
          ? React.cloneElement(newElement as React.ReactElement, undefined, newChildren)
          : null,
      });
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
    let { children, ...slotProps } = props;
    if (isLazyComponent(children) && typeof reactUse === 'function') {
      children = reactUse((children as any)._payload);
    }
    const isValid = React.isValidElement(children);
    const isNonFragment = isValid && (children as any).type !== React.Fragment;
    const childrenRef = isNonFragment ? getElementRef(children as React.ReactElement) : null;
    // THE FIX: stable composed ref via useCallback-memoized useComposedRefs.
    // Inline `composeRefs(forwardedRef, childrenRef)` creates a new function every render,
    // which triggers React 19 ref-effect cleanup/reattach loops in Radix internals.
    const composedRef = useComposedRefs(forwardedRef, childrenRef as React.Ref<HTMLElement> | null);
    if (isValid) {
      const typedChildren = children as React.ReactElement<Record<string, unknown>>;
      const mergedProps = mergeProps(slotProps, typedChildren.props);
      if (isNonFragment) {
        (mergedProps as any).ref = forwardedRef ? composedRef : childrenRef;
      }
      return React.cloneElement(typedChildren, mergedProps);
    }
    return React.Children.count(children) > 1 ? React.Children.only(null) : null;
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
  const Slottable: SlottableComponent = (({ children }: SlottableProps) =>
    jsx(ReactFragment, { children })) as SlottableComponent;
  Slottable.displayName = `${ownerName}.Slottable`;
  Slottable.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable;
}

const Slottable = createSlottable('Slottable');

function isSlottable(child: unknown): child is React.ReactElement {
  return (
    React.isValidElement(child) &&
    typeof (child as any).type === 'function' &&
    '__radixId' in ((child as any).type ?? {}) &&
    ((child as any).type as { __radixId: symbol }).__radixId === SLOTTABLE_IDENTIFIER
  );
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
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args: unknown[]) => {
          const result = (childPropValue as (...a: unknown[]) => unknown)(...args);
          (slotPropValue as (...a: unknown[]) => unknown)(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === 'style') {
      overrideProps[propName] = { ...(slotPropValue as object), ...(childPropValue as object) };
    } else if (propName === 'className') {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(' ');
    }
  }
  return { ...slotProps, ...overrideProps };
}

function getElementRef(element: React.ReactElement): React.Ref<unknown> | null {
  let getter = Object.getOwnPropertyDescriptor((element as any).props, 'ref')?.get;
  let mayWarn = getter && 'isReactWarning' in getter && (getter as any).isReactWarning;
  if (mayWarn) {
    return (element as any).ref ?? null;
  }
  getter = Object.getOwnPropertyDescriptor(element, 'ref')?.get;
  mayWarn = getter && 'isReactWarning' in getter && (getter as any).isReactWarning;
  if (mayWarn) {
    return ((element as any).props?.ref as React.Ref<unknown> | undefined) ?? null;
  }
  return ((element as any).props?.ref as React.Ref<unknown> | undefined) ?? (element as any).ref ?? null;
}

export { Slot, Slot as Root, Slottable, createSlot, createSlottable };
export type { SlotProps };
