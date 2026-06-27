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
      function jsx9(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx9;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx9)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // shim:react-dom-shim
  var require_react_dom_shim = __commonJS({
    "shim:react-dom-shim"(exports, module) {
      init_define_import_meta_env();
      var D = window.ReactDOM;
      var n = function() {
      };
      module.exports = Object.assign({ preload: n, preinit: n, preconnect: n, prefetchDNS: n, preloadModule: n, preinitModule: n }, D);
    }
  });

  // .design-sync/previews/Form.tsx
  var Form_exports = {};
  __export(Form_exports, {
    ComponentProperties: () => ComponentProperties,
    NetLabelWithError: () => NetLabelWithError
  });
  init_define_import_meta_env();

  // ../../../node_modules/react-hook-form/dist/index.esm.mjs
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim(), 1);
  var isCheckBoxInput = (element) => element.type === "checkbox";
  var isDateObject = (value) => value instanceof Date;
  var isNullOrUndefined = (value) => value == null;
  var isObjectType = (value) => typeof value === "object";
  var isObject = (value) => !isNullOrUndefined(value) && !Array.isArray(value) && isObjectType(value) && !isDateObject(value);
  var getEventValue = (event) => isObject(event) && event.target ? isCheckBoxInput(event.target) ? event.target.checked : event.target.value : event;
  var getNodeParentName = (name) => name.substring(0, name.search(/\.\d+(\.|$)/)) || name;
  var isNameInFieldArray = (names, name) => names.has(getNodeParentName(name));
  var isPlainObject = (tempObject) => {
    const prototypeCopy = tempObject.constructor && tempObject.constructor.prototype;
    return isObject(prototypeCopy) && prototypeCopy.hasOwnProperty("isPrototypeOf");
  };
  var isWeb = typeof window !== "undefined" && typeof window.HTMLElement !== "undefined" && typeof document !== "undefined";
  function cloneObject(data) {
    if (data instanceof Date) {
      return new Date(data);
    }
    const isFileListInstance = typeof FileList !== "undefined" && data instanceof FileList;
    if (isWeb && (data instanceof Blob || isFileListInstance)) {
      return data;
    }
    const isArray = Array.isArray(data);
    if (!isArray && !(isObject(data) && isPlainObject(data))) {
      return data;
    }
    const copy = isArray ? [] : Object.create(Object.getPrototypeOf(data));
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        copy[key] = cloneObject(data[key]);
      }
    }
    return copy;
  }
  var isKey = (value) => /^\w*$/.test(value);
  var isUndefined = (val) => val === void 0;
  var compact = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
  var stringToPath = (input) => compact(input.replace(/["|']|\]/g, "").split(/\.|\[/));
  var get = (object, path, defaultValue) => {
    if (!path || !isObject(object)) {
      return defaultValue;
    }
    const result = (isKey(path) ? [path] : stringToPath(path)).reduce((result2, key) => isNullOrUndefined(result2) ? result2 : result2[key], object);
    return isUndefined(result) || result === object ? isUndefined(object[path]) ? defaultValue : object[path] : result;
  };
  var isBoolean = (value) => typeof value === "boolean";
  var isFunction = (value) => typeof value === "function";
  var set = (object, path, value) => {
    let index = -1;
    const tempPath = isKey(path) ? [path] : stringToPath(path);
    const length = tempPath.length;
    const lastIndex = length - 1;
    while (++index < length) {
      const key = tempPath[index];
      let newValue = value;
      if (index !== lastIndex) {
        const objValue = object[key];
        newValue = isObject(objValue) || Array.isArray(objValue) ? objValue : !isNaN(+tempPath[index + 1]) ? [] : {};
      }
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return;
      }
      object[key] = newValue;
      object = object[key];
    }
  };
  var EVENTS = {
    BLUR: "blur",
    FOCUS_OUT: "focusout",
    CHANGE: "change",
    SUBMIT: "submit",
    TRIGGER: "trigger",
    VALID: "valid"
  };
  var VALIDATION_MODE = {
    onBlur: "onBlur",
    onChange: "onChange",
    onSubmit: "onSubmit",
    onTouched: "onTouched",
    all: "all"
  };
  var INPUT_VALIDATION_RULES = {
    max: "max",
    min: "min",
    maxLength: "maxLength",
    minLength: "minLength",
    pattern: "pattern",
    required: "required",
    validate: "validate"
  };
  var FORM_ERROR_TYPE = "form";
  var ROOT_ERROR_TYPE = "root";
  var HookFormControlContext = import_react.default.createContext(null);
  HookFormControlContext.displayName = "HookFormControlContext";
  var useFormControlContext = () => import_react.default.useContext(HookFormControlContext);
  var getProxyFormState = (formState, control, localProxyFormState, isRoot = true) => {
    const result = {
      defaultValues: control._defaultValues
    };
    for (const key in formState) {
      Object.defineProperty(result, key, {
        get: () => {
          const _key = key;
          if (control._proxyFormState[_key] !== VALIDATION_MODE.all) {
            control._proxyFormState[_key] = !isRoot || VALIDATION_MODE.all;
          }
          localProxyFormState && (localProxyFormState[_key] = true);
          return formState[_key];
        }
      });
    }
    return result;
  };
  var useIsomorphicLayoutEffect = typeof window !== "undefined" ? import_react.default.useLayoutEffect : import_react.default.useEffect;
  function useFormState(props) {
    const formControl = useFormControlContext();
    const { control = formControl, disabled, name, exact } = props || {};
    const [formState, updateFormState] = import_react.default.useState(control._formState);
    const _localProxyFormState = import_react.default.useRef({
      isDirty: false,
      isLoading: false,
      dirtyFields: false,
      touchedFields: false,
      validatingFields: false,
      isValidating: false,
      isValid: false,
      errors: false
    });
    useIsomorphicLayoutEffect(() => control._subscribe({
      name,
      formState: _localProxyFormState.current,
      exact,
      callback: (formState2) => {
        !disabled && updateFormState({
          ...control._formState,
          ...formState2
        });
      }
    }), [name, disabled, exact]);
    import_react.default.useEffect(() => {
      _localProxyFormState.current.isValid && control._setValid(true);
    }, [control]);
    return import_react.default.useMemo(() => getProxyFormState(formState, control, _localProxyFormState.current, false), [formState, control]);
  }
  var isString = (value) => typeof value === "string";
  var generateWatchOutput = (names, _names, formValues, isGlobal, defaultValue) => {
    if (isString(names)) {
      isGlobal && _names.watch.add(names);
      return get(formValues, names, defaultValue);
    }
    if (Array.isArray(names)) {
      return names.map((fieldName) => (isGlobal && _names.watch.add(fieldName), get(formValues, fieldName)));
    }
    isGlobal && (_names.watchAll = true);
    return formValues;
  };
  var isPrimitive = (value) => isNullOrUndefined(value) || !isObjectType(value);
  function deepEqual(object1, object2, _internal_visited = /* @__PURE__ */ new WeakSet()) {
    if (isPrimitive(object1) || isPrimitive(object2)) {
      return Object.is(object1, object2);
    }
    if (isDateObject(object1) && isDateObject(object2)) {
      return Object.is(object1.getTime(), object2.getTime());
    }
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
      return false;
    }
    if (_internal_visited.has(object1) || _internal_visited.has(object2)) {
      return true;
    }
    _internal_visited.add(object1);
    _internal_visited.add(object2);
    for (const key of keys1) {
      const val1 = object1[key];
      if (!keys2.includes(key)) {
        return false;
      }
      if (key !== "ref") {
        const val2 = object2[key];
        if (isDateObject(val1) && isDateObject(val2) || isObject(val1) && isObject(val2) || Array.isArray(val1) && Array.isArray(val2) ? !deepEqual(val1, val2, _internal_visited) : !Object.is(val1, val2)) {
          return false;
        }
      }
    }
    return true;
  }
  function useWatch(props) {
    const formControl = useFormControlContext();
    const { control = formControl, name, defaultValue, disabled, exact, compute } = props || {};
    const _defaultValue = import_react.default.useRef(defaultValue);
    const _compute = import_react.default.useRef(compute);
    const _computeFormValues = import_react.default.useRef(void 0);
    const _prevControl = import_react.default.useRef(control);
    const _prevName = import_react.default.useRef(name);
    _compute.current = compute;
    const [value, updateValue] = import_react.default.useState(() => {
      const defaultValue2 = control._getWatch(name, _defaultValue.current);
      return _compute.current ? _compute.current(defaultValue2) : defaultValue2;
    });
    const getCurrentOutput = import_react.default.useCallback((values) => {
      const formValues = generateWatchOutput(name, control._names, values || control._formValues, false, _defaultValue.current);
      return _compute.current ? _compute.current(formValues) : formValues;
    }, [control._formValues, control._names, name]);
    const refreshValue = import_react.default.useCallback((values) => {
      if (!disabled) {
        const formValues = generateWatchOutput(name, control._names, values || control._formValues, false, _defaultValue.current);
        if (_compute.current) {
          const computedFormValues = _compute.current(formValues);
          if (!deepEqual(computedFormValues, _computeFormValues.current)) {
            updateValue(computedFormValues);
            _computeFormValues.current = computedFormValues;
          }
        } else {
          updateValue(formValues);
        }
      }
    }, [control._formValues, control._names, disabled, name]);
    useIsomorphicLayoutEffect(() => {
      if (_prevControl.current !== control || !deepEqual(_prevName.current, name)) {
        _prevControl.current = control;
        _prevName.current = name;
        refreshValue();
      }
      return control._subscribe({
        name,
        formState: {
          values: true
        },
        exact,
        callback: (formState) => {
          refreshValue(formState.values);
        }
      });
    }, [control, exact, name, refreshValue]);
    import_react.default.useEffect(() => control._removeUnmounted());
    const controlChanged = _prevControl.current !== control;
    const prevName = _prevName.current;
    const computedOutput = import_react.default.useMemo(() => {
      if (disabled) {
        return null;
      }
      const nameChanged = !controlChanged && !deepEqual(prevName, name);
      const shouldReturnImmediate = controlChanged || nameChanged;
      return shouldReturnImmediate ? getCurrentOutput() : null;
    }, [disabled, controlChanged, name, prevName, getCurrentOutput]);
    return computedOutput !== null ? computedOutput : value;
  }
  function useController(props) {
    const formControl = useFormControlContext();
    const { name, disabled, control = formControl, shouldUnregister, defaultValue, exact = true } = props;
    const isArrayField = isNameInFieldArray(control._names.array, name);
    const defaultValueMemo = import_react.default.useMemo(() => get(control._formValues, name, get(control._defaultValues, name, defaultValue)), [control, name, defaultValue]);
    const value = useWatch({
      control,
      name,
      defaultValue: defaultValueMemo,
      exact
    });
    const formState = useFormState({
      control,
      name,
      exact
    });
    const _props = import_react.default.useRef(props);
    const _previousNameRef = import_react.default.useRef(void 0);
    const _registerProps = import_react.default.useRef(control.register(name, {
      ...props.rules,
      value,
      ...isBoolean(props.disabled) ? { disabled: props.disabled } : {}
    }));
    _props.current = props;
    const fieldState = import_react.default.useMemo(() => Object.defineProperties({}, {
      invalid: {
        enumerable: true,
        get: () => !!get(formState.errors, name)
      },
      isDirty: {
        enumerable: true,
        get: () => !!get(formState.dirtyFields, name)
      },
      isTouched: {
        enumerable: true,
        get: () => !!get(formState.touchedFields, name)
      },
      isValidating: {
        enumerable: true,
        get: () => !!get(formState.validatingFields, name)
      },
      error: {
        enumerable: true,
        get: () => get(formState.errors, name)
      }
    }), [formState, name]);
    const onChange = import_react.default.useCallback((event) => _registerProps.current.onChange({
      target: {
        value: getEventValue(event),
        name
      },
      type: EVENTS.CHANGE
    }), [name]);
    const onBlur = import_react.default.useCallback(() => _registerProps.current.onBlur({
      target: {
        value: get(control._formValues, name),
        name
      },
      type: EVENTS.BLUR
    }), [name, control._formValues]);
    const ref = import_react.default.useCallback((elm) => {
      const field2 = get(control._fields, name);
      if (field2 && field2._f && elm) {
        field2._f.ref = {
          focus: () => isFunction(elm.focus) && elm.focus(),
          select: () => isFunction(elm.select) && elm.select(),
          setCustomValidity: (message) => isFunction(elm.setCustomValidity) && elm.setCustomValidity(message),
          reportValidity: () => isFunction(elm.reportValidity) && elm.reportValidity()
        };
      }
    }, [control._fields, name]);
    const field = import_react.default.useMemo(() => ({
      name,
      value,
      ...isBoolean(disabled) || formState.disabled ? { disabled: formState.disabled || disabled } : {},
      onChange,
      onBlur,
      ref
    }), [name, disabled, formState.disabled, onChange, onBlur, ref, value]);
    import_react.default.useEffect(() => {
      const _shouldUnregisterField = control._options.shouldUnregister || shouldUnregister;
      const previousName = _previousNameRef.current;
      if (previousName && previousName !== name && !isArrayField) {
        control.unregister(previousName);
      }
      control.register(name, {
        ..._props.current.rules,
        ...isBoolean(_props.current.disabled) ? { disabled: _props.current.disabled } : {}
      });
      const updateMounted = (name2, value2) => {
        const field2 = get(control._fields, name2);
        if (field2 && field2._f) {
          field2._f.mount = value2;
        }
      };
      updateMounted(name, true);
      if (_shouldUnregisterField) {
        const value2 = cloneObject(get(control._options.defaultValues, name, _props.current.defaultValue));
        set(control._defaultValues, name, value2);
        if (isUndefined(get(control._formValues, name))) {
          set(control._formValues, name, value2);
        }
      }
      !isArrayField && control.register(name);
      _previousNameRef.current = name;
      return () => {
        (isArrayField ? _shouldUnregisterField && !control._state.action : _shouldUnregisterField) ? control.unregister(name) : updateMounted(name, false);
      };
    }, [name, control, isArrayField, shouldUnregister]);
    import_react.default.useEffect(() => {
      control._setDisabledField({
        disabled,
        name
      });
    }, [disabled, name, control]);
    return import_react.default.useMemo(() => ({
      field,
      formState,
      fieldState
    }), [field, formState, fieldState]);
  }
  var Controller = (props) => props.render(useController(props));
  var HookFormContext = import_react.default.createContext(null);
  HookFormContext.displayName = "HookFormContext";
  var useFormContext = () => import_react.default.useContext(HookFormContext);
  var FormProvider = (props) => {
    const { children, watch, getValues, getFieldState, setError, clearErrors, setValue, trigger, formState, resetField, reset, handleSubmit, unregister, control, register, setFocus, subscribe } = props;
    return import_react.default.createElement(
      HookFormContext.Provider,
      { value: import_react.default.useMemo(() => ({
        watch,
        getValues,
        getFieldState,
        setError,
        clearErrors,
        setValue,
        trigger,
        formState,
        resetField,
        reset,
        handleSubmit,
        unregister,
        control,
        register,
        setFocus,
        subscribe
      }), [
        clearErrors,
        control,
        formState,
        getFieldState,
        getValues,
        handleSubmit,
        register,
        reset,
        resetField,
        setError,
        setFocus,
        setValue,
        subscribe,
        trigger,
        unregister,
        watch
      ]) },
      import_react.default.createElement(HookFormControlContext.Provider, { value: control }, children)
    );
  };
  var appendErrors = (name, validateAllFieldCriteria, errors, type, message) => validateAllFieldCriteria ? {
    ...errors[name],
    types: {
      ...errors[name] && errors[name].types ? errors[name].types : {},
      [type]: message || true
    }
  } : {};
  var convertToArrayPayload = (value) => Array.isArray(value) ? value : [value];
  var createSubject = () => {
    let _observers = [];
    const next = (value) => {
      for (const observer of _observers) {
        observer.next && observer.next(value);
      }
    };
    const subscribe = (observer) => {
      _observers.push(observer);
      return {
        unsubscribe: () => {
          _observers = _observers.filter((o) => o !== observer);
        }
      };
    };
    const unsubscribe = () => {
      _observers = [];
    };
    return {
      get observers() {
        return _observers;
      },
      next,
      subscribe,
      unsubscribe
    };
  };
  function extractFormValues(fieldsState, formValues) {
    const values = {};
    for (const key in fieldsState) {
      if (fieldsState.hasOwnProperty(key)) {
        const fieldState = fieldsState[key];
        const fieldValue = formValues[key];
        if (fieldState && isObject(fieldState) && fieldValue) {
          const nestedFieldsState = extractFormValues(fieldState, fieldValue);
          if (isObject(nestedFieldsState)) {
            values[key] = nestedFieldsState;
          }
        } else if (fieldsState[key]) {
          values[key] = fieldValue;
        }
      }
    }
    return values;
  }
  var isEmptyObject = (value) => isObject(value) && !Object.keys(value).length;
  var isFileInput = (element) => element.type === "file";
  var isHTMLElement = (value) => {
    if (!isWeb) {
      return false;
    }
    const owner = value ? value.ownerDocument : 0;
    return value instanceof (owner && owner.defaultView ? owner.defaultView.HTMLElement : HTMLElement);
  };
  var isMultipleSelect = (element) => element.type === `select-multiple`;
  var isRadioInput = (element) => element.type === "radio";
  var isRadioOrCheckbox = (ref) => isRadioInput(ref) || isCheckBoxInput(ref);
  var live = (ref) => isHTMLElement(ref) && ref.isConnected;
  function baseGet(object, updatePath) {
    const length = updatePath.slice(0, -1).length;
    let index = 0;
    while (index < length) {
      object = isUndefined(object) ? index++ : object[updatePath[index++]];
    }
    return object;
  }
  function isEmptyArray(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && !isUndefined(obj[key])) {
        return false;
      }
    }
    return true;
  }
  function unset(object, path) {
    const paths = Array.isArray(path) ? path : isKey(path) ? [path] : stringToPath(path);
    const childObject = paths.length === 1 ? object : baseGet(object, paths);
    const index = paths.length - 1;
    const key = paths[index];
    if (childObject) {
      delete childObject[key];
    }
    if (index !== 0 && (isObject(childObject) && isEmptyObject(childObject) || Array.isArray(childObject) && isEmptyArray(childObject))) {
      unset(object, paths.slice(0, -1));
    }
    return object;
  }
  var objectHasFunction = (data) => {
    for (const key in data) {
      if (isFunction(data[key])) {
        return true;
      }
    }
    return false;
  };
  function isTraversable(value) {
    return Array.isArray(value) || isObject(value) && !objectHasFunction(value);
  }
  function markFieldsDirty(data, fields = {}) {
    for (const key in data) {
      const value = data[key];
      if (isTraversable(value)) {
        fields[key] = Array.isArray(value) ? [] : {};
        markFieldsDirty(value, fields[key]);
      } else if (!isUndefined(value)) {
        fields[key] = true;
      }
    }
    return fields;
  }
  function getDirtyFields(data, formValues, dirtyFieldsFromValues) {
    if (!dirtyFieldsFromValues) {
      dirtyFieldsFromValues = markFieldsDirty(formValues);
    }
    for (const key in data) {
      const value = data[key];
      if (isTraversable(value)) {
        if (isUndefined(formValues) || isPrimitive(dirtyFieldsFromValues[key])) {
          dirtyFieldsFromValues[key] = markFieldsDirty(value, Array.isArray(value) ? [] : {});
        } else {
          getDirtyFields(value, isNullOrUndefined(formValues) ? {} : formValues[key], dirtyFieldsFromValues[key]);
        }
      } else {
        const formValue = formValues[key];
        dirtyFieldsFromValues[key] = !deepEqual(value, formValue);
      }
    }
    return dirtyFieldsFromValues;
  }
  var defaultResult = {
    value: false,
    isValid: false
  };
  var validResult = { value: true, isValid: true };
  var getCheckboxValue = (options) => {
    if (Array.isArray(options)) {
      if (options.length > 1) {
        const values = options.filter((option) => option && option.checked && !option.disabled).map((option) => option.value);
        return { value: values, isValid: !!values.length };
      }
      return options[0].checked && !options[0].disabled ? (
        // @ts-expect-error expected to work in the browser
        options[0].attributes && !isUndefined(options[0].attributes.value) ? isUndefined(options[0].value) || options[0].value === "" ? validResult : { value: options[0].value, isValid: true } : validResult
      ) : defaultResult;
    }
    return defaultResult;
  };
  var getFieldValueAs = (value, { valueAsNumber, valueAsDate, setValueAs }) => isUndefined(value) ? value : valueAsNumber ? value === "" ? NaN : value ? +value : value : valueAsDate && isString(value) ? new Date(value) : setValueAs ? setValueAs(value) : value;
  var defaultReturn = {
    isValid: false,
    value: null
  };
  var getRadioValue = (options) => Array.isArray(options) ? options.reduce((previous, option) => option && option.checked && !option.disabled ? {
    isValid: true,
    value: option.value
  } : previous, defaultReturn) : defaultReturn;
  function getFieldValue(_f) {
    const ref = _f.ref;
    if (isFileInput(ref)) {
      return ref.files;
    }
    if (isRadioInput(ref)) {
      return getRadioValue(_f.refs).value;
    }
    if (isMultipleSelect(ref)) {
      return [...ref.selectedOptions].map(({ value }) => value);
    }
    if (isCheckBoxInput(ref)) {
      return getCheckboxValue(_f.refs).value;
    }
    return getFieldValueAs(isUndefined(ref.value) ? _f.ref.value : ref.value, _f);
  }
  var getResolverOptions = (fieldsNames, _fields, criteriaMode, shouldUseNativeValidation) => {
    const fields = {};
    for (const name of fieldsNames) {
      const field = get(_fields, name);
      field && set(fields, name, field._f);
    }
    return {
      criteriaMode,
      names: [...fieldsNames],
      fields,
      shouldUseNativeValidation
    };
  };
  var isRegex = (value) => value instanceof RegExp;
  var getRuleValue = (rule) => isUndefined(rule) ? rule : isRegex(rule) ? rule.source : isObject(rule) ? isRegex(rule.value) ? rule.value.source : rule.value : rule;
  var getValidationModes = (mode) => ({
    isOnSubmit: !mode || mode === VALIDATION_MODE.onSubmit,
    isOnBlur: mode === VALIDATION_MODE.onBlur,
    isOnChange: mode === VALIDATION_MODE.onChange,
    isOnAll: mode === VALIDATION_MODE.all,
    isOnTouch: mode === VALIDATION_MODE.onTouched
  });
  var ASYNC_FUNCTION = "AsyncFunction";
  var hasPromiseValidation = (fieldReference) => !!fieldReference && !!fieldReference.validate && !!(isFunction(fieldReference.validate) && fieldReference.validate.constructor.name === ASYNC_FUNCTION || isObject(fieldReference.validate) && Object.values(fieldReference.validate).find((validateFunction) => validateFunction.constructor.name === ASYNC_FUNCTION));
  var hasValidation = (options) => options.mount && (options.required || options.min || options.max || options.maxLength || options.minLength || options.pattern || options.validate);
  var isWatched = (name, _names, isBlurEvent) => !isBlurEvent && (_names.watchAll || _names.watch.has(name) || [..._names.watch].some((watchName) => name.startsWith(watchName) && /^\.\w+/.test(name.slice(watchName.length))));
  var iterateFieldsByAction = (fields, action, fieldsNames, abortEarly) => {
    for (const key of fieldsNames || Object.keys(fields)) {
      const field = get(fields, key);
      if (field) {
        const { _f, ...currentField } = field;
        if (_f) {
          if (_f.refs && _f.refs[0] && action(_f.refs[0], key) && !abortEarly) {
            return true;
          } else if (_f.ref && action(_f.ref, _f.name) && !abortEarly) {
            return true;
          } else {
            if (iterateFieldsByAction(currentField, action)) {
              break;
            }
          }
        } else if (isObject(currentField)) {
          if (iterateFieldsByAction(currentField, action)) {
            break;
          }
        }
      }
    }
    return;
  };
  function schemaErrorLookup(errors, _fields, name) {
    const error = get(errors, name);
    if (error || isKey(name)) {
      return {
        error,
        name
      };
    }
    const names = name.split(".");
    while (names.length) {
      const fieldName = names.join(".");
      const field = get(_fields, fieldName);
      const foundError = get(errors, fieldName);
      if (field && !Array.isArray(field) && name !== fieldName) {
        return { name };
      }
      if (foundError && foundError.type) {
        return {
          name: fieldName,
          error: foundError
        };
      }
      if (foundError && foundError.root && foundError.root.type) {
        return {
          name: `${fieldName}.root`,
          error: foundError.root
        };
      }
      names.pop();
    }
    return {
      name
    };
  }
  var shouldRenderFormState = (formStateData, _proxyFormState, updateFormState, isRoot) => {
    updateFormState(formStateData);
    const { name, ...formState } = formStateData;
    return isEmptyObject(formState) || Object.keys(formState).length >= Object.keys(_proxyFormState).length || Object.keys(formState).find((key) => _proxyFormState[key] === (!isRoot || VALIDATION_MODE.all));
  };
  var shouldSubscribeByName = (name, signalName, exact) => !name || !signalName || name === signalName || convertToArrayPayload(name).some((currentName) => currentName && (exact ? currentName === signalName : currentName.startsWith(signalName) || signalName.startsWith(currentName)));
  var skipValidation = (isBlurEvent, isTouched, isSubmitted, reValidateMode, mode) => {
    if (mode.isOnAll) {
      return false;
    } else if (!isSubmitted && mode.isOnTouch) {
      return !(isTouched || isBlurEvent);
    } else if (isSubmitted ? reValidateMode.isOnBlur : mode.isOnBlur) {
      return !isBlurEvent;
    } else if (isSubmitted ? reValidateMode.isOnChange : mode.isOnChange) {
      return isBlurEvent;
    }
    return true;
  };
  var unsetEmptyArray = (ref, name) => !compact(get(ref, name)).length && unset(ref, name);
  var updateFieldArrayRootError = (errors, error, name) => {
    const fieldArrayErrors = convertToArrayPayload(get(errors, name));
    set(fieldArrayErrors, ROOT_ERROR_TYPE, error[name]);
    set(errors, name, fieldArrayErrors);
    return errors;
  };
  function getValidateError(result, ref, type = "validate") {
    if (isString(result) || Array.isArray(result) && result.every(isString) || isBoolean(result) && !result) {
      return {
        type,
        message: isString(result) ? result : "",
        ref
      };
    }
  }
  var getValueAndMessage = (validationData) => isObject(validationData) && !isRegex(validationData) ? validationData : {
    value: validationData,
    message: ""
  };
  var validateField = async (field, disabledFieldNames, formValues, validateAllFieldCriteria, shouldUseNativeValidation, isFieldArray) => {
    const { ref, refs, required, maxLength, minLength, min, max, pattern, validate, name, valueAsNumber, mount } = field._f;
    const inputValue = get(formValues, name);
    if (!mount || disabledFieldNames.has(name)) {
      return {};
    }
    const inputRef = refs ? refs[0] : ref;
    const setCustomValidity = (message) => {
      if (shouldUseNativeValidation && inputRef.reportValidity) {
        inputRef.setCustomValidity(isBoolean(message) ? "" : message || "");
        inputRef.reportValidity();
      }
    };
    const error = {};
    const isRadio = isRadioInput(ref);
    const isCheckBox = isCheckBoxInput(ref);
    const isRadioOrCheckbox2 = isRadio || isCheckBox;
    const isEmpty = (valueAsNumber || isFileInput(ref)) && isUndefined(ref.value) && isUndefined(inputValue) || isHTMLElement(ref) && ref.value === "" || inputValue === "" || Array.isArray(inputValue) && !inputValue.length;
    const appendErrorsCurry = appendErrors.bind(null, name, validateAllFieldCriteria, error);
    const getMinMaxMessage = (exceedMax, maxLengthMessage, minLengthMessage, maxType = INPUT_VALIDATION_RULES.maxLength, minType = INPUT_VALIDATION_RULES.minLength) => {
      const message = exceedMax ? maxLengthMessage : minLengthMessage;
      error[name] = {
        type: exceedMax ? maxType : minType,
        message,
        ref,
        ...appendErrorsCurry(exceedMax ? maxType : minType, message)
      };
    };
    if (isFieldArray ? !Array.isArray(inputValue) || !inputValue.length : required && (!isRadioOrCheckbox2 && (isEmpty || isNullOrUndefined(inputValue)) || isBoolean(inputValue) && !inputValue || isCheckBox && !getCheckboxValue(refs).isValid || isRadio && !getRadioValue(refs).isValid)) {
      const { value, message } = isString(required) ? { value: !!required, message: required } : getValueAndMessage(required);
      if (value) {
        error[name] = {
          type: INPUT_VALIDATION_RULES.required,
          message,
          ref: inputRef,
          ...appendErrorsCurry(INPUT_VALIDATION_RULES.required, message)
        };
        if (!validateAllFieldCriteria) {
          setCustomValidity(message);
          return error;
        }
      }
    }
    if (!isEmpty && (!isNullOrUndefined(min) || !isNullOrUndefined(max))) {
      let exceedMax;
      let exceedMin;
      const maxOutput = getValueAndMessage(max);
      const minOutput = getValueAndMessage(min);
      if (!isNullOrUndefined(inputValue) && !isNaN(inputValue)) {
        const valueNumber = ref.valueAsNumber || (inputValue ? +inputValue : inputValue);
        if (!isNullOrUndefined(maxOutput.value)) {
          exceedMax = valueNumber > maxOutput.value;
        }
        if (!isNullOrUndefined(minOutput.value)) {
          exceedMin = valueNumber < minOutput.value;
        }
      } else {
        const valueDate = ref.valueAsDate || new Date(inputValue);
        const convertTimeToDate = (time) => /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).toDateString() + " " + time);
        const isTime = ref.type == "time";
        const isWeek = ref.type == "week";
        if (isString(maxOutput.value) && inputValue) {
          exceedMax = isTime ? convertTimeToDate(inputValue) > convertTimeToDate(maxOutput.value) : isWeek ? inputValue > maxOutput.value : valueDate > new Date(maxOutput.value);
        }
        if (isString(minOutput.value) && inputValue) {
          exceedMin = isTime ? convertTimeToDate(inputValue) < convertTimeToDate(minOutput.value) : isWeek ? inputValue < minOutput.value : valueDate < new Date(minOutput.value);
        }
      }
      if (exceedMax || exceedMin) {
        getMinMaxMessage(!!exceedMax, maxOutput.message, minOutput.message, INPUT_VALIDATION_RULES.max, INPUT_VALIDATION_RULES.min);
        if (!validateAllFieldCriteria) {
          setCustomValidity(error[name].message);
          return error;
        }
      }
    }
    if ((maxLength || minLength) && !isEmpty && (isString(inputValue) || isFieldArray && Array.isArray(inputValue))) {
      const maxLengthOutput = getValueAndMessage(maxLength);
      const minLengthOutput = getValueAndMessage(minLength);
      const exceedMax = !isNullOrUndefined(maxLengthOutput.value) && inputValue.length > +maxLengthOutput.value;
      const exceedMin = !isNullOrUndefined(minLengthOutput.value) && inputValue.length < +minLengthOutput.value;
      if (exceedMax || exceedMin) {
        getMinMaxMessage(exceedMax, maxLengthOutput.message, minLengthOutput.message);
        if (!validateAllFieldCriteria) {
          setCustomValidity(error[name].message);
          return error;
        }
      }
    }
    if (pattern && !isEmpty && isString(inputValue)) {
      const { value: patternValue, message } = getValueAndMessage(pattern);
      if (isRegex(patternValue) && !inputValue.match(patternValue)) {
        error[name] = {
          type: INPUT_VALIDATION_RULES.pattern,
          message,
          ref,
          ...appendErrorsCurry(INPUT_VALIDATION_RULES.pattern, message)
        };
        if (!validateAllFieldCriteria) {
          setCustomValidity(message);
          return error;
        }
      }
    }
    if (validate) {
      if (isFunction(validate)) {
        const result = await validate(inputValue, formValues);
        const validateError = getValidateError(result, inputRef);
        if (validateError) {
          error[name] = {
            ...validateError,
            ...appendErrorsCurry(INPUT_VALIDATION_RULES.validate, validateError.message)
          };
          if (!validateAllFieldCriteria) {
            setCustomValidity(validateError.message);
            return error;
          }
        }
      } else if (isObject(validate)) {
        let validationResult = {};
        for (const key in validate) {
          if (!isEmptyObject(validationResult) && !validateAllFieldCriteria) {
            break;
          }
          const validateError = getValidateError(await validate[key](inputValue, formValues), inputRef, key);
          if (validateError) {
            validationResult = {
              ...validateError,
              ...appendErrorsCurry(key, validateError.message)
            };
            setCustomValidity(validateError.message);
            if (validateAllFieldCriteria) {
              error[name] = validationResult;
            }
          }
        }
        if (!isEmptyObject(validationResult)) {
          error[name] = {
            ref: inputRef,
            ...validationResult
          };
          if (!validateAllFieldCriteria) {
            return error;
          }
        }
      }
    }
    setCustomValidity(true);
    return error;
  };
  var defaultOptions = {
    mode: VALIDATION_MODE.onSubmit,
    reValidateMode: VALIDATION_MODE.onChange,
    shouldFocusError: true
  };
  function createFormControl(props = {}) {
    let _options = {
      ...defaultOptions,
      ...props
    };
    let _formState = {
      submitCount: 0,
      isDirty: false,
      isReady: false,
      isLoading: isFunction(_options.defaultValues),
      isValidating: false,
      isSubmitted: false,
      isSubmitting: false,
      isSubmitSuccessful: false,
      isValid: false,
      touchedFields: {},
      dirtyFields: {},
      validatingFields: {},
      errors: _options.errors || {},
      disabled: _options.disabled || false
    };
    let _fields = {};
    let _defaultValues = isObject(_options.defaultValues) || isObject(_options.values) ? cloneObject(_options.defaultValues || _options.values) || {} : {};
    let _formValues = _options.shouldUnregister ? {} : cloneObject(_defaultValues);
    let _state = {
      action: false,
      mount: false,
      watch: false,
      keepIsValid: false
    };
    let _names = {
      mount: /* @__PURE__ */ new Set(),
      disabled: /* @__PURE__ */ new Set(),
      unMount: /* @__PURE__ */ new Set(),
      array: /* @__PURE__ */ new Set(),
      watch: /* @__PURE__ */ new Set()
    };
    let delayErrorCallback;
    let timer = 0;
    const defaultProxyFormState = {
      isDirty: false,
      dirtyFields: false,
      validatingFields: false,
      touchedFields: false,
      isValidating: false,
      isValid: false,
      errors: false
    };
    const _proxyFormState = {
      ...defaultProxyFormState
    };
    let _proxySubscribeFormState = {
      ..._proxyFormState
    };
    const _subjects = {
      array: createSubject(),
      state: createSubject()
    };
    const shouldDisplayAllAssociatedErrors = _options.criteriaMode === VALIDATION_MODE.all;
    const debounce = (callback) => (wait) => {
      clearTimeout(timer);
      timer = setTimeout(callback, wait);
    };
    const _setValid = async (shouldUpdateValid) => {
      if (_state.keepIsValid) {
        return;
      }
      if (!_options.disabled && (_proxyFormState.isValid || _proxySubscribeFormState.isValid || shouldUpdateValid)) {
        let isValid;
        if (_options.resolver) {
          isValid = isEmptyObject((await _runSchema()).errors);
          _updateIsValidating();
        } else {
          isValid = await executeBuiltInValidation({
            fields: _fields,
            onlyCheckValid: true,
            eventType: EVENTS.VALID
          });
        }
        if (isValid !== _formState.isValid) {
          _subjects.state.next({
            isValid
          });
        }
      }
    };
    const _updateIsValidating = (names, isValidating) => {
      if (!_options.disabled && (_proxyFormState.isValidating || _proxyFormState.validatingFields || _proxySubscribeFormState.isValidating || _proxySubscribeFormState.validatingFields)) {
        (names || Array.from(_names.mount)).forEach((name) => {
          if (name) {
            isValidating ? set(_formState.validatingFields, name, isValidating) : unset(_formState.validatingFields, name);
          }
        });
        _subjects.state.next({
          validatingFields: _formState.validatingFields,
          isValidating: !isEmptyObject(_formState.validatingFields)
        });
      }
    };
    const _setFieldArray = (name, values = [], method, args, shouldSetValues = true, shouldUpdateFieldsAndState = true) => {
      if (args && method && !_options.disabled) {
        _state.action = true;
        if (shouldUpdateFieldsAndState && Array.isArray(get(_fields, name))) {
          const fieldValues = method(get(_fields, name), args.argA, args.argB);
          shouldSetValues && set(_fields, name, fieldValues);
        }
        if (shouldUpdateFieldsAndState && Array.isArray(get(_formState.errors, name))) {
          const errors = method(get(_formState.errors, name), args.argA, args.argB);
          shouldSetValues && set(_formState.errors, name, errors);
          unsetEmptyArray(_formState.errors, name);
        }
        if ((_proxyFormState.touchedFields || _proxySubscribeFormState.touchedFields) && shouldUpdateFieldsAndState && Array.isArray(get(_formState.touchedFields, name))) {
          const touchedFields = method(get(_formState.touchedFields, name), args.argA, args.argB);
          shouldSetValues && set(_formState.touchedFields, name, touchedFields);
        }
        if (_proxyFormState.dirtyFields || _proxySubscribeFormState.dirtyFields) {
          const fullDirtyFields = getDirtyFields(_defaultValues, _formValues);
          const rootName = getNodeParentName(name);
          set(_formState.dirtyFields, rootName, get(fullDirtyFields, rootName));
        }
        _subjects.state.next({
          name,
          isDirty: _getDirty(name, values),
          dirtyFields: _formState.dirtyFields,
          errors: _formState.errors,
          isValid: _formState.isValid
        });
      } else {
        set(_formValues, name, values);
      }
    };
    const updateErrors = (name, error) => {
      set(_formState.errors, name, error);
      _subjects.state.next({
        errors: _formState.errors
      });
    };
    const _setErrors = (errors) => {
      _formState.errors = errors;
      _subjects.state.next({
        errors: _formState.errors,
        isValid: false
      });
    };
    const updateValidAndValue = (name, shouldSkipSetValueAs, value, ref) => {
      const field = get(_fields, name);
      if (field) {
        const defaultValue = get(_formValues, name, isUndefined(value) ? get(_defaultValues, name) : value);
        isUndefined(defaultValue) || ref && ref.defaultChecked || shouldSkipSetValueAs ? set(_formValues, name, shouldSkipSetValueAs ? defaultValue : getFieldValue(field._f)) : setFieldValue(name, defaultValue);
        _state.mount && !_state.action && _setValid();
      }
    };
    const updateTouchAndDirty = (name, fieldValue, isBlurEvent, shouldDirty, shouldRender) => {
      let shouldUpdateField = false;
      let isPreviousDirty = false;
      const output = {
        name
      };
      if (!_options.disabled) {
        if (!isBlurEvent || shouldDirty) {
          if (_proxyFormState.isDirty || _proxySubscribeFormState.isDirty) {
            isPreviousDirty = _formState.isDirty;
            _formState.isDirty = output.isDirty = _getDirty();
            shouldUpdateField = isPreviousDirty !== output.isDirty;
          }
          const isCurrentFieldPristine = deepEqual(get(_defaultValues, name), fieldValue);
          isPreviousDirty = !!get(_formState.dirtyFields, name);
          isCurrentFieldPristine ? unset(_formState.dirtyFields, name) : set(_formState.dirtyFields, name, true);
          output.dirtyFields = _formState.dirtyFields;
          shouldUpdateField = shouldUpdateField || (_proxyFormState.dirtyFields || _proxySubscribeFormState.dirtyFields) && isPreviousDirty !== !isCurrentFieldPristine;
        }
        if (isBlurEvent) {
          const isPreviousFieldTouched = get(_formState.touchedFields, name);
          if (!isPreviousFieldTouched) {
            set(_formState.touchedFields, name, isBlurEvent);
            output.touchedFields = _formState.touchedFields;
            shouldUpdateField = shouldUpdateField || (_proxyFormState.touchedFields || _proxySubscribeFormState.touchedFields) && isPreviousFieldTouched !== isBlurEvent;
          }
        }
        shouldUpdateField && shouldRender && _subjects.state.next(output);
      }
      return shouldUpdateField ? output : {};
    };
    const shouldRenderByError = (name, isValid, error, fieldState) => {
      const previousFieldError = get(_formState.errors, name);
      const shouldUpdateValid = (_proxyFormState.isValid || _proxySubscribeFormState.isValid) && isBoolean(isValid) && _formState.isValid !== isValid;
      if (_options.delayError && error) {
        delayErrorCallback = debounce(() => updateErrors(name, error));
        delayErrorCallback(_options.delayError);
      } else {
        clearTimeout(timer);
        delayErrorCallback = null;
        error ? set(_formState.errors, name, error) : unset(_formState.errors, name);
      }
      if ((error ? !deepEqual(previousFieldError, error) : previousFieldError) || !isEmptyObject(fieldState) || shouldUpdateValid) {
        const updatedFormState = {
          ...fieldState,
          ...shouldUpdateValid && isBoolean(isValid) ? { isValid } : {},
          errors: _formState.errors,
          name
        };
        _formState = {
          ..._formState,
          ...updatedFormState
        };
        _subjects.state.next(updatedFormState);
      }
    };
    const _runSchema = async (name) => {
      _updateIsValidating(name, true);
      return await _options.resolver(_formValues, _options.context, getResolverOptions(name || _names.mount, _fields, _options.criteriaMode, _options.shouldUseNativeValidation));
    };
    const executeSchemaAndUpdateState = async (names) => {
      const { errors } = await _runSchema(names);
      _updateIsValidating(names);
      if (names) {
        for (const name of names) {
          const error = get(errors, name);
          error ? set(_formState.errors, name, error) : unset(_formState.errors, name);
        }
      } else {
        _formState.errors = errors;
      }
      return errors;
    };
    const validateForm = async ({ name, eventType }) => {
      if (props.validate) {
        const result = await props.validate({
          formValues: _formValues,
          formState: _formState,
          name,
          eventType
        });
        if (isObject(result)) {
          for (const key in result) {
            const error = result[key];
            if (error) {
              setError(`${FORM_ERROR_TYPE}.${key}`, {
                message: isString(result.message) ? result.message : "",
                type: INPUT_VALIDATION_RULES.validate
              });
            }
          }
        } else if (isString(result) || !result) {
          setError(FORM_ERROR_TYPE, {
            message: result || "",
            type: INPUT_VALIDATION_RULES.validate
          });
        } else {
          clearErrors(FORM_ERROR_TYPE);
        }
        return result;
      }
      return true;
    };
    const executeBuiltInValidation = async ({ fields, onlyCheckValid, name, eventType, context = {
      valid: true,
      runRootValidation: false
    } }) => {
      if (props.validate) {
        context.runRootValidation = true;
        const result = await validateForm({
          name,
          eventType
        });
        if (!result) {
          context.valid = false;
          if (onlyCheckValid) {
            return context.valid;
          }
        }
      }
      for (const name2 in fields) {
        const field = fields[name2];
        if (field) {
          const { _f, ...fieldValue } = field;
          if (_f) {
            const isFieldArrayRoot = _names.array.has(_f.name);
            const isPromiseFunction = field._f && hasPromiseValidation(field._f);
            if (isPromiseFunction && _proxyFormState.validatingFields) {
              _updateIsValidating([_f.name], true);
            }
            const fieldError = await validateField(field, _names.disabled, _formValues, shouldDisplayAllAssociatedErrors, _options.shouldUseNativeValidation && !onlyCheckValid, isFieldArrayRoot);
            if (isPromiseFunction && _proxyFormState.validatingFields) {
              _updateIsValidating([_f.name]);
            }
            if (fieldError[_f.name]) {
              context.valid = false;
              if (onlyCheckValid) {
                break;
              }
            }
            !onlyCheckValid && (get(fieldError, _f.name) ? isFieldArrayRoot ? updateFieldArrayRootError(_formState.errors, fieldError, _f.name) : set(_formState.errors, _f.name, fieldError[_f.name]) : unset(_formState.errors, _f.name));
            if (props.shouldUseNativeValidation && fieldError[_f.name]) {
              break;
            }
          }
          !isEmptyObject(fieldValue) && await executeBuiltInValidation({
            context,
            onlyCheckValid,
            fields: fieldValue,
            name: name2,
            eventType
          });
        }
      }
      return context.valid;
    };
    const _removeUnmounted = () => {
      for (const name of _names.unMount) {
        const field = get(_fields, name);
        field && (field._f.refs ? field._f.refs.every((ref) => !live(ref)) : !live(field._f.ref)) && unregister(name);
      }
      _names.unMount = /* @__PURE__ */ new Set();
    };
    const _getDirty = (name, data) => !_options.disabled && (name && data && set(_formValues, name, data), !deepEqual(getValues(), _defaultValues));
    const _getWatch = (names, defaultValue, isGlobal) => generateWatchOutput(names, _names, {
      ..._state.mount ? _formValues : isUndefined(defaultValue) ? _defaultValues : isString(names) ? { [names]: defaultValue } : defaultValue
    }, isGlobal, defaultValue);
    const _getFieldArray = (name) => compact(get(_state.mount ? _formValues : _defaultValues, name, _options.shouldUnregister ? get(_defaultValues, name, []) : []));
    const setFieldValue = (name, value, options = {}) => {
      const field = get(_fields, name);
      let fieldValue = value;
      if (field) {
        const fieldReference = field._f;
        if (fieldReference) {
          !fieldReference.disabled && set(_formValues, name, getFieldValueAs(value, fieldReference));
          fieldValue = isHTMLElement(fieldReference.ref) && isNullOrUndefined(value) ? "" : value;
          if (isMultipleSelect(fieldReference.ref)) {
            [...fieldReference.ref.options].forEach((optionRef) => optionRef.selected = fieldValue.includes(optionRef.value));
          } else if (fieldReference.refs) {
            if (isCheckBoxInput(fieldReference.ref)) {
              fieldReference.refs.forEach((checkboxRef) => {
                if (!checkboxRef.defaultChecked || !checkboxRef.disabled) {
                  if (Array.isArray(fieldValue)) {
                    checkboxRef.checked = !!fieldValue.find((data) => data === checkboxRef.value);
                  } else {
                    checkboxRef.checked = fieldValue === checkboxRef.value || !!fieldValue;
                  }
                }
              });
            } else {
              fieldReference.refs.forEach((radioRef) => radioRef.checked = radioRef.value === fieldValue);
            }
          } else if (isFileInput(fieldReference.ref)) {
            fieldReference.ref.value = "";
          } else {
            fieldReference.ref.value = fieldValue;
            if (!fieldReference.ref.type) {
              _subjects.state.next({
                name,
                values: cloneObject(_formValues)
              });
            }
          }
        }
      }
      (options.shouldDirty || options.shouldTouch) && updateTouchAndDirty(name, fieldValue, options.shouldTouch, options.shouldDirty, true);
      options.shouldValidate && trigger(name);
    };
    const setValues = (name, value, options) => {
      for (const fieldKey in value) {
        if (!value.hasOwnProperty(fieldKey)) {
          return;
        }
        const fieldValue = value[fieldKey];
        const fieldName = name + "." + fieldKey;
        const field = get(_fields, fieldName);
        (_names.array.has(name) || isObject(fieldValue) || field && !field._f) && !isDateObject(fieldValue) ? setValues(fieldName, fieldValue, options) : setFieldValue(fieldName, fieldValue, options);
      }
    };
    const setValue = (name, value, options = {}) => {
      const field = get(_fields, name);
      const isFieldArray = _names.array.has(name);
      const cloneValue = cloneObject(value);
      set(_formValues, name, cloneValue);
      if (isFieldArray) {
        _subjects.array.next({
          name,
          values: cloneObject(_formValues)
        });
        if ((_proxyFormState.isDirty || _proxyFormState.dirtyFields || _proxySubscribeFormState.isDirty || _proxySubscribeFormState.dirtyFields) && options.shouldDirty) {
          _subjects.state.next({
            name,
            dirtyFields: getDirtyFields(_defaultValues, _formValues),
            isDirty: _getDirty(name, cloneValue)
          });
        }
      } else {
        field && !field._f && !isNullOrUndefined(cloneValue) ? setValues(name, cloneValue, options) : setFieldValue(name, cloneValue, options);
      }
      if (isWatched(name, _names)) {
        _subjects.state.next({
          ..._formState,
          name,
          values: cloneObject(_formValues)
        });
      } else {
        _subjects.state.next({
          name: _state.mount ? name : void 0,
          values: cloneObject(_formValues)
        });
      }
    };
    const onChange = async (event) => {
      _state.mount = true;
      const target = event.target;
      let name = target.name;
      let isFieldValueUpdated = true;
      const field = get(_fields, name);
      const _updateIsFieldValueUpdated = (fieldValue) => {
        isFieldValueUpdated = Number.isNaN(fieldValue) || isDateObject(fieldValue) && isNaN(fieldValue.getTime()) || deepEqual(fieldValue, get(_formValues, name, fieldValue));
      };
      const validationModeBeforeSubmit = getValidationModes(_options.mode);
      const validationModeAfterSubmit = getValidationModes(_options.reValidateMode);
      if (field) {
        let error;
        let isValid;
        const fieldValue = target.type ? getFieldValue(field._f) : getEventValue(event);
        const isBlurEvent = event.type === EVENTS.BLUR || event.type === EVENTS.FOCUS_OUT;
        const shouldSkipValidation = !hasValidation(field._f) && !props.validate && !_options.resolver && !get(_formState.errors, name) && !field._f.deps || skipValidation(isBlurEvent, get(_formState.touchedFields, name), _formState.isSubmitted, validationModeAfterSubmit, validationModeBeforeSubmit);
        const watched = isWatched(name, _names, isBlurEvent);
        set(_formValues, name, fieldValue);
        if (isBlurEvent) {
          if (!target || !target.readOnly) {
            field._f.onBlur && field._f.onBlur(event);
            delayErrorCallback && delayErrorCallback(0);
          }
        } else if (field._f.onChange) {
          field._f.onChange(event);
        }
        const fieldState = updateTouchAndDirty(name, fieldValue, isBlurEvent);
        const shouldRender = !isEmptyObject(fieldState) || watched;
        !isBlurEvent && _subjects.state.next({
          name,
          type: event.type,
          values: cloneObject(_formValues)
        });
        if (shouldSkipValidation) {
          if (_proxyFormState.isValid || _proxySubscribeFormState.isValid) {
            if (_options.mode === "onBlur") {
              if (isBlurEvent) {
                _setValid();
              }
            } else if (!isBlurEvent) {
              _setValid();
            }
          }
          return shouldRender && _subjects.state.next({ name, ...watched ? {} : fieldState });
        }
        if (!_options.resolver && props.validate) {
          await validateForm({
            name,
            eventType: event.type
          });
        }
        !isBlurEvent && watched && _subjects.state.next({ ..._formState });
        if (_options.resolver) {
          const { errors } = await _runSchema([name]);
          _updateIsValidating([name]);
          _updateIsFieldValueUpdated(fieldValue);
          if (isFieldValueUpdated) {
            const previousErrorLookupResult = schemaErrorLookup(_formState.errors, _fields, name);
            const errorLookupResult = schemaErrorLookup(errors, _fields, previousErrorLookupResult.name || name);
            error = errorLookupResult.error;
            name = errorLookupResult.name;
            isValid = isEmptyObject(errors);
          }
        } else {
          _updateIsValidating([name], true);
          error = (await validateField(field, _names.disabled, _formValues, shouldDisplayAllAssociatedErrors, _options.shouldUseNativeValidation))[name];
          _updateIsValidating([name]);
          _updateIsFieldValueUpdated(fieldValue);
          if (isFieldValueUpdated) {
            if (error) {
              isValid = false;
            } else if (_proxyFormState.isValid || _proxySubscribeFormState.isValid) {
              isValid = await executeBuiltInValidation({
                fields: _fields,
                onlyCheckValid: true,
                name,
                eventType: event.type
              });
            }
          }
        }
        if (isFieldValueUpdated) {
          field._f.deps && (!Array.isArray(field._f.deps) || field._f.deps.length > 0) && trigger(field._f.deps);
          shouldRenderByError(name, isValid, error, fieldState);
        }
      }
    };
    const _focusInput = (ref, key) => {
      if (get(_formState.errors, key) && ref.focus) {
        ref.focus();
        return 1;
      }
      return;
    };
    const trigger = async (name, options = {}) => {
      let isValid;
      let validationResult;
      const fieldNames = convertToArrayPayload(name);
      if (_options.resolver) {
        const errors = await executeSchemaAndUpdateState(isUndefined(name) ? name : fieldNames);
        isValid = isEmptyObject(errors);
        validationResult = name ? !fieldNames.some((name2) => get(errors, name2)) : isValid;
      } else if (name) {
        validationResult = (await Promise.all(fieldNames.map(async (fieldName) => {
          const field = get(_fields, fieldName);
          return await executeBuiltInValidation({
            fields: field && field._f ? { [fieldName]: field } : field,
            eventType: EVENTS.TRIGGER
          });
        }))).every(Boolean);
        !(!validationResult && !_formState.isValid) && _setValid();
      } else {
        validationResult = isValid = await executeBuiltInValidation({
          fields: _fields,
          name,
          eventType: EVENTS.TRIGGER
        });
      }
      _subjects.state.next({
        ...!isString(name) || (_proxyFormState.isValid || _proxySubscribeFormState.isValid) && isValid !== _formState.isValid ? {} : { name },
        ..._options.resolver || !name ? { isValid } : {},
        errors: _formState.errors
      });
      options.shouldFocus && !validationResult && iterateFieldsByAction(_fields, _focusInput, name ? fieldNames : _names.mount);
      return validationResult;
    };
    const getValues = (fieldNames, config) => {
      let values = {
        ..._state.mount ? _formValues : _defaultValues
      };
      if (config) {
        values = extractFormValues(config.dirtyFields ? _formState.dirtyFields : _formState.touchedFields, values);
      }
      return isUndefined(fieldNames) ? values : isString(fieldNames) ? get(values, fieldNames) : fieldNames.map((name) => get(values, name));
    };
    const getFieldState = (name, formState) => ({
      invalid: !!get((formState || _formState).errors, name),
      isDirty: !!get((formState || _formState).dirtyFields, name),
      error: get((formState || _formState).errors, name),
      isValidating: !!get(_formState.validatingFields, name),
      isTouched: !!get((formState || _formState).touchedFields, name)
    });
    const clearErrors = (name) => {
      const names = name ? convertToArrayPayload(name) : void 0;
      names === null || names === void 0 ? void 0 : names.forEach((inputName) => unset(_formState.errors, inputName));
      if (names) {
        names.forEach((inputName) => {
          _subjects.state.next({
            name: inputName,
            errors: _formState.errors
          });
        });
      } else {
        _subjects.state.next({
          errors: {}
        });
      }
    };
    const setError = (name, error, options) => {
      const ref = (get(_fields, name, { _f: {} })._f || {}).ref;
      const currentError = get(_formState.errors, name) || {};
      const { ref: currentRef, message, type, ...restOfErrorTree } = currentError;
      set(_formState.errors, name, {
        ...restOfErrorTree,
        ...error,
        ref
      });
      _subjects.state.next({
        name,
        errors: _formState.errors,
        isValid: false
      });
      options && options.shouldFocus && ref && ref.focus && ref.focus();
    };
    const watch = (name, defaultValue) => isFunction(name) ? _subjects.state.subscribe({
      next: (payload) => "values" in payload && name(_getWatch(void 0, defaultValue), payload)
    }) : _getWatch(name, defaultValue, true);
    const _subscribe = (props2) => _subjects.state.subscribe({
      next: (formState) => {
        if (shouldSubscribeByName(props2.name, formState.name, props2.exact) && shouldRenderFormState(formState, props2.formState || _proxyFormState, _setFormState, props2.reRenderRoot)) {
          props2.callback({
            values: { ..._formValues },
            ..._formState,
            ...formState,
            defaultValues: _defaultValues
          });
        }
      }
    }).unsubscribe;
    const subscribe = (props2) => {
      _state.mount = true;
      _proxySubscribeFormState = {
        ..._proxySubscribeFormState,
        ...props2.formState
      };
      return _subscribe({
        ...props2,
        formState: {
          ...defaultProxyFormState,
          ...props2.formState
        }
      });
    };
    const unregister = (name, options = {}) => {
      for (const fieldName of name ? convertToArrayPayload(name) : _names.mount) {
        _names.mount.delete(fieldName);
        _names.array.delete(fieldName);
        if (!options.keepValue) {
          unset(_fields, fieldName);
          unset(_formValues, fieldName);
        }
        !options.keepError && unset(_formState.errors, fieldName);
        !options.keepDirty && unset(_formState.dirtyFields, fieldName);
        !options.keepTouched && unset(_formState.touchedFields, fieldName);
        !options.keepIsValidating && unset(_formState.validatingFields, fieldName);
        !_options.shouldUnregister && !options.keepDefaultValue && unset(_defaultValues, fieldName);
      }
      _subjects.state.next({
        values: cloneObject(_formValues)
      });
      _subjects.state.next({
        ..._formState,
        ...!options.keepDirty ? {} : { isDirty: _getDirty() }
      });
      !options.keepIsValid && _setValid();
    };
    const _setDisabledField = ({ disabled, name }) => {
      if (isBoolean(disabled) && _state.mount || !!disabled || _names.disabled.has(name)) {
        const wasDisabled = _names.disabled.has(name);
        const isDisabled = !!disabled;
        const disabledStateChanged = wasDisabled !== isDisabled;
        disabled ? _names.disabled.add(name) : _names.disabled.delete(name);
        disabledStateChanged && _state.mount && !_state.action && _setValid();
      }
    };
    const register = (name, options = {}) => {
      let field = get(_fields, name);
      const disabledIsDefined = isBoolean(options.disabled) || isBoolean(_options.disabled);
      set(_fields, name, {
        ...field || {},
        _f: {
          ...field && field._f ? field._f : { ref: { name } },
          name,
          mount: true,
          ...options
        }
      });
      _names.mount.add(name);
      if (field) {
        _setDisabledField({
          disabled: isBoolean(options.disabled) ? options.disabled : _options.disabled,
          name
        });
      } else {
        updateValidAndValue(name, true, options.value);
      }
      return {
        ...disabledIsDefined ? { disabled: options.disabled || _options.disabled } : {},
        ..._options.progressive ? {
          required: !!options.required,
          min: getRuleValue(options.min),
          max: getRuleValue(options.max),
          minLength: getRuleValue(options.minLength),
          maxLength: getRuleValue(options.maxLength),
          pattern: getRuleValue(options.pattern)
        } : {},
        name,
        onChange,
        onBlur: onChange,
        ref: (ref) => {
          if (ref) {
            register(name, options);
            field = get(_fields, name);
            const fieldRef = isUndefined(ref.value) ? ref.querySelectorAll ? ref.querySelectorAll("input,select,textarea")[0] || ref : ref : ref;
            const radioOrCheckbox = isRadioOrCheckbox(fieldRef);
            const refs = field._f.refs || [];
            if (radioOrCheckbox ? refs.find((option) => option === fieldRef) : fieldRef === field._f.ref) {
              return;
            }
            set(_fields, name, {
              _f: {
                ...field._f,
                ...radioOrCheckbox ? {
                  refs: [
                    ...refs.filter(live),
                    fieldRef,
                    ...Array.isArray(get(_defaultValues, name)) ? [{}] : []
                  ],
                  ref: { type: fieldRef.type, name }
                } : { ref: fieldRef }
              }
            });
            updateValidAndValue(name, false, void 0, fieldRef);
          } else {
            field = get(_fields, name, {});
            if (field._f) {
              field._f.mount = false;
            }
            (_options.shouldUnregister || options.shouldUnregister) && !(isNameInFieldArray(_names.array, name) && _state.action) && _names.unMount.add(name);
          }
        }
      };
    };
    const _focusError = () => _options.shouldFocusError && iterateFieldsByAction(_fields, _focusInput, _names.mount);
    const _disableForm = (disabled) => {
      if (isBoolean(disabled)) {
        _subjects.state.next({ disabled });
        iterateFieldsByAction(_fields, (ref, name) => {
          const currentField = get(_fields, name);
          if (currentField) {
            ref.disabled = currentField._f.disabled || disabled;
            if (Array.isArray(currentField._f.refs)) {
              currentField._f.refs.forEach((inputRef) => {
                inputRef.disabled = currentField._f.disabled || disabled;
              });
            }
          }
        }, 0, false);
      }
    };
    const handleSubmit = (onValid, onInvalid) => async (e) => {
      let onValidError = void 0;
      if (e) {
        e.preventDefault && e.preventDefault();
        e.persist && e.persist();
      }
      let fieldValues = cloneObject(_formValues);
      _subjects.state.next({
        isSubmitting: true
      });
      if (_options.resolver) {
        const { errors, values } = await _runSchema();
        _updateIsValidating();
        _formState.errors = errors;
        fieldValues = cloneObject(values);
      } else {
        await executeBuiltInValidation({
          fields: _fields,
          eventType: EVENTS.SUBMIT
        });
      }
      if (_names.disabled.size) {
        for (const name of _names.disabled) {
          unset(fieldValues, name);
        }
      }
      unset(_formState.errors, ROOT_ERROR_TYPE);
      if (isEmptyObject(_formState.errors)) {
        _subjects.state.next({
          errors: {}
        });
        try {
          await onValid(fieldValues, e);
        } catch (error) {
          onValidError = error;
        }
      } else {
        if (onInvalid) {
          await onInvalid({ ..._formState.errors }, e);
        }
        _focusError();
        setTimeout(_focusError);
      }
      _subjects.state.next({
        isSubmitted: true,
        isSubmitting: false,
        isSubmitSuccessful: isEmptyObject(_formState.errors) && !onValidError,
        submitCount: _formState.submitCount + 1,
        errors: _formState.errors
      });
      if (onValidError) {
        throw onValidError;
      }
    };
    const resetField = (name, options = {}) => {
      if (get(_fields, name)) {
        if (isUndefined(options.defaultValue)) {
          setValue(name, cloneObject(get(_defaultValues, name)));
        } else {
          setValue(name, options.defaultValue);
          set(_defaultValues, name, cloneObject(options.defaultValue));
        }
        if (!options.keepTouched) {
          unset(_formState.touchedFields, name);
        }
        if (!options.keepDirty) {
          unset(_formState.dirtyFields, name);
          _formState.isDirty = options.defaultValue ? _getDirty(name, cloneObject(get(_defaultValues, name))) : _getDirty();
        }
        if (!options.keepError) {
          unset(_formState.errors, name);
          _proxyFormState.isValid && _setValid();
        }
        _subjects.state.next({ ..._formState });
      }
    };
    const _reset = (formValues, keepStateOptions = {}) => {
      const updatedValues = formValues ? cloneObject(formValues) : _defaultValues;
      const cloneUpdatedValues = cloneObject(updatedValues);
      const isEmptyResetValues = isEmptyObject(formValues);
      const values = isEmptyResetValues ? _defaultValues : cloneUpdatedValues;
      if (!keepStateOptions.keepDefaultValues) {
        _defaultValues = updatedValues;
      }
      if (!keepStateOptions.keepValues) {
        if (keepStateOptions.keepDirtyValues) {
          const fieldsToCheck = /* @__PURE__ */ new Set([
            ..._names.mount,
            ...Object.keys(getDirtyFields(_defaultValues, _formValues))
          ]);
          for (const fieldName of Array.from(fieldsToCheck)) {
            const isDirty = get(_formState.dirtyFields, fieldName);
            const existingValue = get(_formValues, fieldName);
            const newValue = get(values, fieldName);
            if (isDirty && !isUndefined(existingValue)) {
              set(values, fieldName, existingValue);
            } else if (!isDirty && !isUndefined(newValue)) {
              setValue(fieldName, newValue);
            }
          }
        } else {
          if (isWeb && isUndefined(formValues)) {
            for (const name of _names.mount) {
              const field = get(_fields, name);
              if (field && field._f) {
                const fieldReference = Array.isArray(field._f.refs) ? field._f.refs[0] : field._f.ref;
                if (isHTMLElement(fieldReference)) {
                  const form = fieldReference.closest("form");
                  if (form) {
                    form.reset();
                    break;
                  }
                }
              }
            }
          }
          if (keepStateOptions.keepFieldsRef) {
            for (const fieldName of _names.mount) {
              setValue(fieldName, get(values, fieldName));
            }
          } else {
            _fields = {};
          }
        }
        _formValues = _options.shouldUnregister ? keepStateOptions.keepDefaultValues ? cloneObject(_defaultValues) : {} : cloneObject(values);
        _subjects.array.next({
          values: { ...values }
        });
        _subjects.state.next({
          values: { ...values }
        });
      }
      _names = {
        mount: keepStateOptions.keepDirtyValues ? _names.mount : /* @__PURE__ */ new Set(),
        unMount: /* @__PURE__ */ new Set(),
        array: /* @__PURE__ */ new Set(),
        disabled: /* @__PURE__ */ new Set(),
        watch: /* @__PURE__ */ new Set(),
        watchAll: false,
        focus: ""
      };
      _state.mount = !_proxyFormState.isValid || !!keepStateOptions.keepIsValid || !!keepStateOptions.keepDirtyValues || !_options.shouldUnregister && !isEmptyObject(values);
      _state.watch = !!_options.shouldUnregister;
      _state.keepIsValid = !!keepStateOptions.keepIsValid;
      _state.action = false;
      if (!keepStateOptions.keepErrors) {
        _formState.errors = {};
      }
      _subjects.state.next({
        submitCount: keepStateOptions.keepSubmitCount ? _formState.submitCount : 0,
        isDirty: isEmptyResetValues ? false : keepStateOptions.keepDirty ? _formState.isDirty : !!(keepStateOptions.keepDefaultValues && !deepEqual(formValues, _defaultValues)),
        isSubmitted: keepStateOptions.keepIsSubmitted ? _formState.isSubmitted : false,
        dirtyFields: isEmptyResetValues ? {} : keepStateOptions.keepDirtyValues ? keepStateOptions.keepDefaultValues && _formValues ? getDirtyFields(_defaultValues, _formValues) : _formState.dirtyFields : keepStateOptions.keepDefaultValues && formValues ? getDirtyFields(_defaultValues, formValues) : keepStateOptions.keepDirty ? _formState.dirtyFields : {},
        touchedFields: keepStateOptions.keepTouched ? _formState.touchedFields : {},
        errors: keepStateOptions.keepErrors ? _formState.errors : {},
        isSubmitSuccessful: keepStateOptions.keepIsSubmitSuccessful ? _formState.isSubmitSuccessful : false,
        isSubmitting: false,
        defaultValues: _defaultValues
      });
    };
    const reset = (formValues, keepStateOptions) => _reset(isFunction(formValues) ? formValues(_formValues) : formValues, { ..._options.resetOptions, ...keepStateOptions });
    const setFocus = (name, options = {}) => {
      const field = get(_fields, name);
      const fieldReference = field && field._f;
      if (fieldReference) {
        const fieldRef = fieldReference.refs ? fieldReference.refs[0] : fieldReference.ref;
        if (fieldRef.focus) {
          setTimeout(() => {
            fieldRef.focus();
            options.shouldSelect && isFunction(fieldRef.select) && fieldRef.select();
          });
        }
      }
    };
    const _setFormState = (updatedFormState) => {
      _formState = {
        ..._formState,
        ...updatedFormState
      };
    };
    const _resetDefaultValues = () => isFunction(_options.defaultValues) && _options.defaultValues().then((values) => {
      reset(values, _options.resetOptions);
      _subjects.state.next({
        isLoading: false
      });
    });
    const methods = {
      control: {
        register,
        unregister,
        getFieldState,
        handleSubmit,
        setError,
        _subscribe,
        _runSchema,
        _updateIsValidating,
        _focusError,
        _getWatch,
        _getDirty,
        _setValid,
        _setFieldArray,
        _setDisabledField,
        _setErrors,
        _getFieldArray,
        _reset,
        _resetDefaultValues,
        _removeUnmounted,
        _disableForm,
        _subjects,
        _proxyFormState,
        get _fields() {
          return _fields;
        },
        get _formValues() {
          return _formValues;
        },
        get _state() {
          return _state;
        },
        set _state(value) {
          _state = value;
        },
        get _defaultValues() {
          return _defaultValues;
        },
        get _names() {
          return _names;
        },
        set _names(value) {
          _names = value;
        },
        get _formState() {
          return _formState;
        },
        get _options() {
          return _options;
        },
        set _options(value) {
          _options = {
            ..._options,
            ...value
          };
        }
      },
      subscribe,
      trigger,
      register,
      handleSubmit,
      watch,
      setValue,
      getValues,
      reset,
      resetField,
      clearErrors,
      unregister,
      setError,
      setFocus,
      getFieldState
    };
    return {
      ...methods,
      formControl: methods
    };
  }
  function useForm(props = {}) {
    const _formControl = import_react.default.useRef(void 0);
    const _values = import_react.default.useRef(void 0);
    const [formState, updateFormState] = import_react.default.useState({
      isDirty: false,
      isValidating: false,
      isLoading: isFunction(props.defaultValues),
      isSubmitted: false,
      isSubmitting: false,
      isSubmitSuccessful: false,
      isValid: false,
      submitCount: 0,
      dirtyFields: {},
      touchedFields: {},
      validatingFields: {},
      errors: props.errors || {},
      disabled: props.disabled || false,
      isReady: false,
      defaultValues: isFunction(props.defaultValues) ? void 0 : props.defaultValues
    });
    if (!_formControl.current) {
      if (props.formControl) {
        _formControl.current = {
          ...props.formControl,
          formState
        };
        if (props.defaultValues && !isFunction(props.defaultValues)) {
          props.formControl.reset(props.defaultValues, props.resetOptions);
        }
      } else {
        const { formControl, ...rest } = createFormControl(props);
        _formControl.current = {
          ...rest,
          formState
        };
      }
    }
    const control = _formControl.current.control;
    control._options = props;
    useIsomorphicLayoutEffect(() => {
      const sub = control._subscribe({
        formState: control._proxyFormState,
        callback: () => updateFormState({ ...control._formState }),
        reRenderRoot: true
      });
      updateFormState((data) => ({
        ...data,
        isReady: true
      }));
      control._formState.isReady = true;
      return sub;
    }, [control]);
    import_react.default.useEffect(() => control._disableForm(props.disabled), [control, props.disabled]);
    import_react.default.useEffect(() => {
      if (props.mode) {
        control._options.mode = props.mode;
      }
      if (props.reValidateMode) {
        control._options.reValidateMode = props.reValidateMode;
      }
    }, [control, props.mode, props.reValidateMode]);
    import_react.default.useEffect(() => {
      if (props.errors) {
        control._setErrors(props.errors);
        control._focusError();
      }
    }, [control, props.errors]);
    import_react.default.useEffect(() => {
      props.shouldUnregister && control._subjects.state.next({
        values: control._getWatch()
      });
    }, [control, props.shouldUnregister]);
    import_react.default.useEffect(() => {
      if (control._proxyFormState.isDirty) {
        const isDirty = control._getDirty();
        if (isDirty !== formState.isDirty) {
          control._subjects.state.next({
            isDirty
          });
        }
      }
    }, [control, formState.isDirty]);
    import_react.default.useEffect(() => {
      var _a;
      if (props.values && !deepEqual(props.values, _values.current)) {
        control._reset(props.values, {
          keepFieldsRef: true,
          ...control._options.resetOptions
        });
        if (!((_a = control._options.resetOptions) === null || _a === void 0 ? void 0 : _a.keepIsValid)) {
          control._setValid();
        }
        _values.current = props.values;
        updateFormState((state) => ({ ...state }));
      } else {
        control._resetDefaultValues();
      }
    }, [control, props.values]);
    import_react.default.useEffect(() => {
      if (!control._state.mount) {
        control._setValid();
        control._state.mount = true;
      }
      if (control._state.watch) {
        control._state.watch = false;
        control._subjects.state.next({ ...control._formState });
      }
      control._removeUnmounted();
    });
    _formControl.current.formState = import_react.default.useMemo(() => getProxyFormState(formState, control), [control, formState]);
    return _formControl.current;
  }

  // client/src/components/ui/form.tsx
  init_define_import_meta_env();
  var React7 = __toESM(require_react_shim());

  // ../../../node_modules/@radix-ui/react-slot/dist/index.mjs
  init_define_import_meta_env();
  var React3 = __toESM(require_react_shim(), 1);

  // ../../../node_modules/@radix-ui/react-compose-refs/dist/index.mjs
  init_define_import_meta_env();
  var React2 = __toESM(require_react_shim(), 1);
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
  var use = React3[" use ".trim().toString()];
  function isPromiseLike(value) {
    return typeof value === "object" && value !== null && "then" in value;
  }
  function isLazyComponent(element) {
    return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
  }
  // @__NO_SIDE_EFFECTS__
  function createSlot(ownerName) {
    const SlotClone = /* @__PURE__ */ createSlotClone(ownerName);
    const Slot2 = React3.forwardRef((props, forwardedRef) => {
      let { children, ...slotProps } = props;
      if (isLazyComponent(children) && typeof use === "function") {
        children = use(children._payload);
      }
      const childrenArray = React3.Children.toArray(children);
      const slottable = childrenArray.find(isSlottable);
      if (slottable) {
        const newElement = slottable.props.children;
        const newChildren = childrenArray.map((child) => {
          if (child === slottable) {
            if (React3.Children.count(newElement) > 1) return React3.Children.only(null);
            return React3.isValidElement(newElement) ? newElement.props.children : null;
          } else {
            return child;
          }
        });
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotClone, { ...slotProps, ref: forwardedRef, children: React3.isValidElement(newElement) ? React3.cloneElement(newElement, void 0, newChildren) : null });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotClone, { ...slotProps, ref: forwardedRef, children });
    });
    Slot2.displayName = `${ownerName}.Slot`;
    return Slot2;
  }
  var Slot = /* @__PURE__ */ createSlot("Slot");
  // @__NO_SIDE_EFFECTS__
  function createSlotClone(ownerName) {
    const SlotClone = React3.forwardRef((props, forwardedRef) => {
      let { children, ...slotProps } = props;
      if (isLazyComponent(children) && typeof use === "function") {
        children = use(children._payload);
      }
      if (React3.isValidElement(children)) {
        const childrenRef = getElementRef(children);
        const props2 = mergeProps(slotProps, children.props);
        if (children.type !== React3.Fragment) {
          props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
        }
        return React3.cloneElement(children, props2);
      }
      return React3.Children.count(children) > 1 ? React3.Children.only(null) : null;
    });
    SlotClone.displayName = `${ownerName}.SlotClone`;
    return SlotClone;
  }
  var SLOTTABLE_IDENTIFIER = /* @__PURE__ */ Symbol("radix.slottable");
  function isSlottable(child) {
    return React3.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
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

  // client/src/components/ui/label.tsx
  init_define_import_meta_env();
  var React6 = __toESM(require_react_shim());

  // ../../../node_modules/@radix-ui/react-label/dist/index.mjs
  init_define_import_meta_env();
  var React5 = __toESM(require_react_shim(), 1);

  // ../../../node_modules/@radix-ui/react-label/node_modules/@radix-ui/react-primitive/dist/index.mjs
  init_define_import_meta_env();
  var React4 = __toESM(require_react_shim(), 1);
  var ReactDOM = __toESM(require_react_dom_shim(), 1);
  var import_jsx_runtime2 = __toESM(require_react_shim(), 1);
  var NODES = [
    "a",
    "button",
    "div",
    "form",
    "h2",
    "h3",
    "img",
    "input",
    "label",
    "li",
    "nav",
    "ol",
    "p",
    "select",
    "span",
    "svg",
    "ul"
  ];
  var Primitive = NODES.reduce((primitive, node) => {
    const Slot2 = createSlot(`Primitive.${node}`);
    const Node = React4.forwardRef((props, forwardedRef) => {
      const { asChild, ...primitiveProps } = props;
      const Comp = asChild ? Slot2 : node;
      if (typeof window !== "undefined") {
        window[/* @__PURE__ */ Symbol.for("radix-ui")] = true;
      }
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Comp, { ...primitiveProps, ref: forwardedRef });
    });
    Node.displayName = `Primitive.${node}`;
    return { ...primitive, [node]: Node };
  }, {});

  // ../../../node_modules/@radix-ui/react-label/dist/index.mjs
  var import_jsx_runtime3 = __toESM(require_react_shim(), 1);
  var NAME = "Label";
  var Label = React5.forwardRef((props, forwardedRef) => {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Primitive.label,
      {
        ...props,
        ref: forwardedRef,
        onMouseDown: (event) => {
          const target = event.target;
          if (target.closest("button, input, select, textarea")) return;
          props.onMouseDown?.(event);
          if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
        }
      }
    );
  });
  Label.displayName = NAME;
  var Root = Label;

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

  // client/src/components/ui/label.tsx
  var import_jsx_runtime4 = __toESM(require_react_shim());
  var labelVariants = cva(
    "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
  );
  var Label2 = React6.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    Root,
    {
      ref,
      className: cn(labelVariants(), className),
      ...props
    }
  ));
  Label2.displayName = Root.displayName;

  // client/src/components/ui/form.tsx
  var import_jsx_runtime5 = __toESM(require_react_shim());
  var Form = FormProvider;
  var FormFieldContext = React7.createContext(null);
  var FormField = ({
    ...props
  }) => {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FormFieldContext.Provider, { value: { name: props.name }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Controller, { ...props }) });
  };
  var useFormField = () => {
    const fieldContext = React7.useContext(FormFieldContext);
    const itemContext = React7.useContext(FormItemContext);
    const { getFieldState, formState } = useFormContext();
    if (!fieldContext) {
      throw new Error("useFormField should be used within <FormField>");
    }
    if (!itemContext) {
      throw new Error("useFormField should be used within <FormItem>");
    }
    const fieldState = getFieldState(fieldContext.name, formState);
    const { id } = itemContext;
    return {
      id,
      name: fieldContext.name,
      formItemId: `${id}-form-item`,
      formDescriptionId: `${id}-form-item-description`,
      formMessageId: `${id}-form-item-message`,
      ...fieldState
    };
  };
  var FormItemContext = React7.createContext(null);
  var FormItem = React7.forwardRef(({ className, ...props }, ref) => {
    const id = React7.useId();
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FormItemContext.Provider, { value: { id }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { ref, className: cn("space-y-2", className), ...props }) });
  });
  FormItem.displayName = "FormItem";
  var FormLabel = React7.forwardRef(({ className, ...props }, ref) => {
    const { error, formItemId } = useFormField();
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      Label2,
      {
        ref,
        className: cn(error && "text-destructive", className),
        htmlFor: formItemId,
        ...props
      }
    );
  });
  FormLabel.displayName = "FormLabel";
  var FormControl = React7.forwardRef(({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      Slot,
      {
        ref,
        id: formItemId,
        "aria-describedby": !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`,
        "aria-invalid": !!error,
        ...props
      }
    );
  });
  FormControl.displayName = "FormControl";
  var FormDescription = React7.forwardRef(({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "p",
      {
        ref,
        id: formDescriptionId,
        className: cn("text-[0.8rem] text-muted-foreground", className),
        ...props
      }
    );
  });
  FormDescription.displayName = "FormDescription";
  var FormMessage = React7.forwardRef(({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error?.message ?? "") : children;
    if (!body) {
      return null;
    }
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "p",
      {
        ref,
        id: formMessageId,
        className: cn("text-[0.8rem] font-medium text-destructive", className),
        ...props,
        children: body
      }
    );
  });
  FormMessage.displayName = "FormMessage";

  // client/src/components/ui/input.tsx
  init_define_import_meta_env();
  var React8 = __toESM(require_react_shim());
  var import_jsx_runtime6 = __toESM(require_react_shim());
  var Input = React8.forwardRef(
    ({ className, type, ...props }, ref) => {
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "input",
        {
          type,
          className: cn(
            // E2E-1013 (Plan 03 Phase 9): focus-visible uses `--color-focus-ring`
            // (palette-independent) instead of brand `--color-ring`, and ring
            // width bumped 1 -> 2 with a 2px offset so the indicator reads
            // against any theme surface (WCAG 2.1 AA §1.4.11).
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          ),
          ref,
          ...props
        }
      );
    }
  );
  Input.displayName = "Input";

  // client/src/components/ui/button.tsx
  init_define_import_meta_env();
  var React9 = __toESM(require_react_shim());
  var import_jsx_runtime7 = __toESM(require_react_shim());
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
  var Button = React9.forwardRef(
    ({ className, variant, size, asChild = false, type, ...props }, ref) => {
      const Comp = asChild ? Slot : "button";
      if (asChild) {
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          Comp,
          {
            className: cn(buttonVariants({ variant, size, className })),
            ref,
            ...props
          }
        );
      }
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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

  // .design-sync/previews/Form.tsx
  var import_jsx_runtime8 = __toESM(require_react_shim(), 1);
  var Surface = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "bg-background text-foreground", style: { padding: 24, maxWidth: 460 }, children });
  function ComponentProperties() {
    const form = useForm({
      defaultValues: { refDes: "U1", mpn: "ATmega328P-PU", value: "" }
    });
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Form, { ...form, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("form", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        FormField,
        {
          control: form.control,
          name: "refDes",
          render: ({ field }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(FormItem, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormLabel, { children: "Reference designator" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Input, { placeholder: "U1", ...field }) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormDescription, { children: "Unique identifier on the schematic and silkscreen." })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        FormField,
        {
          control: form.control,
          name: "mpn",
          render: ({ field }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(FormItem, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormLabel, { children: "Manufacturer part number" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Input, { placeholder: "e.g. ATmega328P-PU", ...field }) })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { type: "button", children: "Save component" })
    ] }) }) });
  }
  function NetLabelWithError() {
    const form = useForm({ defaultValues: { netName: "" } });
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Form, { ...form, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("form", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        FormField,
        {
          control: form.control,
          name: "netName",
          render: ({ field }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(FormItem, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormLabel, { children: "Net name" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Input, { placeholder: "+3V3", ...field }) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormDescription, { children: "Power nets get a power-flag symbol automatically." }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(FormMessage, { children: "Net name “GND” already exists on this sheet." })
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { type: "button", variant: "outline", children: "Rename net" })
    ] }) }) });
  }
  return __toCommonJS(Form_exports);
})();
