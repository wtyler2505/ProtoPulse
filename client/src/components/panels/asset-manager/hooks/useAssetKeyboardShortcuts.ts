import { useEffect } from 'react';

interface UseAssetKeyboardShortcutsParams {
  searchRef: React.RefObject<HTMLInputElement | null>;
  search: string;
  setSearch: (v: string) => void;
  showCustomForm: boolean;
  setShowCustomForm: (v: boolean) => void;
  expandedAsset: string | null;
  setExpandedAsset: (v: string | null) => void;
  focusedIndex: number;
  setFocusedIndex: (v: number | ((prev: number) => number)) => void;
  filteredAssetsLength: number;
  handleAddNode: (type: string, label: string, assetId: string) => void;
  /** Retrieve the filtered asset at a given index for Enter-key activation */
  getFilteredAsset: (index: number) => { type: string; name: string; id: string } | undefined;
  activeCategory: string;
}

export function useAssetKeyboardShortcuts({
  searchRef,
  search,
  setSearch,
  showCustomForm,
  setShowCustomForm,
  expandedAsset,
  setExpandedAsset,
  focusedIndex,
  setFocusedIndex,
  filteredAssetsLength,
  handleAddNode,
  getFilteredAsset,
  activeCategory,
}: UseAssetKeyboardShortcutsParams) {
  // Keyboard shortcuts: /, Escape, ArrowDown, ArrowUp, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        if (showCustomForm) { setShowCustomForm(false); return; }
        if (search) { setSearch(''); return; }
        if (expandedAsset) { setExpandedAsset(null); return; }
      }
      if (e.key === 'ArrowDown' && !isInput) {
        e.preventDefault();
        setFocusedIndex((prev: number) => Math.min(prev + 1, filteredAssetsLength - 1));
      }
      if (e.key === 'ArrowUp' && !isInput) {
        e.preventDefault();
        setFocusedIndex((prev: number) => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && !isInput && focusedIndex >= 0 && focusedIndex < filteredAssetsLength) {
        const asset = getFilteredAsset(focusedIndex);
        if (asset) {
          handleAddNode(asset.type, asset.name, asset.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    searchRef, search, setSearch, showCustomForm, setShowCustomForm,
    expandedAsset, setExpandedAsset, focusedIndex, setFocusedIndex,
    filteredAssetsLength, handleAddNode, getFilteredAsset,
  ]);

  // Reset focused index when search or category changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, activeCategory, setFocusedIndex]);
}
