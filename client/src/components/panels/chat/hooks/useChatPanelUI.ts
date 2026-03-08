import { useReducer, useCallback } from 'react';

interface ChatPanelUIState {
  showSettings: boolean;
  showApiKey: boolean;
  showSetupDialog: boolean;
  showSearch: boolean;
  showDesignAgent: boolean;
  showQuickActions: boolean;
  showScrollBtn: boolean;
  showMultimodalMenu: boolean;
}

type ChatPanelUIAction =
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_API_KEY' }
  | { type: 'TOGGLE_SETUP_DIALOG' }
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'TOGGLE_DESIGN_AGENT' }
  | { type: 'TOGGLE_QUICK_ACTIONS' }
  | { type: 'SET_SCROLL_BTN'; payload: boolean }
  | { type: 'TOGGLE_MULTIMODAL_MENU' }
  | { type: 'SET_SETTINGS'; payload: boolean }
  | { type: 'SET_API_KEY'; payload: boolean }
  | { type: 'SET_SETUP_DIALOG'; payload: boolean }
  | { type: 'SET_SEARCH'; payload: boolean }
  | { type: 'SET_DESIGN_AGENT'; payload: boolean }
  | { type: 'SET_QUICK_ACTIONS'; payload: boolean }
  | { type: 'SET_MULTIMODAL_MENU'; payload: boolean };

const initialState: ChatPanelUIState = {
  showSettings: false,
  showApiKey: false,
  showSetupDialog: false,
  showSearch: false,
  showDesignAgent: false,
  showQuickActions: true,
  showScrollBtn: false,
  showMultimodalMenu: false,
};

function chatPanelUIReducer(state: ChatPanelUIState, action: ChatPanelUIAction): ChatPanelUIState {
  switch (action.type) {
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'TOGGLE_API_KEY':
      return { ...state, showApiKey: !state.showApiKey };
    case 'TOGGLE_SETUP_DIALOG':
      return { ...state, showSetupDialog: !state.showSetupDialog };
    case 'TOGGLE_SEARCH':
      return { ...state, showSearch: !state.showSearch };
    case 'TOGGLE_DESIGN_AGENT':
      return { ...state, showDesignAgent: !state.showDesignAgent };
    case 'TOGGLE_QUICK_ACTIONS':
      return { ...state, showQuickActions: !state.showQuickActions };
    case 'SET_SCROLL_BTN':
      return state.showScrollBtn === action.payload ? state : { ...state, showScrollBtn: action.payload };
    case 'TOGGLE_MULTIMODAL_MENU':
      return { ...state, showMultimodalMenu: !state.showMultimodalMenu };
    case 'SET_SETTINGS':
      return state.showSettings === action.payload ? state : { ...state, showSettings: action.payload };
    case 'SET_API_KEY':
      return state.showApiKey === action.payload ? state : { ...state, showApiKey: action.payload };
    case 'SET_SETUP_DIALOG':
      return state.showSetupDialog === action.payload ? state : { ...state, showSetupDialog: action.payload };
    case 'SET_SEARCH':
      return state.showSearch === action.payload ? state : { ...state, showSearch: action.payload };
    case 'SET_DESIGN_AGENT':
      return state.showDesignAgent === action.payload ? state : { ...state, showDesignAgent: action.payload };
    case 'SET_QUICK_ACTIONS':
      return state.showQuickActions === action.payload ? state : { ...state, showQuickActions: action.payload };
    case 'SET_MULTIMODAL_MENU':
      return state.showMultimodalMenu === action.payload ? state : { ...state, showMultimodalMenu: action.payload };
  }
}

export default function useChatPanelUI() {
  const [state, dispatch] = useReducer(chatPanelUIReducer, initialState);

  const toggleSettings = useCallback(() => dispatch({ type: 'TOGGLE_SETTINGS' }), []);
  const toggleApiKey = useCallback(() => dispatch({ type: 'TOGGLE_API_KEY' }), []);
  const toggleSetupDialog = useCallback(() => dispatch({ type: 'TOGGLE_SETUP_DIALOG' }), []);
  const toggleSearch = useCallback(() => dispatch({ type: 'TOGGLE_SEARCH' }), []);
  const toggleDesignAgent = useCallback(() => dispatch({ type: 'TOGGLE_DESIGN_AGENT' }), []);
  const toggleQuickActions = useCallback(() => dispatch({ type: 'TOGGLE_QUICK_ACTIONS' }), []);
  const toggleMultimodalMenu = useCallback(() => dispatch({ type: 'TOGGLE_MULTIMODAL_MENU' }), []);

  const setShowScrollBtn = useCallback((value: boolean) => dispatch({ type: 'SET_SCROLL_BTN', payload: value }), []);
  const setShowSettings = useCallback((value: boolean) => dispatch({ type: 'SET_SETTINGS', payload: value }), []);
  const setShowApiKey = useCallback((value: boolean) => dispatch({ type: 'SET_API_KEY', payload: value }), []);
  const setShowSetupDialog = useCallback((value: boolean) => dispatch({ type: 'SET_SETUP_DIALOG', payload: value }), []);
  const setShowSearch = useCallback((value: boolean) => dispatch({ type: 'SET_SEARCH', payload: value }), []);
  const setShowDesignAgent = useCallback((value: boolean) => dispatch({ type: 'SET_DESIGN_AGENT', payload: value }), []);
  const setShowQuickActions = useCallback((value: boolean) => dispatch({ type: 'SET_QUICK_ACTIONS', payload: value }), []);
  const setShowMultimodalMenu = useCallback((value: boolean) => dispatch({ type: 'SET_MULTIMODAL_MENU', payload: value }), []);

  return {
    ...state,
    toggleSettings,
    toggleApiKey,
    toggleSetupDialog,
    toggleSearch,
    toggleDesignAgent,
    toggleQuickActions,
    toggleMultimodalMenu,
    setShowScrollBtn,
    setShowSettings,
    setShowApiKey,
    setShowSetupDialog,
    setShowSearch,
    setShowDesignAgent,
    setShowQuickActions,
    setShowMultimodalMenu,
  };
}
