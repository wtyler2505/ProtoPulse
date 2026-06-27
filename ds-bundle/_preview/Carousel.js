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
      function jsx5(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs3(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx5;
      module.exports.jsxs = jsxs3;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs3 : jsx5)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.ProtoPulse;
    }
  });

  // .design-sync/previews/Carousel.tsx
  var Carousel_exports = {};
  __export(Carousel_exports, {
    LayerStack: () => LayerStack,
    ModuleGallery: () => ModuleGallery
  });
  init_define_import_meta_env();

  // client/src/components/ui/carousel.tsx
  init_define_import_meta_env();
  var React4 = __toESM(require_react_shim());

  // ../../../node_modules/embla-carousel-react/esm/embla-carousel-react.esm.js
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim());

  // ../../../node_modules/embla-carousel-reactive-utils/esm/embla-carousel-reactive-utils.esm.js
  init_define_import_meta_env();
  function isObject(subject) {
    return Object.prototype.toString.call(subject) === "[object Object]";
  }
  function isRecord(subject) {
    return isObject(subject) || Array.isArray(subject);
  }
  function canUseDOM() {
    return !!(typeof window !== "undefined" && window.document && window.document.createElement);
  }
  function areOptionsEqual(optionsA, optionsB) {
    const optionsAKeys = Object.keys(optionsA);
    const optionsBKeys = Object.keys(optionsB);
    if (optionsAKeys.length !== optionsBKeys.length) return false;
    const breakpointsA = JSON.stringify(Object.keys(optionsA.breakpoints || {}));
    const breakpointsB = JSON.stringify(Object.keys(optionsB.breakpoints || {}));
    if (breakpointsA !== breakpointsB) return false;
    return optionsAKeys.every((key) => {
      const valueA = optionsA[key];
      const valueB = optionsB[key];
      if (typeof valueA === "function") return `${valueA}` === `${valueB}`;
      if (!isRecord(valueA) || !isRecord(valueB)) return valueA === valueB;
      return areOptionsEqual(valueA, valueB);
    });
  }
  function sortAndMapPluginToOptions(plugins) {
    return plugins.concat().sort((a, b) => a.name > b.name ? 1 : -1).map((plugin) => plugin.options);
  }
  function arePluginsEqual(pluginsA, pluginsB) {
    if (pluginsA.length !== pluginsB.length) return false;
    const optionsA = sortAndMapPluginToOptions(pluginsA);
    const optionsB = sortAndMapPluginToOptions(pluginsB);
    return optionsA.every((optionA, index) => {
      const optionB = optionsB[index];
      return areOptionsEqual(optionA, optionB);
    });
  }

  // ../../../node_modules/embla-carousel/esm/embla-carousel.esm.js
  init_define_import_meta_env();
  function isNumber(subject) {
    return typeof subject === "number";
  }
  function isString(subject) {
    return typeof subject === "string";
  }
  function isBoolean(subject) {
    return typeof subject === "boolean";
  }
  function isObject2(subject) {
    return Object.prototype.toString.call(subject) === "[object Object]";
  }
  function mathAbs(n) {
    return Math.abs(n);
  }
  function mathSign(n) {
    return Math.sign(n);
  }
  function deltaAbs(valueB, valueA) {
    return mathAbs(valueB - valueA);
  }
  function factorAbs(valueB, valueA) {
    if (valueB === 0 || valueA === 0) return 0;
    if (mathAbs(valueB) <= mathAbs(valueA)) return 0;
    const diff = deltaAbs(mathAbs(valueB), mathAbs(valueA));
    return mathAbs(diff / valueB);
  }
  function roundToTwoDecimals(num) {
    return Math.round(num * 100) / 100;
  }
  function arrayKeys(array) {
    return objectKeys(array).map(Number);
  }
  function arrayLast(array) {
    return array[arrayLastIndex(array)];
  }
  function arrayLastIndex(array) {
    return Math.max(0, array.length - 1);
  }
  function arrayIsLastIndex(array, index) {
    return index === arrayLastIndex(array);
  }
  function arrayFromNumber(n, startAt = 0) {
    return Array.from(Array(n), (_, i) => startAt + i);
  }
  function objectKeys(object) {
    return Object.keys(object);
  }
  function objectsMergeDeep(objectA, objectB) {
    return [objectA, objectB].reduce((mergedObjects, currentObject) => {
      objectKeys(currentObject).forEach((key) => {
        const valueA = mergedObjects[key];
        const valueB = currentObject[key];
        const areObjects = isObject2(valueA) && isObject2(valueB);
        mergedObjects[key] = areObjects ? objectsMergeDeep(valueA, valueB) : valueB;
      });
      return mergedObjects;
    }, {});
  }
  function isMouseEvent(evt, ownerWindow) {
    return typeof ownerWindow.MouseEvent !== "undefined" && evt instanceof ownerWindow.MouseEvent;
  }
  function Alignment(align, viewSize) {
    const predefined = {
      start,
      center,
      end
    };
    function start() {
      return 0;
    }
    function center(n) {
      return end(n) / 2;
    }
    function end(n) {
      return viewSize - n;
    }
    function measure(n, index) {
      if (isString(align)) return predefined[align](n);
      return align(viewSize, n, index);
    }
    const self = {
      measure
    };
    return self;
  }
  function EventStore() {
    let listeners = [];
    function add(node, type, handler, options = {
      passive: true
    }) {
      let removeListener;
      if ("addEventListener" in node) {
        node.addEventListener(type, handler, options);
        removeListener = () => node.removeEventListener(type, handler, options);
      } else {
        const legacyMediaQueryList = node;
        legacyMediaQueryList.addListener(handler);
        removeListener = () => legacyMediaQueryList.removeListener(handler);
      }
      listeners.push(removeListener);
      return self;
    }
    function clear() {
      listeners = listeners.filter((remove) => remove());
    }
    const self = {
      add,
      clear
    };
    return self;
  }
  function Animations(ownerDocument, ownerWindow, update, render) {
    const documentVisibleHandler = EventStore();
    const fixedTimeStep = 1e3 / 60;
    let lastTimeStamp = null;
    let accumulatedTime = 0;
    let animationId = 0;
    function init() {
      documentVisibleHandler.add(ownerDocument, "visibilitychange", () => {
        if (ownerDocument.hidden) reset();
      });
    }
    function destroy() {
      stop();
      documentVisibleHandler.clear();
    }
    function animate(timeStamp) {
      if (!animationId) return;
      if (!lastTimeStamp) {
        lastTimeStamp = timeStamp;
        update();
        update();
      }
      const timeElapsed = timeStamp - lastTimeStamp;
      lastTimeStamp = timeStamp;
      accumulatedTime += timeElapsed;
      while (accumulatedTime >= fixedTimeStep) {
        update();
        accumulatedTime -= fixedTimeStep;
      }
      const alpha = accumulatedTime / fixedTimeStep;
      render(alpha);
      if (animationId) {
        animationId = ownerWindow.requestAnimationFrame(animate);
      }
    }
    function start() {
      if (animationId) return;
      animationId = ownerWindow.requestAnimationFrame(animate);
    }
    function stop() {
      ownerWindow.cancelAnimationFrame(animationId);
      lastTimeStamp = null;
      accumulatedTime = 0;
      animationId = 0;
    }
    function reset() {
      lastTimeStamp = null;
      accumulatedTime = 0;
    }
    const self = {
      init,
      destroy,
      start,
      stop,
      update,
      render
    };
    return self;
  }
  function Axis(axis, contentDirection) {
    const isRightToLeft = contentDirection === "rtl";
    const isVertical = axis === "y";
    const scroll = isVertical ? "y" : "x";
    const cross = isVertical ? "x" : "y";
    const sign = !isVertical && isRightToLeft ? -1 : 1;
    const startEdge = getStartEdge();
    const endEdge = getEndEdge();
    function measureSize(nodeRect) {
      const {
        height,
        width
      } = nodeRect;
      return isVertical ? height : width;
    }
    function getStartEdge() {
      if (isVertical) return "top";
      return isRightToLeft ? "right" : "left";
    }
    function getEndEdge() {
      if (isVertical) return "bottom";
      return isRightToLeft ? "left" : "right";
    }
    function direction(n) {
      return n * sign;
    }
    const self = {
      scroll,
      cross,
      startEdge,
      endEdge,
      measureSize,
      direction
    };
    return self;
  }
  function Limit(min = 0, max = 0) {
    const length = mathAbs(min - max);
    function reachedMin(n) {
      return n < min;
    }
    function reachedMax(n) {
      return n > max;
    }
    function reachedAny(n) {
      return reachedMin(n) || reachedMax(n);
    }
    function constrain(n) {
      if (!reachedAny(n)) return n;
      return reachedMin(n) ? min : max;
    }
    function removeOffset(n) {
      if (!length) return n;
      return n - length * Math.ceil((n - max) / length);
    }
    const self = {
      length,
      max,
      min,
      constrain,
      reachedAny,
      reachedMax,
      reachedMin,
      removeOffset
    };
    return self;
  }
  function Counter(max, start, loop) {
    const {
      constrain
    } = Limit(0, max);
    const loopEnd = max + 1;
    let counter = withinLimit(start);
    function withinLimit(n) {
      return !loop ? constrain(n) : mathAbs((loopEnd + n) % loopEnd);
    }
    function get() {
      return counter;
    }
    function set(n) {
      counter = withinLimit(n);
      return self;
    }
    function add(n) {
      return clone().set(get() + n);
    }
    function clone() {
      return Counter(max, get(), loop);
    }
    const self = {
      get,
      set,
      add,
      clone
    };
    return self;
  }
  function DragHandler(axis, rootNode, ownerDocument, ownerWindow, target, dragTracker, location, animation, scrollTo, scrollBody, scrollTarget, index, eventHandler, percentOfView, dragFree, dragThreshold, skipSnaps, baseFriction, watchDrag) {
    const {
      cross: crossAxis,
      direction
    } = axis;
    const focusNodes = ["INPUT", "SELECT", "TEXTAREA"];
    const nonPassiveEvent = {
      passive: false
    };
    const initEvents = EventStore();
    const dragEvents = EventStore();
    const goToNextThreshold = Limit(50, 225).constrain(percentOfView.measure(20));
    const snapForceBoost = {
      mouse: 300,
      touch: 400
    };
    const freeForceBoost = {
      mouse: 500,
      touch: 600
    };
    const baseSpeed = dragFree ? 43 : 25;
    let isMoving = false;
    let startScroll = 0;
    let startCross = 0;
    let pointerIsDown = false;
    let preventScroll = false;
    let preventClick = false;
    let isMouse = false;
    function init(emblaApi) {
      if (!watchDrag) return;
      function downIfAllowed(evt) {
        if (isBoolean(watchDrag) || watchDrag(emblaApi, evt)) down(evt);
      }
      const node = rootNode;
      initEvents.add(node, "dragstart", (evt) => evt.preventDefault(), nonPassiveEvent).add(node, "touchmove", () => void 0, nonPassiveEvent).add(node, "touchend", () => void 0).add(node, "touchstart", downIfAllowed).add(node, "mousedown", downIfAllowed).add(node, "touchcancel", up).add(node, "contextmenu", up).add(node, "click", click, true);
    }
    function destroy() {
      initEvents.clear();
      dragEvents.clear();
    }
    function addDragEvents() {
      const node = isMouse ? ownerDocument : rootNode;
      dragEvents.add(node, "touchmove", move, nonPassiveEvent).add(node, "touchend", up).add(node, "mousemove", move, nonPassiveEvent).add(node, "mouseup", up);
    }
    function isFocusNode(node) {
      const nodeName = node.nodeName || "";
      return focusNodes.includes(nodeName);
    }
    function forceBoost() {
      const boost = dragFree ? freeForceBoost : snapForceBoost;
      const type = isMouse ? "mouse" : "touch";
      return boost[type];
    }
    function allowedForce(force, targetChanged) {
      const next = index.add(mathSign(force) * -1);
      const baseForce = scrollTarget.byDistance(force, !dragFree).distance;
      if (dragFree || mathAbs(force) < goToNextThreshold) return baseForce;
      if (skipSnaps && targetChanged) return baseForce * 0.5;
      return scrollTarget.byIndex(next.get(), 0).distance;
    }
    function down(evt) {
      const isMouseEvt = isMouseEvent(evt, ownerWindow);
      isMouse = isMouseEvt;
      preventClick = dragFree && isMouseEvt && !evt.buttons && isMoving;
      isMoving = deltaAbs(target.get(), location.get()) >= 2;
      if (isMouseEvt && evt.button !== 0) return;
      if (isFocusNode(evt.target)) return;
      pointerIsDown = true;
      dragTracker.pointerDown(evt);
      scrollBody.useFriction(0).useDuration(0);
      target.set(location);
      addDragEvents();
      startScroll = dragTracker.readPoint(evt);
      startCross = dragTracker.readPoint(evt, crossAxis);
      eventHandler.emit("pointerDown");
    }
    function move(evt) {
      const isTouchEvt = !isMouseEvent(evt, ownerWindow);
      if (isTouchEvt && evt.touches.length >= 2) return up(evt);
      const lastScroll = dragTracker.readPoint(evt);
      const lastCross = dragTracker.readPoint(evt, crossAxis);
      const diffScroll = deltaAbs(lastScroll, startScroll);
      const diffCross = deltaAbs(lastCross, startCross);
      if (!preventScroll && !isMouse) {
        if (!evt.cancelable) return up(evt);
        preventScroll = diffScroll > diffCross;
        if (!preventScroll) return up(evt);
      }
      const diff = dragTracker.pointerMove(evt);
      if (diffScroll > dragThreshold) preventClick = true;
      scrollBody.useFriction(0.3).useDuration(0.75);
      animation.start();
      target.add(direction(diff));
      evt.preventDefault();
    }
    function up(evt) {
      const currentLocation = scrollTarget.byDistance(0, false);
      const targetChanged = currentLocation.index !== index.get();
      const rawForce = dragTracker.pointerUp(evt) * forceBoost();
      const force = allowedForce(direction(rawForce), targetChanged);
      const forceFactor = factorAbs(rawForce, force);
      const speed = baseSpeed - 10 * forceFactor;
      const friction = baseFriction + forceFactor / 50;
      preventScroll = false;
      pointerIsDown = false;
      dragEvents.clear();
      scrollBody.useDuration(speed).useFriction(friction);
      scrollTo.distance(force, !dragFree);
      isMouse = false;
      eventHandler.emit("pointerUp");
    }
    function click(evt) {
      if (preventClick) {
        evt.stopPropagation();
        evt.preventDefault();
        preventClick = false;
      }
    }
    function pointerDown() {
      return pointerIsDown;
    }
    const self = {
      init,
      destroy,
      pointerDown
    };
    return self;
  }
  function DragTracker(axis, ownerWindow) {
    const logInterval = 170;
    let startEvent;
    let lastEvent;
    function readTime(evt) {
      return evt.timeStamp;
    }
    function readPoint(evt, evtAxis) {
      const property = evtAxis || axis.scroll;
      const coord = `client${property === "x" ? "X" : "Y"}`;
      return (isMouseEvent(evt, ownerWindow) ? evt : evt.touches[0])[coord];
    }
    function pointerDown(evt) {
      startEvent = evt;
      lastEvent = evt;
      return readPoint(evt);
    }
    function pointerMove(evt) {
      const diff = readPoint(evt) - readPoint(lastEvent);
      const expired = readTime(evt) - readTime(startEvent) > logInterval;
      lastEvent = evt;
      if (expired) startEvent = evt;
      return diff;
    }
    function pointerUp(evt) {
      if (!startEvent || !lastEvent) return 0;
      const diffDrag = readPoint(lastEvent) - readPoint(startEvent);
      const diffTime = readTime(evt) - readTime(startEvent);
      const expired = readTime(evt) - readTime(lastEvent) > logInterval;
      const force = diffDrag / diffTime;
      const isFlick = diffTime && !expired && mathAbs(force) > 0.1;
      return isFlick ? force : 0;
    }
    const self = {
      pointerDown,
      pointerMove,
      pointerUp,
      readPoint
    };
    return self;
  }
  function NodeRects() {
    function measure(node) {
      const {
        offsetTop,
        offsetLeft,
        offsetWidth,
        offsetHeight
      } = node;
      const offset = {
        top: offsetTop,
        right: offsetLeft + offsetWidth,
        bottom: offsetTop + offsetHeight,
        left: offsetLeft,
        width: offsetWidth,
        height: offsetHeight
      };
      return offset;
    }
    const self = {
      measure
    };
    return self;
  }
  function PercentOfView(viewSize) {
    function measure(n) {
      return viewSize * (n / 100);
    }
    const self = {
      measure
    };
    return self;
  }
  function ResizeHandler(container, eventHandler, ownerWindow, slides, axis, watchResize, nodeRects) {
    const observeNodes = [container].concat(slides);
    let resizeObserver;
    let containerSize;
    let slideSizes = [];
    let destroyed = false;
    function readSize(node) {
      return axis.measureSize(nodeRects.measure(node));
    }
    function init(emblaApi) {
      if (!watchResize) return;
      containerSize = readSize(container);
      slideSizes = slides.map(readSize);
      function defaultCallback(entries) {
        for (const entry of entries) {
          if (destroyed) return;
          const isContainer = entry.target === container;
          const slideIndex = slides.indexOf(entry.target);
          const lastSize = isContainer ? containerSize : slideSizes[slideIndex];
          const newSize = readSize(isContainer ? container : slides[slideIndex]);
          const diffSize = mathAbs(newSize - lastSize);
          if (diffSize >= 0.5) {
            emblaApi.reInit();
            eventHandler.emit("resize");
            break;
          }
        }
      }
      resizeObserver = new ResizeObserver((entries) => {
        if (isBoolean(watchResize) || watchResize(emblaApi, entries)) {
          defaultCallback(entries);
        }
      });
      ownerWindow.requestAnimationFrame(() => {
        observeNodes.forEach((node) => resizeObserver.observe(node));
      });
    }
    function destroy() {
      destroyed = true;
      if (resizeObserver) resizeObserver.disconnect();
    }
    const self = {
      init,
      destroy
    };
    return self;
  }
  function ScrollBody(location, offsetLocation, previousLocation, target, baseDuration, baseFriction) {
    let scrollVelocity = 0;
    let scrollDirection = 0;
    let scrollDuration = baseDuration;
    let scrollFriction = baseFriction;
    let rawLocation = location.get();
    let rawLocationPrevious = 0;
    function seek() {
      const displacement = target.get() - location.get();
      const isInstant = !scrollDuration;
      let scrollDistance = 0;
      if (isInstant) {
        scrollVelocity = 0;
        previousLocation.set(target);
        location.set(target);
        scrollDistance = displacement;
      } else {
        previousLocation.set(location);
        scrollVelocity += displacement / scrollDuration;
        scrollVelocity *= scrollFriction;
        rawLocation += scrollVelocity;
        location.add(scrollVelocity);
        scrollDistance = rawLocation - rawLocationPrevious;
      }
      scrollDirection = mathSign(scrollDistance);
      rawLocationPrevious = rawLocation;
      return self;
    }
    function settled() {
      const diff = target.get() - offsetLocation.get();
      return mathAbs(diff) < 1e-3;
    }
    function duration() {
      return scrollDuration;
    }
    function direction() {
      return scrollDirection;
    }
    function velocity() {
      return scrollVelocity;
    }
    function useBaseDuration() {
      return useDuration(baseDuration);
    }
    function useBaseFriction() {
      return useFriction(baseFriction);
    }
    function useDuration(n) {
      scrollDuration = n;
      return self;
    }
    function useFriction(n) {
      scrollFriction = n;
      return self;
    }
    const self = {
      direction,
      duration,
      velocity,
      seek,
      settled,
      useBaseFriction,
      useBaseDuration,
      useFriction,
      useDuration
    };
    return self;
  }
  function ScrollBounds(limit, location, target, scrollBody, percentOfView) {
    const pullBackThreshold = percentOfView.measure(10);
    const edgeOffsetTolerance = percentOfView.measure(50);
    const frictionLimit = Limit(0.1, 0.99);
    let disabled = false;
    function shouldConstrain() {
      if (disabled) return false;
      if (!limit.reachedAny(target.get())) return false;
      if (!limit.reachedAny(location.get())) return false;
      return true;
    }
    function constrain(pointerDown) {
      if (!shouldConstrain()) return;
      const edge = limit.reachedMin(location.get()) ? "min" : "max";
      const diffToEdge = mathAbs(limit[edge] - location.get());
      const diffToTarget = target.get() - location.get();
      const friction = frictionLimit.constrain(diffToEdge / edgeOffsetTolerance);
      target.subtract(diffToTarget * friction);
      if (!pointerDown && mathAbs(diffToTarget) < pullBackThreshold) {
        target.set(limit.constrain(target.get()));
        scrollBody.useDuration(25).useBaseFriction();
      }
    }
    function toggleActive(active) {
      disabled = !active;
    }
    const self = {
      shouldConstrain,
      constrain,
      toggleActive
    };
    return self;
  }
  function ScrollContain(viewSize, contentSize, snapsAligned, containScroll, pixelTolerance) {
    const scrollBounds = Limit(-contentSize + viewSize, 0);
    const snapsBounded = measureBounded();
    const scrollContainLimit = findScrollContainLimit();
    const snapsContained = measureContained();
    function usePixelTolerance(bound, snap) {
      return deltaAbs(bound, snap) <= 1;
    }
    function findScrollContainLimit() {
      const startSnap = snapsBounded[0];
      const endSnap = arrayLast(snapsBounded);
      const min = snapsBounded.lastIndexOf(startSnap);
      const max = snapsBounded.indexOf(endSnap) + 1;
      return Limit(min, max);
    }
    function measureBounded() {
      return snapsAligned.map((snapAligned, index) => {
        const {
          min,
          max
        } = scrollBounds;
        const snap = scrollBounds.constrain(snapAligned);
        const isFirst = !index;
        const isLast = arrayIsLastIndex(snapsAligned, index);
        if (isFirst) return max;
        if (isLast) return min;
        if (usePixelTolerance(min, snap)) return min;
        if (usePixelTolerance(max, snap)) return max;
        return snap;
      }).map((scrollBound) => parseFloat(scrollBound.toFixed(3)));
    }
    function measureContained() {
      if (contentSize <= viewSize + pixelTolerance) return [scrollBounds.max];
      if (containScroll === "keepSnaps") return snapsBounded;
      const {
        min,
        max
      } = scrollContainLimit;
      return snapsBounded.slice(min, max);
    }
    const self = {
      snapsContained,
      scrollContainLimit
    };
    return self;
  }
  function ScrollLimit(contentSize, scrollSnaps, loop) {
    const max = scrollSnaps[0];
    const min = loop ? max - contentSize : arrayLast(scrollSnaps);
    const limit = Limit(min, max);
    const self = {
      limit
    };
    return self;
  }
  function ScrollLooper(contentSize, limit, location, vectors) {
    const jointSafety = 0.1;
    const min = limit.min + jointSafety;
    const max = limit.max + jointSafety;
    const {
      reachedMin,
      reachedMax
    } = Limit(min, max);
    function shouldLoop(direction) {
      if (direction === 1) return reachedMax(location.get());
      if (direction === -1) return reachedMin(location.get());
      return false;
    }
    function loop(direction) {
      if (!shouldLoop(direction)) return;
      const loopDistance = contentSize * (direction * -1);
      vectors.forEach((v) => v.add(loopDistance));
    }
    const self = {
      loop
    };
    return self;
  }
  function ScrollProgress(limit) {
    const {
      max,
      length
    } = limit;
    function get(n) {
      const currentLocation = n - max;
      return length ? currentLocation / -length : 0;
    }
    const self = {
      get
    };
    return self;
  }
  function ScrollSnaps(axis, alignment, containerRect, slideRects, slidesToScroll) {
    const {
      startEdge,
      endEdge
    } = axis;
    const {
      groupSlides
    } = slidesToScroll;
    const alignments = measureSizes().map(alignment.measure);
    const snaps = measureUnaligned();
    const snapsAligned = measureAligned();
    function measureSizes() {
      return groupSlides(slideRects).map((rects) => arrayLast(rects)[endEdge] - rects[0][startEdge]).map(mathAbs);
    }
    function measureUnaligned() {
      return slideRects.map((rect) => containerRect[startEdge] - rect[startEdge]).map((snap) => -mathAbs(snap));
    }
    function measureAligned() {
      return groupSlides(snaps).map((g2) => g2[0]).map((snap, index) => snap + alignments[index]);
    }
    const self = {
      snaps,
      snapsAligned
    };
    return self;
  }
  function SlideRegistry(containSnaps, containScroll, scrollSnaps, scrollContainLimit, slidesToScroll, slideIndexes) {
    const {
      groupSlides
    } = slidesToScroll;
    const {
      min,
      max
    } = scrollContainLimit;
    const slideRegistry = createSlideRegistry();
    function createSlideRegistry() {
      const groupedSlideIndexes = groupSlides(slideIndexes);
      const doNotContain = !containSnaps || containScroll === "keepSnaps";
      if (scrollSnaps.length === 1) return [slideIndexes];
      if (doNotContain) return groupedSlideIndexes;
      return groupedSlideIndexes.slice(min, max).map((group, index, groups) => {
        const isFirst = !index;
        const isLast = arrayIsLastIndex(groups, index);
        if (isFirst) {
          const range = arrayLast(groups[0]) + 1;
          return arrayFromNumber(range);
        }
        if (isLast) {
          const range = arrayLastIndex(slideIndexes) - arrayLast(groups)[0] + 1;
          return arrayFromNumber(range, arrayLast(groups)[0]);
        }
        return group;
      });
    }
    const self = {
      slideRegistry
    };
    return self;
  }
  function ScrollTarget(loop, scrollSnaps, contentSize, limit, targetVector) {
    const {
      reachedAny,
      removeOffset,
      constrain
    } = limit;
    function minDistance(distances) {
      return distances.concat().sort((a, b) => mathAbs(a) - mathAbs(b))[0];
    }
    function findTargetSnap(target) {
      const distance = loop ? removeOffset(target) : constrain(target);
      const ascDiffsToSnaps = scrollSnaps.map((snap, index2) => ({
        diff: shortcut(snap - distance, 0),
        index: index2
      })).sort((d1, d2) => mathAbs(d1.diff) - mathAbs(d2.diff));
      const {
        index
      } = ascDiffsToSnaps[0];
      return {
        index,
        distance
      };
    }
    function shortcut(target, direction) {
      const targets = [target, target + contentSize, target - contentSize];
      if (!loop) return target;
      if (!direction) return minDistance(targets);
      const matchingTargets = targets.filter((t) => mathSign(t) === direction);
      if (matchingTargets.length) return minDistance(matchingTargets);
      return arrayLast(targets) - contentSize;
    }
    function byIndex(index, direction) {
      const diffToSnap = scrollSnaps[index] - targetVector.get();
      const distance = shortcut(diffToSnap, direction);
      return {
        index,
        distance
      };
    }
    function byDistance(distance, snap) {
      const target = targetVector.get() + distance;
      const {
        index,
        distance: targetSnapDistance
      } = findTargetSnap(target);
      const reachedBound = !loop && reachedAny(target);
      if (!snap || reachedBound) return {
        index,
        distance
      };
      const diffToSnap = scrollSnaps[index] - targetSnapDistance;
      const snapDistance = distance + shortcut(diffToSnap, 0);
      return {
        index,
        distance: snapDistance
      };
    }
    const self = {
      byDistance,
      byIndex,
      shortcut
    };
    return self;
  }
  function ScrollTo(animation, indexCurrent, indexPrevious, scrollBody, scrollTarget, targetVector, eventHandler) {
    function scrollTo(target) {
      const distanceDiff = target.distance;
      const indexDiff = target.index !== indexCurrent.get();
      targetVector.add(distanceDiff);
      if (distanceDiff) {
        if (scrollBody.duration()) {
          animation.start();
        } else {
          animation.update();
          animation.render(1);
          animation.update();
        }
      }
      if (indexDiff) {
        indexPrevious.set(indexCurrent.get());
        indexCurrent.set(target.index);
        eventHandler.emit("select");
      }
    }
    function distance(n, snap) {
      const target = scrollTarget.byDistance(n, snap);
      scrollTo(target);
    }
    function index(n, direction) {
      const targetIndex = indexCurrent.clone().set(n);
      const target = scrollTarget.byIndex(targetIndex.get(), direction);
      scrollTo(target);
    }
    const self = {
      distance,
      index
    };
    return self;
  }
  function SlideFocus(root, slides, slideRegistry, scrollTo, scrollBody, eventStore, eventHandler, watchFocus) {
    const focusListenerOptions = {
      passive: true,
      capture: true
    };
    let lastTabPressTime = 0;
    function init(emblaApi) {
      if (!watchFocus) return;
      function defaultCallback(index) {
        const nowTime = (/* @__PURE__ */ new Date()).getTime();
        const diffTime = nowTime - lastTabPressTime;
        if (diffTime > 10) return;
        eventHandler.emit("slideFocusStart");
        root.scrollLeft = 0;
        const group = slideRegistry.findIndex((group2) => group2.includes(index));
        if (!isNumber(group)) return;
        scrollBody.useDuration(0);
        scrollTo.index(group, 0);
        eventHandler.emit("slideFocus");
      }
      eventStore.add(document, "keydown", registerTabPress, false);
      slides.forEach((slide, slideIndex) => {
        eventStore.add(slide, "focus", (evt) => {
          if (isBoolean(watchFocus) || watchFocus(emblaApi, evt)) {
            defaultCallback(slideIndex);
          }
        }, focusListenerOptions);
      });
    }
    function registerTabPress(event) {
      if (event.code === "Tab") lastTabPressTime = (/* @__PURE__ */ new Date()).getTime();
    }
    const self = {
      init
    };
    return self;
  }
  function Vector1D(initialValue) {
    let value = initialValue;
    function get() {
      return value;
    }
    function set(n) {
      value = normalizeInput(n);
    }
    function add(n) {
      value += normalizeInput(n);
    }
    function subtract(n) {
      value -= normalizeInput(n);
    }
    function normalizeInput(n) {
      return isNumber(n) ? n : n.get();
    }
    const self = {
      get,
      set,
      add,
      subtract
    };
    return self;
  }
  function Translate(axis, container) {
    const translate = axis.scroll === "x" ? x : y;
    const containerStyle = container.style;
    let previousTarget = null;
    let disabled = false;
    function x(n) {
      return `translate3d(${n}px,0px,0px)`;
    }
    function y(n) {
      return `translate3d(0px,${n}px,0px)`;
    }
    function to(target) {
      if (disabled) return;
      const newTarget = roundToTwoDecimals(axis.direction(target));
      if (newTarget === previousTarget) return;
      containerStyle.transform = translate(newTarget);
      previousTarget = newTarget;
    }
    function toggleActive(active) {
      disabled = !active;
    }
    function clear() {
      if (disabled) return;
      containerStyle.transform = "";
      if (!container.getAttribute("style")) container.removeAttribute("style");
    }
    const self = {
      clear,
      to,
      toggleActive
    };
    return self;
  }
  function SlideLooper(axis, viewSize, contentSize, slideSizes, slideSizesWithGaps, snaps, scrollSnaps, location, slides) {
    const roundingSafety = 0.5;
    const ascItems = arrayKeys(slideSizesWithGaps);
    const descItems = arrayKeys(slideSizesWithGaps).reverse();
    const loopPoints = startPoints().concat(endPoints());
    function removeSlideSizes(indexes, from) {
      return indexes.reduce((a, i) => {
        return a - slideSizesWithGaps[i];
      }, from);
    }
    function slidesInGap(indexes, gap) {
      return indexes.reduce((a, i) => {
        const remainingGap = removeSlideSizes(a, gap);
        return remainingGap > 0 ? a.concat([i]) : a;
      }, []);
    }
    function findSlideBounds(offset) {
      return snaps.map((snap, index) => ({
        start: snap - slideSizes[index] + roundingSafety + offset,
        end: snap + viewSize - roundingSafety + offset
      }));
    }
    function findLoopPoints(indexes, offset, isEndEdge) {
      const slideBounds = findSlideBounds(offset);
      return indexes.map((index) => {
        const initial = isEndEdge ? 0 : -contentSize;
        const altered = isEndEdge ? contentSize : 0;
        const boundEdge = isEndEdge ? "end" : "start";
        const loopPoint = slideBounds[index][boundEdge];
        return {
          index,
          loopPoint,
          slideLocation: Vector1D(-1),
          translate: Translate(axis, slides[index]),
          target: () => location.get() > loopPoint ? initial : altered
        };
      });
    }
    function startPoints() {
      const gap = scrollSnaps[0];
      const indexes = slidesInGap(descItems, gap);
      return findLoopPoints(indexes, contentSize, false);
    }
    function endPoints() {
      const gap = viewSize - scrollSnaps[0] - 1;
      const indexes = slidesInGap(ascItems, gap);
      return findLoopPoints(indexes, -contentSize, true);
    }
    function canLoop() {
      return loopPoints.every(({
        index
      }) => {
        const otherIndexes = ascItems.filter((i) => i !== index);
        return removeSlideSizes(otherIndexes, viewSize) <= 0.1;
      });
    }
    function loop() {
      loopPoints.forEach((loopPoint) => {
        const {
          target,
          translate,
          slideLocation
        } = loopPoint;
        const shiftLocation = target();
        if (shiftLocation === slideLocation.get()) return;
        translate.to(shiftLocation);
        slideLocation.set(shiftLocation);
      });
    }
    function clear() {
      loopPoints.forEach((loopPoint) => loopPoint.translate.clear());
    }
    const self = {
      canLoop,
      clear,
      loop,
      loopPoints
    };
    return self;
  }
  function SlidesHandler(container, eventHandler, watchSlides) {
    let mutationObserver;
    let destroyed = false;
    function init(emblaApi) {
      if (!watchSlides) return;
      function defaultCallback(mutations) {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            emblaApi.reInit();
            eventHandler.emit("slidesChanged");
            break;
          }
        }
      }
      mutationObserver = new MutationObserver((mutations) => {
        if (destroyed) return;
        if (isBoolean(watchSlides) || watchSlides(emblaApi, mutations)) {
          defaultCallback(mutations);
        }
      });
      mutationObserver.observe(container, {
        childList: true
      });
    }
    function destroy() {
      if (mutationObserver) mutationObserver.disconnect();
      destroyed = true;
    }
    const self = {
      init,
      destroy
    };
    return self;
  }
  function SlidesInView(container, slides, eventHandler, threshold) {
    const intersectionEntryMap = {};
    let inViewCache = null;
    let notInViewCache = null;
    let intersectionObserver;
    let destroyed = false;
    function init() {
      intersectionObserver = new IntersectionObserver((entries) => {
        if (destroyed) return;
        entries.forEach((entry) => {
          const index = slides.indexOf(entry.target);
          intersectionEntryMap[index] = entry;
        });
        inViewCache = null;
        notInViewCache = null;
        eventHandler.emit("slidesInView");
      }, {
        root: container.parentElement,
        threshold
      });
      slides.forEach((slide) => intersectionObserver.observe(slide));
    }
    function destroy() {
      if (intersectionObserver) intersectionObserver.disconnect();
      destroyed = true;
    }
    function createInViewList(inView) {
      return objectKeys(intersectionEntryMap).reduce((list, slideIndex) => {
        const index = parseInt(slideIndex);
        const {
          isIntersecting
        } = intersectionEntryMap[index];
        const inViewMatch = inView && isIntersecting;
        const notInViewMatch = !inView && !isIntersecting;
        if (inViewMatch || notInViewMatch) list.push(index);
        return list;
      }, []);
    }
    function get(inView = true) {
      if (inView && inViewCache) return inViewCache;
      if (!inView && notInViewCache) return notInViewCache;
      const slideIndexes = createInViewList(inView);
      if (inView) inViewCache = slideIndexes;
      if (!inView) notInViewCache = slideIndexes;
      return slideIndexes;
    }
    const self = {
      init,
      destroy,
      get
    };
    return self;
  }
  function SlideSizes(axis, containerRect, slideRects, slides, readEdgeGap, ownerWindow) {
    const {
      measureSize,
      startEdge,
      endEdge
    } = axis;
    const withEdgeGap = slideRects[0] && readEdgeGap;
    const startGap = measureStartGap();
    const endGap = measureEndGap();
    const slideSizes = slideRects.map(measureSize);
    const slideSizesWithGaps = measureWithGaps();
    function measureStartGap() {
      if (!withEdgeGap) return 0;
      const slideRect = slideRects[0];
      return mathAbs(containerRect[startEdge] - slideRect[startEdge]);
    }
    function measureEndGap() {
      if (!withEdgeGap) return 0;
      const style = ownerWindow.getComputedStyle(arrayLast(slides));
      return parseFloat(style.getPropertyValue(`margin-${endEdge}`));
    }
    function measureWithGaps() {
      return slideRects.map((rect, index, rects) => {
        const isFirst = !index;
        const isLast = arrayIsLastIndex(rects, index);
        if (isFirst) return slideSizes[index] + startGap;
        if (isLast) return slideSizes[index] + endGap;
        return rects[index + 1][startEdge] - rect[startEdge];
      }).map(mathAbs);
    }
    const self = {
      slideSizes,
      slideSizesWithGaps,
      startGap,
      endGap
    };
    return self;
  }
  function SlidesToScroll(axis, viewSize, slidesToScroll, loop, containerRect, slideRects, startGap, endGap, pixelTolerance) {
    const {
      startEdge,
      endEdge,
      direction
    } = axis;
    const groupByNumber = isNumber(slidesToScroll);
    function byNumber(array, groupSize) {
      return arrayKeys(array).filter((i) => i % groupSize === 0).map((i) => array.slice(i, i + groupSize));
    }
    function bySize(array) {
      if (!array.length) return [];
      return arrayKeys(array).reduce((groups, rectB, index) => {
        const rectA = arrayLast(groups) || 0;
        const isFirst = rectA === 0;
        const isLast = rectB === arrayLastIndex(array);
        const edgeA = containerRect[startEdge] - slideRects[rectA][startEdge];
        const edgeB = containerRect[startEdge] - slideRects[rectB][endEdge];
        const gapA = !loop && isFirst ? direction(startGap) : 0;
        const gapB = !loop && isLast ? direction(endGap) : 0;
        const chunkSize = mathAbs(edgeB - gapB - (edgeA + gapA));
        if (index && chunkSize > viewSize + pixelTolerance) groups.push(rectB);
        if (isLast) groups.push(array.length);
        return groups;
      }, []).map((currentSize, index, groups) => {
        const previousSize = Math.max(groups[index - 1] || 0);
        return array.slice(previousSize, currentSize);
      });
    }
    function groupSlides(array) {
      return groupByNumber ? byNumber(array, slidesToScroll) : bySize(array);
    }
    const self = {
      groupSlides
    };
    return self;
  }
  function Engine(root, container, slides, ownerDocument, ownerWindow, options, eventHandler) {
    const {
      align,
      axis: scrollAxis,
      direction,
      startIndex,
      loop,
      duration,
      dragFree,
      dragThreshold,
      inViewThreshold,
      slidesToScroll: groupSlides,
      skipSnaps,
      containScroll,
      watchResize,
      watchSlides,
      watchDrag,
      watchFocus
    } = options;
    const pixelTolerance = 2;
    const nodeRects = NodeRects();
    const containerRect = nodeRects.measure(container);
    const slideRects = slides.map(nodeRects.measure);
    const axis = Axis(scrollAxis, direction);
    const viewSize = axis.measureSize(containerRect);
    const percentOfView = PercentOfView(viewSize);
    const alignment = Alignment(align, viewSize);
    const containSnaps = !loop && !!containScroll;
    const readEdgeGap = loop || !!containScroll;
    const {
      slideSizes,
      slideSizesWithGaps,
      startGap,
      endGap
    } = SlideSizes(axis, containerRect, slideRects, slides, readEdgeGap, ownerWindow);
    const slidesToScroll = SlidesToScroll(axis, viewSize, groupSlides, loop, containerRect, slideRects, startGap, endGap, pixelTolerance);
    const {
      snaps,
      snapsAligned
    } = ScrollSnaps(axis, alignment, containerRect, slideRects, slidesToScroll);
    const contentSize = -arrayLast(snaps) + arrayLast(slideSizesWithGaps);
    const {
      snapsContained,
      scrollContainLimit
    } = ScrollContain(viewSize, contentSize, snapsAligned, containScroll, pixelTolerance);
    const scrollSnaps = containSnaps ? snapsContained : snapsAligned;
    const {
      limit
    } = ScrollLimit(contentSize, scrollSnaps, loop);
    const index = Counter(arrayLastIndex(scrollSnaps), startIndex, loop);
    const indexPrevious = index.clone();
    const slideIndexes = arrayKeys(slides);
    const update = ({
      dragHandler,
      scrollBody: scrollBody2,
      scrollBounds,
      options: {
        loop: loop2
      }
    }) => {
      if (!loop2) scrollBounds.constrain(dragHandler.pointerDown());
      scrollBody2.seek();
    };
    const render = ({
      scrollBody: scrollBody2,
      translate,
      location: location2,
      offsetLocation: offsetLocation2,
      previousLocation: previousLocation2,
      scrollLooper,
      slideLooper,
      dragHandler,
      animation: animation2,
      eventHandler: eventHandler2,
      scrollBounds,
      options: {
        loop: loop2
      }
    }, alpha) => {
      const shouldSettle = scrollBody2.settled();
      const withinBounds = !scrollBounds.shouldConstrain();
      const hasSettled = loop2 ? shouldSettle : shouldSettle && withinBounds;
      const hasSettledAndIdle = hasSettled && !dragHandler.pointerDown();
      if (hasSettledAndIdle) animation2.stop();
      const interpolatedLocation = location2.get() * alpha + previousLocation2.get() * (1 - alpha);
      offsetLocation2.set(interpolatedLocation);
      if (loop2) {
        scrollLooper.loop(scrollBody2.direction());
        slideLooper.loop();
      }
      translate.to(offsetLocation2.get());
      if (hasSettledAndIdle) eventHandler2.emit("settle");
      if (!hasSettled) eventHandler2.emit("scroll");
    };
    const animation = Animations(ownerDocument, ownerWindow, () => update(engine), (alpha) => render(engine, alpha));
    const friction = 0.68;
    const startLocation = scrollSnaps[index.get()];
    const location = Vector1D(startLocation);
    const previousLocation = Vector1D(startLocation);
    const offsetLocation = Vector1D(startLocation);
    const target = Vector1D(startLocation);
    const scrollBody = ScrollBody(location, offsetLocation, previousLocation, target, duration, friction);
    const scrollTarget = ScrollTarget(loop, scrollSnaps, contentSize, limit, target);
    const scrollTo = ScrollTo(animation, index, indexPrevious, scrollBody, scrollTarget, target, eventHandler);
    const scrollProgress = ScrollProgress(limit);
    const eventStore = EventStore();
    const slidesInView = SlidesInView(container, slides, eventHandler, inViewThreshold);
    const {
      slideRegistry
    } = SlideRegistry(containSnaps, containScroll, scrollSnaps, scrollContainLimit, slidesToScroll, slideIndexes);
    const slideFocus = SlideFocus(root, slides, slideRegistry, scrollTo, scrollBody, eventStore, eventHandler, watchFocus);
    const engine = {
      ownerDocument,
      ownerWindow,
      eventHandler,
      containerRect,
      slideRects,
      animation,
      axis,
      dragHandler: DragHandler(axis, root, ownerDocument, ownerWindow, target, DragTracker(axis, ownerWindow), location, animation, scrollTo, scrollBody, scrollTarget, index, eventHandler, percentOfView, dragFree, dragThreshold, skipSnaps, friction, watchDrag),
      eventStore,
      percentOfView,
      index,
      indexPrevious,
      limit,
      location,
      offsetLocation,
      previousLocation,
      options,
      resizeHandler: ResizeHandler(container, eventHandler, ownerWindow, slides, axis, watchResize, nodeRects),
      scrollBody,
      scrollBounds: ScrollBounds(limit, offsetLocation, target, scrollBody, percentOfView),
      scrollLooper: ScrollLooper(contentSize, limit, offsetLocation, [location, offsetLocation, previousLocation, target]),
      scrollProgress,
      scrollSnapList: scrollSnaps.map(scrollProgress.get),
      scrollSnaps,
      scrollTarget,
      scrollTo,
      slideLooper: SlideLooper(axis, viewSize, contentSize, slideSizes, slideSizesWithGaps, snaps, scrollSnaps, offsetLocation, slides),
      slideFocus,
      slidesHandler: SlidesHandler(container, eventHandler, watchSlides),
      slidesInView,
      slideIndexes,
      slideRegistry,
      slidesToScroll,
      target,
      translate: Translate(axis, container)
    };
    return engine;
  }
  function EventHandler() {
    let listeners = {};
    let api;
    function init(emblaApi) {
      api = emblaApi;
    }
    function getListeners(evt) {
      return listeners[evt] || [];
    }
    function emit(evt) {
      getListeners(evt).forEach((e) => e(api, evt));
      return self;
    }
    function on(evt, cb) {
      listeners[evt] = getListeners(evt).concat([cb]);
      return self;
    }
    function off(evt, cb) {
      listeners[evt] = getListeners(evt).filter((e) => e !== cb);
      return self;
    }
    function clear() {
      listeners = {};
    }
    const self = {
      init,
      emit,
      off,
      on,
      clear
    };
    return self;
  }
  var defaultOptions = {
    align: "center",
    axis: "x",
    container: null,
    slides: null,
    containScroll: "trimSnaps",
    direction: "ltr",
    slidesToScroll: 1,
    inViewThreshold: 0,
    breakpoints: {},
    dragFree: false,
    dragThreshold: 10,
    loop: false,
    skipSnaps: false,
    duration: 25,
    startIndex: 0,
    active: true,
    watchDrag: true,
    watchResize: true,
    watchSlides: true,
    watchFocus: true
  };
  function OptionsHandler(ownerWindow) {
    function mergeOptions(optionsA, optionsB) {
      return objectsMergeDeep(optionsA, optionsB || {});
    }
    function optionsAtMedia(options) {
      const optionsAtMedia2 = options.breakpoints || {};
      const matchedMediaOptions = objectKeys(optionsAtMedia2).filter((media) => ownerWindow.matchMedia(media).matches).map((media) => optionsAtMedia2[media]).reduce((a, mediaOption) => mergeOptions(a, mediaOption), {});
      return mergeOptions(options, matchedMediaOptions);
    }
    function optionsMediaQueries(optionsList) {
      return optionsList.map((options) => objectKeys(options.breakpoints || {})).reduce((acc, mediaQueries) => acc.concat(mediaQueries), []).map(ownerWindow.matchMedia);
    }
    const self = {
      mergeOptions,
      optionsAtMedia,
      optionsMediaQueries
    };
    return self;
  }
  function PluginsHandler(optionsHandler) {
    let activePlugins = [];
    function init(emblaApi, plugins) {
      activePlugins = plugins.filter(({
        options
      }) => optionsHandler.optionsAtMedia(options).active !== false);
      activePlugins.forEach((plugin) => plugin.init(emblaApi, optionsHandler));
      return plugins.reduce((map, plugin) => Object.assign(map, {
        [plugin.name]: plugin
      }), {});
    }
    function destroy() {
      activePlugins = activePlugins.filter((plugin) => plugin.destroy());
    }
    const self = {
      init,
      destroy
    };
    return self;
  }
  function EmblaCarousel(root, userOptions, userPlugins) {
    const ownerDocument = root.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const optionsHandler = OptionsHandler(ownerWindow);
    const pluginsHandler = PluginsHandler(optionsHandler);
    const mediaHandlers = EventStore();
    const eventHandler = EventHandler();
    const {
      mergeOptions,
      optionsAtMedia,
      optionsMediaQueries
    } = optionsHandler;
    const {
      on,
      off,
      emit
    } = eventHandler;
    const reInit = reActivate;
    let destroyed = false;
    let engine;
    let optionsBase = mergeOptions(defaultOptions, EmblaCarousel.globalOptions);
    let options = mergeOptions(optionsBase);
    let pluginList = [];
    let pluginApis;
    let container;
    let slides;
    function storeElements() {
      const {
        container: userContainer,
        slides: userSlides
      } = options;
      const customContainer = isString(userContainer) ? root.querySelector(userContainer) : userContainer;
      container = customContainer || root.children[0];
      const customSlides = isString(userSlides) ? container.querySelectorAll(userSlides) : userSlides;
      slides = [].slice.call(customSlides || container.children);
    }
    function createEngine(options2) {
      const engine2 = Engine(root, container, slides, ownerDocument, ownerWindow, options2, eventHandler);
      if (options2.loop && !engine2.slideLooper.canLoop()) {
        const optionsWithoutLoop = Object.assign({}, options2, {
          loop: false
        });
        return createEngine(optionsWithoutLoop);
      }
      return engine2;
    }
    function activate(withOptions, withPlugins) {
      if (destroyed) return;
      optionsBase = mergeOptions(optionsBase, withOptions);
      options = optionsAtMedia(optionsBase);
      pluginList = withPlugins || pluginList;
      storeElements();
      engine = createEngine(options);
      optionsMediaQueries([optionsBase, ...pluginList.map(({
        options: options2
      }) => options2)]).forEach((query) => mediaHandlers.add(query, "change", reActivate));
      if (!options.active) return;
      engine.translate.to(engine.location.get());
      engine.animation.init();
      engine.slidesInView.init();
      engine.slideFocus.init(self);
      engine.eventHandler.init(self);
      engine.resizeHandler.init(self);
      engine.slidesHandler.init(self);
      if (engine.options.loop) engine.slideLooper.loop();
      if (container.offsetParent && slides.length) engine.dragHandler.init(self);
      pluginApis = pluginsHandler.init(self, pluginList);
    }
    function reActivate(withOptions, withPlugins) {
      const startIndex = selectedScrollSnap();
      deActivate();
      activate(mergeOptions({
        startIndex
      }, withOptions), withPlugins);
      eventHandler.emit("reInit");
    }
    function deActivate() {
      engine.dragHandler.destroy();
      engine.eventStore.clear();
      engine.translate.clear();
      engine.slideLooper.clear();
      engine.resizeHandler.destroy();
      engine.slidesHandler.destroy();
      engine.slidesInView.destroy();
      engine.animation.destroy();
      pluginsHandler.destroy();
      mediaHandlers.clear();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      mediaHandlers.clear();
      deActivate();
      eventHandler.emit("destroy");
      eventHandler.clear();
    }
    function scrollTo(index, jump, direction) {
      if (!options.active || destroyed) return;
      engine.scrollBody.useBaseFriction().useDuration(jump === true ? 0 : options.duration);
      engine.scrollTo.index(index, direction || 0);
    }
    function scrollNext(jump) {
      const next = engine.index.add(1).get();
      scrollTo(next, jump, -1);
    }
    function scrollPrev(jump) {
      const prev = engine.index.add(-1).get();
      scrollTo(prev, jump, 1);
    }
    function canScrollNext() {
      const next = engine.index.add(1).get();
      return next !== selectedScrollSnap();
    }
    function canScrollPrev() {
      const prev = engine.index.add(-1).get();
      return prev !== selectedScrollSnap();
    }
    function scrollSnapList() {
      return engine.scrollSnapList;
    }
    function scrollProgress() {
      return engine.scrollProgress.get(engine.offsetLocation.get());
    }
    function selectedScrollSnap() {
      return engine.index.get();
    }
    function previousScrollSnap() {
      return engine.indexPrevious.get();
    }
    function slidesInView() {
      return engine.slidesInView.get();
    }
    function slidesNotInView() {
      return engine.slidesInView.get(false);
    }
    function plugins() {
      return pluginApis;
    }
    function internalEngine() {
      return engine;
    }
    function rootNode() {
      return root;
    }
    function containerNode() {
      return container;
    }
    function slideNodes() {
      return slides;
    }
    const self = {
      canScrollNext,
      canScrollPrev,
      containerNode,
      internalEngine,
      destroy,
      off,
      on,
      emit,
      plugins,
      previousScrollSnap,
      reInit,
      rootNode,
      scrollNext,
      scrollPrev,
      scrollProgress,
      scrollSnapList,
      scrollTo,
      selectedScrollSnap,
      slideNodes,
      slidesInView,
      slidesNotInView
    };
    activate(userOptions, userPlugins);
    setTimeout(() => eventHandler.emit("init"), 0);
    return self;
  }
  EmblaCarousel.globalOptions = void 0;

  // ../../../node_modules/embla-carousel-react/esm/embla-carousel-react.esm.js
  function useEmblaCarousel(options = {}, plugins = []) {
    const storedOptions = (0, import_react.useRef)(options);
    const storedPlugins = (0, import_react.useRef)(plugins);
    const [emblaApi, setEmblaApi] = (0, import_react.useState)();
    const [viewport, setViewport] = (0, import_react.useState)();
    const reInit = (0, import_react.useCallback)(() => {
      if (emblaApi) emblaApi.reInit(storedOptions.current, storedPlugins.current);
    }, [emblaApi]);
    (0, import_react.useEffect)(() => {
      if (areOptionsEqual(storedOptions.current, options)) return;
      storedOptions.current = options;
      reInit();
    }, [options, reInit]);
    (0, import_react.useEffect)(() => {
      if (arePluginsEqual(storedPlugins.current, plugins)) return;
      storedPlugins.current = plugins;
      reInit();
    }, [plugins, reInit]);
    (0, import_react.useEffect)(() => {
      if (canUseDOM() && viewport) {
        EmblaCarousel.globalOptions = useEmblaCarousel.globalOptions;
        const newEmblaApi = EmblaCarousel(viewport, storedOptions.current, storedPlugins.current);
        setEmblaApi(newEmblaApi);
        return () => newEmblaApi.destroy();
      } else {
        setEmblaApi(void 0);
      }
    }, [viewport, setEmblaApi]);
    return [setViewport, emblaApi];
  }
  useEmblaCarousel.globalOptions = void 0;

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.ProtoPulse;
  var ds_default = "default" in g ? g.default : g;

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
  var isNumber2 = (value) => !!value && !Number.isNaN(Number(value));
  var isInteger = (value) => !!value && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber2(value.slice(0, -1));
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
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, isLabelNumber, isNumber2);
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
    const scaleBorderWidth = () => ["", isNumber2, isArbitraryVariableLength, isArbitraryLength];
    const scaleLineStyle = () => ["solid", "dashed", "dotted", "double"];
    const scaleBlendMode = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const scaleMaskImagePosition = () => [isNumber2, isPercent, isArbitraryVariablePosition, isArbitraryPosition];
    const scaleBlur = () => [
      // Deprecated since Tailwind CSS v4.0.0
      "",
      "none",
      themeBlur,
      isArbitraryVariable,
      isArbitraryValue
    ];
    const scaleRotate = () => ["none", isNumber2, isArbitraryVariable, isArbitraryValue];
    const scaleScale = () => ["none", isNumber2, isArbitraryVariable, isArbitraryValue];
    const scaleSkew = () => [isNumber2, isArbitraryVariable, isArbitraryValue];
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
        spacing: ["px", isNumber2],
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
          columns: [isNumber2, isArbitraryValue, isArbitraryVariable, themeContainer]
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
          flex: [isNumber2, isFraction, "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: ["", isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: ["", isNumber2, isArbitraryVariable, isArbitraryValue]
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
          "line-clamp": [isNumber2, "none", isArbitraryVariable, isArbitraryNumber]
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
          decoration: [isNumber2, "from-font", "auto", isArbitraryVariable, isArbitraryLength]
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
          "underline-offset": [isNumber2, "auto", isArbitraryVariable, isArbitraryValue]
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
          "outline-offset": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: ["", isNumber2, isArbitraryVariableLength, isArbitraryLength]
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
          "ring-offset": [isNumber2, isArbitraryLength]
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
          opacity: [isNumber2, isArbitraryVariable, isArbitraryValue]
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
          "mask-linear": [isNumber2]
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
          "mask-conic": [isNumber2]
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
          brightness: [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [isNumber2, isArbitraryVariable, isArbitraryValue]
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
          grayscale: ["", isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: ["", isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: ["", isNumber2, isArbitraryVariable, isArbitraryValue]
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
          "backdrop-brightness": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": ["", isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": ["", isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [isNumber2, isArbitraryVariable, isArbitraryValue]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": ["", isNumber2, isArbitraryVariable, isArbitraryValue]
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
          duration: [isNumber2, "initial", isArbitraryVariable, isArbitraryValue]
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
          delay: [isNumber2, isArbitraryVariable, isArbitraryValue]
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
          stroke: [isNumber2, isArbitraryVariableLength, isArbitraryLength, isArbitraryNumber]
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

  // client/src/components/ui/button.tsx
  init_define_import_meta_env();
  var React3 = __toESM(require_react_shim());

  // ../../../node_modules/@radix-ui/react-slot/dist/index.mjs
  init_define_import_meta_env();
  var React2 = __toESM(require_react_shim(), 1);

  // ../../../node_modules/@radix-ui/react-compose-refs/dist/index.mjs
  init_define_import_meta_env();
  var React = __toESM(require_react_shim(), 1);
  function setRef(ref, value) {
    if (typeof ref === "function") {
      return ref(value);
    } else if (ref !== null && ref !== void 0) {
      ref.current = value;
    }
  }
  function composeRefs(...refs) {
    return (node) => {
      let hasCleanup = false;
      const cleanups = refs.map((ref) => {
        const cleanup = setRef(ref, node);
        if (!hasCleanup && typeof cleanup == "function") {
          hasCleanup = true;
        }
        return cleanup;
      });
      if (hasCleanup) {
        return () => {
          for (let i = 0; i < cleanups.length; i++) {
            const cleanup = cleanups[i];
            if (typeof cleanup == "function") {
              cleanup();
            } else {
              setRef(refs[i], null);
            }
          }
        };
      }
    };
  }

  // ../../../node_modules/@radix-ui/react-slot/dist/index.mjs
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
  var use = React2[" use ".trim().toString()];
  function isPromiseLike(value) {
    return typeof value === "object" && value !== null && "then" in value;
  }
  function isLazyComponent(element) {
    return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
  }
  // @__NO_SIDE_EFFECTS__
  function createSlot(ownerName) {
    const SlotClone = /* @__PURE__ */ createSlotClone(ownerName);
    const Slot2 = React2.forwardRef((props, forwardedRef) => {
      let { children, ...slotProps } = props;
      if (isLazyComponent(children) && typeof use === "function") {
        children = use(children._payload);
      }
      const childrenArray = React2.Children.toArray(children);
      const slottable = childrenArray.find(isSlottable);
      if (slottable) {
        const newElement = slottable.props.children;
        const newChildren = childrenArray.map((child) => {
          if (child === slottable) {
            if (React2.Children.count(newElement) > 1) return React2.Children.only(null);
            return React2.isValidElement(newElement) ? newElement.props.children : null;
          } else {
            return child;
          }
        });
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotClone, { ...slotProps, ref: forwardedRef, children: React2.isValidElement(newElement) ? React2.cloneElement(newElement, void 0, newChildren) : null });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotClone, { ...slotProps, ref: forwardedRef, children });
    });
    Slot2.displayName = `${ownerName}.Slot`;
    return Slot2;
  }
  var Slot = /* @__PURE__ */ createSlot("Slot");
  // @__NO_SIDE_EFFECTS__
  function createSlotClone(ownerName) {
    const SlotClone = React2.forwardRef((props, forwardedRef) => {
      let { children, ...slotProps } = props;
      if (isLazyComponent(children) && typeof use === "function") {
        children = use(children._payload);
      }
      if (React2.isValidElement(children)) {
        const childrenRef = getElementRef(children);
        const props2 = mergeProps(slotProps, children.props);
        if (children.type !== React2.Fragment) {
          props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
        }
        return React2.cloneElement(children, props2);
      }
      return React2.Children.count(children) > 1 ? React2.Children.only(null) : null;
    });
    SlotClone.displayName = `${ownerName}.SlotClone`;
    return SlotClone;
  }
  var SLOTTABLE_IDENTIFIER = /* @__PURE__ */ Symbol("radix.slottable");
  function isSlottable(child) {
    return React2.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
  }
  function mergeProps(slotProps, childProps) {
    const overrideProps = { ...childProps };
    for (const propName in childProps) {
      const slotPropValue = slotProps[propName];
      const childPropValue = childProps[propName];
      const isHandler = /^on[A-Z]/.test(propName);
      if (isHandler) {
        if (slotPropValue && childPropValue) {
          overrideProps[propName] = (...args) => {
            const result = childPropValue(...args);
            slotPropValue(...args);
            return result;
          };
        } else if (slotPropValue) {
          overrideProps[propName] = slotPropValue;
        }
      } else if (propName === "style") {
        overrideProps[propName] = { ...slotPropValue, ...childPropValue };
      } else if (propName === "className") {
        overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
      }
    }
    return { ...slotProps, ...overrideProps };
  }
  function getElementRef(element) {
    let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
    let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
    if (mayWarn) {
      return element.ref;
    }
    getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
    mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
    if (mayWarn) {
      return element.props.ref;
    }
    return element.props.ref || element.ref;
  }

  // ../../../node_modules/class-variance-authority/dist/index.mjs
  init_define_import_meta_env();
  var falsyToString = (value) => typeof value === "boolean" ? `${value}` : value === 0 ? "0" : value;
  var cx = clsx;
  var cva = (base, config) => (props) => {
    var _config_compoundVariants;
    if ((config === null || config === void 0 ? void 0 : config.variants) == null) return cx(base, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
    const { variants, defaultVariants } = config;
    const getVariantClassNames = Object.keys(variants).map((variant) => {
      const variantProp = props === null || props === void 0 ? void 0 : props[variant];
      const defaultVariantProp = defaultVariants === null || defaultVariants === void 0 ? void 0 : defaultVariants[variant];
      if (variantProp === null) return null;
      const variantKey = falsyToString(variantProp) || falsyToString(defaultVariantProp);
      return variants[variant][variantKey];
    });
    const propsWithoutUndefined = props && Object.entries(props).reduce((acc, param) => {
      let [key, value] = param;
      if (value === void 0) {
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});
    const getCompoundVariantClassNames = config === null || config === void 0 ? void 0 : (_config_compoundVariants = config.compoundVariants) === null || _config_compoundVariants === void 0 ? void 0 : _config_compoundVariants.reduce((acc, param) => {
      let { class: cvClass, className: cvClassName, ...compoundVariantOptions } = param;
      return Object.entries(compoundVariantOptions).every((param2) => {
        let [key, value] = param2;
        return Array.isArray(value) ? value.includes({
          ...defaultVariants,
          ...propsWithoutUndefined
        }[key]) : {
          ...defaultVariants,
          ...propsWithoutUndefined
        }[key] === value;
      }) ? [
        ...acc,
        cvClass,
        cvClassName
      ] : acc;
    }, []);
    return cx(base, getVariantClassNames, getCompoundVariantClassNames, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
  };

  // client/src/components/ui/button.tsx
  var import_jsx_runtime2 = __toESM(require_react_shim());
  var buttonVariants = cva(
    // E2E-1013 (Plan 03 Phase 9): focus-visible now references the palette-
    //   independent `--color-focus-ring` token (white/near-black) instead of
    //   the brand `--color-ring` cyan, plus a 2px ring offset so the indicator
    //   reads against any surface. Ring width bumped 1 -> 2 for visibility.
    // E2E-1014 (Plan 03 Phase 9): `active:scale-[0.98]` gives tactile click
    //   feedback uniformly. Subtle (2% shrink) so it doesn't disrupt dense
    //   toolbars. `motion-reduce:active:scale-100` respects prefers-reduced-
    //   motion. `transition` governs both color and transform.
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] motion-reduce:active:scale-100 hover-elevate active-elevate-2",
    {
      variants: {
        variant: {
          default: (
            // @replit: no hover, and add primary border
            // E2E-1014: `active:brightness-90` adds tactile press feedback.
            "bg-primary text-primary-foreground border border-primary-border active:brightness-90"
          ),
          destructive: "bg-destructive text-destructive-foreground shadow-sm border-destructive-border active:brightness-90",
          outline: (
            // @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
            // Inherits the current text color. Uses shadow-xs. no shadow on active
            // No hover state
            // E2E-1014: keep the shadow-drop active cue plus a subtle bg tint.
            " border [border-color:var(--button-outline)] shadow-xs active:shadow-none active:bg-muted/60 "
          ),
          secondary: (
            // @replit border, no hover, no shadow, secondary border.
            "border bg-secondary text-secondary-foreground border border-secondary-border active:brightness-90"
          ),
          // @replit no hover, transparent border
          ghost: "border border-transparent active:bg-muted/60",
          link: "text-primary underline-offset-4 hover:underline active:opacity-70"
        },
        size: {
          // @replit changed sizes
          default: "min-h-9 px-4 py-2",
          sm: "min-h-8 rounded-md px-3 text-xs",
          lg: "min-h-10 rounded-md px-8",
          icon: "h-9 w-9"
        }
      },
      defaultVariants: {
        variant: "default",
        size: "default"
      }
    }
  );
  var Button = React3.forwardRef(
    ({ className, variant, size, asChild = false, type, ...props }, ref) => {
      const Comp = asChild ? Slot : "button";
      if (asChild) {
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          Comp,
          {
            className: cn(buttonVariants({ variant, size, className })),
            ref,
            ...props
          }
        );
      }
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Comp,
        {
          className: cn(buttonVariants({ variant, size, className })),
          ref,
          type: type ?? "button",
          ...props
        }
      );
    }
  );
  Button.displayName = "Button";

  // client/src/components/ui/carousel.tsx
  var import_jsx_runtime3 = __toESM(require_react_shim());
  var CarouselContext = React4.createContext(null);
  function useCarousel() {
    const context = React4.useContext(CarouselContext);
    if (!context) {
      throw new Error("useCarousel must be used within a <Carousel />");
    }
    return context;
  }
  var Carousel = React4.forwardRef(
    ({
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    }, ref) => {
      const [carouselRef, api] = useEmblaCarousel(
        {
          ...opts,
          axis: orientation === "horizontal" ? "x" : "y"
        },
        plugins
      );
      const [canScrollPrev, setCanScrollPrev] = React4.useState(false);
      const [canScrollNext, setCanScrollNext] = React4.useState(false);
      const onSelect = React4.useCallback((api2) => {
        if (!api2) {
          return;
        }
        setCanScrollPrev(api2.canScrollPrev());
        setCanScrollNext(api2.canScrollNext());
      }, []);
      const scrollPrev = React4.useCallback(() => {
        api?.scrollPrev();
      }, [api]);
      const scrollNext = React4.useCallback(() => {
        api?.scrollNext();
      }, [api]);
      const handleKeyDown = React4.useCallback(
        (event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollPrev();
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollNext();
          }
        },
        [scrollPrev, scrollNext]
      );
      React4.useEffect(() => {
        if (!api || !setApi) {
          return;
        }
        setApi(api);
      }, [api, setApi]);
      React4.useEffect(() => {
        if (!api) {
          return;
        }
        onSelect(api);
        api.on("reInit", onSelect);
        api.on("select", onSelect);
        return () => {
          api?.off("select", onSelect);
        };
      }, [api, onSelect]);
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        CarouselContext.Provider,
        {
          value: {
            carouselRef,
            api,
            opts,
            orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
            scrollPrev,
            scrollNext,
            canScrollPrev,
            canScrollNext
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              ref,
              onKeyDownCapture: handleKeyDown,
              className: cn("relative", className),
              role: "region",
              "aria-roledescription": "carousel",
              ...props,
              children
            }
          )
        }
      );
    }
  );
  Carousel.displayName = "Carousel";
  var CarouselContent = React4.forwardRef(({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: carouselRef, className: "overflow-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        ref,
        className: cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        ),
        ...props
      }
    ) });
  });
  CarouselContent.displayName = "CarouselContent";
  var CarouselItem = React4.forwardRef(({ className, ...props }, ref) => {
    const { orientation } = useCarousel();
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        ref,
        role: "group",
        "aria-roledescription": "slide",
        className: cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-4" : "pt-4",
          className
        ),
        ...props
      }
    );
  });
  CarouselItem.displayName = "CarouselItem";
  var CarouselPrevious = React4.forwardRef(({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      Button,
      {
        ref,
        variant,
        size,
        className: cn(
          "absolute  h-8 w-8 rounded-full",
          orientation === "horizontal" ? "-left-12 top-1/2 -translate-y-1/2" : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
          className
        ),
        disabled: !canScrollPrev,
        onClick: scrollPrev,
        ...props,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ds_exports.ArrowLeft, { className: "h-4 w-4" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "sr-only", children: "Previous slide" })
        ]
      }
    );
  });
  CarouselPrevious.displayName = "CarouselPrevious";
  var CarouselNext = React4.forwardRef(({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      Button,
      {
        ref,
        variant,
        size,
        className: cn(
          "absolute h-8 w-8 rounded-full",
          orientation === "horizontal" ? "-right-12 top-1/2 -translate-y-1/2" : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
          className
        ),
        disabled: !canScrollNext,
        onClick: scrollNext,
        ...props,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ds_exports.ArrowRight, { className: "h-4 w-4" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "sr-only", children: "Next slide" })
        ]
      }
    );
  });
  CarouselNext.displayName = "CarouselNext";

  // .design-sync/previews/Carousel.tsx
  var import_jsx_runtime4 = __toESM(require_react_shim(), 1);
  var Surface = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "bg-background text-foreground", style: { padding: 40 }, children });
  var modules = [
    { name: "ESP32-WROOM-32", detail: "Wi-Fi + BLE MCU module", Icon: ds_exports.Cpu },
    { name: "BME280", detail: "Temp / humidity / pressure", Icon: ds_exports.Thermometer },
    { name: "MPU-6050", detail: "6-axis IMU, I²C", Icon: ds_exports.Gauge },
    { name: "nRF24L01+", detail: "2.4 GHz transceiver", Icon: ds_exports.Radio }
  ];
  function ModuleGallery() {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: 280 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Carousel, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselContent, { children: modules.map(({ name, detail, Icon }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselItem, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-border bg-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { className: "h-8 w-8 text-primary" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "text-sm font-medium", children: name }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "text-xs text-muted-foreground", children: detail })
      ] }) }, name)) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselPrevious, {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselNext, {})
    ] }) }) });
  }
  function LayerStack() {
    const layers = ["Top Copper", "Prepreg", "Inner GND", "Core", "Bottom Copper"];
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { width: 280 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Carousel, { orientation: "vertical", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselContent, { className: "h-40", children: layers.map((layer) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselItem, { className: "basis-1/2", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "flex h-full items-center justify-center rounded-md border border-border bg-muted text-sm font-medium", children: layer }) }, layer)) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselPrevious, {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CarouselNext, {})
    ] }) }) });
  }
  return __toCommonJS(Carousel_exports);
})();
