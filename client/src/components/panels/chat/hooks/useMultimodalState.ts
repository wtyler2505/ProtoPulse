import { useReducer, useCallback } from 'react';

import type { InputType, ProcessingStatus } from '@/lib/multimodal-input';

interface AttachedImage {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

interface MultimodalState {
  multimodalInputType: InputType | null;
  multimodalStatus: ProcessingStatus;
  attachedImage: AttachedImage | null;
}

type MultimodalAction =
  | { type: 'SET_INPUT_TYPE'; payload: InputType | null }
  | { type: 'SET_STATUS'; payload: ProcessingStatus }
  | { type: 'SET_ATTACHED_IMAGE'; payload: AttachedImage | null }
  | { type: 'RESET_MULTIMODAL' };

const initialState: MultimodalState = {
  multimodalInputType: null,
  multimodalStatus: 'idle',
  attachedImage: null,
};

function multimodalReducer(state: MultimodalState, action: MultimodalAction): MultimodalState {
  switch (action.type) {
    case 'SET_INPUT_TYPE':
      return { ...state, multimodalInputType: action.payload };
    case 'SET_STATUS':
      return state.multimodalStatus === action.payload ? state : { ...state, multimodalStatus: action.payload };
    case 'SET_ATTACHED_IMAGE':
      return { ...state, attachedImage: action.payload };
    case 'RESET_MULTIMODAL':
      return { ...initialState };
  }
}

export default function useMultimodalState() {
  const [state, dispatch] = useReducer(multimodalReducer, initialState);

  const setMultimodalInputType = useCallback((value: InputType | null) => dispatch({ type: 'SET_INPUT_TYPE', payload: value }), []);
  const setMultimodalStatus = useCallback((value: ProcessingStatus) => dispatch({ type: 'SET_STATUS', payload: value }), []);
  const setAttachedImage = useCallback((value: AttachedImage | null) => dispatch({ type: 'SET_ATTACHED_IMAGE', payload: value }), []);
  const resetMultimodal = useCallback(() => dispatch({ type: 'RESET_MULTIMODAL' }), []);

  return {
    ...state,
    setMultimodalInputType,
    setMultimodalStatus,
    setAttachedImage,
    resetMultimodal,
  };
}
