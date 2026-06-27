"use strict";
var __dsPreview = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.ProtoPulse;
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx3(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx3;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx3)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/previews/ResizablePanelGroup.tsx
  var ResizablePanelGroup_exports = {};
  __export(ResizablePanelGroup_exports, {
    CanvasAndConsole: () => CanvasAndConsole,
    EditorLayout: () => EditorLayout
  });
  init_define_import_meta_env();

  // client/src/components/ui/resizable.tsx
  init_define_import_meta_env();

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.ProtoPulse;
  var ds_default = "default" in g ? g.default : g;

  // ../../../node_modules/react-resizable-panels/dist/react-resizable-panels.browser.esm.js
  init_define_import_meta_env();
  var React = __toESM(require_react_shim());
  var import_react = __toESM(require_react_shim());
  var PanelGroupContext = (0, import_react.createContext)(null);
  PanelGroupContext.displayName = "PanelGroupContext";
  var DATA_ATTRIBUTES = {
    group: "data-panel-group",
    groupDirection: "data-panel-group-direction",
    groupId: "data-panel-group-id",
    panel: "data-panel",
    panelCollapsible: "data-panel-collapsible",
    panelId: "data-panel-id",
    panelSize: "data-panel-size",
    resizeHandle: "data-resize-handle",
    resizeHandleActive: "data-resize-handle-active",
    resizeHandleEnabled: "data-panel-resize-handle-enabled",
    resizeHandleId: "data-panel-resize-handle-id",
    resizeHandleState: "data-resize-handle-state"
  };
  var PRECISION = 10;
  var useIsomorphicLayoutEffect = import_react.useLayoutEffect;
  var useId = React["useId".toString()];
  var wrappedUseId = typeof useId === "function" ? useId : () => null;
  var counter = 0;
  function useUniqueId(idFromParams = null) {
    const idFromUseId = wrappedUseId();
    const idRef = (0, import_react.useRef)(idFromParams || idFromUseId || null);
    if (idRef.current === null) {
      idRef.current = "" + counter++;
    }
    return idFromParams !== null && idFromParams !== void 0 ? idFromParams : idRef.current;
  }
  function PanelWithForwardedRef({
    children,
    className: classNameFromProps = "",
    collapsedSize,
    collapsible,
    defaultSize,
    forwardedRef,
    id: idFromProps,
    maxSize,
    minSize,
    onCollapse,
    onExpand,
    onResize,
    order,
    style: styleFromProps,
    tagName: Type = "div",
    ...rest
  }) {
    const context = (0, import_react.useContext)(PanelGroupContext);
    if (context === null) {
      throw Error(`Panel components must be rendered within a PanelGroup container`);
    }
    const {
      collapsePanel,
      expandPanel,
      getPanelSize,
      getPanelStyle,
      groupId,
      isPanelCollapsed,
      reevaluatePanelConstraints,
      registerPanel,
      resizePanel: resizePanel2,
      unregisterPanel
    } = context;
    const panelId = useUniqueId(idFromProps);
    const panelDataRef = (0, import_react.useRef)({
      callbacks: {
        onCollapse,
        onExpand,
        onResize
      },
      constraints: {
        collapsedSize,
        collapsible,
        defaultSize,
        maxSize,
        minSize
      },
      id: panelId,
      idIsFromProps: idFromProps !== void 0,
      order
    });
    (0, import_react.useRef)({
      didLogMissingDefaultSizeWarning: false
    });
    useIsomorphicLayoutEffect(() => {
      const {
        callbacks,
        constraints
      } = panelDataRef.current;
      const prevConstraints = {
        ...constraints
      };
      panelDataRef.current.id = panelId;
      panelDataRef.current.idIsFromProps = idFromProps !== void 0;
      panelDataRef.current.order = order;
      callbacks.onCollapse = onCollapse;
      callbacks.onExpand = onExpand;
      callbacks.onResize = onResize;
      constraints.collapsedSize = collapsedSize;
      constraints.collapsible = collapsible;
      constraints.defaultSize = defaultSize;
      constraints.maxSize = maxSize;
      constraints.minSize = minSize;
      if (prevConstraints.collapsedSize !== constraints.collapsedSize || prevConstraints.collapsible !== constraints.collapsible || prevConstraints.maxSize !== constraints.maxSize || prevConstraints.minSize !== constraints.minSize) {
        reevaluatePanelConstraints(panelDataRef.current, prevConstraints);
      }
    });
    useIsomorphicLayoutEffect(() => {
      const panelData = panelDataRef.current;
      registerPanel(panelData);
      return () => {
        unregisterPanel(panelData);
      };
    }, [order, panelId, registerPanel, unregisterPanel]);
    (0, import_react.useImperativeHandle)(forwardedRef, () => ({
      collapse: () => {
        collapsePanel(panelDataRef.current);
      },
      expand: (minSize2) => {
        expandPanel(panelDataRef.current, minSize2);
      },
      getId() {
        return panelId;
      },
      getSize() {
        return getPanelSize(panelDataRef.current);
      },
      isCollapsed() {
        return isPanelCollapsed(panelDataRef.current);
      },
      isExpanded() {
        return !isPanelCollapsed(panelDataRef.current);
      },
      resize: (size) => {
        resizePanel2(panelDataRef.current, size);
      }
    }), [collapsePanel, expandPanel, getPanelSize, isPanelCollapsed, panelId, resizePanel2]);
    const style = getPanelStyle(panelDataRef.current, defaultSize);
    return (0, import_react.createElement)(Type, {
      ...rest,
      children,
      className: classNameFromProps,
      id: panelId,
      style: {
        ...style,
        ...styleFromProps
      },
      // CSS selectors
      [DATA_ATTRIBUTES.groupId]: groupId,
      [DATA_ATTRIBUTES.panel]: "",
      [DATA_ATTRIBUTES.panelCollapsible]: collapsible || void 0,
      [DATA_ATTRIBUTES.panelId]: panelId,
      [DATA_ATTRIBUTES.panelSize]: parseFloat("" + style.flexGrow).toFixed(1)
    });
  }
  var Panel = (0, import_react.forwardRef)((props2, ref) => (0, import_react.createElement)(PanelWithForwardedRef, {
    ...props2,
    forwardedRef: ref
  }));
  PanelWithForwardedRef.displayName = "Panel";
  Panel.displayName = "forwardRef(Panel)";
  var nonce;
  function getNonce() {
    return nonce;
  }
  var currentCursorStyle = null;
  var enabled = true;
  var prevRuleIndex = -1;
  var styleElement = null;
  function getCursorStyle(state, constraintFlags) {
    if (constraintFlags) {
      const horizontalMin = (constraintFlags & EXCEEDED_HORIZONTAL_MIN) !== 0;
      const horizontalMax = (constraintFlags & EXCEEDED_HORIZONTAL_MAX) !== 0;
      const verticalMin = (constraintFlags & EXCEEDED_VERTICAL_MIN) !== 0;
      const verticalMax = (constraintFlags & EXCEEDED_VERTICAL_MAX) !== 0;
      if (horizontalMin) {
        if (verticalMin) {
          return "se-resize";
        } else if (verticalMax) {
          return "ne-resize";
        } else {
          return "e-resize";
        }
      } else if (horizontalMax) {
        if (verticalMin) {
          return "sw-resize";
        } else if (verticalMax) {
          return "nw-resize";
        } else {
          return "w-resize";
        }
      } else if (verticalMin) {
        return "s-resize";
      } else if (verticalMax) {
        return "n-resize";
      }
    }
    switch (state) {
      case "horizontal":
        return "ew-resize";
      case "intersection":
        return "move";
      case "vertical":
        return "ns-resize";
    }
  }
  function resetGlobalCursorStyle() {
    if (styleElement !== null) {
      document.head.removeChild(styleElement);
      currentCursorStyle = null;
      styleElement = null;
      prevRuleIndex = -1;
    }
  }
  function setGlobalCursorStyle(state, constraintFlags) {
    var _styleElement$sheet$i, _styleElement$sheet2;
    if (!enabled) {
      return;
    }
    const style = getCursorStyle(state, constraintFlags);
    if (currentCursorStyle === style) {
      return;
    }
    currentCursorStyle = style;
    if (styleElement === null) {
      styleElement = document.createElement("style");
      const nonce2 = getNonce();
      if (nonce2) {
        styleElement.setAttribute("nonce", nonce2);
      }
      document.head.appendChild(styleElement);
    }
    if (prevRuleIndex >= 0) {
      var _styleElement$sheet;
      (_styleElement$sheet = styleElement.sheet) === null || _styleElement$sheet === void 0 ? void 0 : _styleElement$sheet.removeRule(prevRuleIndex);
    }
    prevRuleIndex = (_styleElement$sheet$i = (_styleElement$sheet2 = styleElement.sheet) === null || _styleElement$sheet2 === void 0 ? void 0 : _styleElement$sheet2.insertRule(`*{cursor: ${style} !important;}`)) !== null && _styleElement$sheet$i !== void 0 ? _styleElement$sheet$i : -1;
  }
  function isKeyDown(event) {
    return event.type === "keydown";
  }
  function isPointerEvent(event) {
    return event.type.startsWith("pointer");
  }
  function isMouseEvent(event) {
    return event.type.startsWith("mouse");
  }
  function getResizeEventCoordinates(event) {
    if (isPointerEvent(event)) {
      if (event.isPrimary) {
        return {
          x: event.clientX,
          y: event.clientY
        };
      }
    } else if (isMouseEvent(event)) {
      return {
        x: event.clientX,
        y: event.clientY
      };
    }
    return {
      x: Infinity,
      y: Infinity
    };
  }
  function getInputType() {
    if (typeof matchMedia === "function") {
      return matchMedia("(pointer:coarse)").matches ? "coarse" : "fine";
    }
  }
  function intersects(rectOne, rectTwo, strict) {
    if (strict) {
      return rectOne.x < rectTwo.x + rectTwo.width && rectOne.x + rectOne.width > rectTwo.x && rectOne.y < rectTwo.y + rectTwo.height && rectOne.y + rectOne.height > rectTwo.y;
    } else {
      return rectOne.x <= rectTwo.x + rectTwo.width && rectOne.x + rectOne.width >= rectTwo.x && rectOne.y <= rectTwo.y + rectTwo.height && rectOne.y + rectOne.height >= rectTwo.y;
    }
  }
  function compare(a, b) {
    if (a === b) throw new Error("Cannot compare node with itself");
    const ancestors = {
      a: get_ancestors(a),
      b: get_ancestors(b)
    };
    let common_ancestor;
    while (ancestors.a.at(-1) === ancestors.b.at(-1)) {
      a = ancestors.a.pop();
      b = ancestors.b.pop();
      common_ancestor = a;
    }
    assert(common_ancestor, "Stacking order can only be calculated for elements with a common ancestor");
    const z_indexes = {
      a: get_z_index(find_stacking_context(ancestors.a)),
      b: get_z_index(find_stacking_context(ancestors.b))
    };
    if (z_indexes.a === z_indexes.b) {
      const children = common_ancestor.childNodes;
      const furthest_ancestors = {
        a: ancestors.a.at(-1),
        b: ancestors.b.at(-1)
      };
      let i = children.length;
      while (i--) {
        const child = children[i];
        if (child === furthest_ancestors.a) return 1;
        if (child === furthest_ancestors.b) return -1;
      }
    }
    return Math.sign(z_indexes.a - z_indexes.b);
  }
  var props = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
  function is_flex_item(node) {
    var _get_parent;
    const display = getComputedStyle((_get_parent = get_parent(node)) !== null && _get_parent !== void 0 ? _get_parent : node).display;
    return display === "flex" || display === "inline-flex";
  }
  function creates_stacking_context(node) {
    const style = getComputedStyle(node);
    if (style.position === "fixed") return true;
    if (style.zIndex !== "auto" && (style.position !== "static" || is_flex_item(node))) return true;
    if (+style.opacity < 1) return true;
    if ("transform" in style && style.transform !== "none") return true;
    if ("webkitTransform" in style && style.webkitTransform !== "none") return true;
    if ("mixBlendMode" in style && style.mixBlendMode !== "normal") return true;
    if ("filter" in style && style.filter !== "none") return true;
    if ("webkitFilter" in style && style.webkitFilter !== "none") return true;
    if ("isolation" in style && style.isolation === "isolate") return true;
    if (props.test(style.willChange)) return true;
    if (style.webkitOverflowScrolling === "touch") return true;
    return false;
  }
  function find_stacking_context(nodes) {
    let i = nodes.length;
    while (i--) {
      const node = nodes[i];
      assert(node, "Missing node");
      if (creates_stacking_context(node)) return node;
    }
    return null;
  }
  function get_z_index(node) {
    return node && Number(getComputedStyle(node).zIndex) || 0;
  }
  function get_ancestors(node) {
    const ancestors = [];
    while (node) {
      ancestors.push(node);
      node = get_parent(node);
    }
    return ancestors;
  }
  function get_parent(node) {
    const {
      parentNode
    } = node;
    if (parentNode && parentNode instanceof ShadowRoot) {
      return parentNode.host;
    }
    return parentNode;
  }
  var EXCEEDED_HORIZONTAL_MIN = 1;
  var EXCEEDED_HORIZONTAL_MAX = 2;
  var EXCEEDED_VERTICAL_MIN = 4;
  var EXCEEDED_VERTICAL_MAX = 8;
  var isCoarsePointer = getInputType() === "coarse";
  var intersectingHandles = [];
  var isPointerDown = false;
  var ownerDocumentCounts = /* @__PURE__ */ new Map();
  var panelConstraintFlags = /* @__PURE__ */ new Map();
  var registeredResizeHandlers = /* @__PURE__ */ new Set();
  function registerResizeHandle(resizeHandleId, element, direction, hitAreaMargins, setResizeHandlerState) {
    var _ownerDocumentCounts$;
    const {
      ownerDocument
    } = element;
    const data = {
      direction,
      element,
      hitAreaMargins,
      setResizeHandlerState
    };
    const count = (_ownerDocumentCounts$ = ownerDocumentCounts.get(ownerDocument)) !== null && _ownerDocumentCounts$ !== void 0 ? _ownerDocumentCounts$ : 0;
    ownerDocumentCounts.set(ownerDocument, count + 1);
    registeredResizeHandlers.add(data);
    updateListeners();
    return function unregisterResizeHandle() {
      var _ownerDocumentCounts$2;
      panelConstraintFlags.delete(resizeHandleId);
      registeredResizeHandlers.delete(data);
      const count2 = (_ownerDocumentCounts$2 = ownerDocumentCounts.get(ownerDocument)) !== null && _ownerDocumentCounts$2 !== void 0 ? _ownerDocumentCounts$2 : 1;
      ownerDocumentCounts.set(ownerDocument, count2 - 1);
      updateListeners();
      if (count2 === 1) {
        ownerDocumentCounts.delete(ownerDocument);
      }
      if (intersectingHandles.includes(data)) {
        const index = intersectingHandles.indexOf(data);
        if (index >= 0) {
          intersectingHandles.splice(index, 1);
        }
        updateCursor();
        setResizeHandlerState("up", true, null);
      }
    };
  }
  function handlePointerDown(event) {
    const {
      target
    } = event;
    const {
      x,
      y
    } = getResizeEventCoordinates(event);
    isPointerDown = true;
    recalculateIntersectingHandles({
      target,
      x,
      y
    });
    updateListeners();
    if (intersectingHandles.length > 0) {
      updateResizeHandlerStates("down", event);
      event.preventDefault();
      if (!isWithinResizeHandle(target)) {
        event.stopImmediatePropagation();
      }
    }
  }
  function handlePointerMove(event) {
    const {
      x,
      y
    } = getResizeEventCoordinates(event);
    if (isPointerDown && event.buttons === 0) {
      isPointerDown = false;
      updateResizeHandlerStates("up", event);
    }
    if (!isPointerDown) {
      const {
        target
      } = event;
      recalculateIntersectingHandles({
        target,
        x,
        y
      });
    }
    updateResizeHandlerStates("move", event);
    updateCursor();
    if (intersectingHandles.length > 0) {
      event.preventDefault();
    }
  }
  function handlePointerUp(event) {
    const {
      target
    } = event;
    const {
      x,
      y
    } = getResizeEventCoordinates(event);
    panelConstraintFlags.clear();
    isPointerDown = false;
    if (intersectingHandles.length > 0) {
      event.preventDefault();
      if (!isWithinResizeHandle(target)) {
        event.stopImmediatePropagation();
      }
    }
    updateResizeHandlerStates("up", event);
    recalculateIntersectingHandles({
      target,
      x,
      y
    });
    updateCursor();
    updateListeners();
  }
  function isWithinResizeHandle(element) {
    let currentElement = element;
    while (currentElement) {
      if (currentElement.hasAttribute(DATA_ATTRIBUTES.resizeHandle)) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }
    return false;
  }
  function recalculateIntersectingHandles({
    target,
    x,
    y
  }) {
    intersectingHandles.splice(0);
    let targetElement = null;
    if (target instanceof HTMLElement || target instanceof SVGElement) {
      targetElement = target;
    }
    registeredResizeHandlers.forEach((data) => {
      const {
        element: dragHandleElement,
        hitAreaMargins
      } = data;
      const dragHandleRect = dragHandleElement.getBoundingClientRect();
      const {
        bottom,
        left,
        right,
        top
      } = dragHandleRect;
      const margin = isCoarsePointer ? hitAreaMargins.coarse : hitAreaMargins.fine;
      const eventIntersects = x >= left - margin && x <= right + margin && y >= top - margin && y <= bottom + margin;
      if (eventIntersects) {
        if (targetElement !== null && document.contains(targetElement) && dragHandleElement !== targetElement && !dragHandleElement.contains(targetElement) && !targetElement.contains(dragHandleElement) && // Calculating stacking order has a cost, so we should avoid it if possible
        // That is why we only check potentially intersecting handles,
        // and why we skip if the event target is within the handle's DOM
        compare(targetElement, dragHandleElement) > 0) {
          let currentElement = targetElement;
          let didIntersect = false;
          while (currentElement) {
            if (currentElement.contains(dragHandleElement)) {
              break;
            } else if (intersects(currentElement.getBoundingClientRect(), dragHandleRect, true)) {
              didIntersect = true;
              break;
            }
            currentElement = currentElement.parentElement;
          }
          if (didIntersect) {
            return;
          }
        }
        intersectingHandles.push(data);
      }
    });
  }
  function reportConstraintsViolation(resizeHandleId, flag) {
    panelConstraintFlags.set(resizeHandleId, flag);
  }
  function updateCursor() {
    let intersectsHorizontal = false;
    let intersectsVertical = false;
    intersectingHandles.forEach((data) => {
      const {
        direction
      } = data;
      if (direction === "horizontal") {
        intersectsHorizontal = true;
      } else {
        intersectsVertical = true;
      }
    });
    let constraintFlags = 0;
    panelConstraintFlags.forEach((flag) => {
      constraintFlags |= flag;
    });
    if (intersectsHorizontal && intersectsVertical) {
      setGlobalCursorStyle("intersection", constraintFlags);
    } else if (intersectsHorizontal) {
      setGlobalCursorStyle("horizontal", constraintFlags);
    } else if (intersectsVertical) {
      setGlobalCursorStyle("vertical", constraintFlags);
    } else {
      resetGlobalCursorStyle();
    }
  }
  var listenersAbortController = new AbortController();
  function updateListeners() {
    listenersAbortController.abort();
    listenersAbortController = new AbortController();
    const options = {
      capture: true,
      signal: listenersAbortController.signal
    };
    if (!registeredResizeHandlers.size) {
      return;
    }
    if (isPointerDown) {
      if (intersectingHandles.length > 0) {
        ownerDocumentCounts.forEach((count, ownerDocument) => {
          const {
            body
          } = ownerDocument;
          if (count > 0) {
            body.addEventListener("contextmenu", handlePointerUp, options);
            body.addEventListener("pointerleave", handlePointerMove, options);
            body.addEventListener("pointermove", handlePointerMove, options);
          }
        });
      }
      window.addEventListener("pointerup", handlePointerUp, options);
      window.addEventListener("pointercancel", handlePointerUp, options);
    } else {
      ownerDocumentCounts.forEach((count, ownerDocument) => {
        const {
          body
        } = ownerDocument;
        if (count > 0) {
          body.addEventListener("pointerdown", handlePointerDown, options);
          body.addEventListener("pointermove", handlePointerMove, options);
        }
      });
    }
  }
  function updateResizeHandlerStates(action, event) {
    registeredResizeHandlers.forEach((data) => {
      const {
        setResizeHandlerState
      } = data;
      const isActive = intersectingHandles.includes(data);
      setResizeHandlerState(action, isActive, event);
    });
  }
  function useForceUpdate() {
    const [_, setCount] = (0, import_react.useState)(0);
    return (0, import_react.useCallback)(() => setCount((prevCount) => prevCount + 1), []);
  }
  function assert(expectedCondition, message) {
    if (!expectedCondition) {
      console.error(message);
      throw Error(message);
    }
  }
  function fuzzyCompareNumbers(actual, expected, fractionDigits = PRECISION) {
    if (actual.toFixed(fractionDigits) === expected.toFixed(fractionDigits)) {
      return 0;
    } else {
      return actual > expected ? 1 : -1;
    }
  }
  function fuzzyNumbersEqual$1(actual, expected, fractionDigits = PRECISION) {
    return fuzzyCompareNumbers(actual, expected, fractionDigits) === 0;
  }
  function fuzzyNumbersEqual(actual, expected, fractionDigits) {
    return fuzzyCompareNumbers(actual, expected, fractionDigits) === 0;
  }
  function fuzzyLayoutsEqual(actual, expected, fractionDigits) {
    if (actual.length !== expected.length) {
      return false;
    }
    for (let index = 0; index < actual.length; index++) {
      const actualSize = actual[index];
      const expectedSize = expected[index];
      if (!fuzzyNumbersEqual(actualSize, expectedSize, fractionDigits)) {
        return false;
      }
    }
    return true;
  }
  function resizePanel({
    panelConstraints: panelConstraintsArray,
    panelIndex,
    size
  }) {
    const panelConstraints = panelConstraintsArray[panelIndex];
    assert(panelConstraints != null, `Panel constraints not found for index ${panelIndex}`);
    let {
      collapsedSize = 0,
      collapsible,
      maxSize = 100,
      minSize = 0
    } = panelConstraints;
    if (fuzzyCompareNumbers(size, minSize) < 0) {
      if (collapsible) {
        const halfwayPoint = (collapsedSize + minSize) / 2;
        if (fuzzyCompareNumbers(size, halfwayPoint) < 0) {
          size = collapsedSize;
        } else {
          size = minSize;
        }
      } else {
        size = minSize;
      }
    }
    size = Math.min(maxSize, size);
    size = parseFloat(size.toFixed(PRECISION));
    return size;
  }
  function adjustLayoutByDelta({
    delta,
    initialLayout,
    panelConstraints: panelConstraintsArray,
    pivotIndices,
    prevLayout,
    trigger
  }) {
    if (fuzzyNumbersEqual(delta, 0)) {
      return initialLayout;
    }
    const nextLayout = [...initialLayout];
    const [firstPivotIndex, secondPivotIndex] = pivotIndices;
    assert(firstPivotIndex != null, "Invalid first pivot index");
    assert(secondPivotIndex != null, "Invalid second pivot index");
    let deltaApplied = 0;
    {
      if (trigger === "keyboard") {
        {
          const index = delta < 0 ? secondPivotIndex : firstPivotIndex;
          const panelConstraints = panelConstraintsArray[index];
          assert(panelConstraints, `Panel constraints not found for index ${index}`);
          const {
            collapsedSize = 0,
            collapsible,
            minSize = 0
          } = panelConstraints;
          if (collapsible) {
            const prevSize = initialLayout[index];
            assert(prevSize != null, `Previous layout not found for panel index ${index}`);
            if (fuzzyNumbersEqual(prevSize, collapsedSize)) {
              const localDelta = minSize - prevSize;
              if (fuzzyCompareNumbers(localDelta, Math.abs(delta)) > 0) {
                delta = delta < 0 ? 0 - localDelta : localDelta;
              }
            }
          }
        }
        {
          const index = delta < 0 ? firstPivotIndex : secondPivotIndex;
          const panelConstraints = panelConstraintsArray[index];
          assert(panelConstraints, `No panel constraints found for index ${index}`);
          const {
            collapsedSize = 0,
            collapsible,
            minSize = 0
          } = panelConstraints;
          if (collapsible) {
            const prevSize = initialLayout[index];
            assert(prevSize != null, `Previous layout not found for panel index ${index}`);
            if (fuzzyNumbersEqual(prevSize, minSize)) {
              const localDelta = prevSize - collapsedSize;
              if (fuzzyCompareNumbers(localDelta, Math.abs(delta)) > 0) {
                delta = delta < 0 ? 0 - localDelta : localDelta;
              }
            }
          }
        }
      }
    }
    {
      const increment = delta < 0 ? 1 : -1;
      let index = delta < 0 ? secondPivotIndex : firstPivotIndex;
      let maxAvailableDelta = 0;
      while (true) {
        const prevSize = initialLayout[index];
        assert(prevSize != null, `Previous layout not found for panel index ${index}`);
        const maxSafeSize = resizePanel({
          panelConstraints: panelConstraintsArray,
          panelIndex: index,
          size: 100
        });
        const delta2 = maxSafeSize - prevSize;
        maxAvailableDelta += delta2;
        index += increment;
        if (index < 0 || index >= panelConstraintsArray.length) {
          break;
        }
      }
      const minAbsDelta = Math.min(Math.abs(delta), Math.abs(maxAvailableDelta));
      delta = delta < 0 ? 0 - minAbsDelta : minAbsDelta;
    }
    {
      const pivotIndex = delta < 0 ? firstPivotIndex : secondPivotIndex;
      let index = pivotIndex;
      while (index >= 0 && index < panelConstraintsArray.length) {
        const deltaRemaining = Math.abs(delta) - Math.abs(deltaApplied);
        const prevSize = initialLayout[index];
        assert(prevSize != null, `Previous layout not found for panel index ${index}`);
        const unsafeSize = prevSize - deltaRemaining;
        const safeSize = resizePanel({
          panelConstraints: panelConstraintsArray,
          panelIndex: index,
          size: unsafeSize
        });
        if (!fuzzyNumbersEqual(prevSize, safeSize)) {
          deltaApplied += prevSize - safeSize;
          nextLayout[index] = safeSize;
          if (deltaApplied.toPrecision(3).localeCompare(Math.abs(delta).toPrecision(3), void 0, {
            numeric: true
          }) >= 0) {
            break;
          }
        }
        if (delta < 0) {
          index--;
        } else {
          index++;
        }
      }
    }
    if (fuzzyLayoutsEqual(prevLayout, nextLayout)) {
      return prevLayout;
    }
    {
      const pivotIndex = delta < 0 ? secondPivotIndex : firstPivotIndex;
      const prevSize = initialLayout[pivotIndex];
      assert(prevSize != null, `Previous layout not found for panel index ${pivotIndex}`);
      const unsafeSize = prevSize + deltaApplied;
      const safeSize = resizePanel({
        panelConstraints: panelConstraintsArray,
        panelIndex: pivotIndex,
        size: unsafeSize
      });
      nextLayout[pivotIndex] = safeSize;
      if (!fuzzyNumbersEqual(safeSize, unsafeSize)) {
        let deltaRemaining = unsafeSize - safeSize;
        const pivotIndex2 = delta < 0 ? secondPivotIndex : firstPivotIndex;
        let index = pivotIndex2;
        while (index >= 0 && index < panelConstraintsArray.length) {
          const prevSize2 = nextLayout[index];
          assert(prevSize2 != null, `Previous layout not found for panel index ${index}`);
          const unsafeSize2 = prevSize2 + deltaRemaining;
          const safeSize2 = resizePanel({
            panelConstraints: panelConstraintsArray,
            panelIndex: index,
            size: unsafeSize2
          });
          if (!fuzzyNumbersEqual(prevSize2, safeSize2)) {
            deltaRemaining -= safeSize2 - prevSize2;
            nextLayout[index] = safeSize2;
          }
          if (fuzzyNumbersEqual(deltaRemaining, 0)) {
            break;
          }
          if (delta > 0) {
            index--;
          } else {
            index++;
          }
        }
      }
    }
    const totalSize = nextLayout.reduce((total, size) => size + total, 0);
    if (!fuzzyNumbersEqual(totalSize, 100)) {
      return prevLayout;
    }
    return nextLayout;
  }
  function calculateAriaValues({
    layout,
    panelsArray,
    pivotIndices
  }) {
    let currentMinSize = 0;
    let currentMaxSize = 100;
    let totalMinSize = 0;
    let totalMaxSize = 0;
    const firstIndex = pivotIndices[0];
    assert(firstIndex != null, "No pivot index found");
    panelsArray.forEach((panelData, index) => {
      const {
        constraints
      } = panelData;
      const {
        maxSize = 100,
        minSize = 0
      } = constraints;
      if (index === firstIndex) {
        currentMinSize = minSize;
        currentMaxSize = maxSize;
      } else {
        totalMinSize += minSize;
        totalMaxSize += maxSize;
      }
    });
    const valueMax = Math.min(currentMaxSize, 100 - totalMinSize);
    const valueMin = Math.max(currentMinSize, 100 - totalMaxSize);
    const valueNow = layout[firstIndex];
    return {
      valueMax,
      valueMin,
      valueNow
    };
  }
  function getResizeHandleElementsForGroup(groupId, scope = document) {
    return Array.from(scope.querySelectorAll(`[${DATA_ATTRIBUTES.resizeHandleId}][data-panel-group-id="${groupId}"]`));
  }
  function getResizeHandleElementIndex(groupId, id, scope = document) {
    const handles = getResizeHandleElementsForGroup(groupId, scope);
    const index = handles.findIndex((handle) => handle.getAttribute(DATA_ATTRIBUTES.resizeHandleId) === id);
    return index !== null && index !== void 0 ? index : null;
  }
  function determinePivotIndices(groupId, dragHandleId, panelGroupElement) {
    const index = getResizeHandleElementIndex(groupId, dragHandleId, panelGroupElement);
    return index != null ? [index, index + 1] : [-1, -1];
  }
  function getPanelGroupElement(id, rootElement = document) {
    var _dataset;
    if (rootElement instanceof HTMLElement && (rootElement === null || rootElement === void 0 ? void 0 : (_dataset = rootElement.dataset) === null || _dataset === void 0 ? void 0 : _dataset.panelGroupId) == id) {
      return rootElement;
    }
    const element = rootElement.querySelector(`[data-panel-group][data-panel-group-id="${id}"]`);
    if (element) {
      return element;
    }
    return null;
  }
  function getResizeHandleElement(id, scope = document) {
    const element = scope.querySelector(`[${DATA_ATTRIBUTES.resizeHandleId}="${id}"]`);
    if (element) {
      return element;
    }
    return null;
  }
  function getResizeHandlePanelIds(groupId, handleId, panelsArray, scope = document) {
    var _panelsArray$index$id, _panelsArray$index, _panelsArray$id, _panelsArray;
    const handle = getResizeHandleElement(handleId, scope);
    const handles = getResizeHandleElementsForGroup(groupId, scope);
    const index = handle ? handles.indexOf(handle) : -1;
    const idBefore = (_panelsArray$index$id = (_panelsArray$index = panelsArray[index]) === null || _panelsArray$index === void 0 ? void 0 : _panelsArray$index.id) !== null && _panelsArray$index$id !== void 0 ? _panelsArray$index$id : null;
    const idAfter = (_panelsArray$id = (_panelsArray = panelsArray[index + 1]) === null || _panelsArray === void 0 ? void 0 : _panelsArray.id) !== null && _panelsArray$id !== void 0 ? _panelsArray$id : null;
    return [idBefore, idAfter];
  }
  function useWindowSplitterPanelGroupBehavior({
    committedValuesRef,
    eagerValuesRef,
    groupId,
    layout,
    panelDataArray,
    panelGroupElement,
    setLayout
  }) {
    (0, import_react.useRef)({
      didWarnAboutMissingResizeHandle: false
    });
    useIsomorphicLayoutEffect(() => {
      if (!panelGroupElement) {
        return;
      }
      const resizeHandleElements = getResizeHandleElementsForGroup(groupId, panelGroupElement);
      for (let index = 0; index < panelDataArray.length - 1; index++) {
        const {
          valueMax,
          valueMin,
          valueNow
        } = calculateAriaValues({
          layout,
          panelsArray: panelDataArray,
          pivotIndices: [index, index + 1]
        });
        const resizeHandleElement = resizeHandleElements[index];
        if (resizeHandleElement == null) ;
        else {
          const panelData = panelDataArray[index];
          assert(panelData, `No panel data found for index "${index}"`);
          resizeHandleElement.setAttribute("aria-controls", panelData.id);
          resizeHandleElement.setAttribute("aria-valuemax", "" + Math.round(valueMax));
          resizeHandleElement.setAttribute("aria-valuemin", "" + Math.round(valueMin));
          resizeHandleElement.setAttribute("aria-valuenow", valueNow != null ? "" + Math.round(valueNow) : "");
        }
      }
      return () => {
        resizeHandleElements.forEach((resizeHandleElement, index) => {
          resizeHandleElement.removeAttribute("aria-controls");
          resizeHandleElement.removeAttribute("aria-valuemax");
          resizeHandleElement.removeAttribute("aria-valuemin");
          resizeHandleElement.removeAttribute("aria-valuenow");
        });
      };
    }, [groupId, layout, panelDataArray, panelGroupElement]);
    (0, import_react.useEffect)(() => {
      if (!panelGroupElement) {
        return;
      }
      const eagerValues = eagerValuesRef.current;
      assert(eagerValues, `Eager values not found`);
      const {
        panelDataArray: panelDataArray2
      } = eagerValues;
      const groupElement = getPanelGroupElement(groupId, panelGroupElement);
      assert(groupElement != null, `No group found for id "${groupId}"`);
      const handles = getResizeHandleElementsForGroup(groupId, panelGroupElement);
      assert(handles, `No resize handles found for group id "${groupId}"`);
      const cleanupFunctions = handles.map((handle) => {
        const handleId = handle.getAttribute(DATA_ATTRIBUTES.resizeHandleId);
        assert(handleId, `Resize handle element has no handle id attribute`);
        const [idBefore, idAfter] = getResizeHandlePanelIds(groupId, handleId, panelDataArray2, panelGroupElement);
        if (idBefore == null || idAfter == null) {
          return () => {
          };
        }
        const onKeyDown = (event) => {
          if (event.defaultPrevented) {
            return;
          }
          switch (event.key) {
            case "Enter": {
              event.preventDefault();
              const index = panelDataArray2.findIndex((panelData) => panelData.id === idBefore);
              if (index >= 0) {
                const panelData = panelDataArray2[index];
                assert(panelData, `No panel data found for index ${index}`);
                const size = layout[index];
                const {
                  collapsedSize = 0,
                  collapsible,
                  minSize = 0
                } = panelData.constraints;
                if (size != null && collapsible) {
                  const nextLayout = adjustLayoutByDelta({
                    delta: fuzzyNumbersEqual(size, collapsedSize) ? minSize - collapsedSize : collapsedSize - size,
                    initialLayout: layout,
                    panelConstraints: panelDataArray2.map((panelData2) => panelData2.constraints),
                    pivotIndices: determinePivotIndices(groupId, handleId, panelGroupElement),
                    prevLayout: layout,
                    trigger: "keyboard"
                  });
                  if (layout !== nextLayout) {
                    setLayout(nextLayout);
                  }
                }
              }
              break;
            }
          }
        };
        handle.addEventListener("keydown", onKeyDown);
        return () => {
          handle.removeEventListener("keydown", onKeyDown);
        };
      });
      return () => {
        cleanupFunctions.forEach((cleanupFunction) => cleanupFunction());
      };
    }, [panelGroupElement, committedValuesRef, eagerValuesRef, groupId, layout, panelDataArray, setLayout]);
  }
  function areEqual(arrayA, arrayB) {
    if (arrayA.length !== arrayB.length) {
      return false;
    }
    for (let index = 0; index < arrayA.length; index++) {
      if (arrayA[index] !== arrayB[index]) {
        return false;
      }
    }
    return true;
  }
  function getResizeEventCursorPosition(direction, event) {
    const isHorizontal = direction === "horizontal";
    const {
      x,
      y
    } = getResizeEventCoordinates(event);
    return isHorizontal ? x : y;
  }
  function calculateDragOffsetPercentage(event, dragHandleId, direction, initialDragState, panelGroupElement) {
    const isHorizontal = direction === "horizontal";
    const handleElement = getResizeHandleElement(dragHandleId, panelGroupElement);
    assert(handleElement, `No resize handle element found for id "${dragHandleId}"`);
    const groupId = handleElement.getAttribute(DATA_ATTRIBUTES.groupId);
    assert(groupId, `Resize handle element has no group id attribute`);
    let {
      initialCursorPosition
    } = initialDragState;
    const cursorPosition = getResizeEventCursorPosition(direction, event);
    const groupElement = getPanelGroupElement(groupId, panelGroupElement);
    assert(groupElement, `No group element found for id "${groupId}"`);
    const groupRect = groupElement.getBoundingClientRect();
    const groupSizeInPixels = isHorizontal ? groupRect.width : groupRect.height;
    const offsetPixels = cursorPosition - initialCursorPosition;
    const offsetPercentage = offsetPixels / groupSizeInPixels * 100;
    return offsetPercentage;
  }
  function calculateDeltaPercentage(event, dragHandleId, direction, initialDragState, keyboardResizeBy, panelGroupElement) {
    if (isKeyDown(event)) {
      const isHorizontal = direction === "horizontal";
      let delta = 0;
      if (event.shiftKey) {
        delta = 100;
      } else if (keyboardResizeBy != null) {
        delta = keyboardResizeBy;
      } else {
        delta = 10;
      }
      let movement = 0;
      switch (event.key) {
        case "ArrowDown":
          movement = isHorizontal ? 0 : delta;
          break;
        case "ArrowLeft":
          movement = isHorizontal ? -delta : 0;
          break;
        case "ArrowRight":
          movement = isHorizontal ? delta : 0;
          break;
        case "ArrowUp":
          movement = isHorizontal ? 0 : -delta;
          break;
        case "End":
          movement = 100;
          break;
        case "Home":
          movement = -100;
          break;
      }
      return movement;
    } else {
      if (initialDragState == null) {
        return 0;
      }
      return calculateDragOffsetPercentage(event, dragHandleId, direction, initialDragState, panelGroupElement);
    }
  }
  function calculateUnsafeDefaultLayout({
    panelDataArray
  }) {
    const layout = Array(panelDataArray.length);
    const panelConstraintsArray = panelDataArray.map((panelData) => panelData.constraints);
    let numPanelsWithSizes = 0;
    let remainingSize = 100;
    for (let index = 0; index < panelDataArray.length; index++) {
      const panelConstraints = panelConstraintsArray[index];
      assert(panelConstraints, `Panel constraints not found for index ${index}`);
      const {
        defaultSize
      } = panelConstraints;
      if (defaultSize != null) {
        numPanelsWithSizes++;
        layout[index] = defaultSize;
        remainingSize -= defaultSize;
      }
    }
    for (let index = 0; index < panelDataArray.length; index++) {
      const panelConstraints = panelConstraintsArray[index];
      assert(panelConstraints, `Panel constraints not found for index ${index}`);
      const {
        defaultSize
      } = panelConstraints;
      if (defaultSize != null) {
        continue;
      }
      const numRemainingPanels = panelDataArray.length - numPanelsWithSizes;
      const size = remainingSize / numRemainingPanels;
      numPanelsWithSizes++;
      layout[index] = size;
      remainingSize -= size;
    }
    return layout;
  }
  function callPanelCallbacks(panelsArray, layout, panelIdToLastNotifiedSizeMap) {
    layout.forEach((size, index) => {
      const panelData = panelsArray[index];
      assert(panelData, `Panel data not found for index ${index}`);
      const {
        callbacks,
        constraints,
        id: panelId
      } = panelData;
      const {
        collapsedSize = 0,
        collapsible
      } = constraints;
      const lastNotifiedSize = panelIdToLastNotifiedSizeMap[panelId];
      if (lastNotifiedSize == null || size !== lastNotifiedSize) {
        panelIdToLastNotifiedSizeMap[panelId] = size;
        const {
          onCollapse,
          onExpand,
          onResize
        } = callbacks;
        if (onResize) {
          onResize(size, lastNotifiedSize);
        }
        if (collapsible && (onCollapse || onExpand)) {
          if (onExpand && (lastNotifiedSize == null || fuzzyNumbersEqual$1(lastNotifiedSize, collapsedSize)) && !fuzzyNumbersEqual$1(size, collapsedSize)) {
            onExpand();
          }
          if (onCollapse && (lastNotifiedSize == null || !fuzzyNumbersEqual$1(lastNotifiedSize, collapsedSize)) && fuzzyNumbersEqual$1(size, collapsedSize)) {
            onCollapse();
          }
        }
      }
    });
  }
  function compareLayouts(a, b) {
    if (a.length !== b.length) {
      return false;
    } else {
      for (let index = 0; index < a.length; index++) {
        if (a[index] != b[index]) {
          return false;
        }
      }
    }
    return true;
  }
  function computePanelFlexBoxStyle({
    defaultSize,
    dragState,
    layout,
    panelData,
    panelIndex,
    precision = 3
  }) {
    const size = layout[panelIndex];
    let flexGrow;
    if (size == null) {
      flexGrow = defaultSize != void 0 ? defaultSize.toPrecision(precision) : "1";
    } else if (panelData.length === 1) {
      flexGrow = "1";
    } else {
      flexGrow = size.toPrecision(precision);
    }
    return {
      flexBasis: 0,
      flexGrow,
      flexShrink: 1,
      // Without this, Panel sizes may be unintentionally overridden by their content
      overflow: "hidden",
      // Disable pointer events inside of a panel during resize
      // This avoid edge cases like nested iframes
      pointerEvents: dragState !== null ? "none" : void 0
    };
  }
  function debounce(callback, durationMs = 10) {
    let timeoutId = null;
    let callable = (...args) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        callback(...args);
      }, durationMs);
    };
    return callable;
  }
  function initializeDefaultStorage(storageObject) {
    try {
      if (typeof localStorage !== "undefined") {
        storageObject.getItem = (name) => {
          return localStorage.getItem(name);
        };
        storageObject.setItem = (name, value) => {
          localStorage.setItem(name, value);
        };
      } else {
        throw new Error("localStorage not supported in this environment");
      }
    } catch (error) {
      console.error(error);
      storageObject.getItem = () => null;
      storageObject.setItem = () => {
      };
    }
  }
  function getPanelGroupKey(autoSaveId) {
    return `react-resizable-panels:${autoSaveId}`;
  }
  function getPanelKey(panels) {
    return panels.map((panel) => {
      const {
        constraints,
        id,
        idIsFromProps,
        order
      } = panel;
      if (idIsFromProps) {
        return id;
      } else {
        return order ? `${order}:${JSON.stringify(constraints)}` : JSON.stringify(constraints);
      }
    }).sort((a, b) => a.localeCompare(b)).join(",");
  }
  function loadSerializedPanelGroupState(autoSaveId, storage) {
    try {
      const panelGroupKey = getPanelGroupKey(autoSaveId);
      const serialized = storage.getItem(panelGroupKey);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        if (typeof parsed === "object" && parsed != null) {
          return parsed;
        }
      }
    } catch (error) {
    }
    return null;
  }
  function loadPanelGroupState(autoSaveId, panels, storage) {
    var _loadSerializedPanelG, _state$panelKey;
    const state = (_loadSerializedPanelG = loadSerializedPanelGroupState(autoSaveId, storage)) !== null && _loadSerializedPanelG !== void 0 ? _loadSerializedPanelG : {};
    const panelKey = getPanelKey(panels);
    return (_state$panelKey = state[panelKey]) !== null && _state$panelKey !== void 0 ? _state$panelKey : null;
  }
  function savePanelGroupState(autoSaveId, panels, panelSizesBeforeCollapse, sizes, storage) {
    var _loadSerializedPanelG2;
    const panelGroupKey = getPanelGroupKey(autoSaveId);
    const panelKey = getPanelKey(panels);
    const state = (_loadSerializedPanelG2 = loadSerializedPanelGroupState(autoSaveId, storage)) !== null && _loadSerializedPanelG2 !== void 0 ? _loadSerializedPanelG2 : {};
    state[panelKey] = {
      expandToSizes: Object.fromEntries(panelSizesBeforeCollapse.entries()),
      layout: sizes
    };
    try {
      storage.setItem(panelGroupKey, JSON.stringify(state));
    } catch (error) {
      console.error(error);
    }
  }
  function validatePanelGroupLayout({
    layout: prevLayout,
    panelConstraints
  }) {
    const nextLayout = [...prevLayout];
    const nextLayoutTotalSize = nextLayout.reduce((accumulated, current) => accumulated + current, 0);
    if (nextLayout.length !== panelConstraints.length) {
      throw Error(`Invalid ${panelConstraints.length} panel layout: ${nextLayout.map((size) => `${size}%`).join(", ")}`);
    } else if (!fuzzyNumbersEqual(nextLayoutTotalSize, 100) && nextLayout.length > 0) {
      for (let index = 0; index < panelConstraints.length; index++) {
        const unsafeSize = nextLayout[index];
        assert(unsafeSize != null, `No layout data found for index ${index}`);
        const safeSize = 100 / nextLayoutTotalSize * unsafeSize;
        nextLayout[index] = safeSize;
      }
    }
    let remainingSize = 0;
    for (let index = 0; index < panelConstraints.length; index++) {
      const unsafeSize = nextLayout[index];
      assert(unsafeSize != null, `No layout data found for index ${index}`);
      const safeSize = resizePanel({
        panelConstraints,
        panelIndex: index,
        size: unsafeSize
      });
      if (unsafeSize != safeSize) {
        remainingSize += unsafeSize - safeSize;
        nextLayout[index] = safeSize;
      }
    }
    if (!fuzzyNumbersEqual(remainingSize, 0)) {
      for (let index = 0; index < panelConstraints.length; index++) {
        const prevSize = nextLayout[index];
        assert(prevSize != null, `No layout data found for index ${index}`);
        const unsafeSize = prevSize + remainingSize;
        const safeSize = resizePanel({
          panelConstraints,
          panelIndex: index,
          size: unsafeSize
        });
        if (prevSize !== safeSize) {
          remainingSize -= safeSize - prevSize;
          nextLayout[index] = safeSize;
          if (fuzzyNumbersEqual(remainingSize, 0)) {
            break;
          }
        }
      }
    }
    return nextLayout;
  }
  var LOCAL_STORAGE_DEBOUNCE_INTERVAL = 100;
  var defaultStorage = {
    getItem: (name) => {
      initializeDefaultStorage(defaultStorage);
      return defaultStorage.getItem(name);
    },
    setItem: (name, value) => {
      initializeDefaultStorage(defaultStorage);
      defaultStorage.setItem(name, value);
    }
  };
  var debounceMap = {};
  function PanelGroupWithForwardedRef({
    autoSaveId = null,
    children,
    className: classNameFromProps = "",
    direction,
    forwardedRef,
    id: idFromProps = null,
    onLayout = null,
    keyboardResizeBy = null,
    storage = defaultStorage,
    style: styleFromProps,
    tagName: Type = "div",
    ...rest
  }) {
    const groupId = useUniqueId(idFromProps);
    const panelGroupElementRef = (0, import_react.useRef)(null);
    const [dragState, setDragState] = (0, import_react.useState)(null);
    const [layout, setLayout] = (0, import_react.useState)([]);
    const forceUpdate = useForceUpdate();
    const panelIdToLastNotifiedSizeMapRef = (0, import_react.useRef)({});
    const panelSizeBeforeCollapseRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const prevDeltaRef = (0, import_react.useRef)(0);
    const committedValuesRef = (0, import_react.useRef)({
      autoSaveId,
      direction,
      dragState,
      id: groupId,
      keyboardResizeBy,
      onLayout,
      storage
    });
    const eagerValuesRef = (0, import_react.useRef)({
      layout,
      panelDataArray: [],
      panelDataArrayChanged: false
    });
    (0, import_react.useRef)({
      didLogIdAndOrderWarning: false,
      didLogPanelConstraintsWarning: false,
      prevPanelIds: []
    });
    (0, import_react.useImperativeHandle)(forwardedRef, () => ({
      getId: () => committedValuesRef.current.id,
      getLayout: () => {
        const {
          layout: layout2
        } = eagerValuesRef.current;
        return layout2;
      },
      setLayout: (unsafeLayout) => {
        const {
          onLayout: onLayout2
        } = committedValuesRef.current;
        const {
          layout: prevLayout,
          panelDataArray
        } = eagerValuesRef.current;
        const safeLayout = validatePanelGroupLayout({
          layout: unsafeLayout,
          panelConstraints: panelDataArray.map((panelData) => panelData.constraints)
        });
        if (!areEqual(prevLayout, safeLayout)) {
          setLayout(safeLayout);
          eagerValuesRef.current.layout = safeLayout;
          if (onLayout2) {
            onLayout2(safeLayout);
          }
          callPanelCallbacks(panelDataArray, safeLayout, panelIdToLastNotifiedSizeMapRef.current);
        }
      }
    }), []);
    useIsomorphicLayoutEffect(() => {
      committedValuesRef.current.autoSaveId = autoSaveId;
      committedValuesRef.current.direction = direction;
      committedValuesRef.current.dragState = dragState;
      committedValuesRef.current.id = groupId;
      committedValuesRef.current.onLayout = onLayout;
      committedValuesRef.current.storage = storage;
    });
    useWindowSplitterPanelGroupBehavior({
      committedValuesRef,
      eagerValuesRef,
      groupId,
      layout,
      panelDataArray: eagerValuesRef.current.panelDataArray,
      setLayout,
      panelGroupElement: panelGroupElementRef.current
    });
    (0, import_react.useEffect)(() => {
      const {
        panelDataArray
      } = eagerValuesRef.current;
      if (autoSaveId) {
        if (layout.length === 0 || layout.length !== panelDataArray.length) {
          return;
        }
        let debouncedSave = debounceMap[autoSaveId];
        if (debouncedSave == null) {
          debouncedSave = debounce(savePanelGroupState, LOCAL_STORAGE_DEBOUNCE_INTERVAL);
          debounceMap[autoSaveId] = debouncedSave;
        }
        const clonedPanelDataArray = [...panelDataArray];
        const clonedPanelSizesBeforeCollapse = new Map(panelSizeBeforeCollapseRef.current);
        debouncedSave(autoSaveId, clonedPanelDataArray, clonedPanelSizesBeforeCollapse, layout, storage);
      }
    }, [autoSaveId, layout, storage]);
    (0, import_react.useEffect)(() => {
    });
    const collapsePanel = (0, import_react.useCallback)((panelData) => {
      const {
        onLayout: onLayout2
      } = committedValuesRef.current;
      const {
        layout: prevLayout,
        panelDataArray
      } = eagerValuesRef.current;
      if (panelData.constraints.collapsible) {
        const panelConstraintsArray = panelDataArray.map((panelData2) => panelData2.constraints);
        const {
          collapsedSize = 0,
          panelSize,
          pivotIndices
        } = panelDataHelper(panelDataArray, panelData, prevLayout);
        assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
        if (!fuzzyNumbersEqual$1(panelSize, collapsedSize)) {
          panelSizeBeforeCollapseRef.current.set(panelData.id, panelSize);
          const isLastPanel = findPanelDataIndex(panelDataArray, panelData) === panelDataArray.length - 1;
          const delta = isLastPanel ? panelSize - collapsedSize : collapsedSize - panelSize;
          const nextLayout = adjustLayoutByDelta({
            delta,
            initialLayout: prevLayout,
            panelConstraints: panelConstraintsArray,
            pivotIndices,
            prevLayout,
            trigger: "imperative-api"
          });
          if (!compareLayouts(prevLayout, nextLayout)) {
            setLayout(nextLayout);
            eagerValuesRef.current.layout = nextLayout;
            if (onLayout2) {
              onLayout2(nextLayout);
            }
            callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
          }
        }
      }
    }, []);
    const expandPanel = (0, import_react.useCallback)((panelData, minSizeOverride) => {
      const {
        onLayout: onLayout2
      } = committedValuesRef.current;
      const {
        layout: prevLayout,
        panelDataArray
      } = eagerValuesRef.current;
      if (panelData.constraints.collapsible) {
        const panelConstraintsArray = panelDataArray.map((panelData2) => panelData2.constraints);
        const {
          collapsedSize = 0,
          panelSize = 0,
          minSize: minSizeFromProps = 0,
          pivotIndices
        } = panelDataHelper(panelDataArray, panelData, prevLayout);
        const minSize = minSizeOverride !== null && minSizeOverride !== void 0 ? minSizeOverride : minSizeFromProps;
        if (fuzzyNumbersEqual$1(panelSize, collapsedSize)) {
          const prevPanelSize = panelSizeBeforeCollapseRef.current.get(panelData.id);
          const baseSize = prevPanelSize != null && prevPanelSize >= minSize ? prevPanelSize : minSize;
          const isLastPanel = findPanelDataIndex(panelDataArray, panelData) === panelDataArray.length - 1;
          const delta = isLastPanel ? panelSize - baseSize : baseSize - panelSize;
          const nextLayout = adjustLayoutByDelta({
            delta,
            initialLayout: prevLayout,
            panelConstraints: panelConstraintsArray,
            pivotIndices,
            prevLayout,
            trigger: "imperative-api"
          });
          if (!compareLayouts(prevLayout, nextLayout)) {
            setLayout(nextLayout);
            eagerValuesRef.current.layout = nextLayout;
            if (onLayout2) {
              onLayout2(nextLayout);
            }
            callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
          }
        }
      }
    }, []);
    const getPanelSize = (0, import_react.useCallback)((panelData) => {
      const {
        layout: layout2,
        panelDataArray
      } = eagerValuesRef.current;
      const {
        panelSize
      } = panelDataHelper(panelDataArray, panelData, layout2);
      assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
      return panelSize;
    }, []);
    const getPanelStyle = (0, import_react.useCallback)((panelData, defaultSize) => {
      const {
        panelDataArray
      } = eagerValuesRef.current;
      const panelIndex = findPanelDataIndex(panelDataArray, panelData);
      return computePanelFlexBoxStyle({
        defaultSize,
        dragState,
        layout,
        panelData: panelDataArray,
        panelIndex
      });
    }, [dragState, layout]);
    const isPanelCollapsed = (0, import_react.useCallback)((panelData) => {
      const {
        layout: layout2,
        panelDataArray
      } = eagerValuesRef.current;
      const {
        collapsedSize = 0,
        collapsible,
        panelSize
      } = panelDataHelper(panelDataArray, panelData, layout2);
      assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
      return collapsible === true && fuzzyNumbersEqual$1(panelSize, collapsedSize);
    }, []);
    const isPanelExpanded = (0, import_react.useCallback)((panelData) => {
      const {
        layout: layout2,
        panelDataArray
      } = eagerValuesRef.current;
      const {
        collapsedSize = 0,
        collapsible,
        panelSize
      } = panelDataHelper(panelDataArray, panelData, layout2);
      assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
      return !collapsible || fuzzyCompareNumbers(panelSize, collapsedSize) > 0;
    }, []);
    const registerPanel = (0, import_react.useCallback)((panelData) => {
      const {
        panelDataArray
      } = eagerValuesRef.current;
      panelDataArray.push(panelData);
      panelDataArray.sort((panelA, panelB) => {
        const orderA = panelA.order;
        const orderB = panelB.order;
        if (orderA == null && orderB == null) {
          return 0;
        } else if (orderA == null) {
          return -1;
        } else if (orderB == null) {
          return 1;
        } else {
          return orderA - orderB;
        }
      });
      eagerValuesRef.current.panelDataArrayChanged = true;
      forceUpdate();
    }, [forceUpdate]);
    useIsomorphicLayoutEffect(() => {
      if (eagerValuesRef.current.panelDataArrayChanged) {
        eagerValuesRef.current.panelDataArrayChanged = false;
        const {
          autoSaveId: autoSaveId2,
          onLayout: onLayout2,
          storage: storage2
        } = committedValuesRef.current;
        const {
          layout: prevLayout,
          panelDataArray
        } = eagerValuesRef.current;
        let unsafeLayout = null;
        if (autoSaveId2) {
          const state = loadPanelGroupState(autoSaveId2, panelDataArray, storage2);
          if (state) {
            panelSizeBeforeCollapseRef.current = new Map(Object.entries(state.expandToSizes));
            unsafeLayout = state.layout;
          }
        }
        if (unsafeLayout == null) {
          unsafeLayout = calculateUnsafeDefaultLayout({
            panelDataArray
          });
        }
        const nextLayout = validatePanelGroupLayout({
          layout: unsafeLayout,
          panelConstraints: panelDataArray.map((panelData) => panelData.constraints)
        });
        if (!areEqual(prevLayout, nextLayout)) {
          setLayout(nextLayout);
          eagerValuesRef.current.layout = nextLayout;
          if (onLayout2) {
            onLayout2(nextLayout);
          }
          callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
        }
      }
    });
    useIsomorphicLayoutEffect(() => {
      const eagerValues = eagerValuesRef.current;
      return () => {
        eagerValues.layout = [];
      };
    }, []);
    const registerResizeHandle2 = (0, import_react.useCallback)((dragHandleId) => {
      let isRTL = false;
      const panelGroupElement = panelGroupElementRef.current;
      if (panelGroupElement) {
        const style2 = window.getComputedStyle(panelGroupElement, null);
        if (style2.getPropertyValue("direction") === "rtl") {
          isRTL = true;
        }
      }
      return function resizeHandler(event) {
        event.preventDefault();
        const panelGroupElement2 = panelGroupElementRef.current;
        if (!panelGroupElement2) {
          return () => null;
        }
        const {
          direction: direction2,
          dragState: dragState2,
          id: groupId2,
          keyboardResizeBy: keyboardResizeBy2,
          onLayout: onLayout2
        } = committedValuesRef.current;
        const {
          layout: prevLayout,
          panelDataArray
        } = eagerValuesRef.current;
        const {
          initialLayout
        } = dragState2 !== null && dragState2 !== void 0 ? dragState2 : {};
        const pivotIndices = determinePivotIndices(groupId2, dragHandleId, panelGroupElement2);
        let delta = calculateDeltaPercentage(event, dragHandleId, direction2, dragState2, keyboardResizeBy2, panelGroupElement2);
        const isHorizontal = direction2 === "horizontal";
        if (isHorizontal && isRTL) {
          delta = -delta;
        }
        const panelConstraints = panelDataArray.map((panelData) => panelData.constraints);
        const nextLayout = adjustLayoutByDelta({
          delta,
          initialLayout: initialLayout !== null && initialLayout !== void 0 ? initialLayout : prevLayout,
          panelConstraints,
          pivotIndices,
          prevLayout,
          trigger: isKeyDown(event) ? "keyboard" : "mouse-or-touch"
        });
        const layoutChanged = !compareLayouts(prevLayout, nextLayout);
        if (isPointerEvent(event) || isMouseEvent(event)) {
          if (prevDeltaRef.current != delta) {
            prevDeltaRef.current = delta;
            if (!layoutChanged && delta !== 0) {
              if (isHorizontal) {
                reportConstraintsViolation(dragHandleId, delta < 0 ? EXCEEDED_HORIZONTAL_MIN : EXCEEDED_HORIZONTAL_MAX);
              } else {
                reportConstraintsViolation(dragHandleId, delta < 0 ? EXCEEDED_VERTICAL_MIN : EXCEEDED_VERTICAL_MAX);
              }
            } else {
              reportConstraintsViolation(dragHandleId, 0);
            }
          }
        }
        if (layoutChanged) {
          setLayout(nextLayout);
          eagerValuesRef.current.layout = nextLayout;
          if (onLayout2) {
            onLayout2(nextLayout);
          }
          callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
        }
      };
    }, []);
    const resizePanel2 = (0, import_react.useCallback)((panelData, unsafePanelSize) => {
      const {
        onLayout: onLayout2
      } = committedValuesRef.current;
      const {
        layout: prevLayout,
        panelDataArray
      } = eagerValuesRef.current;
      const panelConstraintsArray = panelDataArray.map((panelData2) => panelData2.constraints);
      const {
        panelSize,
        pivotIndices
      } = panelDataHelper(panelDataArray, panelData, prevLayout);
      assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
      const isLastPanel = findPanelDataIndex(panelDataArray, panelData) === panelDataArray.length - 1;
      const delta = isLastPanel ? panelSize - unsafePanelSize : unsafePanelSize - panelSize;
      const nextLayout = adjustLayoutByDelta({
        delta,
        initialLayout: prevLayout,
        panelConstraints: panelConstraintsArray,
        pivotIndices,
        prevLayout,
        trigger: "imperative-api"
      });
      if (!compareLayouts(prevLayout, nextLayout)) {
        setLayout(nextLayout);
        eagerValuesRef.current.layout = nextLayout;
        if (onLayout2) {
          onLayout2(nextLayout);
        }
        callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
      }
    }, []);
    const reevaluatePanelConstraints = (0, import_react.useCallback)((panelData, prevConstraints) => {
      const {
        layout: layout2,
        panelDataArray
      } = eagerValuesRef.current;
      const {
        collapsedSize: prevCollapsedSize = 0,
        collapsible: prevCollapsible
      } = prevConstraints;
      const {
        collapsedSize: nextCollapsedSize = 0,
        collapsible: nextCollapsible,
        maxSize: nextMaxSize = 100,
        minSize: nextMinSize = 0
      } = panelData.constraints;
      const {
        panelSize: prevPanelSize
      } = panelDataHelper(panelDataArray, panelData, layout2);
      if (prevPanelSize == null) {
        return;
      }
      if (prevCollapsible && nextCollapsible && fuzzyNumbersEqual$1(prevPanelSize, prevCollapsedSize)) {
        if (!fuzzyNumbersEqual$1(prevCollapsedSize, nextCollapsedSize)) {
          resizePanel2(panelData, nextCollapsedSize);
        }
      } else if (prevPanelSize < nextMinSize) {
        resizePanel2(panelData, nextMinSize);
      } else if (prevPanelSize > nextMaxSize) {
        resizePanel2(panelData, nextMaxSize);
      }
    }, [resizePanel2]);
    const startDragging = (0, import_react.useCallback)((dragHandleId, event) => {
      const {
        direction: direction2
      } = committedValuesRef.current;
      const {
        layout: layout2
      } = eagerValuesRef.current;
      if (!panelGroupElementRef.current) {
        return;
      }
      const handleElement = getResizeHandleElement(dragHandleId, panelGroupElementRef.current);
      assert(handleElement, `Drag handle element not found for id "${dragHandleId}"`);
      const initialCursorPosition = getResizeEventCursorPosition(direction2, event);
      setDragState({
        dragHandleId,
        dragHandleRect: handleElement.getBoundingClientRect(),
        initialCursorPosition,
        initialLayout: layout2
      });
    }, []);
    const stopDragging = (0, import_react.useCallback)(() => {
      setDragState(null);
    }, []);
    const unregisterPanel = (0, import_react.useCallback)((panelData) => {
      const {
        panelDataArray
      } = eagerValuesRef.current;
      const index = findPanelDataIndex(panelDataArray, panelData);
      if (index >= 0) {
        panelDataArray.splice(index, 1);
        delete panelIdToLastNotifiedSizeMapRef.current[panelData.id];
        eagerValuesRef.current.panelDataArrayChanged = true;
        forceUpdate();
      }
    }, [forceUpdate]);
    const context = (0, import_react.useMemo)(() => ({
      collapsePanel,
      direction,
      dragState,
      expandPanel,
      getPanelSize,
      getPanelStyle,
      groupId,
      isPanelCollapsed,
      isPanelExpanded,
      reevaluatePanelConstraints,
      registerPanel,
      registerResizeHandle: registerResizeHandle2,
      resizePanel: resizePanel2,
      startDragging,
      stopDragging,
      unregisterPanel,
      panelGroupElement: panelGroupElementRef.current
    }), [collapsePanel, dragState, direction, expandPanel, getPanelSize, getPanelStyle, groupId, isPanelCollapsed, isPanelExpanded, reevaluatePanelConstraints, registerPanel, registerResizeHandle2, resizePanel2, startDragging, stopDragging, unregisterPanel]);
    const style = {
      display: "flex",
      flexDirection: direction === "horizontal" ? "row" : "column",
      height: "100%",
      overflow: "hidden",
      width: "100%"
    };
    return (0, import_react.createElement)(PanelGroupContext.Provider, {
      value: context
    }, (0, import_react.createElement)(Type, {
      ...rest,
      children,
      className: classNameFromProps,
      id: idFromProps,
      ref: panelGroupElementRef,
      style: {
        ...style,
        ...styleFromProps
      },
      // CSS selectors
      [DATA_ATTRIBUTES.group]: "",
      [DATA_ATTRIBUTES.groupDirection]: direction,
      [DATA_ATTRIBUTES.groupId]: groupId
    }));
  }
  var PanelGroup = (0, import_react.forwardRef)((props2, ref) => (0, import_react.createElement)(PanelGroupWithForwardedRef, {
    ...props2,
    forwardedRef: ref
  }));
  PanelGroupWithForwardedRef.displayName = "PanelGroup";
  PanelGroup.displayName = "forwardRef(PanelGroup)";
  function findPanelDataIndex(panelDataArray, panelData) {
    return panelDataArray.findIndex((prevPanelData) => prevPanelData === panelData || prevPanelData.id === panelData.id);
  }
  function panelDataHelper(panelDataArray, panelData, layout) {
    const panelIndex = findPanelDataIndex(panelDataArray, panelData);
    const isLastPanel = panelIndex === panelDataArray.length - 1;
    const pivotIndices = isLastPanel ? [panelIndex - 1, panelIndex] : [panelIndex, panelIndex + 1];
    const panelSize = layout[panelIndex];
    return {
      ...panelData.constraints,
      panelSize,
      pivotIndices
    };
  }
  function useWindowSplitterResizeHandlerBehavior({
    disabled,
    handleId,
    resizeHandler,
    panelGroupElement
  }) {
    (0, import_react.useEffect)(() => {
      if (disabled || resizeHandler == null || panelGroupElement == null) {
        return;
      }
      const handleElement = getResizeHandleElement(handleId, panelGroupElement);
      if (handleElement == null) {
        return;
      }
      const onKeyDown = (event) => {
        if (event.defaultPrevented) {
          return;
        }
        switch (event.key) {
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight":
          case "ArrowUp":
          case "End":
          case "Home": {
            event.preventDefault();
            resizeHandler(event);
            break;
          }
          case "F6": {
            event.preventDefault();
            const groupId = handleElement.getAttribute(DATA_ATTRIBUTES.groupId);
            assert(groupId, `No group element found for id "${groupId}"`);
            const handles = getResizeHandleElementsForGroup(groupId, panelGroupElement);
            const index = getResizeHandleElementIndex(groupId, handleId, panelGroupElement);
            assert(index !== null, `No resize element found for id "${handleId}"`);
            const nextIndex = event.shiftKey ? index > 0 ? index - 1 : handles.length - 1 : index + 1 < handles.length ? index + 1 : 0;
            const nextHandle = handles[nextIndex];
            nextHandle.focus();
            break;
          }
        }
      };
      handleElement.addEventListener("keydown", onKeyDown);
      return () => {
        handleElement.removeEventListener("keydown", onKeyDown);
      };
    }, [panelGroupElement, disabled, handleId, resizeHandler]);
  }
  function PanelResizeHandle({
    children = null,
    className: classNameFromProps = "",
    disabled = false,
    hitAreaMargins,
    id: idFromProps,
    onBlur,
    onClick,
    onDragging,
    onFocus,
    onPointerDown,
    onPointerUp,
    style: styleFromProps = {},
    tabIndex = 0,
    tagName: Type = "div",
    ...rest
  }) {
    var _hitAreaMargins$coars, _hitAreaMargins$fine;
    const elementRef = (0, import_react.useRef)(null);
    const callbacksRef = (0, import_react.useRef)({
      onClick,
      onDragging,
      onPointerDown,
      onPointerUp
    });
    (0, import_react.useEffect)(() => {
      callbacksRef.current.onClick = onClick;
      callbacksRef.current.onDragging = onDragging;
      callbacksRef.current.onPointerDown = onPointerDown;
      callbacksRef.current.onPointerUp = onPointerUp;
    });
    const panelGroupContext = (0, import_react.useContext)(PanelGroupContext);
    if (panelGroupContext === null) {
      throw Error(`PanelResizeHandle components must be rendered within a PanelGroup container`);
    }
    const {
      direction,
      groupId,
      registerResizeHandle: registerResizeHandleWithParentGroup,
      startDragging,
      stopDragging,
      panelGroupElement
    } = panelGroupContext;
    const resizeHandleId = useUniqueId(idFromProps);
    const [state, setState] = (0, import_react.useState)("inactive");
    const [isFocused, setIsFocused] = (0, import_react.useState)(false);
    const [resizeHandler, setResizeHandler] = (0, import_react.useState)(null);
    const committedValuesRef = (0, import_react.useRef)({
      state
    });
    useIsomorphicLayoutEffect(() => {
      committedValuesRef.current.state = state;
    });
    (0, import_react.useEffect)(() => {
      if (disabled) {
        setResizeHandler(null);
      } else {
        const resizeHandler2 = registerResizeHandleWithParentGroup(resizeHandleId);
        setResizeHandler(() => resizeHandler2);
      }
    }, [disabled, resizeHandleId, registerResizeHandleWithParentGroup]);
    const coarseHitAreaMargins = (_hitAreaMargins$coars = hitAreaMargins === null || hitAreaMargins === void 0 ? void 0 : hitAreaMargins.coarse) !== null && _hitAreaMargins$coars !== void 0 ? _hitAreaMargins$coars : 15;
    const fineHitAreaMargins = (_hitAreaMargins$fine = hitAreaMargins === null || hitAreaMargins === void 0 ? void 0 : hitAreaMargins.fine) !== null && _hitAreaMargins$fine !== void 0 ? _hitAreaMargins$fine : 5;
    (0, import_react.useEffect)(() => {
      if (disabled || resizeHandler == null) {
        return;
      }
      const element = elementRef.current;
      assert(element, "Element ref not attached");
      let didMove = false;
      const setResizeHandlerState = (action, isActive, event) => {
        if (!isActive) {
          setState("inactive");
          return;
        }
        switch (action) {
          case "down": {
            setState("drag");
            didMove = false;
            assert(event, 'Expected event to be defined for "down" action');
            startDragging(resizeHandleId, event);
            const {
              onDragging: onDragging2,
              onPointerDown: onPointerDown2
            } = callbacksRef.current;
            onDragging2 === null || onDragging2 === void 0 ? void 0 : onDragging2(true);
            onPointerDown2 === null || onPointerDown2 === void 0 ? void 0 : onPointerDown2();
            break;
          }
          case "move": {
            const {
              state: state2
            } = committedValuesRef.current;
            didMove = true;
            if (state2 !== "drag") {
              setState("hover");
            }
            assert(event, 'Expected event to be defined for "move" action');
            resizeHandler(event);
            break;
          }
          case "up": {
            setState("hover");
            stopDragging();
            const {
              onClick: onClick2,
              onDragging: onDragging2,
              onPointerUp: onPointerUp2
            } = callbacksRef.current;
            onDragging2 === null || onDragging2 === void 0 ? void 0 : onDragging2(false);
            onPointerUp2 === null || onPointerUp2 === void 0 ? void 0 : onPointerUp2();
            if (!didMove) {
              onClick2 === null || onClick2 === void 0 ? void 0 : onClick2();
            }
            break;
          }
        }
      };
      return registerResizeHandle(resizeHandleId, element, direction, {
        coarse: coarseHitAreaMargins,
        fine: fineHitAreaMargins
      }, setResizeHandlerState);
    }, [coarseHitAreaMargins, direction, disabled, fineHitAreaMargins, registerResizeHandleWithParentGroup, resizeHandleId, resizeHandler, startDragging, stopDragging]);
    useWindowSplitterResizeHandlerBehavior({
      disabled,
      handleId: resizeHandleId,
      resizeHandler,
      panelGroupElement
    });
    const style = {
      touchAction: "none",
      userSelect: "none"
    };
    return (0, import_react.createElement)(Type, {
      ...rest,
      children,
      className: classNameFromProps,
      id: idFromProps,
      onBlur: () => {
        setIsFocused(false);
        onBlur === null || onBlur === void 0 ? void 0 : onBlur();
      },
      onFocus: () => {
        setIsFocused(true);
        onFocus === null || onFocus === void 0 ? void 0 : onFocus();
      },
      ref: elementRef,
      role: "separator",
      style: {
        ...style,
        ...styleFromProps
      },
      tabIndex,
      // CSS selectors
      [DATA_ATTRIBUTES.groupDirection]: direction,
      [DATA_ATTRIBUTES.groupId]: groupId,
      [DATA_ATTRIBUTES.resizeHandle]: "",
      [DATA_ATTRIBUTES.resizeHandleActive]: state === "drag" ? "pointer" : isFocused ? "keyboard" : void 0,
      [DATA_ATTRIBUTES.resizeHandleEnabled]: !disabled,
      [DATA_ATTRIBUTES.resizeHandleId]: resizeHandleId,
      [DATA_ATTRIBUTES.resizeHandleState]: state
    });
  }
  PanelResizeHandle.displayName = "PanelResizeHandle";

  // client/src/lib/utils.ts
  init_define_import_meta_env();

  // ../../../node_modules/clsx/dist/clsx.mjs
  init_define_import_meta_env();
  function r(e) {
    var t, f, n = "";
    if ("string" == typeof e || "number" == typeof e) n += e;
    else if ("object" == typeof e) if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else for (f in e) e[f] && (n && (n += " "), n += f);
    return n;
  }
  function clsx() {
    for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
    return n;
  }

  // ../../../node_modules/tailwind-merge/dist/bundle-mjs.mjs
  init_define_import_meta_env();
  var concatArrays = (array1, array2) => {
    const combinedArray = new Array(array1.length + array2.length);
    for (let i = 0; i < array1.length; i++) {
      combinedArray[i] = array1[i];
    }
    for (let i = 0; i < array2.length; i++) {
      combinedArray[array1.length + i] = array2[i];
    }
    return combinedArray;
  };
  var createClassValidatorObject = (classGroupId, validator) => ({
    classGroupId,
    validator
  });
  var createClassPartObject = (nextPart = /* @__PURE__ */ new Map(), validators = null, classGroupId) => ({
    nextPart,
    validators,
    classGroupId
  });
  var CLASS_PART_SEPARATOR = "-";
  var EMPTY_CONFLICTS = [];
  var ARBITRARY_PROPERTY_PREFIX = "arbitrary..";
  var createClassGroupUtils = (config) => {
    const classMap = createClassMap(config);
    const {
      conflictingClassGroups,
      conflictingClassGroupModifiers
    } = config;
    const getClassGroupId = (className) => {
      if (className.startsWith("[") && className.endsWith("]")) {
        return getGroupIdForArbitraryProperty(className);
      }
      const classParts = className.split(CLASS_PART_SEPARATOR);
      const startIndex = classParts[0] === "" && classParts.length > 1 ? 1 : 0;
      return getGroupRecursive(classParts, startIndex, classMap);
    };
    const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
      if (hasPostfixModifier) {
        const modifierConflicts = conflictingClassGroupModifiers[classGroupId];
        const baseConflicts = conflictingClassGroups[classGroupId];
        if (modifierConflicts) {
          if (baseConflicts) {
            return concatArrays(baseConflicts, modifierConflicts);
          }
          return modifierConflicts;
        }
        return baseConflicts || EMPTY_CONFLICTS;
      }
      return conflictingClassGroups[classGroupId] || EMPTY_CONFLICTS;
    };
    return {
      getClassGroupId,
      getConflictingClassGroupIds
    };
  };
  var getGroupRecursive = (classParts, startIndex, classPartObject) => {
    const classPathsLength = classParts.length - startIndex;
    if (classPathsLength === 0) {
      return classPartObject.classGroupId;
    }
    const currentClassPart = classParts[startIndex];
    const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
    if (nextClassPartObject) {
      const result = getGroupRecursive(classParts, startIndex + 1, nextClassPartObject);
      if (result) return result;
    }
    const validators = classPartObject.validators;
    if (validators === null) {
      return void 0;
    }
    const classRest = startIndex === 0 ? classParts.join(CLASS_PART_SEPARATOR) : classParts.slice(startIndex).join(CLASS_PART_SEPARATOR);
    const validatorsLength = validators.length;
    for (let i = 0; i < validatorsLength; i++) {
      const validatorObj = validators[i];
      if (validatorObj.validator(classRest)) {
        return validatorObj.classGroupId;
      }
    }
    return void 0;
  };
  var getGroupIdForArbitraryProperty = (className) => className.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
    const content = className.slice(1, -1);
    const colonIndex = content.indexOf(":");
    const property = content.slice(0, colonIndex);
    return property ? ARBITRARY_PROPERTY_PREFIX + property : void 0;
  })();
  var createClassMap = (config) => {
    const {
      theme,
      classGroups
    } = config;
    return processClassGroups(classGroups, theme);
  };
  var processClassGroups = (classGroups, theme) => {
    const classMap = createClassPartObject();
    for (const classGroupId in classGroups) {
      const group = classGroups[classGroupId];
      processClassesRecursively(group, classMap, classGroupId, theme);
    }
    return classMap;
  };
  var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
    const len = classGroup.length;
    for (let i = 0; i < len; i++) {
      const classDefinition = classGroup[i];
      processClassDefinition(classDefinition, classPartObject, classGroupId, theme);
    }
  };
  var processClassDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
    if (typeof classDefinition === "string") {
      processStringDefinition(classDefinition, classPartObject, classGroupId);
      return;
    }
    if (typeof classDefinition === "function") {
      processFunctionDefinition(classDefinition, classPartObject, classGroupId, theme);
      return;
    }
    processObjectDefinition(classDefinition, classPartObject, classGroupId, theme);
  };
  var processStringDefinition = (classDefinition, classPartObject, classGroupId) => {
    const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
    classPartObjectToEdit.classGroupId = classGroupId;
  };
  var processFunctionDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
    if (isThemeGetter(classDefinition)) {
      processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
      return;
    }
    if (classPartObject.validators === null) {
      classPartObject.validators = [];
    }
    classPartObject.validators.push(createClassValidatorObject(classGroupId, classDefinition));
  };
  var processObjectDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
    const entries = Object.entries(classDefinition);
    const len = entries.length;
    for (let i = 0; i < len; i++) {
      const [key, value] = entries[i];
      processClassesRecursively(value, getPart(classPartObject, key), classGroupId, theme);
    }
  };
  var getPart = (classPartObject, path) => {
    let current = classPartObject;
    const parts = path.split(CLASS_PART_SEPARATOR);
    const len = parts.length;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      let next = current.nextPart.get(part);
      if (!next) {
        next = createClassPartObject();
        current.nextPart.set(part, next);
      }
      current = next;
    }
    return current;
  };
  var isThemeGetter = (func) => "isThemeGetter" in func && func.isThemeGetter === true;
  var createLruCache = (maxCacheSize) => {
    if (maxCacheSize < 1) {
      return {
        get: () => void 0,
        set: () => {
        }
      };
    }
    let cacheSize = 0;
    let cache = /* @__PURE__ */ Object.create(null);
    let previousCache = /* @__PURE__ */ Object.create(null);
    const update = (key, value) => {
      cache[key] = value;
      cacheSize++;
      if (cacheSize > maxCacheSize) {
        cacheSize = 0;
        previousCache = cache;
        cache = /* @__PURE__ */ Object.create(null);
      }
    };
    return {
      get(key) {
        let value = cache[key];
        if (value !== void 0) {
          return value;
        }
        if ((value = previousCache[key]) !== void 0) {
          update(key, value);
          return value;
        }
      },
      set(key, value) {
        if (key in cache) {
          cache[key] = value;
        } else {
          update(key, value);
        }
      }
    };
  };
  var IMPORTANT_MODIFIER = "!";
  var MODIFIER_SEPARATOR = ":";
  var EMPTY_MODIFIERS = [];
  var createResultObject = (modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition, isExternal) => ({
    modifiers,
    hasImportantModifier,
    baseClassName,
    maybePostfixModifierPosition,
    isExternal
  });
  var createParseClassName = (config) => {
    const {
      prefix,
      experimentalParseClassName
    } = config;
    let parseClassName = (className) => {
      const modifiers = [];
      let bracketDepth = 0;
      let parenDepth = 0;
      let modifierStart = 0;
      let postfixModifierPosition;
      const len = className.length;
      for (let index = 0; index < len; index++) {
        const currentCharacter = className[index];
        if (bracketDepth === 0 && parenDepth === 0) {
          if (currentCharacter === MODIFIER_SEPARATOR) {
            modifiers.push(className.slice(modifierStart, index));
            modifierStart = index + 1;
            continue;
          }
          if (currentCharacter === "/") {
            postfixModifierPosition = index;
            continue;
          }
        }
        if (currentCharacter === "[") bracketDepth++;
        else if (currentCharacter === "]") bracketDepth--;
        else if (currentCharacter === "(") parenDepth++;
        else if (currentCharacter === ")") parenDepth--;
      }
      const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.slice(modifierStart);
      let baseClassName = baseClassNameWithImportantModifier;
      let hasImportantModifier = false;
      if (baseClassNameWithImportantModifier.endsWith(IMPORTANT_MODIFIER)) {
        baseClassName = baseClassNameWithImportantModifier.slice(0, -1);
        hasImportantModifier = true;
      } else if (
        /**
         * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
         * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
         */
        baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER)
      ) {
        baseClassName = baseClassNameWithImportantModifier.slice(1);
        hasImportantModifier = true;
      }
      const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
      return createResultObject(modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition);
    };
    if (prefix) {
      const fullPrefix = prefix + MODIFIER_SEPARATOR;
      const parseClassNameOriginal = parseClassName;
      parseClassName = (className) => className.startsWith(fullPrefix) ? parseClassNameOriginal(className.slice(fullPrefix.length)) : createResultObject(EMPTY_MODIFIERS, false, className, void 0, true);
    }
    if (experimentalParseClassName) {
      const parseClassNameOriginal = parseClassName;
      parseClassName = (className) => experimentalParseClassName({
        className,
        parseClassName: parseClassNameOriginal
      });
    }
    return parseClassName;
  };
  var createSortModifiers = (config) => {
    const modifierWeights = /* @__PURE__ */ new Map();
    config.orderSensitiveModifiers.forEach((mod, index) => {
      modifierWeights.set(mod, 1e6 + index);
    });
    return (modifiers) => {
      const result = [];
      let currentSegment = [];
      for (let i = 0; i < modifiers.length; i++) {
        const modifier = modifiers[i];
        const isArbitrary = modifier[0] === "[";
        const isOrderSensitive = modifierWeights.has(modifier);
        if (isArbitrary || isOrderSensitive) {
          if (currentSegment.length > 0) {
            currentSegment.sort();
            result.push(...currentSegment);
            currentSegment = [];
          }
          result.push(modifier);
        } else {
          currentSegment.push(modifier);
        }
      }
      if (currentSegment.length > 0) {
        currentSegment.sort();
        result.push(...currentSegment);
      }
      return result;
    };
  };
  var createConfigUtils = (config) => ({
    cache: createLruCache(config.cacheSize),
    parseClassName: createParseClassName(config),
    sortModifiers: createSortModifiers(config),
    ...createClassGroupUtils(config)
  });
  var SPLIT_CLASSES_REGEX = /\s+/;
  var mergeClassList = (classList, configUtils) => {
    const {
      parseClassName,
      getClassGroupId,
      getConflictingClassGroupIds,
      sortModifiers
    } = configUtils;
    const classGroupsInConflict = [];
    const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
    let result = "";
    for (let index = classNames.length - 1; index >= 0; index -= 1) {
      const originalClassName = classNames[index];
      const {
        isExternal,
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      } = parseClassName(originalClassName);
      if (isExternal) {
        result = originalClassName + (result.length > 0 ? " " + result : result);
        continue;
      }
      let hasPostfixModifier = !!maybePostfixModifierPosition;
      let classGroupId = getClassGroupId(hasPostfixModifier ? baseClassName.substring(0, maybePostfixModifierPosition) : baseClassName);
      if (!classGroupId) {
        if (!hasPostfixModifier) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        classGroupId = getClassGroupId(baseClassName);
        if (!classGroupId) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        hasPostfixModifier = false;
      }
      const variantModifier = modifiers.length === 0 ? "" : modifiers.length === 1 ? modifiers[0] : sortModifiers(modifiers).join(":");
      const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
      const classId = modifierId + classGroupId;
      if (classGroupsInConflict.indexOf(classId) > -1) {
        continue;
      }
      classGroupsInConflict.push(classId);
      const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
      for (let i = 0; i < conflictGroups.length; ++i) {
        const group = conflictGroups[i];
        classGroupsInConflict.push(modifierId + group);
      }
      result = originalClassName + (result.length > 0 ? " " + result : result);
    }
    return result;
  };
  var twJoin = (...classLists) => {
    let index = 0;
    let argument;
    let resolvedValue;
    let string = "";
    while (index < classLists.length) {
      if (argument = classLists[index++]) {
        if (resolvedValue = toValue(argument)) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  var toValue = (mix) => {
    if (typeof mix === "string") {
      return mix;
    }
    let resolvedValue;
    let string = "";
    for (let k = 0; k < mix.length; k++) {
      if (mix[k]) {
        if (resolvedValue = toValue(mix[k])) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  var createTailwindMerge = (createConfigFirst, ...createConfigRest) => {
    let configUtils;
    let cacheGet;
    let cacheSet;
    let functionToCall;
    const initTailwindMerge = (classList) => {
      const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
      configUtils = createConfigUtils(config);
      cacheGet = configUtils.cache.get;
      cacheSet = configUtils.cache.set;
      functionToCall = tailwindMerge;
      return tailwindMerge(classList);
    };
    const tailwindMerge = (classList) => {
      const cachedResult = cacheGet(classList);
      if (cachedResult) {
        return cachedResult;
      }
      const result = mergeClassList(classList, configUtils);
      cacheSet(classList, result);
      return result;
    };
    functionToCall = initTailwindMerge;
    return (...args) => functionToCall(twJoin(...args));
  };
  var fallbackThemeArr = [];
  var fromTheme = (key) => {
    const themeGetter = (theme) => theme[key] || fallbackThemeArr;
    themeGetter.isThemeGetter = true;
    return themeGetter;
  };
  var arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
  var arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
  var fractionRegex = /^\d+\/\d+$/;
  var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
  var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  var isFraction = (value) => fractionRegex.test(value);
  var isNumber = (value) => !!value && !Number.isNaN(Number(value));
  var isInteger = (value) => !!value && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
  var isTshirtSize = (value) => tshirtUnitRegex.test(value);
  var isAny = () => true;
  var isLengthOnly = (value) => (
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
  );
  var isNever = () => false;
  var isShadow = (value) => shadowRegex.test(value);
  var isImage = (value) => imageRegex.test(value);
  var isAnyNonArbitrary = (value) => !isArbitraryValue(value) && !isArbitraryVariable(value);
  var isArbitrarySize = (value) => getIsArbitraryValue(value, isLabelSize, isNever);
  var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
  var isArbitraryLength = (value) => getIsArbitraryValue(value, isLabelLength, isLengthOnly);
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, isLabelNumber, isNumber);
  var isArbitraryWeight = (value) => getIsArbitraryValue(value, isLabelWeight, isAny);
  var isArbitraryFamilyName = (value) => getIsArbitraryValue(value, isLabelFamilyName, isNever);
  var isArbitraryPosition = (value) => getIsArbitraryValue(value, isLabelPosition, isNever);
  var isArbitraryImage = (value) => getIsArbitraryValue(value, isLabelImage, isImage);
  var isArbitraryShadow = (value) => getIsArbitraryValue(value, isLabelShadow, isShadow);
  var isArbitraryVariable = (value) => arbitraryVariableRegex.test(value);
  var isArbitraryVariableLength = (value) => getIsArbitraryVariable(value, isLabelLength);
  var isArbitraryVariableFamilyName = (value) => getIsArbitraryVariable(value, isLabelFamilyName);
  var isArbitraryVariablePosition = (value) => getIsArbitraryVariable(value, isLabelPosition);
  var isArbitraryVariableSize = (value) => getIsArbitraryVariable(value, isLabelSize);
  var isArbitraryVariableImage = (value) => getIsArbitraryVariable(value, isLabelImage);
  var isArbitraryVariableShadow = (value) => getIsArbitraryVariable(value, isLabelShadow, true);
  var isArbitraryVariableWeight = (value) => getIsArbitraryVariable(value, isLabelWeight, true);
  var getIsArbitraryValue = (value, testLabel, testValue) => {
    const result = arbitraryValueRegex.exec(value);
    if (result) {
      if (result[1]) {
        return testLabel(result[1]);
      }
      return testValue(result[2]);
    }
    return false;
  };
  var getIsArbitraryVariable = (value, testLabel, shouldMatchNoLabel = false) => {
    const result = arbitraryVariableRegex.exec(value);
    if (result) {
      if (result[1]) {
        return testLabel(result[1]);
      }
      return shouldMatchNoLabel;
    }
    return false;
  };
  var isLabelPosition = (label) => label === "position" || label === "percentage";
  var isLabelImage = (label) => label === "image" || label === "url";
  var isLabelSize = (label) => label === "length" || label === "size" || label === "bg-size";
  var isLabelLength = (label) => label === "length";
  var isLabelNumber = (label) => label === "number";
  var isLabelFamilyName = (label) => label === "family-name";
  var isLabelWeight = (label) => label === "number" || label === "weight";
  var isLabelShadow = (label) => label === "shadow";
  var getDefaultConfig = () => {
    const themeColor = fromTheme("color");
    const themeFont = fromTheme("font");
    const themeText = fromTheme("text");
    const themeFontWeight = fromTheme("font-weight");
    const themeTracking = fromTheme("tracking");
    const themeLeading = fromTheme("leading");
    const themeBreakpoint = fromTheme("breakpoint");
    const themeContainer = fromTheme("container");
    const themeSpacing = fromTheme("spacing");
    const themeRadius = fromTheme("radius");
    const themeShadow = fromTheme("shadow");
    const themeInsetShadow = fromTheme("inset-shadow");
    const themeTextShadow = fromTheme("text-shadow");
    const themeDropShadow = fromTheme("drop-shadow");
    const themeBlur = fromTheme("blur");
    const themePerspective = fromTheme("perspective");
    const themeAspect = fromTheme("aspect");
    const themeEase = fromTheme("ease");
    const themeAnimate = fromTheme("animate");
    const scaleBreak = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
    const scalePosition = () => [
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "top-left",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "left-top",
      "top-right",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "right-top",
      "bottom-right",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "right-bottom",
      "bottom-left",
      // Deprecated since Tailwind CSS v4.1.0, see https://github.com/tailwindlabs/tailwindcss/pull/17378
      "left-bottom"
    ];
    const scalePositionWithArbitrary = () => [...scalePosition(), isArbitraryVariable, isArbitraryValue];
    const scaleOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
    const scaleOverscroll = () => ["auto", "contain", "none"];
    const scaleUnambiguousSpacing = () => [isArbitraryVariable, isArbitraryValue, themeSpacing];
    const scaleInset = () => [isFraction, "full", "auto", ...scaleUnambiguousSpacing()];
    const scaleGridTemplateColsRows = () => [isInteger, "none", "subgrid", isArbitraryVariable, isArbitraryValue];
    const scaleGridColRowStartAndEnd = () => ["auto", {
      span: ["full", isInteger, isArbitraryVariable, isArbitraryValue]
    }, isInteger, isArbitraryVariable, isArbitraryValue];
    const scaleGridColRowStartOrEnd = () => [isInteger, "auto", isArbitraryVariable, isArbitraryValue];
    const scaleGridAutoColsRows = () => ["auto", "min", "max", "fr", isArbitraryVariable, isArbitraryValue];
    const scaleAlignPrimaryAxis = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"];
    const scaleAlignSecondaryAxis = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"];
    const scaleMargin = () => ["auto", ...scaleUnambiguousSpacing()];
    const scaleSizing = () => [isFraction, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...scaleUnambiguousSpacing()];
    const scaleColor = () => [themeColor, isArbitraryVariable, isArbitraryValue];
    const scaleBgPosition = () => [...scalePosition(), isArbitraryVariablePosition, isArbitraryPosition, {
      position: [isArbitraryVariable, isArbitraryValue]
    }];
    const scaleBgRepeat = () => ["no-repeat", {
      repeat: ["", "x", "y", "space", "round"]
    }];
    const scaleBgSize = () => ["auto", "cover", "contain", isArbitraryVariableSize, isArbitrarySize, {
      size: [isArbitraryVariable, isArbitraryValue]
    }];
    const scaleGradientStopPosition = () => [isPercent, isArbitraryVariableLength, isArbitraryLength];
    const scaleRadius = () => [
      // Deprecated since Tailwind CSS v4.0.0
      "",
      "none",
      "full",
      themeRadius,
      isArbitraryVariable,
      isArbitraryValue
    ];
    const scaleBorderWidth = () => ["", isNumber, isArbitraryVariableLength, isArbitraryLength];
    const scaleLineStyle = () => ["solid", "dashed", "dotted", "double"];
    const scaleBlendMode = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const scaleMaskImagePosition = () => [isNumber, isPercent, isArbitraryVariablePosition, isArbitraryPosition];
    const scaleBlur = () => [
      // Deprecated since Tailwind CSS v4.0.0
      "",
      "none",
      themeBlur,
      isArbitraryVariable,
      isArbitraryValue
    ];
    const scaleRotate = () => ["none", isNumber, isArbitraryVariable, isArbitraryValue];
    const scaleScale = () => ["none", isNumber, isArbitraryVariable, isArbitraryValue];
    const scaleSkew = () => [isNumber, isArbitraryVariable, isArbitraryValue];
    const scaleTranslate = () => [isFraction, "full", ...scaleUnambiguousSpacing()];
    return {
      cacheSize: 500,
      theme: {
        animate: ["spin", "ping", "pulse", "bounce"],
        aspect: ["video"],
        blur: [isTshirtSize],
        breakpoint: [isTshirtSize],
        color: [isAny],
        container: [isTshirtSize],
        "drop-shadow": [isTshirtSize],
        ease: ["in", "out", "in-out"],
        font: [isAnyNonArbitrary],
        "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
        "inset-shadow": [isTshirtSize],
        leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
        perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
        radius: [isTshirtSize],
        shadow: [isTshirtSize],
        spacing: ["px", isNumber],
        text: [isTshirtSize],
        "text-shadow": [isTshirtSize],
        tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"]
      },
      classGroups: {
        // --------------
        // --- Layout ---
        // --------------
        /**
         * Aspect Ratio
         * @see https://tailwindcss.com/docs/aspect-ratio
         */
        aspect: [{
          aspect: ["auto", "square", isFraction, isArbitraryValue, isArbitraryVariable, themeAspect]
        }],
        /**
         * Container
         * @see https://tailwindcss.com/docs/container
         * @deprecated since Tailwind CSS v4.0.0
         */
        container: ["container"],
        /**
         * Columns
         * @see https://tailwindcss.com/docs/columns
         */
        columns: [{
          columns: [isNumber, isArbitraryValue, isArbitraryVariable, themeContainer]
        }],
        /**
         * Break After
         * @see https://tailwindcss.com/docs/break-after
         */
        "break-after": [{
          "break-after": scaleBreak()
        }],
        /**
         * Break Before
         * @see https://tailwindcss.com/docs/break-before
         */
        "break-before": [{
          "break-before": scaleBreak()
        }],
        /**
         * Break Inside
         * @see https://tailwindcss.com/docs/break-inside
         */
        "break-inside": [{
          "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
        }],
        /**
         * Box Decoration Break
         * @see https://tailwindcss.com/docs/box-decoration-break
         */
        "box-decoration": [{
          "box-decoration": ["slice", "clone"]
        }],
        /**
         * Box Sizing
         * @see https://tailwindcss.com/docs/box-sizing
         */
        box: [{
          box: ["border", "content"]
        }],
        /**
         * Display
         * @see https://tailwindcss.com/docs/display
         */
        display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
        /**
         * Screen Reader Only
         * @see https://tailwindcss.com/docs/display#screen-reader-only
         */
        sr: ["sr-only", "not-sr-only"],
        /**
         * Floats
         * @see https://tailwindcss.com/docs/float
         */
        float: [{
          float: ["right", "left", "none", "start", "end"]
        }],
        /**
         * Clear
         * @see https://tailwindcss.com/docs/clear
         */
        clear: [{
          clear: ["left", "right", "both", "none", "start", "end"]
        }],
        /**
         * Isolation
         * @see https://tailwindcss.com/docs/isolation
         */
        isolation: ["isolate", "isolation-auto"],
        /**
         * Object Fit
         * @see https://tailwindcss.com/docs/object-fit
         */
        "object-fit": [{
          object: ["contain", "cover", "fill", "none", "scale-down"]
        }],
        /**
         * Object Position
         * @see https://tailwindcss.com/docs/object-position
         */
        "object-position": [{
          object: scalePositionWithArbitrary()
        }],
        /**
         * Overflow
         * @see https://tailwindcss.com/docs/overflow
         */
        overflow: [{
          overflow: scaleOverflow()
        }],
        /**
         * Overflow X
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-x": [{
          "overflow-x": scaleOverflow()
        }],
        /**
         * Overflow Y
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-y": [{
          "overflow-y": scaleOverflow()
        }],
        /**
         * Overscroll Behavior
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        overscroll: [{
          overscroll: scaleOverscroll()
        }],
        /**
         * Overscroll Behavior X
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-x": [{
          "overscroll-x": scaleOverscroll()
        }],
        /**
         * Overscroll Behavior Y
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-y": [{
          "overscroll-y": scaleOverscroll()
        }],
        /**
         * Position
         * @see https://tailwindcss.com/docs/position
         */
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        /**
         * Top / Right / Bottom / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        inset: [{
          inset: scaleInset()
        }],
        /**
         * Right / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-x": [{
          "inset-x": scaleInset()
        }],
        /**
         * Top / Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-y": [{
          "inset-y": scaleInset()
        }],
        /**
         * Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        start: [{
          start: scaleInset()
        }],
        /**
         * End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        end: [{
          end: scaleInset()
        }],
        /**
         * Top
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        top: [{
          top: scaleInset()
        }],
        /**
         * Right
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        right: [{
          right: scaleInset()
        }],
        /**
         * Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        bottom: [{
          bottom: scaleInset()
        }],
        /**
         * Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        left: [{
          left: scaleInset()
        }],
        /**
         * Visibility
         * @see https://tailwindcss.com/docs/visibility
         */
        visibility: ["visible", "invisible", "collapse"],
        /**
         * Z-Index
         * @see https://tailwindcss.com/docs/z-index
         */
        z: [{
          z: [isInteger, "auto", isArbitraryVariable, isArbitraryValue]
        }],
        // ------------------------
        // --- Flexbox and Grid ---
        // ------------------------
        /**
         * Flex Basis
         * @see https://tailwindcss.com/docs/flex-basis
         */
        basis: [{
          basis: [isFraction, "full", "auto", themeContainer, ...scaleUnambiguousSpacing()]
        }],
        /**
         * Flex Direction
         * @see https://tailwindcss.com/docs/flex-direction
         */
        "flex-direction": [{
          flex: ["row", "row-reverse", "col", "col-reverse"]
        }],
        /**
         * Flex Wrap
         * @see https://tailwindcss.com/docs/flex-wrap
         */
        "flex-wrap": [{
          flex: ["nowrap", "wrap", "wrap-reverse"]
        }],
        /**
         * Flex
         * @see https://tailwindcss.com/docs/flex
         */
        flex: [{
          flex: [isNumber, isFraction, "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Order
         * @see https://tailwindcss.com/docs/order
         */
        order: [{
          order: [isInteger, "first", "last", "none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Grid Template Columns
         * @see https://tailwindcss.com/docs/grid-template-columns
         */
        "grid-cols": [{
          "grid-cols": scaleGridTemplateColsRows()
        }],
        /**
         * Grid Column Start / End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start-end": [{
          col: scaleGridColRowStartAndEnd()
        }],
        /**
         * Grid Column Start
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start": [{
          "col-start": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Column End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-end": [{
          "col-end": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Template Rows
         * @see https://tailwindcss.com/docs/grid-template-rows
         */
        "grid-rows": [{
          "grid-rows": scaleGridTemplateColsRows()
        }],
        /**
         * Grid Row Start / End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start-end": [{
          row: scaleGridColRowStartAndEnd()
        }],
        /**
         * Grid Row Start
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start": [{
          "row-start": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Row End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-end": [{
          "row-end": scaleGridColRowStartOrEnd()
        }],
        /**
         * Grid Auto Flow
         * @see https://tailwindcss.com/docs/grid-auto-flow
         */
        "grid-flow": [{
          "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
        }],
        /**
         * Grid Auto Columns
         * @see https://tailwindcss.com/docs/grid-auto-columns
         */
        "auto-cols": [{
          "auto-cols": scaleGridAutoColsRows()
        }],
        /**
         * Grid Auto Rows
         * @see https://tailwindcss.com/docs/grid-auto-rows
         */
        "auto-rows": [{
          "auto-rows": scaleGridAutoColsRows()
        }],
        /**
         * Gap
         * @see https://tailwindcss.com/docs/gap
         */
        gap: [{
          gap: scaleUnambiguousSpacing()
        }],
        /**
         * Gap X
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-x": [{
          "gap-x": scaleUnambiguousSpacing()
        }],
        /**
         * Gap Y
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-y": [{
          "gap-y": scaleUnambiguousSpacing()
        }],
        /**
         * Justify Content
         * @see https://tailwindcss.com/docs/justify-content
         */
        "justify-content": [{
          justify: [...scaleAlignPrimaryAxis(), "normal"]
        }],
        /**
         * Justify Items
         * @see https://tailwindcss.com/docs/justify-items
         */
        "justify-items": [{
          "justify-items": [...scaleAlignSecondaryAxis(), "normal"]
        }],
        /**
         * Justify Self
         * @see https://tailwindcss.com/docs/justify-self
         */
        "justify-self": [{
          "justify-self": ["auto", ...scaleAlignSecondaryAxis()]
        }],
        /**
         * Align Content
         * @see https://tailwindcss.com/docs/align-content
         */
        "align-content": [{
          content: ["normal", ...scaleAlignPrimaryAxis()]
        }],
        /**
         * Align Items
         * @see https://tailwindcss.com/docs/align-items
         */
        "align-items": [{
          items: [...scaleAlignSecondaryAxis(), {
            baseline: ["", "last"]
          }]
        }],
        /**
         * Align Self
         * @see https://tailwindcss.com/docs/align-self
         */
        "align-self": [{
          self: ["auto", ...scaleAlignSecondaryAxis(), {
            baseline: ["", "last"]
          }]
        }],
        /**
         * Place Content
         * @see https://tailwindcss.com/docs/place-content
         */
        "place-content": [{
          "place-content": scaleAlignPrimaryAxis()
        }],
        /**
         * Place Items
         * @see https://tailwindcss.com/docs/place-items
         */
        "place-items": [{
          "place-items": [...scaleAlignSecondaryAxis(), "baseline"]
        }],
        /**
         * Place Self
         * @see https://tailwindcss.com/docs/place-self
         */
        "place-self": [{
          "place-self": ["auto", ...scaleAlignSecondaryAxis()]
        }],
        // Spacing
        /**
         * Padding
         * @see https://tailwindcss.com/docs/padding
         */
        p: [{
          p: scaleUnambiguousSpacing()
        }],
        /**
         * Padding X
         * @see https://tailwindcss.com/docs/padding
         */
        px: [{
          px: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Y
         * @see https://tailwindcss.com/docs/padding
         */
        py: [{
          py: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Start
         * @see https://tailwindcss.com/docs/padding
         */
        ps: [{
          ps: scaleUnambiguousSpacing()
        }],
        /**
         * Padding End
         * @see https://tailwindcss.com/docs/padding
         */
        pe: [{
          pe: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Top
         * @see https://tailwindcss.com/docs/padding
         */
        pt: [{
          pt: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Right
         * @see https://tailwindcss.com/docs/padding
         */
        pr: [{
          pr: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Bottom
         * @see https://tailwindcss.com/docs/padding
         */
        pb: [{
          pb: scaleUnambiguousSpacing()
        }],
        /**
         * Padding Left
         * @see https://tailwindcss.com/docs/padding
         */
        pl: [{
          pl: scaleUnambiguousSpacing()
        }],
        /**
         * Margin
         * @see https://tailwindcss.com/docs/margin
         */
        m: [{
          m: scaleMargin()
        }],
        /**
         * Margin X
         * @see https://tailwindcss.com/docs/margin
         */
        mx: [{
          mx: scaleMargin()
        }],
        /**
         * Margin Y
         * @see https://tailwindcss.com/docs/margin
         */
        my: [{
          my: scaleMargin()
        }],
        /**
         * Margin Start
         * @see https://tailwindcss.com/docs/margin
         */
        ms: [{
          ms: scaleMargin()
        }],
        /**
         * Margin End
         * @see https://tailwindcss.com/docs/margin
         */
        me: [{
          me: scaleMargin()
        }],
        /**
         * Margin Top
         * @see https://tailwindcss.com/docs/margin
         */
        mt: [{
          mt: scaleMargin()
        }],
        /**
         * Margin Right
         * @see https://tailwindcss.com/docs/margin
         */
        mr: [{
          mr: scaleMargin()
        }],
        /**
         * Margin Bottom
         * @see https://tailwindcss.com/docs/margin
         */
        mb: [{
          mb: scaleMargin()
        }],
        /**
         * Margin Left
         * @see https://tailwindcss.com/docs/margin
         */
        ml: [{
          ml: scaleMargin()
        }],
        /**
         * Space Between X
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-x": [{
          "space-x": scaleUnambiguousSpacing()
        }],
        /**
         * Space Between X Reverse
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-x-reverse": ["space-x-reverse"],
        /**
         * Space Between Y
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-y": [{
          "space-y": scaleUnambiguousSpacing()
        }],
        /**
         * Space Between Y Reverse
         * @see https://tailwindcss.com/docs/margin#adding-space-between-children
         */
        "space-y-reverse": ["space-y-reverse"],
        // --------------
        // --- Sizing ---
        // --------------
        /**
         * Size
         * @see https://tailwindcss.com/docs/width#setting-both-width-and-height
         */
        size: [{
          size: scaleSizing()
        }],
        /**
         * Width
         * @see https://tailwindcss.com/docs/width
         */
        w: [{
          w: [themeContainer, "screen", ...scaleSizing()]
        }],
        /**
         * Min-Width
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-w": [{
          "min-w": [
            themeContainer,
            "screen",
            /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            "none",
            ...scaleSizing()
          ]
        }],
        /**
         * Max-Width
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-w": [{
          "max-w": [
            themeContainer,
            "screen",
            "none",
            /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            "prose",
            /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            {
              screen: [themeBreakpoint]
            },
            ...scaleSizing()
          ]
        }],
        /**
         * Height
         * @see https://tailwindcss.com/docs/height
         */
        h: [{
          h: ["screen", "lh", ...scaleSizing()]
        }],
        /**
         * Min-Height
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-h": [{
          "min-h": ["screen", "lh", "none", ...scaleSizing()]
        }],
        /**
         * Max-Height
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-h": [{
          "max-h": ["screen", "lh", ...scaleSizing()]
        }],
        // ------------------
        // --- Typography ---
        // ------------------
        /**
         * Font Size
         * @see https://tailwindcss.com/docs/font-size
         */
        "font-size": [{
          text: ["base", themeText, isArbitraryVariableLength, isArbitraryLength]
        }],
        /**
         * Font Smoothing
         * @see https://tailwindcss.com/docs/font-smoothing
         */
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        /**
         * Font Style
         * @see https://tailwindcss.com/docs/font-style
         */
        "font-style": ["italic", "not-italic"],
        /**
         * Font Weight
         * @see https://tailwindcss.com/docs/font-weight
         */
        "font-weight": [{
          font: [themeFontWeight, isArbitraryVariableWeight, isArbitraryWeight]
        }],
        /**
         * Font Stretch
         * @see https://tailwindcss.com/docs/font-stretch
         */
        "font-stretch": [{
          "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", isPercent, isArbitraryValue]
        }],
        /**
         * Font Family
         * @see https://tailwindcss.com/docs/font-family
         */
        "font-family": [{
          font: [isArbitraryVariableFamilyName, isArbitraryFamilyName, themeFont]
        }],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-normal": ["normal-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-ordinal": ["ordinal"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-slashed-zero": ["slashed-zero"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        /**
         * Letter Spacing
         * @see https://tailwindcss.com/docs/letter-spacing
         */
        tracking: [{
          tracking: [themeTracking, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Line Clamp
         * @see https://tailwindcss.com/docs/line-clamp
         */
        "line-clamp": [{
          "line-clamp": [isNumber, "none", isArbitraryVariable, isArbitraryNumber]
        }],
        /**
         * Line Height
         * @see https://tailwindcss.com/docs/line-height
         */
        leading: [{
          leading: [
            /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
            themeLeading,
            ...scaleUnambiguousSpacing()
          ]
        }],
        /**
         * List Style Image
         * @see https://tailwindcss.com/docs/list-style-image
         */
        "list-image": [{
          "list-image": ["none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * List Style Position
         * @see https://tailwindcss.com/docs/list-style-position
         */
        "list-style-position": [{
          list: ["inside", "outside"]
        }],
        /**
         * List Style Type
         * @see https://tailwindcss.com/docs/list-style-type
         */
        "list-style-type": [{
          list: ["disc", "decimal", "none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Text Alignment
         * @see https://tailwindcss.com/docs/text-align
         */
        "text-alignment": [{
          text: ["left", "center", "right", "justify", "start", "end"]
        }],
        /**
         * Placeholder Color
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://v3.tailwindcss.com/docs/placeholder-color
         */
        "placeholder-color": [{
          placeholder: scaleColor()
        }],
        /**
         * Text Color
         * @see https://tailwindcss.com/docs/text-color
         */
        "text-color": [{
          text: scaleColor()
        }],
        /**
         * Text Decoration
         * @see https://tailwindcss.com/docs/text-decoration
         */
        "text-decoration": ["underline", "overline", "line-through", "no-underline"],
        /**
         * Text Decoration Style
         * @see https://tailwindcss.com/docs/text-decoration-style
         */
        "text-decoration-style": [{
          decoration: [...scaleLineStyle(), "wavy"]
        }],
        /**
         * Text Decoration Thickness
         * @see https://tailwindcss.com/docs/text-decoration-thickness
         */
        "text-decoration-thickness": [{
          decoration: [isNumber, "from-font", "auto", isArbitraryVariable, isArbitraryLength]
        }],
        /**
         * Text Decoration Color
         * @see https://tailwindcss.com/docs/text-decoration-color
         */
        "text-decoration-color": [{
          decoration: scaleColor()
        }],
        /**
         * Text Underline Offset
         * @see https://tailwindcss.com/docs/text-underline-offset
         */
        "underline-offset": [{
          "underline-offset": [isNumber, "auto", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Text Transform
         * @see https://tailwindcss.com/docs/text-transform
         */
        "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
        /**
         * Text Overflow
         * @see https://tailwindcss.com/docs/text-overflow
         */
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        /**
         * Text Wrap
         * @see https://tailwindcss.com/docs/text-wrap
         */
        "text-wrap": [{
          text: ["wrap", "nowrap", "balance", "pretty"]
        }],
        /**
         * Text Indent
         * @see https://tailwindcss.com/docs/text-indent
         */
        indent: [{
          indent: scaleUnambiguousSpacing()
        }],
        /**
         * Vertical Alignment
         * @see https://tailwindcss.com/docs/vertical-align
         */
        "vertical-align": [{
          align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Whitespace
         * @see https://tailwindcss.com/docs/whitespace
         */
        whitespace: [{
          whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
        }],
        /**
         * Word Break
         * @see https://tailwindcss.com/docs/word-break
         */
        break: [{
          break: ["normal", "words", "all", "keep"]
        }],
        /**
         * Overflow Wrap
         * @see https://tailwindcss.com/docs/overflow-wrap
         */
        wrap: [{
          wrap: ["break-word", "anywhere", "normal"]
        }],
        /**
         * Hyphens
         * @see https://tailwindcss.com/docs/hyphens
         */
        hyphens: [{
          hyphens: ["none", "manual", "auto"]
        }],
        /**
         * Content
         * @see https://tailwindcss.com/docs/content
         */
        content: [{
          content: ["none", isArbitraryVariable, isArbitraryValue]
        }],
        // -------------------
        // --- Backgrounds ---
        // -------------------
        /**
         * Background Attachment
         * @see https://tailwindcss.com/docs/background-attachment
         */
        "bg-attachment": [{
          bg: ["fixed", "local", "scroll"]
        }],
        /**
         * Background Clip
         * @see https://tailwindcss.com/docs/background-clip
         */
        "bg-clip": [{
          "bg-clip": ["border", "padding", "content", "text"]
        }],
        /**
         * Background Origin
         * @see https://tailwindcss.com/docs/background-origin
         */
        "bg-origin": [{
          "bg-origin": ["border", "padding", "content"]
        }],
        /**
         * Background Position
         * @see https://tailwindcss.com/docs/background-position
         */
        "bg-position": [{
          bg: scaleBgPosition()
        }],
        /**
         * Background Repeat
         * @see https://tailwindcss.com/docs/background-repeat
         */
        "bg-repeat": [{
          bg: scaleBgRepeat()
        }],
        /**
         * Background Size
         * @see https://tailwindcss.com/docs/background-size
         */
        "bg-size": [{
          bg: scaleBgSize()
        }],
        /**
         * Background Image
         * @see https://tailwindcss.com/docs/background-image
         */
        "bg-image": [{
          bg: ["none", {
            linear: [{
              to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
            }, isInteger, isArbitraryVariable, isArbitraryValue],
            radial: ["", isArbitraryVariable, isArbitraryValue],
            conic: [isInteger, isArbitraryVariable, isArbitraryValue]
          }, isArbitraryVariableImage, isArbitraryImage]
        }],
        /**
         * Background Color
         * @see https://tailwindcss.com/docs/background-color
         */
        "bg-color": [{
          bg: scaleColor()
        }],
        /**
         * Gradient Color Stops From Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from-pos": [{
          from: scaleGradientStopPosition()
        }],
        /**
         * Gradient Color Stops Via Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via-pos": [{
          via: scaleGradientStopPosition()
        }],
        /**
         * Gradient Color Stops To Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to-pos": [{
          to: scaleGradientStopPosition()
        }],
        /**
         * Gradient Color Stops From
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from": [{
          from: scaleColor()
        }],
        /**
         * Gradient Color Stops Via
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via": [{
          via: scaleColor()
        }],
        /**
         * Gradient Color Stops To
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to": [{
          to: scaleColor()
        }],
        // ---------------
        // --- Borders ---
        // ---------------
        /**
         * Border Radius
         * @see https://tailwindcss.com/docs/border-radius
         */
        rounded: [{
          rounded: scaleRadius()
        }],
        /**
         * Border Radius Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-s": [{
          "rounded-s": scaleRadius()
        }],
        /**
         * Border Radius End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-e": [{
          "rounded-e": scaleRadius()
        }],
        /**
         * Border Radius Top
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-t": [{
          "rounded-t": scaleRadius()
        }],
        /**
         * Border Radius Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-r": [{
          "rounded-r": scaleRadius()
        }],
        /**
         * Border Radius Bottom
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-b": [{
          "rounded-b": scaleRadius()
        }],
        /**
         * Border Radius Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-l": [{
          "rounded-l": scaleRadius()
        }],
        /**
         * Border Radius Start Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ss": [{
          "rounded-ss": scaleRadius()
        }],
        /**
         * Border Radius Start End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-se": [{
          "rounded-se": scaleRadius()
        }],
        /**
         * Border Radius End End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ee": [{
          "rounded-ee": scaleRadius()
        }],
        /**
         * Border Radius End Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-es": [{
          "rounded-es": scaleRadius()
        }],
        /**
         * Border Radius Top Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tl": [{
          "rounded-tl": scaleRadius()
        }],
        /**
         * Border Radius Top Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tr": [{
          "rounded-tr": scaleRadius()
        }],
        /**
         * Border Radius Bottom Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-br": [{
          "rounded-br": scaleRadius()
        }],
        /**
         * Border Radius Bottom Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-bl": [{
          "rounded-bl": scaleRadius()
        }],
        /**
         * Border Width
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w": [{
          border: scaleBorderWidth()
        }],
        /**
         * Border Width X
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-x": [{
          "border-x": scaleBorderWidth()
        }],
        /**
         * Border Width Y
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-y": [{
          "border-y": scaleBorderWidth()
        }],
        /**
         * Border Width Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-s": [{
          "border-s": scaleBorderWidth()
        }],
        /**
         * Border Width End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-e": [{
          "border-e": scaleBorderWidth()
        }],
        /**
         * Border Width Top
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-t": [{
          "border-t": scaleBorderWidth()
        }],
        /**
         * Border Width Right
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-r": [{
          "border-r": scaleBorderWidth()
        }],
        /**
         * Border Width Bottom
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-b": [{
          "border-b": scaleBorderWidth()
        }],
        /**
         * Border Width Left
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-l": [{
          "border-l": scaleBorderWidth()
        }],
        /**
         * Divide Width X
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-x": [{
          "divide-x": scaleBorderWidth()
        }],
        /**
         * Divide Width X Reverse
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-x-reverse": ["divide-x-reverse"],
        /**
         * Divide Width Y
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-y": [{
          "divide-y": scaleBorderWidth()
        }],
        /**
         * Divide Width Y Reverse
         * @see https://tailwindcss.com/docs/border-width#between-children
         */
        "divide-y-reverse": ["divide-y-reverse"],
        /**
         * Border Style
         * @see https://tailwindcss.com/docs/border-style
         */
        "border-style": [{
          border: [...scaleLineStyle(), "hidden", "none"]
        }],
        /**
         * Divide Style
         * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
         */
        "divide-style": [{
          divide: [...scaleLineStyle(), "hidden", "none"]
        }],
        /**
         * Border Color
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color": [{
          border: scaleColor()
        }],
        /**
         * Border Color X
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-x": [{
          "border-x": scaleColor()
        }],
        /**
         * Border Color Y
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-y": [{
          "border-y": scaleColor()
        }],
        /**
         * Border Color S
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-s": [{
          "border-s": scaleColor()
        }],
        /**
         * Border Color E
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-e": [{
          "border-e": scaleColor()
        }],
        /**
         * Border Color Top
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-t": [{
          "border-t": scaleColor()
        }],
        /**
         * Border Color Right
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-r": [{
          "border-r": scaleColor()
        }],
        /**
         * Border Color Bottom
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-b": [{
          "border-b": scaleColor()
        }],
        /**
         * Border Color Left
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-l": [{
          "border-l": scaleColor()
        }],
        /**
         * Divide Color
         * @see https://tailwindcss.com/docs/divide-color
         */
        "divide-color": [{
          divide: scaleColor()
        }],
        /**
         * Outline Style
         * @see https://tailwindcss.com/docs/outline-style
         */
        "outline-style": [{
          outline: [...scaleLineStyle(), "none", "hidden"]
        }],
        /**
         * Outline Offset
         * @see https://tailwindcss.com/docs/outline-offset
         */
        "outline-offset": [{
          "outline-offset": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: ["", isNumber, isArbitraryVariableLength, isArbitraryLength]
        }],
        /**
         * Outline Color
         * @see https://tailwindcss.com/docs/outline-color
         */
        "outline-color": [{
          outline: scaleColor()
        }],
        // ---------------
        // --- Effects ---
        // ---------------
        /**
         * Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow
         */
        shadow: [{
          shadow: [
            // Deprecated since Tailwind CSS v4.0.0
            "",
            "none",
            themeShadow,
            isArbitraryVariableShadow,
            isArbitraryShadow
          ]
        }],
        /**
         * Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
         */
        "shadow-color": [{
          shadow: scaleColor()
        }],
        /**
         * Inset Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
         */
        "inset-shadow": [{
          "inset-shadow": ["none", themeInsetShadow, isArbitraryVariableShadow, isArbitraryShadow]
        }],
        /**
         * Inset Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
         */
        "inset-shadow-color": [{
          "inset-shadow": scaleColor()
        }],
        /**
         * Ring Width
         * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
         */
        "ring-w": [{
          ring: scaleBorderWidth()
        }],
        /**
         * Ring Width Inset
         * @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
         * @deprecated since Tailwind CSS v4.0.0
         * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
         */
        "ring-w-inset": ["ring-inset"],
        /**
         * Ring Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
         */
        "ring-color": [{
          ring: scaleColor()
        }],
        /**
         * Ring Offset Width
         * @see https://v3.tailwindcss.com/docs/ring-offset-width
         * @deprecated since Tailwind CSS v4.0.0
         * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
         */
        "ring-offset-w": [{
          "ring-offset": [isNumber, isArbitraryLength]
        }],
        /**
         * Ring Offset Color
         * @see https://v3.tailwindcss.com/docs/ring-offset-color
         * @deprecated since Tailwind CSS v4.0.0
         * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
         */
        "ring-offset-color": [{
          "ring-offset": scaleColor()
        }],
        /**
         * Inset Ring Width
         * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
         */
        "inset-ring-w": [{
          "inset-ring": scaleBorderWidth()
        }],
        /**
         * Inset Ring Color
         * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
         */
        "inset-ring-color": [{
          "inset-ring": scaleColor()
        }],
        /**
         * Text Shadow
         * @see https://tailwindcss.com/docs/text-shadow
         */
        "text-shadow": [{
          "text-shadow": ["none", themeTextShadow, isArbitraryVariableShadow, isArbitraryShadow]
        }],
        /**
         * Text Shadow Color
         * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
         */
        "text-shadow-color": [{
          "text-shadow": scaleColor()
        }],
        /**
         * Opacity
         * @see https://tailwindcss.com/docs/opacity
         */
        opacity: [{
          opacity: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Mix Blend Mode
         * @see https://tailwindcss.com/docs/mix-blend-mode
         */
        "mix-blend": [{
          "mix-blend": [...scaleBlendMode(), "plus-darker", "plus-lighter"]
        }],
        /**
         * Background Blend Mode
         * @see https://tailwindcss.com/docs/background-blend-mode
         */
        "bg-blend": [{
          "bg-blend": scaleBlendMode()
        }],
        /**
         * Mask Clip
         * @see https://tailwindcss.com/docs/mask-clip
         */
        "mask-clip": [{
          "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"]
        }, "mask-no-clip"],
        /**
         * Mask Composite
         * @see https://tailwindcss.com/docs/mask-composite
         */
        "mask-composite": [{
          mask: ["add", "subtract", "intersect", "exclude"]
        }],
        /**
         * Mask Image
         * @see https://tailwindcss.com/docs/mask-image
         */
        "mask-image-linear-pos": [{
          "mask-linear": [isNumber]
        }],
        "mask-image-linear-from-pos": [{
          "mask-linear-from": scaleMaskImagePosition()
        }],
        "mask-image-linear-to-pos": [{
          "mask-linear-to": scaleMaskImagePosition()
        }],
        "mask-image-linear-from-color": [{
          "mask-linear-from": scaleColor()
        }],
        "mask-image-linear-to-color": [{
          "mask-linear-to": scaleColor()
        }],
        "mask-image-t-from-pos": [{
          "mask-t-from": scaleMaskImagePosition()
        }],
        "mask-image-t-to-pos": [{
          "mask-t-to": scaleMaskImagePosition()
        }],
        "mask-image-t-from-color": [{
          "mask-t-from": scaleColor()
        }],
        "mask-image-t-to-color": [{
          "mask-t-to": scaleColor()
        }],
        "mask-image-r-from-pos": [{
          "mask-r-from": scaleMaskImagePosition()
        }],
        "mask-image-r-to-pos": [{
          "mask-r-to": scaleMaskImagePosition()
        }],
        "mask-image-r-from-color": [{
          "mask-r-from": scaleColor()
        }],
        "mask-image-r-to-color": [{
          "mask-r-to": scaleColor()
        }],
        "mask-image-b-from-pos": [{
          "mask-b-from": scaleMaskImagePosition()
        }],
        "mask-image-b-to-pos": [{
          "mask-b-to": scaleMaskImagePosition()
        }],
        "mask-image-b-from-color": [{
          "mask-b-from": scaleColor()
        }],
        "mask-image-b-to-color": [{
          "mask-b-to": scaleColor()
        }],
        "mask-image-l-from-pos": [{
          "mask-l-from": scaleMaskImagePosition()
        }],
        "mask-image-l-to-pos": [{
          "mask-l-to": scaleMaskImagePosition()
        }],
        "mask-image-l-from-color": [{
          "mask-l-from": scaleColor()
        }],
        "mask-image-l-to-color": [{
          "mask-l-to": scaleColor()
        }],
        "mask-image-x-from-pos": [{
          "mask-x-from": scaleMaskImagePosition()
        }],
        "mask-image-x-to-pos": [{
          "mask-x-to": scaleMaskImagePosition()
        }],
        "mask-image-x-from-color": [{
          "mask-x-from": scaleColor()
        }],
        "mask-image-x-to-color": [{
          "mask-x-to": scaleColor()
        }],
        "mask-image-y-from-pos": [{
          "mask-y-from": scaleMaskImagePosition()
        }],
        "mask-image-y-to-pos": [{
          "mask-y-to": scaleMaskImagePosition()
        }],
        "mask-image-y-from-color": [{
          "mask-y-from": scaleColor()
        }],
        "mask-image-y-to-color": [{
          "mask-y-to": scaleColor()
        }],
        "mask-image-radial": [{
          "mask-radial": [isArbitraryVariable, isArbitraryValue]
        }],
        "mask-image-radial-from-pos": [{
          "mask-radial-from": scaleMaskImagePosition()
        }],
        "mask-image-radial-to-pos": [{
          "mask-radial-to": scaleMaskImagePosition()
        }],
        "mask-image-radial-from-color": [{
          "mask-radial-from": scaleColor()
        }],
        "mask-image-radial-to-color": [{
          "mask-radial-to": scaleColor()
        }],
        "mask-image-radial-shape": [{
          "mask-radial": ["circle", "ellipse"]
        }],
        "mask-image-radial-size": [{
          "mask-radial": [{
            closest: ["side", "corner"],
            farthest: ["side", "corner"]
          }]
        }],
        "mask-image-radial-pos": [{
          "mask-radial-at": scalePosition()
        }],
        "mask-image-conic-pos": [{
          "mask-conic": [isNumber]
        }],
        "mask-image-conic-from-pos": [{
          "mask-conic-from": scaleMaskImagePosition()
        }],
        "mask-image-conic-to-pos": [{
          "mask-conic-to": scaleMaskImagePosition()
        }],
        "mask-image-conic-from-color": [{
          "mask-conic-from": scaleColor()
        }],
        "mask-image-conic-to-color": [{
          "mask-conic-to": scaleColor()
        }],
        /**
         * Mask Mode
         * @see https://tailwindcss.com/docs/mask-mode
         */
        "mask-mode": [{
          mask: ["alpha", "luminance", "match"]
        }],
        /**
         * Mask Origin
         * @see https://tailwindcss.com/docs/mask-origin
         */
        "mask-origin": [{
          "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"]
        }],
        /**
         * Mask Position
         * @see https://tailwindcss.com/docs/mask-position
         */
        "mask-position": [{
          mask: scaleBgPosition()
        }],
        /**
         * Mask Repeat
         * @see https://tailwindcss.com/docs/mask-repeat
         */
        "mask-repeat": [{
          mask: scaleBgRepeat()
        }],
        /**
         * Mask Size
         * @see https://tailwindcss.com/docs/mask-size
         */
        "mask-size": [{
          mask: scaleBgSize()
        }],
        /**
         * Mask Type
         * @see https://tailwindcss.com/docs/mask-type
         */
        "mask-type": [{
          "mask-type": ["alpha", "luminance"]
        }],
        /**
         * Mask Image
         * @see https://tailwindcss.com/docs/mask-image
         */
        "mask-image": [{
          mask: ["none", isArbitraryVariable, isArbitraryValue]
        }],
        // ---------------
        // --- Filters ---
        // ---------------
        /**
         * Filter
         * @see https://tailwindcss.com/docs/filter
         */
        filter: [{
          filter: [
            // Deprecated since Tailwind CSS v3.0.0
            "",
            "none",
            isArbitraryVariable,
            isArbitraryValue
          ]
        }],
        /**
         * Blur
         * @see https://tailwindcss.com/docs/blur
         */
        blur: [{
          blur: scaleBlur()
        }],
        /**
         * Brightness
         * @see https://tailwindcss.com/docs/brightness
         */
        brightness: [{
          brightness: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Drop Shadow
         * @see https://tailwindcss.com/docs/drop-shadow
         */
        "drop-shadow": [{
          "drop-shadow": [
            // Deprecated since Tailwind CSS v4.0.0
            "",
            "none",
            themeDropShadow,
            isArbitraryVariableShadow,
            isArbitraryShadow
          ]
        }],
        /**
         * Drop Shadow Color
         * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
         */
        "drop-shadow-color": [{
          "drop-shadow": scaleColor()
        }],
        /**
         * Grayscale
         * @see https://tailwindcss.com/docs/grayscale
         */
        grayscale: [{
          grayscale: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Filter
         * @see https://tailwindcss.com/docs/backdrop-filter
         */
        "backdrop-filter": [{
          "backdrop-filter": [
            // Deprecated since Tailwind CSS v3.0.0
            "",
            "none",
            isArbitraryVariable,
            isArbitraryValue
          ]
        }],
        /**
         * Backdrop Blur
         * @see https://tailwindcss.com/docs/backdrop-blur
         */
        "backdrop-blur": [{
          "backdrop-blur": scaleBlur()
        }],
        /**
         * Backdrop Brightness
         * @see https://tailwindcss.com/docs/backdrop-brightness
         */
        "backdrop-brightness": [{
          "backdrop-brightness": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": ["", isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        // --------------
        // --- Tables ---
        // --------------
        /**
         * Border Collapse
         * @see https://tailwindcss.com/docs/border-collapse
         */
        "border-collapse": [{
          border: ["collapse", "separate"]
        }],
        /**
         * Border Spacing
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing": [{
          "border-spacing": scaleUnambiguousSpacing()
        }],
        /**
         * Border Spacing X
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-x": [{
          "border-spacing-x": scaleUnambiguousSpacing()
        }],
        /**
         * Border Spacing Y
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-y": [{
          "border-spacing-y": scaleUnambiguousSpacing()
        }],
        /**
         * Table Layout
         * @see https://tailwindcss.com/docs/table-layout
         */
        "table-layout": [{
          table: ["auto", "fixed"]
        }],
        /**
         * Caption Side
         * @see https://tailwindcss.com/docs/caption-side
         */
        caption: [{
          caption: ["top", "bottom"]
        }],
        // ---------------------------------
        // --- Transitions and Animation ---
        // ---------------------------------
        /**
         * Transition Property
         * @see https://tailwindcss.com/docs/transition-property
         */
        transition: [{
          transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Transition Behavior
         * @see https://tailwindcss.com/docs/transition-behavior
         */
        "transition-behavior": [{
          transition: ["normal", "discrete"]
        }],
        /**
         * Transition Duration
         * @see https://tailwindcss.com/docs/transition-duration
         */
        duration: [{
          duration: [isNumber, "initial", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Transition Timing Function
         * @see https://tailwindcss.com/docs/transition-timing-function
         */
        ease: [{
          ease: ["linear", "initial", themeEase, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Transition Delay
         * @see https://tailwindcss.com/docs/transition-delay
         */
        delay: [{
          delay: [isNumber, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Animation
         * @see https://tailwindcss.com/docs/animation
         */
        animate: [{
          animate: ["none", themeAnimate, isArbitraryVariable, isArbitraryValue]
        }],
        // ------------------
        // --- Transforms ---
        // ------------------
        /**
         * Backface Visibility
         * @see https://tailwindcss.com/docs/backface-visibility
         */
        backface: [{
          backface: ["hidden", "visible"]
        }],
        /**
         * Perspective
         * @see https://tailwindcss.com/docs/perspective
         */
        perspective: [{
          perspective: [themePerspective, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Perspective Origin
         * @see https://tailwindcss.com/docs/perspective-origin
         */
        "perspective-origin": [{
          "perspective-origin": scalePositionWithArbitrary()
        }],
        /**
         * Rotate
         * @see https://tailwindcss.com/docs/rotate
         */
        rotate: [{
          rotate: scaleRotate()
        }],
        /**
         * Rotate X
         * @see https://tailwindcss.com/docs/rotate
         */
        "rotate-x": [{
          "rotate-x": scaleRotate()
        }],
        /**
         * Rotate Y
         * @see https://tailwindcss.com/docs/rotate
         */
        "rotate-y": [{
          "rotate-y": scaleRotate()
        }],
        /**
         * Rotate Z
         * @see https://tailwindcss.com/docs/rotate
         */
        "rotate-z": [{
          "rotate-z": scaleRotate()
        }],
        /**
         * Scale
         * @see https://tailwindcss.com/docs/scale
         */
        scale: [{
          scale: scaleScale()
        }],
        /**
         * Scale X
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-x": [{
          "scale-x": scaleScale()
        }],
        /**
         * Scale Y
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-y": [{
          "scale-y": scaleScale()
        }],
        /**
         * Scale Z
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-z": [{
          "scale-z": scaleScale()
        }],
        /**
         * Scale 3D
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-3d": ["scale-3d"],
        /**
         * Skew
         * @see https://tailwindcss.com/docs/skew
         */
        skew: [{
          skew: scaleSkew()
        }],
        /**
         * Skew X
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-x": [{
          "skew-x": scaleSkew()
        }],
        /**
         * Skew Y
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-y": [{
          "skew-y": scaleSkew()
        }],
        /**
         * Transform
         * @see https://tailwindcss.com/docs/transform
         */
        transform: [{
          transform: [isArbitraryVariable, isArbitraryValue, "", "none", "gpu", "cpu"]
        }],
        /**
         * Transform Origin
         * @see https://tailwindcss.com/docs/transform-origin
         */
        "transform-origin": [{
          origin: scalePositionWithArbitrary()
        }],
        /**
         * Transform Style
         * @see https://tailwindcss.com/docs/transform-style
         */
        "transform-style": [{
          transform: ["3d", "flat"]
        }],
        /**
         * Translate
         * @see https://tailwindcss.com/docs/translate
         */
        translate: [{
          translate: scaleTranslate()
        }],
        /**
         * Translate X
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-x": [{
          "translate-x": scaleTranslate()
        }],
        /**
         * Translate Y
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-y": [{
          "translate-y": scaleTranslate()
        }],
        /**
         * Translate Z
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-z": [{
          "translate-z": scaleTranslate()
        }],
        /**
         * Translate None
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-none": ["translate-none"],
        // ---------------------
        // --- Interactivity ---
        // ---------------------
        /**
         * Accent Color
         * @see https://tailwindcss.com/docs/accent-color
         */
        accent: [{
          accent: scaleColor()
        }],
        /**
         * Appearance
         * @see https://tailwindcss.com/docs/appearance
         */
        appearance: [{
          appearance: ["none", "auto"]
        }],
        /**
         * Caret Color
         * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
         */
        "caret-color": [{
          caret: scaleColor()
        }],
        /**
         * Color Scheme
         * @see https://tailwindcss.com/docs/color-scheme
         */
        "color-scheme": [{
          scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"]
        }],
        /**
         * Cursor
         * @see https://tailwindcss.com/docs/cursor
         */
        cursor: [{
          cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Field Sizing
         * @see https://tailwindcss.com/docs/field-sizing
         */
        "field-sizing": [{
          "field-sizing": ["fixed", "content"]
        }],
        /**
         * Pointer Events
         * @see https://tailwindcss.com/docs/pointer-events
         */
        "pointer-events": [{
          "pointer-events": ["auto", "none"]
        }],
        /**
         * Resize
         * @see https://tailwindcss.com/docs/resize
         */
        resize: [{
          resize: ["none", "", "y", "x"]
        }],
        /**
         * Scroll Behavior
         * @see https://tailwindcss.com/docs/scroll-behavior
         */
        "scroll-behavior": [{
          scroll: ["auto", "smooth"]
        }],
        /**
         * Scroll Margin
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-m": [{
          "scroll-m": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin X
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mx": [{
          "scroll-mx": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Y
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-my": [{
          "scroll-my": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ms": [{
          "scroll-ms": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-me": [{
          "scroll-me": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Top
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mt": [{
          "scroll-mt": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Right
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mr": [{
          "scroll-mr": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Bottom
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mb": [{
          "scroll-mb": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Margin Left
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ml": [{
          "scroll-ml": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-p": [{
          "scroll-p": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding X
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-px": [{
          "scroll-px": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Y
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-py": [{
          "scroll-py": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-ps": [{
          "scroll-ps": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pe": [{
          "scroll-pe": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Top
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pt": [{
          "scroll-pt": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Right
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pr": [{
          "scroll-pr": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Bottom
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pb": [{
          "scroll-pb": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Padding Left
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pl": [{
          "scroll-pl": scaleUnambiguousSpacing()
        }],
        /**
         * Scroll Snap Align
         * @see https://tailwindcss.com/docs/scroll-snap-align
         */
        "snap-align": [{
          snap: ["start", "end", "center", "align-none"]
        }],
        /**
         * Scroll Snap Stop
         * @see https://tailwindcss.com/docs/scroll-snap-stop
         */
        "snap-stop": [{
          snap: ["normal", "always"]
        }],
        /**
         * Scroll Snap Type
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-type": [{
          snap: ["none", "x", "y", "both"]
        }],
        /**
         * Scroll Snap Type Strictness
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-strictness": [{
          snap: ["mandatory", "proximity"]
        }],
        /**
         * Touch Action
         * @see https://tailwindcss.com/docs/touch-action
         */
        touch: [{
          touch: ["auto", "none", "manipulation"]
        }],
        /**
         * Touch Action X
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-x": [{
          "touch-pan": ["x", "left", "right"]
        }],
        /**
         * Touch Action Y
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-y": [{
          "touch-pan": ["y", "up", "down"]
        }],
        /**
         * Touch Action Pinch Zoom
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-pz": ["touch-pinch-zoom"],
        /**
         * User Select
         * @see https://tailwindcss.com/docs/user-select
         */
        select: [{
          select: ["none", "text", "all", "auto"]
        }],
        /**
         * Will Change
         * @see https://tailwindcss.com/docs/will-change
         */
        "will-change": [{
          "will-change": ["auto", "scroll", "contents", "transform", isArbitraryVariable, isArbitraryValue]
        }],
        // -----------
        // --- SVG ---
        // -----------
        /**
         * Fill
         * @see https://tailwindcss.com/docs/fill
         */
        fill: [{
          fill: ["none", ...scaleColor()]
        }],
        /**
         * Stroke Width
         * @see https://tailwindcss.com/docs/stroke-width
         */
        "stroke-w": [{
          stroke: [isNumber, isArbitraryVariableLength, isArbitraryLength, isArbitraryNumber]
        }],
        /**
         * Stroke
         * @see https://tailwindcss.com/docs/stroke
         */
        stroke: [{
          stroke: ["none", ...scaleColor()]
        }],
        // ---------------------
        // --- Accessibility ---
        // ---------------------
        /**
         * Forced Color Adjust
         * @see https://tailwindcss.com/docs/forced-color-adjust
         */
        "forced-color-adjust": [{
          "forced-color-adjust": ["auto", "none"]
        }]
      },
      conflictingClassGroups: {
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": ["border-w-x", "border-w-y", "border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": ["border-color-x", "border-color-y", "border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        translate: ["translate-x", "translate-y", "translate-none"],
        "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
        "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"]
      },
      conflictingClassGroupModifiers: {
        "font-size": ["leading"]
      },
      orderSensitiveModifiers: ["*", "**", "after", "backdrop", "before", "details-content", "file", "first-letter", "first-line", "marker", "placeholder", "selection"]
    };
  };
  var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);

  // client/src/lib/utils.ts
  function cn(...inputs) {
    return twMerge(clsx(inputs));
  }

  // client/src/components/ui/resizable.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  var ResizablePanelGroup = ({
    className,
    ...props2
  }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    PanelGroup,
    {
      className: cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      ),
      ...props2
    }
  );
  var ResizablePanel = Panel;
  var ResizableHandle = ({
    withHandle,
    className,
    ...props2
  }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    PanelResizeHandle,
    {
      className: cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      ),
      ...props2,
      children: withHandle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.GripVertical, { className: "h-2.5 w-2.5" }) })
    }
  );

  // .design-sync/previews/ResizablePanelGroup.tsx
  var import_jsx_runtime2 = __toESM(require_react_shim(), 1);
  var Surface = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      className: "bg-background text-foreground overflow-hidden rounded-md border border-border",
      style: { width: 720, height: 360 },
      children
    }
  );
  function EditorLayout() {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(ResizablePanelGroup, { direction: "horizontal", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizablePanel, { defaultSize: 22, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex h-full flex-col gap-2 p-3 text-xs", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "font-semibold", children: "Components" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "U1 · ESP32-S3" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "U2 · AMS1117" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "J1 · USB-C" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "Y1 · 40 MHz xtal" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizableHandle, { withHandle: true }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizablePanel, { defaultSize: 53, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex h-full items-center justify-center p-3 text-sm text-muted-foreground", children: "Schematic canvas" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizableHandle, { withHandle: true }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizablePanel, { defaultSize: 25, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex h-full flex-col gap-2 p-3 text-xs", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "font-semibold", children: "Inspector" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "Ref: U1" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "Footprint: QFN-56" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "Net: +3V3" })
      ] }) })
    ] }) });
  }
  function CanvasAndConsole() {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(ResizablePanelGroup, { direction: "vertical", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizablePanel, { defaultSize: 68, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "flex h-full items-center justify-center p-3 text-sm text-muted-foreground", children: "PCB layout — 4 layers" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizableHandle, { withHandle: true }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ResizablePanel, { defaultSize: 32, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "flex h-full flex-col gap-1 p-3 font-mono text-xs", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "font-semibold", children: "DRC console" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-amber-400", children: "warning: silkscreen over pad R7" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-muted-foreground", children: "info: 256 nets, 184 routed" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "text-emerald-400", children: "0 unrouted on power nets" })
      ] }) })
    ] }) });
  }
  return __toCommonJS(ResizablePanelGroup_exports);
})();
