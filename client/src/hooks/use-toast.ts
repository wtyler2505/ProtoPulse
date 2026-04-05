import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST": {
      let changed = false;
      const nextToasts = state.toasts.map((t) => {
        if (t.id !== action.toast.id) {
          return t;
        }
        changed = true;
        return { ...t, ...action.toast };
      });

      return changed
        ? {
            ...state,
            toasts: nextToasts,
          }
        : state;
    }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      let changed = false;
      const nextToasts = state.toasts.map((t) => {
        if (t.id !== toastId && toastId !== undefined) {
          return t;
        }
        if (t.open === false) {
          return t;
        }
        changed = true;
        return {
          ...t,
          open: false,
        };
      });

      return changed
        ? {
            ...state,
            toasts: nextToasts,
          }
        : state
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        if (state.toasts.length === 0) {
          return state;
        }
        return {
          ...state,
          toasts: [],
        }
      }
      if (!state.toasts.some((t) => t.id === action.toastId)) {
        return state;
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  const nextState = reducer(memoryState, action)
  if (nextState === memoryState) {
    return
  }
  memoryState = nextState
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function signatureValue(value: React.ReactNode | undefined): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return null
}

function toastSignature(toastLike: Partial<ToasterToast>): string | null {
  const title = signatureValue(toastLike.title)
  const description = signatureValue(toastLike.description)
  if (title === null && description === null) {
    return null
  }
  return `${toastLike.variant ?? "default"}|${title ?? ""}|${description ?? ""}`
}

function toast({ ...props }: Toast) {
  const nextSignature = toastSignature(props)
  if (nextSignature !== null) {
    const existingToast = memoryState.toasts.find((currentToast) => {
      return currentToast.open !== false && toastSignature(currentToast) === nextSignature
    })

    if (existingToast) {
      const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: existingToast.id })
      const update = (updatedProps: ToasterToast) =>
        dispatch({
          type: "UPDATE_TOAST",
          toast: { ...updatedProps, id: existingToast.id },
        })

      return {
        id: existingToast.id,
        dismiss,
        update,
      }
    }
  }

  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
