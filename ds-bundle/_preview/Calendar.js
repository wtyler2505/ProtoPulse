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
      function jsxs(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx5;
      module.exports.jsxs = jsxs;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs : jsx5)(t, p, k);
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

  // .design-sync/previews/Calendar.tsx
  var Calendar_exports = {};
  __export(Calendar_exports, {
    FabRunDate: () => FabRunDate,
    ProductionWindow: () => ProductionWindow
  });
  init_define_import_meta_env();
  var import_react33 = __toESM(require_react_shim(), 1);

  // client/src/components/ui/calendar.tsx
  init_define_import_meta_env();
  var React31 = __toESM(require_react_shim());

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.ProtoPulse;
  var ds_default = "default" in g ? g.default : g;

  // ../../../node_modules/@date-fns/tz/index.js
  init_define_import_meta_env();

  // ../../../node_modules/@date-fns/tz/constants/index.js
  init_define_import_meta_env();

  // ../../../node_modules/@date-fns/tz/date/index.js
  init_define_import_meta_env();

  // ../../../node_modules/@date-fns/tz/tzName/index.js
  init_define_import_meta_env();
  function tzName(timeZone, date, format2 = "long") {
    return new Intl.DateTimeFormat("en-US", {
      // Enforces engine to render the time. Without the option JavaScriptCore omits it.
      hour: "numeric",
      timeZone,
      timeZoneName: format2
    }).format(date).split(/\s/g).slice(2).join(" ");
  }

  // ../../../node_modules/@date-fns/tz/date/mini.js
  init_define_import_meta_env();

  // ../../../node_modules/@date-fns/tz/tzOffset/index.js
  init_define_import_meta_env();
  var offsetFormatCache = {};
  var offsetCache = {};
  function tzOffset(timeZone, date) {
    try {
      const format2 = offsetFormatCache[timeZone] ||= new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "longOffset"
      }).format;
      const offsetStr = format2(date).split("GMT")[1];
      if (offsetStr in offsetCache) return offsetCache[offsetStr];
      return calcOffset(offsetStr, offsetStr.split(":"));
    } catch {
      if (timeZone in offsetCache) return offsetCache[timeZone];
      const captures = timeZone?.match(offsetRe);
      if (captures) return calcOffset(timeZone, captures.slice(1));
      return NaN;
    }
  }
  var offsetRe = /([+-]\d\d):?(\d\d)?/;
  function calcOffset(cacheStr, values) {
    const hours = +(values[0] || 0);
    const minutes = +(values[1] || 0);
    const seconds = +(values[2] || 0) / 60;
    return offsetCache[cacheStr] = hours * 60 + minutes > 0 ? hours * 60 + minutes + seconds : hours * 60 - minutes - seconds;
  }

  // ../../../node_modules/@date-fns/tz/date/mini.js
  var TZDateMini = class _TZDateMini extends Date {
    //#region static
    constructor(...args) {
      super();
      if (args.length > 1 && typeof args[args.length - 1] === "string") {
        this.timeZone = args.pop();
      }
      this.internal = /* @__PURE__ */ new Date();
      if (isNaN(tzOffset(this.timeZone, this))) {
        this.setTime(NaN);
      } else {
        if (!args.length) {
          this.setTime(Date.now());
        } else if (typeof args[0] === "number" && (args.length === 1 || args.length === 2 && typeof args[1] !== "number")) {
          this.setTime(args[0]);
        } else if (typeof args[0] === "string") {
          this.setTime(+new Date(args[0]));
        } else if (args[0] instanceof Date) {
          this.setTime(+args[0]);
        } else {
          this.setTime(+new Date(...args));
          adjustToSystemTZ(this, NaN);
          syncToInternal(this);
        }
      }
    }
    static tz(tz, ...args) {
      return args.length ? new _TZDateMini(...args, tz) : new _TZDateMini(Date.now(), tz);
    }
    //#endregion
    //#region time zone
    withTimeZone(timeZone) {
      return new _TZDateMini(+this, timeZone);
    }
    getTimezoneOffset() {
      const offset = -tzOffset(this.timeZone, this);
      return offset > 0 ? Math.floor(offset) : Math.ceil(offset);
    }
    //#endregion
    //#region time
    setTime(time) {
      Date.prototype.setTime.apply(this, arguments);
      syncToInternal(this);
      return +this;
    }
    //#endregion
    //#region date-fns integration
    [/* @__PURE__ */ Symbol.for("constructDateFrom")](date) {
      return new _TZDateMini(+new Date(date), this.timeZone);
    }
    //#endregion
  };
  var re = /^(get|set)(?!UTC)/;
  Object.getOwnPropertyNames(Date.prototype).forEach((method) => {
    if (!re.test(method)) return;
    const utcMethod = method.replace(re, "$1UTC");
    if (!TZDateMini.prototype[utcMethod]) return;
    if (method.startsWith("get")) {
      TZDateMini.prototype[method] = function() {
        return this.internal[utcMethod]();
      };
    } else {
      TZDateMini.prototype[method] = function() {
        Date.prototype[utcMethod].apply(this.internal, arguments);
        syncFromInternal(this);
        return +this;
      };
      TZDateMini.prototype[utcMethod] = function() {
        Date.prototype[utcMethod].apply(this, arguments);
        syncToInternal(this);
        return +this;
      };
    }
  });
  function syncToInternal(date) {
    date.internal.setTime(+date);
    date.internal.setUTCSeconds(date.internal.getUTCSeconds() - Math.round(-tzOffset(date.timeZone, date) * 60));
  }
  function syncFromInternal(date) {
    Date.prototype.setFullYear.call(date, date.internal.getUTCFullYear(), date.internal.getUTCMonth(), date.internal.getUTCDate());
    Date.prototype.setHours.call(date, date.internal.getUTCHours(), date.internal.getUTCMinutes(), date.internal.getUTCSeconds(), date.internal.getUTCMilliseconds());
    adjustToSystemTZ(date);
  }
  function adjustToSystemTZ(date) {
    const baseOffset = tzOffset(date.timeZone, date);
    const offset = baseOffset > 0 ? Math.floor(baseOffset) : Math.ceil(baseOffset);
    const prevHour = /* @__PURE__ */ new Date(+date);
    prevHour.setUTCHours(prevHour.getUTCHours() - 1);
    const systemOffset = -(/* @__PURE__ */ new Date(+date)).getTimezoneOffset();
    const prevHourSystemOffset = -(/* @__PURE__ */ new Date(+prevHour)).getTimezoneOffset();
    const systemDSTChange = systemOffset - prevHourSystemOffset;
    const dstShift = Date.prototype.getHours.apply(date) !== date.internal.getUTCHours();
    if (systemDSTChange && dstShift) date.internal.setUTCMinutes(date.internal.getUTCMinutes() + systemDSTChange);
    const offsetDiff = systemOffset - offset;
    if (offsetDiff) Date.prototype.setUTCMinutes.call(date, Date.prototype.getUTCMinutes.call(date) + offsetDiff);
    const systemDate = /* @__PURE__ */ new Date(+date);
    systemDate.setUTCSeconds(0);
    const systemSecondsOffset = systemOffset > 0 ? systemDate.getSeconds() : (systemDate.getSeconds() - 60) % 60;
    const secondsOffset = Math.round(-(tzOffset(date.timeZone, date) * 60)) % 60;
    if (secondsOffset || systemSecondsOffset) {
      date.internal.setUTCSeconds(date.internal.getUTCSeconds() + secondsOffset);
      Date.prototype.setUTCSeconds.call(date, Date.prototype.getUTCSeconds.call(date) + secondsOffset + systemSecondsOffset);
    }
    const postBaseOffset = tzOffset(date.timeZone, date);
    const postOffset = postBaseOffset > 0 ? Math.floor(postBaseOffset) : Math.ceil(postBaseOffset);
    const postSystemOffset = -(/* @__PURE__ */ new Date(+date)).getTimezoneOffset();
    const postOffsetDiff = postSystemOffset - postOffset;
    const offsetChanged = postOffset !== offset;
    const postDiff = postOffsetDiff - offsetDiff;
    if (offsetChanged && postDiff) {
      Date.prototype.setUTCMinutes.call(date, Date.prototype.getUTCMinutes.call(date) + postDiff);
      const newBaseOffset = tzOffset(date.timeZone, date);
      const newOffset = newBaseOffset > 0 ? Math.floor(newBaseOffset) : Math.ceil(newBaseOffset);
      const offsetChange = postOffset - newOffset;
      if (offsetChange) {
        date.internal.setUTCMinutes(date.internal.getUTCMinutes() + offsetChange);
        Date.prototype.setUTCMinutes.call(date, Date.prototype.getUTCMinutes.call(date) + offsetChange);
      }
    }
  }

  // ../../../node_modules/@date-fns/tz/date/index.js
  var TZDate = class _TZDate extends TZDateMini {
    //#region static
    static tz(tz, ...args) {
      return args.length ? new _TZDate(...args, tz) : new _TZDate(Date.now(), tz);
    }
    //#endregion
    //#region representation
    toISOString() {
      const [sign, hours, minutes] = this.tzComponents();
      const tz = `${sign}${hours}:${minutes}`;
      return this.internal.toISOString().slice(0, -1) + tz;
    }
    toString() {
      return `${this.toDateString()} ${this.toTimeString()}`;
    }
    toDateString() {
      const [day, date, month, year] = this.internal.toUTCString().split(" ");
      return `${day?.slice(0, -1)} ${month} ${date} ${year}`;
    }
    toTimeString() {
      const time = this.internal.toUTCString().split(" ")[4];
      const [sign, hours, minutes] = this.tzComponents();
      return `${time} GMT${sign}${hours}${minutes} (${tzName(this.timeZone, this)})`;
    }
    toLocaleString(locales, options) {
      return Date.prototype.toLocaleString.call(this, locales, {
        ...options,
        timeZone: options?.timeZone || this.timeZone
      });
    }
    toLocaleDateString(locales, options) {
      return Date.prototype.toLocaleDateString.call(this, locales, {
        ...options,
        timeZone: options?.timeZone || this.timeZone
      });
    }
    toLocaleTimeString(locales, options) {
      return Date.prototype.toLocaleTimeString.call(this, locales, {
        ...options,
        timeZone: options?.timeZone || this.timeZone
      });
    }
    //#endregion
    //#region private
    tzComponents() {
      const offset = this.getTimezoneOffset();
      const sign = offset > 0 ? "-" : "+";
      const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
      const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
      return [sign, hours, minutes];
    }
    //#endregion
    withTimeZone(timeZone) {
      return new _TZDate(+this, timeZone);
    }
    //#region date-fns integration
    [/* @__PURE__ */ Symbol.for("constructDateFrom")](date) {
      return new _TZDate(+new Date(date), this.timeZone);
    }
    //#endregion
  };

  // ../../../node_modules/@date-fns/tz/tz/index.js
  init_define_import_meta_env();

  // ../../../node_modules/@date-fns/tz/tzScan/index.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/classes/CalendarDay.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/classes/DateLib.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/addDays.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/constructFrom.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/constants.js
  init_define_import_meta_env();
  var daysInYear = 365.2425;
  var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
  var minTime = -maxTime;
  var millisecondsInWeek = 6048e5;
  var millisecondsInDay = 864e5;
  var secondsInHour = 3600;
  var secondsInDay = secondsInHour * 24;
  var secondsInWeek = secondsInDay * 7;
  var secondsInYear = secondsInDay * daysInYear;
  var secondsInMonth = secondsInYear / 12;
  var secondsInQuarter = secondsInMonth * 3;
  var constructFromSymbol = /* @__PURE__ */ Symbol.for("constructDateFrom");

  // ../../../node_modules/date-fns/constructFrom.js
  function constructFrom(date, value) {
    if (typeof date === "function") return date(value);
    if (date && typeof date === "object" && constructFromSymbol in date)
      return date[constructFromSymbol](value);
    if (date instanceof Date) return new date.constructor(value);
    return new Date(value);
  }

  // ../../../node_modules/date-fns/toDate.js
  init_define_import_meta_env();
  function toDate(argument, context) {
    return constructFrom(context || argument, argument);
  }

  // ../../../node_modules/date-fns/addDays.js
  function addDays(date, amount, options) {
    const _date = toDate(date, options?.in);
    if (isNaN(amount)) return constructFrom(options?.in || date, NaN);
    if (!amount) return _date;
    _date.setDate(_date.getDate() + amount);
    return _date;
  }

  // ../../../node_modules/date-fns/addMonths.js
  init_define_import_meta_env();
  function addMonths(date, amount, options) {
    const _date = toDate(date, options?.in);
    if (isNaN(amount)) return constructFrom(options?.in || date, NaN);
    if (!amount) {
      return _date;
    }
    const dayOfMonth = _date.getDate();
    const endOfDesiredMonth = constructFrom(options?.in || date, _date.getTime());
    endOfDesiredMonth.setMonth(_date.getMonth() + amount + 1, 0);
    const daysInMonth = endOfDesiredMonth.getDate();
    if (dayOfMonth >= daysInMonth) {
      return endOfDesiredMonth;
    } else {
      _date.setFullYear(
        endOfDesiredMonth.getFullYear(),
        endOfDesiredMonth.getMonth(),
        dayOfMonth
      );
      return _date;
    }
  }

  // ../../../node_modules/date-fns/getISOWeekYear.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/startOfISOWeek.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/startOfWeek.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/_lib/defaultOptions.js
  init_define_import_meta_env();
  var defaultOptions = {};
  function getDefaultOptions() {
    return defaultOptions;
  }

  // ../../../node_modules/date-fns/startOfWeek.js
  function startOfWeek(date, options) {
    const defaultOptions2 = getDefaultOptions();
    const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
    const _date = toDate(date, options?.in);
    const day = _date.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    _date.setDate(_date.getDate() - diff);
    _date.setHours(0, 0, 0, 0);
    return _date;
  }

  // ../../../node_modules/date-fns/startOfISOWeek.js
  function startOfISOWeek(date, options) {
    return startOfWeek(date, { ...options, weekStartsOn: 1 });
  }

  // ../../../node_modules/date-fns/getISOWeekYear.js
  function getISOWeekYear(date, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    const fourthOfJanuaryOfNextYear = constructFrom(_date, 0);
    fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
    fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
    const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
    const fourthOfJanuaryOfThisYear = constructFrom(_date, 0);
    fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
    fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
    const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
    if (_date.getTime() >= startOfNextYear.getTime()) {
      return year + 1;
    } else if (_date.getTime() >= startOfThisYear.getTime()) {
      return year;
    } else {
      return year - 1;
    }
  }

  // ../../../node_modules/date-fns/differenceInCalendarDays.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js
  init_define_import_meta_env();
  function getTimezoneOffsetInMilliseconds(date) {
    const _date = toDate(date);
    const utcDate = new Date(
      Date.UTC(
        _date.getFullYear(),
        _date.getMonth(),
        _date.getDate(),
        _date.getHours(),
        _date.getMinutes(),
        _date.getSeconds(),
        _date.getMilliseconds()
      )
    );
    utcDate.setUTCFullYear(_date.getFullYear());
    return +date - +utcDate;
  }

  // ../../../node_modules/date-fns/_lib/normalizeDates.js
  init_define_import_meta_env();
  function normalizeDates(context, ...dates) {
    const normalize = constructFrom.bind(
      null,
      context || dates.find((date) => typeof date === "object")
    );
    return dates.map(normalize);
  }

  // ../../../node_modules/date-fns/startOfDay.js
  init_define_import_meta_env();
  function startOfDay(date, options) {
    const _date = toDate(date, options?.in);
    _date.setHours(0, 0, 0, 0);
    return _date;
  }

  // ../../../node_modules/date-fns/differenceInCalendarDays.js
  function differenceInCalendarDays(laterDate, earlierDate, options) {
    const [laterDate_, earlierDate_] = normalizeDates(
      options?.in,
      laterDate,
      earlierDate
    );
    const laterStartOfDay = startOfDay(laterDate_);
    const earlierStartOfDay = startOfDay(earlierDate_);
    const laterTimestamp = +laterStartOfDay - getTimezoneOffsetInMilliseconds(laterStartOfDay);
    const earlierTimestamp = +earlierStartOfDay - getTimezoneOffsetInMilliseconds(earlierStartOfDay);
    return Math.round((laterTimestamp - earlierTimestamp) / millisecondsInDay);
  }

  // ../../../node_modules/date-fns/startOfISOWeekYear.js
  init_define_import_meta_env();
  function startOfISOWeekYear(date, options) {
    const year = getISOWeekYear(date, options);
    const fourthOfJanuary = constructFrom(options?.in || date, 0);
    fourthOfJanuary.setFullYear(year, 0, 4);
    fourthOfJanuary.setHours(0, 0, 0, 0);
    return startOfISOWeek(fourthOfJanuary);
  }

  // ../../../node_modules/date-fns/addWeeks.js
  init_define_import_meta_env();
  function addWeeks(date, amount, options) {
    return addDays(date, amount * 7, options);
  }

  // ../../../node_modules/date-fns/addYears.js
  init_define_import_meta_env();
  function addYears(date, amount, options) {
    return addMonths(date, amount * 12, options);
  }

  // ../../../node_modules/date-fns/max.js
  init_define_import_meta_env();
  function max(dates, options) {
    let result;
    let context = options?.in;
    dates.forEach((date) => {
      if (!context && typeof date === "object")
        context = constructFrom.bind(null, date);
      const date_ = toDate(date, context);
      if (!result || result < date_ || isNaN(+date_)) result = date_;
    });
    return constructFrom(context, result || NaN);
  }

  // ../../../node_modules/date-fns/min.js
  init_define_import_meta_env();
  function min(dates, options) {
    let result;
    let context = options?.in;
    dates.forEach((date) => {
      if (!context && typeof date === "object")
        context = constructFrom.bind(null, date);
      const date_ = toDate(date, context);
      if (!result || result > date_ || isNaN(+date_)) result = date_;
    });
    return constructFrom(context, result || NaN);
  }

  // ../../../node_modules/date-fns/isSameDay.js
  init_define_import_meta_env();
  function isSameDay(laterDate, earlierDate, options) {
    const [dateLeft_, dateRight_] = normalizeDates(
      options?.in,
      laterDate,
      earlierDate
    );
    return +startOfDay(dateLeft_) === +startOfDay(dateRight_);
  }

  // ../../../node_modules/date-fns/isValid.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/isDate.js
  init_define_import_meta_env();
  function isDate(value) {
    return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
  }

  // ../../../node_modules/date-fns/isValid.js
  function isValid(date) {
    return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
  }

  // ../../../node_modules/date-fns/differenceInCalendarMonths.js
  init_define_import_meta_env();
  function differenceInCalendarMonths(laterDate, earlierDate, options) {
    const [laterDate_, earlierDate_] = normalizeDates(
      options?.in,
      laterDate,
      earlierDate
    );
    const yearsDiff = laterDate_.getFullYear() - earlierDate_.getFullYear();
    const monthsDiff = laterDate_.getMonth() - earlierDate_.getMonth();
    return yearsDiff * 12 + monthsDiff;
  }

  // ../../../node_modules/date-fns/endOfMonth.js
  init_define_import_meta_env();
  function endOfMonth(date, options) {
    const _date = toDate(date, options?.in);
    const month = _date.getMonth();
    _date.setFullYear(_date.getFullYear(), month + 1, 0);
    _date.setHours(23, 59, 59, 999);
    return _date;
  }

  // ../../../node_modules/date-fns/_lib/normalizeInterval.js
  init_define_import_meta_env();
  function normalizeInterval(context, interval) {
    const [start, end] = normalizeDates(context, interval.start, interval.end);
    return { start, end };
  }

  // ../../../node_modules/date-fns/eachMonthOfInterval.js
  init_define_import_meta_env();
  function eachMonthOfInterval(interval, options) {
    const { start, end } = normalizeInterval(options?.in, interval);
    let reversed = +start > +end;
    const endTime = reversed ? +start : +end;
    const date = reversed ? end : start;
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    let step = options?.step ?? 1;
    if (!step) return [];
    if (step < 0) {
      step = -step;
      reversed = !reversed;
    }
    const dates = [];
    while (+date <= endTime) {
      dates.push(constructFrom(start, date));
      date.setMonth(date.getMonth() + step);
    }
    return reversed ? dates.reverse() : dates;
  }

  // ../../../node_modules/date-fns/startOfMonth.js
  init_define_import_meta_env();
  function startOfMonth(date, options) {
    const _date = toDate(date, options?.in);
    _date.setDate(1);
    _date.setHours(0, 0, 0, 0);
    return _date;
  }

  // ../../../node_modules/date-fns/endOfYear.js
  init_define_import_meta_env();
  function endOfYear(date, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    _date.setFullYear(year + 1, 0, 0);
    _date.setHours(23, 59, 59, 999);
    return _date;
  }

  // ../../../node_modules/date-fns/startOfYear.js
  init_define_import_meta_env();
  function startOfYear(date, options) {
    const date_ = toDate(date, options?.in);
    date_.setFullYear(date_.getFullYear(), 0, 1);
    date_.setHours(0, 0, 0, 0);
    return date_;
  }

  // ../../../node_modules/date-fns/eachYearOfInterval.js
  init_define_import_meta_env();
  function eachYearOfInterval(interval, options) {
    const { start, end } = normalizeInterval(options?.in, interval);
    let reversed = +start > +end;
    const endTime = reversed ? +start : +end;
    const date = reversed ? end : start;
    date.setHours(0, 0, 0, 0);
    date.setMonth(0, 1);
    let step = options?.step ?? 1;
    if (!step) return [];
    if (step < 0) {
      step = -step;
      reversed = !reversed;
    }
    const dates = [];
    while (+date <= endTime) {
      dates.push(constructFrom(start, date));
      date.setFullYear(date.getFullYear() + step);
    }
    return reversed ? dates.reverse() : dates;
  }

  // ../../../node_modules/date-fns/endOfISOWeek.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/endOfWeek.js
  init_define_import_meta_env();
  function endOfWeek(date, options) {
    const defaultOptions2 = getDefaultOptions();
    const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
    const _date = toDate(date, options?.in);
    const day = _date.getDay();
    const diff = (day < weekStartsOn ? -7 : 0) + 6 - (day - weekStartsOn);
    _date.setDate(_date.getDate() + diff);
    _date.setHours(23, 59, 59, 999);
    return _date;
  }

  // ../../../node_modules/date-fns/endOfISOWeek.js
  function endOfISOWeek(date, options) {
    return endOfWeek(date, { ...options, weekStartsOn: 1 });
  }

  // ../../../node_modules/date-fns/format.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/_lib/defaultLocale.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/locale/en-US.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/locale/en-US/_lib/formatDistance.js
  init_define_import_meta_env();
  var formatDistanceLocale = {
    lessThanXSeconds: {
      one: "less than a second",
      other: "less than {{count}} seconds"
    },
    xSeconds: {
      one: "1 second",
      other: "{{count}} seconds"
    },
    halfAMinute: "half a minute",
    lessThanXMinutes: {
      one: "less than a minute",
      other: "less than {{count}} minutes"
    },
    xMinutes: {
      one: "1 minute",
      other: "{{count}} minutes"
    },
    aboutXHours: {
      one: "about 1 hour",
      other: "about {{count}} hours"
    },
    xHours: {
      one: "1 hour",
      other: "{{count}} hours"
    },
    xDays: {
      one: "1 day",
      other: "{{count}} days"
    },
    aboutXWeeks: {
      one: "about 1 week",
      other: "about {{count}} weeks"
    },
    xWeeks: {
      one: "1 week",
      other: "{{count}} weeks"
    },
    aboutXMonths: {
      one: "about 1 month",
      other: "about {{count}} months"
    },
    xMonths: {
      one: "1 month",
      other: "{{count}} months"
    },
    aboutXYears: {
      one: "about 1 year",
      other: "about {{count}} years"
    },
    xYears: {
      one: "1 year",
      other: "{{count}} years"
    },
    overXYears: {
      one: "over 1 year",
      other: "over {{count}} years"
    },
    almostXYears: {
      one: "almost 1 year",
      other: "almost {{count}} years"
    }
  };
  var formatDistance = (token, count, options) => {
    let result;
    const tokenValue = formatDistanceLocale[token];
    if (typeof tokenValue === "string") {
      result = tokenValue;
    } else if (count === 1) {
      result = tokenValue.one;
    } else {
      result = tokenValue.other.replace("{{count}}", count.toString());
    }
    if (options?.addSuffix) {
      if (options.comparison && options.comparison > 0) {
        return "in " + result;
      } else {
        return result + " ago";
      }
    }
    return result;
  };

  // ../../../node_modules/date-fns/locale/en-US/_lib/formatLong.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/locale/_lib/buildFormatLongFn.js
  init_define_import_meta_env();
  function buildFormatLongFn(args) {
    return (options = {}) => {
      const width = options.width ? String(options.width) : args.defaultWidth;
      const format2 = args.formats[width] || args.formats[args.defaultWidth];
      return format2;
    };
  }

  // ../../../node_modules/date-fns/locale/en-US/_lib/formatLong.js
  var dateFormats = {
    full: "EEEE, MMMM do, y",
    long: "MMMM do, y",
    medium: "MMM d, y",
    short: "MM/dd/yyyy"
  };
  var timeFormats = {
    full: "h:mm:ss a zzzz",
    long: "h:mm:ss a z",
    medium: "h:mm:ss a",
    short: "h:mm a"
  };
  var dateTimeFormats = {
    full: "{{date}} 'at' {{time}}",
    long: "{{date}} 'at' {{time}}",
    medium: "{{date}}, {{time}}",
    short: "{{date}}, {{time}}"
  };
  var formatLong = {
    date: buildFormatLongFn({
      formats: dateFormats,
      defaultWidth: "full"
    }),
    time: buildFormatLongFn({
      formats: timeFormats,
      defaultWidth: "full"
    }),
    dateTime: buildFormatLongFn({
      formats: dateTimeFormats,
      defaultWidth: "full"
    })
  };

  // ../../../node_modules/date-fns/locale/en-US/_lib/formatRelative.js
  init_define_import_meta_env();
  var formatRelativeLocale = {
    lastWeek: "'last' eeee 'at' p",
    yesterday: "'yesterday at' p",
    today: "'today at' p",
    tomorrow: "'tomorrow at' p",
    nextWeek: "eeee 'at' p",
    other: "P"
  };
  var formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];

  // ../../../node_modules/date-fns/locale/en-US/_lib/localize.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/locale/_lib/buildLocalizeFn.js
  init_define_import_meta_env();
  function buildLocalizeFn(args) {
    return (value, options) => {
      const context = options?.context ? String(options.context) : "standalone";
      let valuesArray;
      if (context === "formatting" && args.formattingValues) {
        const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
        const width = options?.width ? String(options.width) : defaultWidth;
        valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
      } else {
        const defaultWidth = args.defaultWidth;
        const width = options?.width ? String(options.width) : args.defaultWidth;
        valuesArray = args.values[width] || args.values[defaultWidth];
      }
      const index = args.argumentCallback ? args.argumentCallback(value) : value;
      return valuesArray[index];
    };
  }

  // ../../../node_modules/date-fns/locale/en-US/_lib/localize.js
  var eraValues = {
    narrow: ["B", "A"],
    abbreviated: ["BC", "AD"],
    wide: ["Before Christ", "Anno Domini"]
  };
  var quarterValues = {
    narrow: ["1", "2", "3", "4"],
    abbreviated: ["Q1", "Q2", "Q3", "Q4"],
    wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
  };
  var monthValues = {
    narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    abbreviated: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ],
    wide: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ]
  };
  var dayValues = {
    narrow: ["S", "M", "T", "W", "T", "F", "S"],
    short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    wide: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ]
  };
  var dayPeriodValues = {
    narrow: {
      am: "a",
      pm: "p",
      midnight: "mi",
      noon: "n",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    },
    abbreviated: {
      am: "AM",
      pm: "PM",
      midnight: "midnight",
      noon: "noon",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    },
    wide: {
      am: "a.m.",
      pm: "p.m.",
      midnight: "midnight",
      noon: "noon",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    }
  };
  var formattingDayPeriodValues = {
    narrow: {
      am: "a",
      pm: "p",
      midnight: "mi",
      noon: "n",
      morning: "in the morning",
      afternoon: "in the afternoon",
      evening: "in the evening",
      night: "at night"
    },
    abbreviated: {
      am: "AM",
      pm: "PM",
      midnight: "midnight",
      noon: "noon",
      morning: "in the morning",
      afternoon: "in the afternoon",
      evening: "in the evening",
      night: "at night"
    },
    wide: {
      am: "a.m.",
      pm: "p.m.",
      midnight: "midnight",
      noon: "noon",
      morning: "in the morning",
      afternoon: "in the afternoon",
      evening: "in the evening",
      night: "at night"
    }
  };
  var ordinalNumber = (dirtyNumber, _options) => {
    const number = Number(dirtyNumber);
    const rem100 = number % 100;
    if (rem100 > 20 || rem100 < 10) {
      switch (rem100 % 10) {
        case 1:
          return number + "st";
        case 2:
          return number + "nd";
        case 3:
          return number + "rd";
      }
    }
    return number + "th";
  };
  var localize = {
    ordinalNumber,
    era: buildLocalizeFn({
      values: eraValues,
      defaultWidth: "wide"
    }),
    quarter: buildLocalizeFn({
      values: quarterValues,
      defaultWidth: "wide",
      argumentCallback: (quarter) => quarter - 1
    }),
    month: buildLocalizeFn({
      values: monthValues,
      defaultWidth: "wide"
    }),
    day: buildLocalizeFn({
      values: dayValues,
      defaultWidth: "wide"
    }),
    dayPeriod: buildLocalizeFn({
      values: dayPeriodValues,
      defaultWidth: "wide",
      formattingValues: formattingDayPeriodValues,
      defaultFormattingWidth: "wide"
    })
  };

  // ../../../node_modules/date-fns/locale/en-US/_lib/match.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/locale/_lib/buildMatchFn.js
  init_define_import_meta_env();
  function buildMatchFn(args) {
    return (string, options = {}) => {
      const width = options.width;
      const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
      const matchResult = string.match(matchPattern);
      if (!matchResult) {
        return null;
      }
      const matchedString = matchResult[0];
      const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
      const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
        // [TODO] -- I challenge you to fix the type
        findKey(parsePatterns, (pattern) => pattern.test(matchedString))
      );
      let value;
      value = args.valueCallback ? args.valueCallback(key) : key;
      value = options.valueCallback ? (
        // [TODO] -- I challenge you to fix the type
        options.valueCallback(value)
      ) : value;
      const rest = string.slice(matchedString.length);
      return { value, rest };
    };
  }
  function findKey(object, predicate) {
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
        return key;
      }
    }
    return void 0;
  }
  function findIndex(array, predicate) {
    for (let key = 0; key < array.length; key++) {
      if (predicate(array[key])) {
        return key;
      }
    }
    return void 0;
  }

  // ../../../node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
  init_define_import_meta_env();
  function buildMatchPatternFn(args) {
    return (string, options = {}) => {
      const matchResult = string.match(args.matchPattern);
      if (!matchResult) return null;
      const matchedString = matchResult[0];
      const parseResult = string.match(args.parsePattern);
      if (!parseResult) return null;
      let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
      value = options.valueCallback ? options.valueCallback(value) : value;
      const rest = string.slice(matchedString.length);
      return { value, rest };
    };
  }

  // ../../../node_modules/date-fns/locale/en-US/_lib/match.js
  var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
  var parseOrdinalNumberPattern = /\d+/i;
  var matchEraPatterns = {
    narrow: /^(b|a)/i,
    abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
    wide: /^(before christ|before common era|anno domini|common era)/i
  };
  var parseEraPatterns = {
    any: [/^b/i, /^(a|c)/i]
  };
  var matchQuarterPatterns = {
    narrow: /^[1234]/i,
    abbreviated: /^q[1234]/i,
    wide: /^[1234](th|st|nd|rd)? quarter/i
  };
  var parseQuarterPatterns = {
    any: [/1/i, /2/i, /3/i, /4/i]
  };
  var matchMonthPatterns = {
    narrow: /^[jfmasond]/i,
    abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
  };
  var parseMonthPatterns = {
    narrow: [
      /^j/i,
      /^f/i,
      /^m/i,
      /^a/i,
      /^m/i,
      /^j/i,
      /^j/i,
      /^a/i,
      /^s/i,
      /^o/i,
      /^n/i,
      /^d/i
    ],
    any: [
      /^ja/i,
      /^f/i,
      /^mar/i,
      /^ap/i,
      /^may/i,
      /^jun/i,
      /^jul/i,
      /^au/i,
      /^s/i,
      /^o/i,
      /^n/i,
      /^d/i
    ]
  };
  var matchDayPatterns = {
    narrow: /^[smtwf]/i,
    short: /^(su|mo|tu|we|th|fr|sa)/i,
    abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
    wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
  };
  var parseDayPatterns = {
    narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
    any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
  };
  var matchDayPeriodPatterns = {
    narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
    any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
  };
  var parseDayPeriodPatterns = {
    any: {
      am: /^a/i,
      pm: /^p/i,
      midnight: /^mi/i,
      noon: /^no/i,
      morning: /morning/i,
      afternoon: /afternoon/i,
      evening: /evening/i,
      night: /night/i
    }
  };
  var match = {
    ordinalNumber: buildMatchPatternFn({
      matchPattern: matchOrdinalNumberPattern,
      parsePattern: parseOrdinalNumberPattern,
      valueCallback: (value) => parseInt(value, 10)
    }),
    era: buildMatchFn({
      matchPatterns: matchEraPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseEraPatterns,
      defaultParseWidth: "any"
    }),
    quarter: buildMatchFn({
      matchPatterns: matchQuarterPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseQuarterPatterns,
      defaultParseWidth: "any",
      valueCallback: (index) => index + 1
    }),
    month: buildMatchFn({
      matchPatterns: matchMonthPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseMonthPatterns,
      defaultParseWidth: "any"
    }),
    day: buildMatchFn({
      matchPatterns: matchDayPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseDayPatterns,
      defaultParseWidth: "any"
    }),
    dayPeriod: buildMatchFn({
      matchPatterns: matchDayPeriodPatterns,
      defaultMatchWidth: "any",
      parsePatterns: parseDayPeriodPatterns,
      defaultParseWidth: "any"
    })
  };

  // ../../../node_modules/date-fns/locale/en-US.js
  var enUS = {
    code: "en-US",
    formatDistance,
    formatLong,
    formatRelative,
    localize,
    match,
    options: {
      weekStartsOn: 0,
      firstWeekContainsDate: 1
    }
  };

  // ../../../node_modules/date-fns/_lib/format/formatters.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/getDayOfYear.js
  init_define_import_meta_env();
  function getDayOfYear(date, options) {
    const _date = toDate(date, options?.in);
    const diff = differenceInCalendarDays(_date, startOfYear(_date));
    const dayOfYear = diff + 1;
    return dayOfYear;
  }

  // ../../../node_modules/date-fns/getISOWeek.js
  init_define_import_meta_env();
  function getISOWeek(date, options) {
    const _date = toDate(date, options?.in);
    const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
    return Math.round(diff / millisecondsInWeek) + 1;
  }

  // ../../../node_modules/date-fns/getWeek.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/startOfWeekYear.js
  init_define_import_meta_env();

  // ../../../node_modules/date-fns/getWeekYear.js
  init_define_import_meta_env();
  function getWeekYear(date, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    const defaultOptions2 = getDefaultOptions();
    const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
    const firstWeekOfNextYear = constructFrom(options?.in || date, 0);
    firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
    firstWeekOfNextYear.setHours(0, 0, 0, 0);
    const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
    const firstWeekOfThisYear = constructFrom(options?.in || date, 0);
    firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
    firstWeekOfThisYear.setHours(0, 0, 0, 0);
    const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
    if (+_date >= +startOfNextYear) {
      return year + 1;
    } else if (+_date >= +startOfThisYear) {
      return year;
    } else {
      return year - 1;
    }
  }

  // ../../../node_modules/date-fns/startOfWeekYear.js
  function startOfWeekYear(date, options) {
    const defaultOptions2 = getDefaultOptions();
    const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
    const year = getWeekYear(date, options);
    const firstWeek = constructFrom(options?.in || date, 0);
    firstWeek.setFullYear(year, 0, firstWeekContainsDate);
    firstWeek.setHours(0, 0, 0, 0);
    const _date = startOfWeek(firstWeek, options);
    return _date;
  }

  // ../../../node_modules/date-fns/getWeek.js
  function getWeek(date, options) {
    const _date = toDate(date, options?.in);
    const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
    return Math.round(diff / millisecondsInWeek) + 1;
  }

  // ../../../node_modules/date-fns/_lib/addLeadingZeros.js
  init_define_import_meta_env();
  function addLeadingZeros(number, targetLength) {
    const sign = number < 0 ? "-" : "";
    const output = Math.abs(number).toString().padStart(targetLength, "0");
    return sign + output;
  }

  // ../../../node_modules/date-fns/_lib/format/lightFormatters.js
  init_define_import_meta_env();
  var lightFormatters = {
    // Year
    y(date, token) {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
    },
    // Month
    M(date, token) {
      const month = date.getMonth();
      return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
    },
    // Day of the month
    d(date, token) {
      return addLeadingZeros(date.getDate(), token.length);
    },
    // AM or PM
    a(date, token) {
      const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
      switch (token) {
        case "a":
        case "aa":
          return dayPeriodEnumValue.toUpperCase();
        case "aaa":
          return dayPeriodEnumValue;
        case "aaaaa":
          return dayPeriodEnumValue[0];
        case "aaaa":
        default:
          return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
      }
    },
    // Hour [1-12]
    h(date, token) {
      return addLeadingZeros(date.getHours() % 12 || 12, token.length);
    },
    // Hour [0-23]
    H(date, token) {
      return addLeadingZeros(date.getHours(), token.length);
    },
    // Minute
    m(date, token) {
      return addLeadingZeros(date.getMinutes(), token.length);
    },
    // Second
    s(date, token) {
      return addLeadingZeros(date.getSeconds(), token.length);
    },
    // Fraction of second
    S(date, token) {
      const numberOfDigits = token.length;
      const milliseconds = date.getMilliseconds();
      const fractionalSeconds = Math.trunc(
        milliseconds * Math.pow(10, numberOfDigits - 3)
      );
      return addLeadingZeros(fractionalSeconds, token.length);
    }
  };

  // ../../../node_modules/date-fns/_lib/format/formatters.js
  var dayPeriodEnum = {
    am: "am",
    pm: "pm",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  };
  var formatters = {
    // Era
    G: function(date, token, localize2) {
      const era = date.getFullYear() > 0 ? 1 : 0;
      switch (token) {
        // AD, BC
        case "G":
        case "GG":
        case "GGG":
          return localize2.era(era, { width: "abbreviated" });
        // A, B
        case "GGGGG":
          return localize2.era(era, { width: "narrow" });
        // Anno Domini, Before Christ
        case "GGGG":
        default:
          return localize2.era(era, { width: "wide" });
      }
    },
    // Year
    y: function(date, token, localize2) {
      if (token === "yo") {
        const signedYear = date.getFullYear();
        const year = signedYear > 0 ? signedYear : 1 - signedYear;
        return localize2.ordinalNumber(year, { unit: "year" });
      }
      return lightFormatters.y(date, token);
    },
    // Local week-numbering year
    Y: function(date, token, localize2, options) {
      const signedWeekYear = getWeekYear(date, options);
      const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
      if (token === "YY") {
        const twoDigitYear = weekYear % 100;
        return addLeadingZeros(twoDigitYear, 2);
      }
      if (token === "Yo") {
        return localize2.ordinalNumber(weekYear, { unit: "year" });
      }
      return addLeadingZeros(weekYear, token.length);
    },
    // ISO week-numbering year
    R: function(date, token) {
      const isoWeekYear = getISOWeekYear(date);
      return addLeadingZeros(isoWeekYear, token.length);
    },
    // Extended year. This is a single number designating the year of this calendar system.
    // The main difference between `y` and `u` localizers are B.C. years:
    // | Year | `y` | `u` |
    // |------|-----|-----|
    // | AC 1 |   1 |   1 |
    // | BC 1 |   1 |   0 |
    // | BC 2 |   2 |  -1 |
    // Also `yy` always returns the last two digits of a year,
    // while `uu` pads single digit years to 2 characters and returns other years unchanged.
    u: function(date, token) {
      const year = date.getFullYear();
      return addLeadingZeros(year, token.length);
    },
    // Quarter
    Q: function(date, token, localize2) {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      switch (token) {
        // 1, 2, 3, 4
        case "Q":
          return String(quarter);
        // 01, 02, 03, 04
        case "QQ":
          return addLeadingZeros(quarter, 2);
        // 1st, 2nd, 3rd, 4th
        case "Qo":
          return localize2.ordinalNumber(quarter, { unit: "quarter" });
        // Q1, Q2, Q3, Q4
        case "QQQ":
          return localize2.quarter(quarter, {
            width: "abbreviated",
            context: "formatting"
          });
        // 1, 2, 3, 4 (narrow quarter; could be not numerical)
        case "QQQQQ":
          return localize2.quarter(quarter, {
            width: "narrow",
            context: "formatting"
          });
        // 1st quarter, 2nd quarter, ...
        case "QQQQ":
        default:
          return localize2.quarter(quarter, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Stand-alone quarter
    q: function(date, token, localize2) {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      switch (token) {
        // 1, 2, 3, 4
        case "q":
          return String(quarter);
        // 01, 02, 03, 04
        case "qq":
          return addLeadingZeros(quarter, 2);
        // 1st, 2nd, 3rd, 4th
        case "qo":
          return localize2.ordinalNumber(quarter, { unit: "quarter" });
        // Q1, Q2, Q3, Q4
        case "qqq":
          return localize2.quarter(quarter, {
            width: "abbreviated",
            context: "standalone"
          });
        // 1, 2, 3, 4 (narrow quarter; could be not numerical)
        case "qqqqq":
          return localize2.quarter(quarter, {
            width: "narrow",
            context: "standalone"
          });
        // 1st quarter, 2nd quarter, ...
        case "qqqq":
        default:
          return localize2.quarter(quarter, {
            width: "wide",
            context: "standalone"
          });
      }
    },
    // Month
    M: function(date, token, localize2) {
      const month = date.getMonth();
      switch (token) {
        case "M":
        case "MM":
          return lightFormatters.M(date, token);
        // 1st, 2nd, ..., 12th
        case "Mo":
          return localize2.ordinalNumber(month + 1, { unit: "month" });
        // Jan, Feb, ..., Dec
        case "MMM":
          return localize2.month(month, {
            width: "abbreviated",
            context: "formatting"
          });
        // J, F, ..., D
        case "MMMMM":
          return localize2.month(month, {
            width: "narrow",
            context: "formatting"
          });
        // January, February, ..., December
        case "MMMM":
        default:
          return localize2.month(month, { width: "wide", context: "formatting" });
      }
    },
    // Stand-alone month
    L: function(date, token, localize2) {
      const month = date.getMonth();
      switch (token) {
        // 1, 2, ..., 12
        case "L":
          return String(month + 1);
        // 01, 02, ..., 12
        case "LL":
          return addLeadingZeros(month + 1, 2);
        // 1st, 2nd, ..., 12th
        case "Lo":
          return localize2.ordinalNumber(month + 1, { unit: "month" });
        // Jan, Feb, ..., Dec
        case "LLL":
          return localize2.month(month, {
            width: "abbreviated",
            context: "standalone"
          });
        // J, F, ..., D
        case "LLLLL":
          return localize2.month(month, {
            width: "narrow",
            context: "standalone"
          });
        // January, February, ..., December
        case "LLLL":
        default:
          return localize2.month(month, { width: "wide", context: "standalone" });
      }
    },
    // Local week of year
    w: function(date, token, localize2, options) {
      const week = getWeek(date, options);
      if (token === "wo") {
        return localize2.ordinalNumber(week, { unit: "week" });
      }
      return addLeadingZeros(week, token.length);
    },
    // ISO week of year
    I: function(date, token, localize2) {
      const isoWeek = getISOWeek(date);
      if (token === "Io") {
        return localize2.ordinalNumber(isoWeek, { unit: "week" });
      }
      return addLeadingZeros(isoWeek, token.length);
    },
    // Day of the month
    d: function(date, token, localize2) {
      if (token === "do") {
        return localize2.ordinalNumber(date.getDate(), { unit: "date" });
      }
      return lightFormatters.d(date, token);
    },
    // Day of year
    D: function(date, token, localize2) {
      const dayOfYear = getDayOfYear(date);
      if (token === "Do") {
        return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
      }
      return addLeadingZeros(dayOfYear, token.length);
    },
    // Day of week
    E: function(date, token, localize2) {
      const dayOfWeek = date.getDay();
      switch (token) {
        // Tue
        case "E":
        case "EE":
        case "EEE":
          return localize2.day(dayOfWeek, {
            width: "abbreviated",
            context: "formatting"
          });
        // T
        case "EEEEE":
          return localize2.day(dayOfWeek, {
            width: "narrow",
            context: "formatting"
          });
        // Tu
        case "EEEEEE":
          return localize2.day(dayOfWeek, {
            width: "short",
            context: "formatting"
          });
        // Tuesday
        case "EEEE":
        default:
          return localize2.day(dayOfWeek, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Local day of week
    e: function(date, token, localize2, options) {
      const dayOfWeek = date.getDay();
      const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
      switch (token) {
        // Numerical value (Nth day of week with current locale or weekStartsOn)
        case "e":
          return String(localDayOfWeek);
        // Padded numerical value
        case "ee":
          return addLeadingZeros(localDayOfWeek, 2);
        // 1st, 2nd, ..., 7th
        case "eo":
          return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
        case "eee":
          return localize2.day(dayOfWeek, {
            width: "abbreviated",
            context: "formatting"
          });
        // T
        case "eeeee":
          return localize2.day(dayOfWeek, {
            width: "narrow",
            context: "formatting"
          });
        // Tu
        case "eeeeee":
          return localize2.day(dayOfWeek, {
            width: "short",
            context: "formatting"
          });
        // Tuesday
        case "eeee":
        default:
          return localize2.day(dayOfWeek, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Stand-alone local day of week
    c: function(date, token, localize2, options) {
      const dayOfWeek = date.getDay();
      const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
      switch (token) {
        // Numerical value (same as in `e`)
        case "c":
          return String(localDayOfWeek);
        // Padded numerical value
        case "cc":
          return addLeadingZeros(localDayOfWeek, token.length);
        // 1st, 2nd, ..., 7th
        case "co":
          return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
        case "ccc":
          return localize2.day(dayOfWeek, {
            width: "abbreviated",
            context: "standalone"
          });
        // T
        case "ccccc":
          return localize2.day(dayOfWeek, {
            width: "narrow",
            context: "standalone"
          });
        // Tu
        case "cccccc":
          return localize2.day(dayOfWeek, {
            width: "short",
            context: "standalone"
          });
        // Tuesday
        case "cccc":
        default:
          return localize2.day(dayOfWeek, {
            width: "wide",
            context: "standalone"
          });
      }
    },
    // ISO day of week
    i: function(date, token, localize2) {
      const dayOfWeek = date.getDay();
      const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
      switch (token) {
        // 2
        case "i":
          return String(isoDayOfWeek);
        // 02
        case "ii":
          return addLeadingZeros(isoDayOfWeek, token.length);
        // 2nd
        case "io":
          return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
        // Tue
        case "iii":
          return localize2.day(dayOfWeek, {
            width: "abbreviated",
            context: "formatting"
          });
        // T
        case "iiiii":
          return localize2.day(dayOfWeek, {
            width: "narrow",
            context: "formatting"
          });
        // Tu
        case "iiiiii":
          return localize2.day(dayOfWeek, {
            width: "short",
            context: "formatting"
          });
        // Tuesday
        case "iiii":
        default:
          return localize2.day(dayOfWeek, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // AM or PM
    a: function(date, token, localize2) {
      const hours = date.getHours();
      const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
      switch (token) {
        case "a":
        case "aa":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          });
        case "aaa":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          }).toLowerCase();
        case "aaaaa":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "narrow",
            context: "formatting"
          });
        case "aaaa":
        default:
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // AM, PM, midnight, noon
    b: function(date, token, localize2) {
      const hours = date.getHours();
      let dayPeriodEnumValue;
      if (hours === 12) {
        dayPeriodEnumValue = dayPeriodEnum.noon;
      } else if (hours === 0) {
        dayPeriodEnumValue = dayPeriodEnum.midnight;
      } else {
        dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
      }
      switch (token) {
        case "b":
        case "bb":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          });
        case "bbb":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          }).toLowerCase();
        case "bbbbb":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "narrow",
            context: "formatting"
          });
        case "bbbb":
        default:
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // in the morning, in the afternoon, in the evening, at night
    B: function(date, token, localize2) {
      const hours = date.getHours();
      let dayPeriodEnumValue;
      if (hours >= 17) {
        dayPeriodEnumValue = dayPeriodEnum.evening;
      } else if (hours >= 12) {
        dayPeriodEnumValue = dayPeriodEnum.afternoon;
      } else if (hours >= 4) {
        dayPeriodEnumValue = dayPeriodEnum.morning;
      } else {
        dayPeriodEnumValue = dayPeriodEnum.night;
      }
      switch (token) {
        case "B":
        case "BB":
        case "BBB":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          });
        case "BBBBB":
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "narrow",
            context: "formatting"
          });
        case "BBBB":
        default:
          return localize2.dayPeriod(dayPeriodEnumValue, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Hour [1-12]
    h: function(date, token, localize2) {
      if (token === "ho") {
        let hours = date.getHours() % 12;
        if (hours === 0) hours = 12;
        return localize2.ordinalNumber(hours, { unit: "hour" });
      }
      return lightFormatters.h(date, token);
    },
    // Hour [0-23]
    H: function(date, token, localize2) {
      if (token === "Ho") {
        return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
      }
      return lightFormatters.H(date, token);
    },
    // Hour [0-11]
    K: function(date, token, localize2) {
      const hours = date.getHours() % 12;
      if (token === "Ko") {
        return localize2.ordinalNumber(hours, { unit: "hour" });
      }
      return addLeadingZeros(hours, token.length);
    },
    // Hour [1-24]
    k: function(date, token, localize2) {
      let hours = date.getHours();
      if (hours === 0) hours = 24;
      if (token === "ko") {
        return localize2.ordinalNumber(hours, { unit: "hour" });
      }
      return addLeadingZeros(hours, token.length);
    },
    // Minute
    m: function(date, token, localize2) {
      if (token === "mo") {
        return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
      }
      return lightFormatters.m(date, token);
    },
    // Second
    s: function(date, token, localize2) {
      if (token === "so") {
        return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
      }
      return lightFormatters.s(date, token);
    },
    // Fraction of second
    S: function(date, token) {
      return lightFormatters.S(date, token);
    },
    // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
    X: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      if (timezoneOffset === 0) {
        return "Z";
      }
      switch (token) {
        // Hours and optional minutes
        case "X":
          return formatTimezoneWithOptionalMinutes(timezoneOffset);
        // Hours, minutes and optional seconds without `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `XX`
        case "XXXX":
        case "XX":
          return formatTimezone(timezoneOffset);
        // Hours, minutes and optional seconds with `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `XXX`
        case "XXXXX":
        case "XXX":
        // Hours and minutes with `:` delimiter
        default:
          return formatTimezone(timezoneOffset, ":");
      }
    },
    // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
    x: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      switch (token) {
        // Hours and optional minutes
        case "x":
          return formatTimezoneWithOptionalMinutes(timezoneOffset);
        // Hours, minutes and optional seconds without `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `xx`
        case "xxxx":
        case "xx":
          return formatTimezone(timezoneOffset);
        // Hours, minutes and optional seconds with `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `xxx`
        case "xxxxx":
        case "xxx":
        // Hours and minutes with `:` delimiter
        default:
          return formatTimezone(timezoneOffset, ":");
      }
    },
    // Timezone (GMT)
    O: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      switch (token) {
        // Short
        case "O":
        case "OO":
        case "OOO":
          return "GMT" + formatTimezoneShort(timezoneOffset, ":");
        // Long
        case "OOOO":
        default:
          return "GMT" + formatTimezone(timezoneOffset, ":");
      }
    },
    // Timezone (specific non-location)
    z: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      switch (token) {
        // Short
        case "z":
        case "zz":
        case "zzz":
          return "GMT" + formatTimezoneShort(timezoneOffset, ":");
        // Long
        case "zzzz":
        default:
          return "GMT" + formatTimezone(timezoneOffset, ":");
      }
    },
    // Seconds timestamp
    t: function(date, token, _localize) {
      const timestamp = Math.trunc(+date / 1e3);
      return addLeadingZeros(timestamp, token.length);
    },
    // Milliseconds timestamp
    T: function(date, token, _localize) {
      return addLeadingZeros(+date, token.length);
    }
  };
  function formatTimezoneShort(offset, delimiter = "") {
    const sign = offset > 0 ? "-" : "+";
    const absOffset = Math.abs(offset);
    const hours = Math.trunc(absOffset / 60);
    const minutes = absOffset % 60;
    if (minutes === 0) {
      return sign + String(hours);
    }
    return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
  }
  function formatTimezoneWithOptionalMinutes(offset, delimiter) {
    if (offset % 60 === 0) {
      const sign = offset > 0 ? "-" : "+";
      return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
    }
    return formatTimezone(offset, delimiter);
  }
  function formatTimezone(offset, delimiter = "") {
    const sign = offset > 0 ? "-" : "+";
    const absOffset = Math.abs(offset);
    const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
    const minutes = addLeadingZeros(absOffset % 60, 2);
    return sign + hours + delimiter + minutes;
  }

  // ../../../node_modules/date-fns/_lib/format/longFormatters.js
  init_define_import_meta_env();
  var dateLongFormatter = (pattern, formatLong2) => {
    switch (pattern) {
      case "P":
        return formatLong2.date({ width: "short" });
      case "PP":
        return formatLong2.date({ width: "medium" });
      case "PPP":
        return formatLong2.date({ width: "long" });
      case "PPPP":
      default:
        return formatLong2.date({ width: "full" });
    }
  };
  var timeLongFormatter = (pattern, formatLong2) => {
    switch (pattern) {
      case "p":
        return formatLong2.time({ width: "short" });
      case "pp":
        return formatLong2.time({ width: "medium" });
      case "ppp":
        return formatLong2.time({ width: "long" });
      case "pppp":
      default:
        return formatLong2.time({ width: "full" });
    }
  };
  var dateTimeLongFormatter = (pattern, formatLong2) => {
    const matchResult = pattern.match(/(P+)(p+)?/) || [];
    const datePattern = matchResult[1];
    const timePattern = matchResult[2];
    if (!timePattern) {
      return dateLongFormatter(pattern, formatLong2);
    }
    let dateTimeFormat;
    switch (datePattern) {
      case "P":
        dateTimeFormat = formatLong2.dateTime({ width: "short" });
        break;
      case "PP":
        dateTimeFormat = formatLong2.dateTime({ width: "medium" });
        break;
      case "PPP":
        dateTimeFormat = formatLong2.dateTime({ width: "long" });
        break;
      case "PPPP":
      default:
        dateTimeFormat = formatLong2.dateTime({ width: "full" });
        break;
    }
    return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
  };
  var longFormatters = {
    p: timeLongFormatter,
    P: dateTimeLongFormatter
  };

  // ../../../node_modules/date-fns/_lib/protectedTokens.js
  init_define_import_meta_env();
  var dayOfYearTokenRE = /^D+$/;
  var weekYearTokenRE = /^Y+$/;
  var throwTokens = ["D", "DD", "YY", "YYYY"];
  function isProtectedDayOfYearToken(token) {
    return dayOfYearTokenRE.test(token);
  }
  function isProtectedWeekYearToken(token) {
    return weekYearTokenRE.test(token);
  }
  function warnOrThrowProtectedError(token, format2, input) {
    const _message = message(token, format2, input);
    console.warn(_message);
    if (throwTokens.includes(token)) throw new RangeError(_message);
  }
  function message(token, format2, input) {
    const subject = token[0] === "Y" ? "years" : "days of the month";
    return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
  }

  // ../../../node_modules/date-fns/format.js
  var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
  var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
  var escapedStringRegExp = /^'([^]*?)'?$/;
  var doubleQuoteRegExp = /''/g;
  var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
  function format(date, formatStr, options) {
    const defaultOptions2 = getDefaultOptions();
    const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
    const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
    const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
    const originalDate = toDate(date, options?.in);
    if (!isValid(originalDate)) {
      throw new RangeError("Invalid time value");
    }
    let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
      const firstCharacter = substring[0];
      if (firstCharacter === "p" || firstCharacter === "P") {
        const longFormatter = longFormatters[firstCharacter];
        return longFormatter(substring, locale.formatLong);
      }
      return substring;
    }).join("").match(formattingTokensRegExp).map((substring) => {
      if (substring === "''") {
        return { isToken: false, value: "'" };
      }
      const firstCharacter = substring[0];
      if (firstCharacter === "'") {
        return { isToken: false, value: cleanEscapedString(substring) };
      }
      if (formatters[firstCharacter]) {
        return { isToken: true, value: substring };
      }
      if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
        throw new RangeError(
          "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
        );
      }
      return { isToken: false, value: substring };
    });
    if (locale.localize.preprocessor) {
      parts = locale.localize.preprocessor(originalDate, parts);
    }
    const formatterOptions = {
      firstWeekContainsDate,
      weekStartsOn,
      locale
    };
    return parts.map((part) => {
      if (!part.isToken) return part.value;
      const token = part.value;
      if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
        warnOrThrowProtectedError(token, formatStr, String(date));
      }
      const formatter = formatters[token[0]];
      return formatter(originalDate, token, locale.localize, formatterOptions);
    }).join("");
  }
  function cleanEscapedString(input) {
    const matched = input.match(escapedStringRegExp);
    if (!matched) {
      return input;
    }
    return matched[1].replace(doubleQuoteRegExp, "'");
  }

  // ../../../node_modules/date-fns/getDaysInMonth.js
  init_define_import_meta_env();
  function getDaysInMonth(date, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    const monthIndex = _date.getMonth();
    const lastDayOfMonth = constructFrom(_date, 0);
    lastDayOfMonth.setFullYear(year, monthIndex + 1, 0);
    lastDayOfMonth.setHours(0, 0, 0, 0);
    return lastDayOfMonth.getDate();
  }

  // ../../../node_modules/date-fns/getMonth.js
  init_define_import_meta_env();
  function getMonth(date, options) {
    return toDate(date, options?.in).getMonth();
  }

  // ../../../node_modules/date-fns/getYear.js
  init_define_import_meta_env();
  function getYear(date, options) {
    return toDate(date, options?.in).getFullYear();
  }

  // ../../../node_modules/date-fns/isAfter.js
  init_define_import_meta_env();
  function isAfter(date, dateToCompare) {
    return +toDate(date) > +toDate(dateToCompare);
  }

  // ../../../node_modules/date-fns/isBefore.js
  init_define_import_meta_env();
  function isBefore(date, dateToCompare) {
    return +toDate(date) < +toDate(dateToCompare);
  }

  // ../../../node_modules/date-fns/isSameMonth.js
  init_define_import_meta_env();
  function isSameMonth(laterDate, earlierDate, options) {
    const [laterDate_, earlierDate_] = normalizeDates(
      options?.in,
      laterDate,
      earlierDate
    );
    return laterDate_.getFullYear() === earlierDate_.getFullYear() && laterDate_.getMonth() === earlierDate_.getMonth();
  }

  // ../../../node_modules/date-fns/isSameYear.js
  init_define_import_meta_env();
  function isSameYear(laterDate, earlierDate, options) {
    const [laterDate_, earlierDate_] = normalizeDates(
      options?.in,
      laterDate,
      earlierDate
    );
    return laterDate_.getFullYear() === earlierDate_.getFullYear();
  }

  // ../../../node_modules/date-fns/setMonth.js
  init_define_import_meta_env();
  function setMonth(date, month, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    const day = _date.getDate();
    const midMonth = constructFrom(options?.in || date, 0);
    midMonth.setFullYear(year, month, 15);
    midMonth.setHours(0, 0, 0, 0);
    const daysInMonth = getDaysInMonth(midMonth);
    _date.setMonth(month, Math.min(day, daysInMonth));
    return _date;
  }

  // ../../../node_modules/date-fns/setYear.js
  init_define_import_meta_env();
  function setYear(date, year, options) {
    const date_ = toDate(date, options?.in);
    if (isNaN(+date_)) return constructFrom(options?.in || date, NaN);
    date_.setFullYear(year);
    return date_;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/endOfBroadcastWeek.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getBroadcastWeeksInMonth.js
  init_define_import_meta_env();
  var FIVE_WEEKS = 5;
  var FOUR_WEEKS = 4;
  function getBroadcastWeeksInMonth(month, dateLib) {
    const firstDayOfMonth = dateLib.startOfMonth(month);
    const firstDayOfWeek = firstDayOfMonth.getDay() > 0 ? firstDayOfMonth.getDay() : 7;
    const broadcastStartDate = dateLib.addDays(month, -firstDayOfWeek + 1);
    const lastDateOfLastWeek = dateLib.addDays(broadcastStartDate, FIVE_WEEKS * 7 - 1);
    const numberOfWeeks = dateLib.getMonth(month) === dateLib.getMonth(lastDateOfLastWeek) ? FIVE_WEEKS : FOUR_WEEKS;
    return numberOfWeeks;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/startOfBroadcastWeek.js
  init_define_import_meta_env();
  function startOfBroadcastWeek(date, dateLib) {
    const firstOfMonth = dateLib.startOfMonth(date);
    const dayOfWeek = firstOfMonth.getDay();
    if (dayOfWeek === 1) {
      return firstOfMonth;
    } else if (dayOfWeek === 0) {
      return dateLib.addDays(firstOfMonth, -1 * 6);
    } else {
      return dateLib.addDays(firstOfMonth, -1 * (dayOfWeek - 1));
    }
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/endOfBroadcastWeek.js
  function endOfBroadcastWeek(date, dateLib) {
    const startDate = startOfBroadcastWeek(date, dateLib);
    const numberOfWeeks = getBroadcastWeeksInMonth(date, dateLib);
    const endDate = dateLib.addDays(startDate, numberOfWeeks * 7 - 1);
    return endDate;
  }

  // ../../../node_modules/react-day-picker/dist/esm/locale/en-US.js
  init_define_import_meta_env();
  var enUS2 = {
    ...enUS,
    labels: {
      labelDayButton: (date, modifiers, options, dateLib) => {
        let formatDate;
        if (dateLib && typeof dateLib.format === "function") {
          formatDate = dateLib.format.bind(dateLib);
        } else {
          formatDate = (d, pattern) => format(d, pattern, { locale: enUS, ...options });
        }
        let label = formatDate(date, "PPPP");
        if (modifiers.today)
          label = `Today, ${label}`;
        if (modifiers.selected)
          label = `${label}, selected`;
        return label;
      },
      labelMonthDropdown: "Choose the Month",
      labelNext: "Go to the Next Month",
      labelPrevious: "Go to the Previous Month",
      labelWeekNumber: (weekNumber) => `Week ${weekNumber}`,
      labelYearDropdown: "Choose the Year",
      labelGrid: (date, options, dateLib) => {
        let formatDate;
        if (dateLib && typeof dateLib.format === "function") {
          formatDate = dateLib.format.bind(dateLib);
        } else {
          formatDate = (d, pattern) => format(d, pattern, { locale: enUS, ...options });
        }
        return formatDate(date, "LLLL yyyy");
      },
      labelGridcell: (date, modifiers, options, dateLib) => {
        let formatDate;
        if (dateLib && typeof dateLib.format === "function") {
          formatDate = dateLib.format.bind(dateLib);
        } else {
          formatDate = (d, pattern) => format(d, pattern, { locale: enUS, ...options });
        }
        let label = formatDate(date, "PPPP");
        if (modifiers?.today) {
          label = `Today, ${label}`;
        }
        return label;
      },
      labelNav: "Navigation bar",
      labelWeekNumberHeader: "Week Number",
      labelWeekday: (date, options, dateLib) => {
        let formatDate;
        if (dateLib && typeof dateLib.format === "function") {
          formatDate = dateLib.format.bind(dateLib);
        } else {
          formatDate = (d, pattern) => format(d, pattern, { locale: enUS, ...options });
        }
        return formatDate(date, "cccc");
      }
    }
  };

  // ../../../node_modules/react-day-picker/dist/esm/classes/DateLib.js
  var DateLib = class _DateLib {
    /**
     * Creates an instance of `DateLib`.
     *
     * @param options Configuration options for the date library.
     * @param overrides Custom overrides for the date library functions.
     */
    constructor(options, overrides) {
      this.Date = Date;
      this.today = () => {
        if (this.overrides?.today) {
          return this.overrides.today();
        }
        if (this.options.timeZone) {
          return TZDate.tz(this.options.timeZone);
        }
        return new this.Date();
      };
      this.newDate = (year, monthIndex, date) => {
        if (this.overrides?.newDate) {
          return this.overrides.newDate(year, monthIndex, date);
        }
        if (this.options.timeZone) {
          return new TZDate(year, monthIndex, date, this.options.timeZone);
        }
        return new Date(year, monthIndex, date);
      };
      this.addDays = (date, amount) => {
        return this.overrides?.addDays ? this.overrides.addDays(date, amount) : addDays(date, amount);
      };
      this.addMonths = (date, amount) => {
        return this.overrides?.addMonths ? this.overrides.addMonths(date, amount) : addMonths(date, amount);
      };
      this.addWeeks = (date, amount) => {
        return this.overrides?.addWeeks ? this.overrides.addWeeks(date, amount) : addWeeks(date, amount);
      };
      this.addYears = (date, amount) => {
        return this.overrides?.addYears ? this.overrides.addYears(date, amount) : addYears(date, amount);
      };
      this.differenceInCalendarDays = (dateLeft, dateRight) => {
        return this.overrides?.differenceInCalendarDays ? this.overrides.differenceInCalendarDays(dateLeft, dateRight) : differenceInCalendarDays(dateLeft, dateRight);
      };
      this.differenceInCalendarMonths = (dateLeft, dateRight) => {
        return this.overrides?.differenceInCalendarMonths ? this.overrides.differenceInCalendarMonths(dateLeft, dateRight) : differenceInCalendarMonths(dateLeft, dateRight);
      };
      this.eachMonthOfInterval = (interval) => {
        return this.overrides?.eachMonthOfInterval ? this.overrides.eachMonthOfInterval(interval) : eachMonthOfInterval(interval);
      };
      this.eachYearOfInterval = (interval) => {
        const years = this.overrides?.eachYearOfInterval ? this.overrides.eachYearOfInterval(interval) : eachYearOfInterval(interval);
        const uniqueYears = new Set(years.map((d) => this.getYear(d)));
        if (uniqueYears.size === years.length) {
          return years;
        }
        const yearsArray = [];
        uniqueYears.forEach((y) => {
          yearsArray.push(new Date(y, 0, 1));
        });
        return yearsArray;
      };
      this.endOfBroadcastWeek = (date) => {
        return this.overrides?.endOfBroadcastWeek ? this.overrides.endOfBroadcastWeek(date) : endOfBroadcastWeek(date, this);
      };
      this.endOfISOWeek = (date) => {
        return this.overrides?.endOfISOWeek ? this.overrides.endOfISOWeek(date) : endOfISOWeek(date);
      };
      this.endOfMonth = (date) => {
        return this.overrides?.endOfMonth ? this.overrides.endOfMonth(date) : endOfMonth(date);
      };
      this.endOfWeek = (date, options2) => {
        return this.overrides?.endOfWeek ? this.overrides.endOfWeek(date, options2) : endOfWeek(date, this.options);
      };
      this.endOfYear = (date) => {
        return this.overrides?.endOfYear ? this.overrides.endOfYear(date) : endOfYear(date);
      };
      this.format = (date, formatStr, _options) => {
        const formatted = this.overrides?.format ? this.overrides.format(date, formatStr, this.options) : format(date, formatStr, this.options);
        if (this.options.numerals && this.options.numerals !== "latn") {
          return this.replaceDigits(formatted);
        }
        return formatted;
      };
      this.getISOWeek = (date) => {
        return this.overrides?.getISOWeek ? this.overrides.getISOWeek(date) : getISOWeek(date);
      };
      this.getMonth = (date, _options) => {
        return this.overrides?.getMonth ? this.overrides.getMonth(date, this.options) : getMonth(date, this.options);
      };
      this.getYear = (date, _options) => {
        return this.overrides?.getYear ? this.overrides.getYear(date, this.options) : getYear(date, this.options);
      };
      this.getWeek = (date, _options) => {
        return this.overrides?.getWeek ? this.overrides.getWeek(date, this.options) : getWeek(date, this.options);
      };
      this.isAfter = (date, dateToCompare) => {
        return this.overrides?.isAfter ? this.overrides.isAfter(date, dateToCompare) : isAfter(date, dateToCompare);
      };
      this.isBefore = (date, dateToCompare) => {
        return this.overrides?.isBefore ? this.overrides.isBefore(date, dateToCompare) : isBefore(date, dateToCompare);
      };
      this.isDate = (value) => {
        return this.overrides?.isDate ? this.overrides.isDate(value) : isDate(value);
      };
      this.isSameDay = (dateLeft, dateRight) => {
        return this.overrides?.isSameDay ? this.overrides.isSameDay(dateLeft, dateRight) : isSameDay(dateLeft, dateRight);
      };
      this.isSameMonth = (dateLeft, dateRight) => {
        return this.overrides?.isSameMonth ? this.overrides.isSameMonth(dateLeft, dateRight) : isSameMonth(dateLeft, dateRight);
      };
      this.isSameYear = (dateLeft, dateRight) => {
        return this.overrides?.isSameYear ? this.overrides.isSameYear(dateLeft, dateRight) : isSameYear(dateLeft, dateRight);
      };
      this.max = (dates) => {
        return this.overrides?.max ? this.overrides.max(dates) : max(dates);
      };
      this.min = (dates) => {
        return this.overrides?.min ? this.overrides.min(dates) : min(dates);
      };
      this.setMonth = (date, month) => {
        return this.overrides?.setMonth ? this.overrides.setMonth(date, month) : setMonth(date, month);
      };
      this.setYear = (date, year) => {
        return this.overrides?.setYear ? this.overrides.setYear(date, year) : setYear(date, year);
      };
      this.startOfBroadcastWeek = (date, _dateLib) => {
        return this.overrides?.startOfBroadcastWeek ? this.overrides.startOfBroadcastWeek(date, this) : startOfBroadcastWeek(date, this);
      };
      this.startOfDay = (date) => {
        return this.overrides?.startOfDay ? this.overrides.startOfDay(date) : startOfDay(date);
      };
      this.startOfISOWeek = (date) => {
        return this.overrides?.startOfISOWeek ? this.overrides.startOfISOWeek(date) : startOfISOWeek(date);
      };
      this.startOfMonth = (date) => {
        return this.overrides?.startOfMonth ? this.overrides.startOfMonth(date) : startOfMonth(date);
      };
      this.startOfWeek = (date, _options) => {
        return this.overrides?.startOfWeek ? this.overrides.startOfWeek(date, this.options) : startOfWeek(date, this.options);
      };
      this.startOfYear = (date) => {
        return this.overrides?.startOfYear ? this.overrides.startOfYear(date) : startOfYear(date);
      };
      this.options = { locale: enUS2, ...options };
      this.overrides = overrides;
    }
    /**
     * Generates a mapping of Arabic digits (0-9) to the target numbering system
     * digits.
     *
     * @since 9.5.0
     * @returns A record mapping Arabic digits to the target numerals.
     */
    getDigitMap() {
      const { numerals = "latn" } = this.options;
      const formatter = new Intl.NumberFormat("en-US", {
        numberingSystem: numerals
      });
      const digitMap = {};
      for (let i = 0; i < 10; i++) {
        digitMap[i.toString()] = formatter.format(i);
      }
      return digitMap;
    }
    /**
     * Replaces Arabic digits in a string with the target numbering system digits.
     *
     * @since 9.5.0
     * @param input The string containing Arabic digits.
     * @returns The string with digits replaced.
     */
    replaceDigits(input) {
      const digitMap = this.getDigitMap();
      return input.replace(/\d/g, (digit) => digitMap[digit] || digit);
    }
    /**
     * Formats a number using the configured numbering system.
     *
     * @since 9.5.0
     * @param value The number to format.
     * @returns The formatted number as a string.
     */
    formatNumber(value) {
      return this.replaceDigits(value.toString());
    }
    /**
     * Returns the preferred ordering for month and year labels for the current
     * locale.
     */
    getMonthYearOrder() {
      const code = this.options.locale?.code;
      if (!code) {
        return "month-first";
      }
      return _DateLib.yearFirstLocales.has(code) ? "year-first" : "month-first";
    }
    /**
     * Formats the month/year pair respecting locale conventions.
     *
     * @since 9.11.0
     */
    formatMonthYear(date) {
      const { locale, timeZone, numerals } = this.options;
      const localeCode = locale?.code;
      if (localeCode && _DateLib.yearFirstLocales.has(localeCode)) {
        try {
          const intl = new Intl.DateTimeFormat(localeCode, {
            month: "long",
            year: "numeric",
            timeZone,
            numberingSystem: numerals
          });
          const formatted = intl.format(date);
          return formatted;
        } catch {
        }
      }
      const pattern = this.getMonthYearOrder() === "year-first" ? "y LLLL" : "LLLL y";
      return this.format(date, pattern);
    }
  };
  DateLib.yearFirstLocales = /* @__PURE__ */ new Set([
    "eu",
    "hu",
    "ja",
    "ja-Hira",
    "ja-JP",
    "ko",
    "ko-KR",
    "lt",
    "lt-LT",
    "lv",
    "lv-LV",
    "mn",
    "mn-MN",
    "zh",
    "zh-CN",
    "zh-HK",
    "zh-TW"
  ]);
  var defaultDateLib = new DateLib();

  // ../../../node_modules/react-day-picker/dist/esm/classes/CalendarDay.js
  var CalendarDay = class {
    constructor(date, displayMonth, dateLib = defaultDateLib) {
      this.date = date;
      this.displayMonth = displayMonth;
      this.outside = Boolean(displayMonth && !dateLib.isSameMonth(date, displayMonth));
      this.dateLib = dateLib;
      this.isoDate = dateLib.format(date, "yyyy-MM-dd");
      this.displayMonthId = dateLib.format(displayMonth, "yyyy-MM");
      this.dateMonthId = dateLib.format(date, "yyyy-MM");
    }
    /**
     * Checks if this day is equal to another `CalendarDay`, considering both the
     * date and the displayed month.
     *
     * @param day The `CalendarDay` to compare with.
     * @returns `true` if the days are equal, otherwise `false`.
     */
    isEqualTo(day) {
      return this.dateLib.isSameDay(day.date, this.date) && this.dateLib.isSameMonth(day.displayMonth, this.displayMonth);
    }
  };

  // ../../../node_modules/react-day-picker/dist/esm/classes/CalendarMonth.js
  init_define_import_meta_env();
  var CalendarMonth = class {
    constructor(month, weeks) {
      this.date = month;
      this.weeks = weeks;
    }
  };

  // ../../../node_modules/react-day-picker/dist/esm/classes/CalendarWeek.js
  init_define_import_meta_env();
  var CalendarWeek = class {
    constructor(weekNumber, days) {
      this.days = days;
      this.weekNumber = weekNumber;
    }
  };

  // ../../../node_modules/react-day-picker/dist/esm/components/custom-components.js
  var custom_components_exports = {};
  __export(custom_components_exports, {
    Button: () => Button,
    CaptionLabel: () => CaptionLabel,
    Chevron: () => Chevron,
    Day: () => Day,
    DayButton: () => DayButton,
    Dropdown: () => Dropdown,
    DropdownNav: () => DropdownNav,
    Footer: () => Footer,
    Month: () => Month,
    MonthCaption: () => MonthCaption,
    MonthGrid: () => MonthGrid,
    Months: () => Months,
    MonthsDropdown: () => MonthsDropdown,
    Nav: () => Nav,
    NextMonthButton: () => NextMonthButton,
    Option: () => Option,
    PreviousMonthButton: () => PreviousMonthButton,
    Root: () => Root,
    Select: () => Select,
    Week: () => Week,
    WeekNumber: () => WeekNumber,
    WeekNumberHeader: () => WeekNumberHeader,
    Weekday: () => Weekday,
    Weekdays: () => Weekdays,
    Weeks: () => Weeks,
    YearsDropdown: () => YearsDropdown
  });
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/components/Button.js
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim());
  function Button(props) {
    return import_react.default.createElement("button", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/CaptionLabel.js
  init_define_import_meta_env();
  var import_react2 = __toESM(require_react_shim());
  function CaptionLabel(props) {
    return import_react2.default.createElement("span", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Chevron.js
  init_define_import_meta_env();
  var import_react3 = __toESM(require_react_shim());
  function Chevron(props) {
    const { size = 24, orientation = "left", className } = props;
    return (
      // biome-ignore lint/a11y/noSvgWithoutTitle: handled by the parent component
      import_react3.default.createElement(
        "svg",
        { className, width: size, height: size, viewBox: "0 0 24 24" },
        orientation === "up" && import_react3.default.createElement("polygon", { points: "6.77 17 12.5 11.43 18.24 17 20 15.28 12.5 8 5 15.28" }),
        orientation === "down" && import_react3.default.createElement("polygon", { points: "6.77 8 12.5 13.57 18.24 8 20 9.72 12.5 17 5 9.72" }),
        orientation === "left" && import_react3.default.createElement("polygon", { points: "16 18.112 9.81111111 12 16 5.87733333 14.0888889 4 6 12 14.0888889 20" }),
        orientation === "right" && import_react3.default.createElement("polygon", { points: "8 18.112 14.18888889 12 8 5.87733333 9.91111111 4 18 12 9.91111111 20" })
      )
    );
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Day.js
  init_define_import_meta_env();
  var import_react4 = __toESM(require_react_shim());
  function Day(props) {
    const { day, modifiers, ...tdProps } = props;
    return import_react4.default.createElement("td", { ...tdProps });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/DayButton.js
  init_define_import_meta_env();
  var import_react5 = __toESM(require_react_shim());
  function DayButton(props) {
    const { day, modifiers, ...buttonProps } = props;
    const ref = import_react5.default.useRef(null);
    import_react5.default.useEffect(() => {
      if (modifiers.focused)
        ref.current?.focus();
    }, [modifiers.focused]);
    return import_react5.default.createElement("button", { ref, ...buttonProps });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Dropdown.js
  init_define_import_meta_env();
  var import_react6 = __toESM(require_react_shim());

  // ../../../node_modules/react-day-picker/dist/esm/UI.js
  init_define_import_meta_env();
  var UI;
  (function(UI2) {
    UI2["Root"] = "root";
    UI2["Chevron"] = "chevron";
    UI2["Day"] = "day";
    UI2["DayButton"] = "day_button";
    UI2["CaptionLabel"] = "caption_label";
    UI2["Dropdowns"] = "dropdowns";
    UI2["Dropdown"] = "dropdown";
    UI2["DropdownRoot"] = "dropdown_root";
    UI2["Footer"] = "footer";
    UI2["MonthGrid"] = "month_grid";
    UI2["MonthCaption"] = "month_caption";
    UI2["MonthsDropdown"] = "months_dropdown";
    UI2["Month"] = "month";
    UI2["Months"] = "months";
    UI2["Nav"] = "nav";
    UI2["NextMonthButton"] = "button_next";
    UI2["PreviousMonthButton"] = "button_previous";
    UI2["Week"] = "week";
    UI2["Weeks"] = "weeks";
    UI2["Weekday"] = "weekday";
    UI2["Weekdays"] = "weekdays";
    UI2["WeekNumber"] = "week_number";
    UI2["WeekNumberHeader"] = "week_number_header";
    UI2["YearsDropdown"] = "years_dropdown";
  })(UI || (UI = {}));
  var DayFlag;
  (function(DayFlag2) {
    DayFlag2["disabled"] = "disabled";
    DayFlag2["hidden"] = "hidden";
    DayFlag2["outside"] = "outside";
    DayFlag2["focused"] = "focused";
    DayFlag2["today"] = "today";
  })(DayFlag || (DayFlag = {}));
  var SelectionState;
  (function(SelectionState2) {
    SelectionState2["range_end"] = "range_end";
    SelectionState2["range_middle"] = "range_middle";
    SelectionState2["range_start"] = "range_start";
    SelectionState2["selected"] = "selected";
  })(SelectionState || (SelectionState = {}));
  var Animation;
  (function(Animation2) {
    Animation2["weeks_before_enter"] = "weeks_before_enter";
    Animation2["weeks_before_exit"] = "weeks_before_exit";
    Animation2["weeks_after_enter"] = "weeks_after_enter";
    Animation2["weeks_after_exit"] = "weeks_after_exit";
    Animation2["caption_after_enter"] = "caption_after_enter";
    Animation2["caption_after_exit"] = "caption_after_exit";
    Animation2["caption_before_enter"] = "caption_before_enter";
    Animation2["caption_before_exit"] = "caption_before_exit";
  })(Animation || (Animation = {}));

  // ../../../node_modules/react-day-picker/dist/esm/components/Dropdown.js
  function Dropdown(props) {
    const { options, className, components, classNames, ...selectProps } = props;
    const cssClassSelect = [classNames[UI.Dropdown], className].join(" ");
    const selectedOption = options?.find(({ value }) => value === selectProps.value);
    return import_react6.default.createElement(
      "span",
      { "data-disabled": selectProps.disabled, className: classNames[UI.DropdownRoot] },
      import_react6.default.createElement(components.Select, { className: cssClassSelect, ...selectProps }, options?.map(({ value, label, disabled }) => import_react6.default.createElement(components.Option, { key: value, value, disabled }, label))),
      import_react6.default.createElement(
        "span",
        { className: classNames[UI.CaptionLabel], "aria-hidden": true },
        selectedOption?.label,
        import_react6.default.createElement(components.Chevron, { orientation: "down", size: 18, className: classNames[UI.Chevron] })
      )
    );
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/DropdownNav.js
  init_define_import_meta_env();
  var import_react7 = __toESM(require_react_shim());
  function DropdownNav(props) {
    return import_react7.default.createElement("div", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Footer.js
  init_define_import_meta_env();
  var import_react8 = __toESM(require_react_shim());
  function Footer(props) {
    return import_react8.default.createElement("div", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Month.js
  init_define_import_meta_env();
  var import_react9 = __toESM(require_react_shim());
  function Month(props) {
    const { calendarMonth, displayIndex, ...divProps } = props;
    return import_react9.default.createElement("div", { ...divProps }, props.children);
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/MonthCaption.js
  init_define_import_meta_env();
  var import_react10 = __toESM(require_react_shim());
  function MonthCaption(props) {
    const { calendarMonth, displayIndex, ...divProps } = props;
    return import_react10.default.createElement("div", { ...divProps });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/MonthGrid.js
  init_define_import_meta_env();
  var import_react11 = __toESM(require_react_shim());
  function MonthGrid(props) {
    return import_react11.default.createElement("table", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Months.js
  init_define_import_meta_env();
  var import_react12 = __toESM(require_react_shim());
  function Months(props) {
    return import_react12.default.createElement("div", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/MonthsDropdown.js
  init_define_import_meta_env();
  var import_react14 = __toESM(require_react_shim());

  // ../../../node_modules/react-day-picker/dist/esm/useDayPicker.js
  init_define_import_meta_env();
  var import_react13 = __toESM(require_react_shim());
  var dayPickerContext = (0, import_react13.createContext)(void 0);
  function useDayPicker() {
    const context = (0, import_react13.useContext)(dayPickerContext);
    if (context === void 0) {
      throw new Error("useDayPicker() must be used within a custom component.");
    }
    return context;
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/MonthsDropdown.js
  function MonthsDropdown(props) {
    const { components } = useDayPicker();
    return import_react14.default.createElement(components.Dropdown, { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Nav.js
  init_define_import_meta_env();
  var import_react15 = __toESM(require_react_shim());
  function Nav(props) {
    const { onPreviousClick, onNextClick, previousMonth, nextMonth, ...navProps } = props;
    const { components, classNames, labels: { labelPrevious: labelPrevious2, labelNext: labelNext2 } } = useDayPicker();
    const handleNextClick = (0, import_react15.useCallback)((e) => {
      if (nextMonth) {
        onNextClick?.(e);
      }
    }, [nextMonth, onNextClick]);
    const handlePreviousClick = (0, import_react15.useCallback)((e) => {
      if (previousMonth) {
        onPreviousClick?.(e);
      }
    }, [previousMonth, onPreviousClick]);
    return import_react15.default.createElement(
      "nav",
      { ...navProps },
      import_react15.default.createElement(
        components.PreviousMonthButton,
        { type: "button", className: classNames[UI.PreviousMonthButton], tabIndex: previousMonth ? void 0 : -1, "aria-disabled": previousMonth ? void 0 : true, "aria-label": labelPrevious2(previousMonth), onClick: handlePreviousClick },
        import_react15.default.createElement(components.Chevron, { disabled: previousMonth ? void 0 : true, className: classNames[UI.Chevron], orientation: "left" })
      ),
      import_react15.default.createElement(
        components.NextMonthButton,
        { type: "button", className: classNames[UI.NextMonthButton], tabIndex: nextMonth ? void 0 : -1, "aria-disabled": nextMonth ? void 0 : true, "aria-label": labelNext2(nextMonth), onClick: handleNextClick },
        import_react15.default.createElement(components.Chevron, { disabled: nextMonth ? void 0 : true, orientation: "right", className: classNames[UI.Chevron] })
      )
    );
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/NextMonthButton.js
  init_define_import_meta_env();
  var import_react16 = __toESM(require_react_shim());
  function NextMonthButton(props) {
    const { components } = useDayPicker();
    return import_react16.default.createElement(components.Button, { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Option.js
  init_define_import_meta_env();
  var import_react17 = __toESM(require_react_shim());
  function Option(props) {
    return import_react17.default.createElement("option", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/PreviousMonthButton.js
  init_define_import_meta_env();
  var import_react18 = __toESM(require_react_shim());
  function PreviousMonthButton(props) {
    const { components } = useDayPicker();
    return import_react18.default.createElement(components.Button, { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Root.js
  init_define_import_meta_env();
  var import_react19 = __toESM(require_react_shim());
  function Root(props) {
    const { rootRef, ...rest } = props;
    return import_react19.default.createElement("div", { ...rest, ref: rootRef });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Select.js
  init_define_import_meta_env();
  var import_react20 = __toESM(require_react_shim());
  function Select(props) {
    return import_react20.default.createElement("select", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Week.js
  init_define_import_meta_env();
  var import_react21 = __toESM(require_react_shim());
  function Week(props) {
    const { week, ...trProps } = props;
    return import_react21.default.createElement("tr", { ...trProps });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Weekday.js
  init_define_import_meta_env();
  var import_react22 = __toESM(require_react_shim());
  function Weekday(props) {
    return import_react22.default.createElement("th", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Weekdays.js
  init_define_import_meta_env();
  var import_react23 = __toESM(require_react_shim());
  function Weekdays(props) {
    return import_react23.default.createElement(
      "thead",
      { "aria-hidden": true },
      import_react23.default.createElement("tr", { ...props })
    );
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/WeekNumber.js
  init_define_import_meta_env();
  var import_react24 = __toESM(require_react_shim());
  function WeekNumber(props) {
    const { week, ...thProps } = props;
    return import_react24.default.createElement("th", { ...thProps });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/WeekNumberHeader.js
  init_define_import_meta_env();
  var import_react25 = __toESM(require_react_shim());
  function WeekNumberHeader(props) {
    return import_react25.default.createElement("th", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/Weeks.js
  init_define_import_meta_env();
  var import_react26 = __toESM(require_react_shim());
  function Weeks(props) {
    return import_react26.default.createElement("tbody", { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/components/YearsDropdown.js
  init_define_import_meta_env();
  var import_react27 = __toESM(require_react_shim());
  function YearsDropdown(props) {
    const { components } = useDayPicker();
    return import_react27.default.createElement(components.Dropdown, { ...props });
  }

  // ../../../node_modules/react-day-picker/dist/esm/DayPicker.js
  init_define_import_meta_env();
  var import_react32 = __toESM(require_react_shim());

  // ../../../node_modules/react-day-picker/dist/esm/helpers/createGetModifiers.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/utils/dateMatchModifiers.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/utils/rangeIncludesDate.js
  init_define_import_meta_env();
  function rangeIncludesDate(range, date, excludeEnds = false, dateLib = defaultDateLib) {
    let { from, to } = range;
    const { differenceInCalendarDays: differenceInCalendarDays2, isSameDay: isSameDay2 } = dateLib;
    if (from && to) {
      const isRangeInverted = differenceInCalendarDays2(to, from) < 0;
      if (isRangeInverted) {
        [from, to] = [to, from];
      }
      const isInRange = differenceInCalendarDays2(date, from) >= (excludeEnds ? 1 : 0) && differenceInCalendarDays2(to, date) >= (excludeEnds ? 1 : 0);
      return isInRange;
    }
    if (!excludeEnds && to) {
      return isSameDay2(to, date);
    }
    if (!excludeEnds && from) {
      return isSameDay2(from, date);
    }
    return false;
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/typeguards.js
  init_define_import_meta_env();
  function isDateInterval(matcher) {
    return Boolean(matcher && typeof matcher === "object" && "before" in matcher && "after" in matcher);
  }
  function isDateRange(value) {
    return Boolean(value && typeof value === "object" && "from" in value);
  }
  function isDateAfterType(value) {
    return Boolean(value && typeof value === "object" && "after" in value);
  }
  function isDateBeforeType(value) {
    return Boolean(value && typeof value === "object" && "before" in value);
  }
  function isDayOfWeekType(value) {
    return Boolean(value && typeof value === "object" && "dayOfWeek" in value);
  }
  function isDatesArray(value, dateLib) {
    return Array.isArray(value) && value.every(dateLib.isDate);
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/dateMatchModifiers.js
  function dateMatchModifiers(date, matchers, dateLib = defaultDateLib) {
    const matchersArr = !Array.isArray(matchers) ? [matchers] : matchers;
    const { isSameDay: isSameDay2, differenceInCalendarDays: differenceInCalendarDays2, isAfter: isAfter2 } = dateLib;
    return matchersArr.some((matcher) => {
      if (typeof matcher === "boolean") {
        return matcher;
      }
      if (dateLib.isDate(matcher)) {
        return isSameDay2(date, matcher);
      }
      if (isDatesArray(matcher, dateLib)) {
        return matcher.some((matcherDate) => isSameDay2(date, matcherDate));
      }
      if (isDateRange(matcher)) {
        return rangeIncludesDate(matcher, date, false, dateLib);
      }
      if (isDayOfWeekType(matcher)) {
        if (!Array.isArray(matcher.dayOfWeek)) {
          return matcher.dayOfWeek === date.getDay();
        }
        return matcher.dayOfWeek.includes(date.getDay());
      }
      if (isDateInterval(matcher)) {
        const diffBefore = differenceInCalendarDays2(matcher.before, date);
        const diffAfter = differenceInCalendarDays2(matcher.after, date);
        const isDayBefore = diffBefore > 0;
        const isDayAfter = diffAfter < 0;
        const isClosedInterval = isAfter2(matcher.before, matcher.after);
        if (isClosedInterval) {
          return isDayAfter && isDayBefore;
        } else {
          return isDayBefore || isDayAfter;
        }
      }
      if (isDateAfterType(matcher)) {
        return differenceInCalendarDays2(date, matcher.after) > 0;
      }
      if (isDateBeforeType(matcher)) {
        return differenceInCalendarDays2(matcher.before, date) > 0;
      }
      if (typeof matcher === "function") {
        return matcher(date);
      }
      return false;
    });
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/createGetModifiers.js
  function createGetModifiers(days, props, navStart, navEnd, dateLib) {
    const { disabled, hidden, modifiers, showOutsideDays, broadcastCalendar, today = dateLib.today() } = props;
    const { isSameDay: isSameDay2, isSameMonth: isSameMonth2, startOfMonth: startOfMonth2, isBefore: isBefore2, endOfMonth: endOfMonth2, isAfter: isAfter2 } = dateLib;
    const computedNavStart = navStart && startOfMonth2(navStart);
    const computedNavEnd = navEnd && endOfMonth2(navEnd);
    const internalModifiersMap = {
      [DayFlag.focused]: [],
      [DayFlag.outside]: [],
      [DayFlag.disabled]: [],
      [DayFlag.hidden]: [],
      [DayFlag.today]: []
    };
    const customModifiersMap = {};
    for (const day of days) {
      const { date, displayMonth } = day;
      const isOutside = Boolean(displayMonth && !isSameMonth2(date, displayMonth));
      const isBeforeNavStart = Boolean(computedNavStart && isBefore2(date, computedNavStart));
      const isAfterNavEnd = Boolean(computedNavEnd && isAfter2(date, computedNavEnd));
      const isDisabled = Boolean(disabled && dateMatchModifiers(date, disabled, dateLib));
      const isHidden = Boolean(hidden && dateMatchModifiers(date, hidden, dateLib)) || isBeforeNavStart || isAfterNavEnd || // Broadcast calendar will show outside days as default
      !broadcastCalendar && !showOutsideDays && isOutside || broadcastCalendar && showOutsideDays === false && isOutside;
      const isToday = isSameDay2(date, today);
      if (isOutside)
        internalModifiersMap.outside.push(day);
      if (isDisabled)
        internalModifiersMap.disabled.push(day);
      if (isHidden)
        internalModifiersMap.hidden.push(day);
      if (isToday)
        internalModifiersMap.today.push(day);
      if (modifiers) {
        Object.keys(modifiers).forEach((name) => {
          const modifierValue = modifiers?.[name];
          const isMatch = modifierValue ? dateMatchModifiers(date, modifierValue, dateLib) : false;
          if (!isMatch)
            return;
          if (customModifiersMap[name]) {
            customModifiersMap[name].push(day);
          } else {
            customModifiersMap[name] = [day];
          }
        });
      }
    }
    return (day) => {
      const dayFlags = {
        [DayFlag.focused]: false,
        [DayFlag.disabled]: false,
        [DayFlag.hidden]: false,
        [DayFlag.outside]: false,
        [DayFlag.today]: false
      };
      const customModifiers = {};
      for (const name in internalModifiersMap) {
        const days2 = internalModifiersMap[name];
        dayFlags[name] = days2.some((d) => d === day);
      }
      for (const name in customModifiersMap) {
        customModifiers[name] = customModifiersMap[name].some((d) => d === day);
      }
      return {
        ...dayFlags,
        // custom modifiers should override all the previous ones
        ...customModifiers
      };
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getClassNamesForModifiers.js
  init_define_import_meta_env();
  function getClassNamesForModifiers(modifiers, classNames, modifiersClassNames = {}) {
    const modifierClassNames = Object.entries(modifiers).filter(([, active]) => active === true).reduce((previousValue, [key]) => {
      if (modifiersClassNames[key]) {
        previousValue.push(modifiersClassNames[key]);
      } else if (classNames[DayFlag[key]]) {
        previousValue.push(classNames[DayFlag[key]]);
      } else if (classNames[SelectionState[key]]) {
        previousValue.push(classNames[SelectionState[key]]);
      }
      return previousValue;
    }, [classNames[UI.Day]]);
    return modifierClassNames;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getComponents.js
  init_define_import_meta_env();
  function getComponents(customComponents) {
    return {
      ...custom_components_exports,
      ...customComponents
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getDataAttributes.js
  init_define_import_meta_env();
  function getDataAttributes(props) {
    const dataAttributes = {
      "data-mode": props.mode ?? void 0,
      "data-required": "required" in props ? props.required : void 0,
      "data-multiple-months": props.numberOfMonths && props.numberOfMonths > 1 || void 0,
      "data-week-numbers": props.showWeekNumber || void 0,
      "data-broadcast-calendar": props.broadcastCalendar || void 0,
      "data-nav-layout": props.navLayout || void 0
    };
    Object.entries(props).forEach(([key, val]) => {
      if (key.startsWith("data-")) {
        dataAttributes[key] = val;
      }
    });
    return dataAttributes;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getDefaultClassNames.js
  init_define_import_meta_env();
  function getDefaultClassNames() {
    const classNames = {};
    for (const key in UI) {
      classNames[UI[key]] = `rdp-${UI[key]}`;
    }
    for (const key in DayFlag) {
      classNames[DayFlag[key]] = `rdp-${DayFlag[key]}`;
    }
    for (const key in SelectionState) {
      classNames[SelectionState[key]] = `rdp-${SelectionState[key]}`;
    }
    for (const key in Animation) {
      classNames[Animation[key]] = `rdp-${Animation[key]}`;
    }
    return classNames;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getFormatters.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/formatters/index.js
  var formatters_exports = {};
  __export(formatters_exports, {
    formatCaption: () => formatCaption,
    formatDay: () => formatDay,
    formatMonthCaption: () => formatMonthCaption,
    formatMonthDropdown: () => formatMonthDropdown,
    formatWeekNumber: () => formatWeekNumber,
    formatWeekNumberHeader: () => formatWeekNumberHeader,
    formatWeekdayName: () => formatWeekdayName,
    formatYearCaption: () => formatYearCaption,
    formatYearDropdown: () => formatYearDropdown
  });
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatCaption.js
  init_define_import_meta_env();
  function formatCaption(month, options, dateLib) {
    const lib = dateLib ?? new DateLib(options);
    return lib.formatMonthYear(month);
  }
  var formatMonthCaption = formatCaption;

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatDay.js
  init_define_import_meta_env();
  function formatDay(date, options, dateLib) {
    return (dateLib ?? new DateLib(options)).format(date, "d");
  }

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatMonthDropdown.js
  init_define_import_meta_env();
  function formatMonthDropdown(month, dateLib = defaultDateLib) {
    return dateLib.format(month, "LLLL");
  }

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatWeekdayName.js
  init_define_import_meta_env();
  function formatWeekdayName(weekday, options, dateLib) {
    return (dateLib ?? new DateLib(options)).format(weekday, "cccccc");
  }

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatWeekNumber.js
  init_define_import_meta_env();
  function formatWeekNumber(weekNumber, dateLib = defaultDateLib) {
    if (weekNumber < 10) {
      return dateLib.formatNumber(`0${weekNumber.toLocaleString()}`);
    }
    return dateLib.formatNumber(`${weekNumber.toLocaleString()}`);
  }

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatWeekNumberHeader.js
  init_define_import_meta_env();
  function formatWeekNumberHeader() {
    return ``;
  }

  // ../../../node_modules/react-day-picker/dist/esm/formatters/formatYearDropdown.js
  init_define_import_meta_env();
  function formatYearDropdown(year, dateLib = defaultDateLib) {
    return dateLib.format(year, "yyyy");
  }
  var formatYearCaption = formatYearDropdown;

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getFormatters.js
  function getFormatters(customFormatters) {
    if (customFormatters?.formatMonthCaption && !customFormatters.formatCaption) {
      customFormatters.formatCaption = customFormatters.formatMonthCaption;
    }
    if (customFormatters?.formatYearCaption && !customFormatters.formatYearDropdown) {
      customFormatters.formatYearDropdown = customFormatters.formatYearCaption;
    }
    return {
      ...formatters_exports,
      ...customFormatters
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getLabels.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/labels/index.js
  var labels_exports = {};
  __export(labels_exports, {
    labelCaption: () => labelCaption,
    labelDay: () => labelDay,
    labelDayButton: () => labelDayButton,
    labelGrid: () => labelGrid,
    labelGridcell: () => labelGridcell,
    labelMonthDropdown: () => labelMonthDropdown,
    labelNav: () => labelNav,
    labelNext: () => labelNext,
    labelPrevious: () => labelPrevious,
    labelWeekNumber: () => labelWeekNumber,
    labelWeekNumberHeader: () => labelWeekNumberHeader,
    labelWeekday: () => labelWeekday,
    labelYearDropdown: () => labelYearDropdown
  });
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelDayButton.js
  init_define_import_meta_env();
  function labelDayButton(date, modifiers, options, dateLib) {
    let label = (dateLib ?? new DateLib(options)).format(date, "PPPP");
    if (modifiers.today)
      label = `Today, ${label}`;
    if (modifiers.selected)
      label = `${label}, selected`;
    return label;
  }
  var labelDay = labelDayButton;

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelGrid.js
  init_define_import_meta_env();
  function labelGrid(date, options, dateLib) {
    const lib = dateLib ?? new DateLib(options);
    return lib.formatMonthYear(date);
  }
  var labelCaption = labelGrid;

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelGridcell.js
  init_define_import_meta_env();
  function labelGridcell(date, modifiers, options, dateLib) {
    let label = (dateLib ?? new DateLib(options)).format(date, "PPPP");
    if (modifiers?.today) {
      label = `Today, ${label}`;
    }
    return label;
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelMonthDropdown.js
  init_define_import_meta_env();
  function labelMonthDropdown(_options) {
    return "Choose the Month";
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelNav.js
  init_define_import_meta_env();
  function labelNav() {
    return "";
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelNext.js
  init_define_import_meta_env();
  var defaultLabel = "Go to the Next Month";
  function labelNext(_month, _options) {
    return defaultLabel;
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelPrevious.js
  init_define_import_meta_env();
  function labelPrevious(_month) {
    return "Go to the Previous Month";
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelWeekday.js
  init_define_import_meta_env();
  function labelWeekday(date, options, dateLib) {
    return (dateLib ?? new DateLib(options)).format(date, "cccc");
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelWeekNumber.js
  init_define_import_meta_env();
  function labelWeekNumber(weekNumber, _options) {
    return `Week ${weekNumber}`;
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelWeekNumberHeader.js
  init_define_import_meta_env();
  function labelWeekNumberHeader(_options) {
    return "Week Number";
  }

  // ../../../node_modules/react-day-picker/dist/esm/labels/labelYearDropdown.js
  init_define_import_meta_env();
  function labelYearDropdown(_options) {
    return "Choose the Year";
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getLabels.js
  var resolveLabel = (defaultLabel2, customLabel, localeLabel) => {
    if (customLabel)
      return customLabel;
    if (localeLabel) {
      return typeof localeLabel === "function" ? localeLabel : (..._args) => localeLabel;
    }
    return defaultLabel2;
  };
  function getLabels(customLabels, options) {
    const localeLabels = options.locale?.labels ?? {};
    return {
      ...labels_exports,
      ...customLabels ?? {},
      labelDayButton: resolveLabel(labelDayButton, customLabels?.labelDayButton, localeLabels.labelDayButton),
      labelMonthDropdown: resolveLabel(labelMonthDropdown, customLabels?.labelMonthDropdown, localeLabels.labelMonthDropdown),
      labelNext: resolveLabel(labelNext, customLabels?.labelNext, localeLabels.labelNext),
      labelPrevious: resolveLabel(labelPrevious, customLabels?.labelPrevious, localeLabels.labelPrevious),
      labelWeekNumber: resolveLabel(labelWeekNumber, customLabels?.labelWeekNumber, localeLabels.labelWeekNumber),
      labelYearDropdown: resolveLabel(labelYearDropdown, customLabels?.labelYearDropdown, localeLabels.labelYearDropdown),
      labelGrid: resolveLabel(labelGrid, customLabels?.labelGrid, localeLabels.labelGrid),
      labelGridcell: resolveLabel(labelGridcell, customLabels?.labelGridcell, localeLabels.labelGridcell),
      labelNav: resolveLabel(labelNav, customLabels?.labelNav, localeLabels.labelNav),
      labelWeekNumberHeader: resolveLabel(labelWeekNumberHeader, customLabels?.labelWeekNumberHeader, localeLabels.labelWeekNumberHeader),
      labelWeekday: resolveLabel(labelWeekday, customLabels?.labelWeekday, localeLabels.labelWeekday)
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getMonthOptions.js
  init_define_import_meta_env();
  function getMonthOptions(displayMonth, navStart, navEnd, formatters2, dateLib) {
    const { startOfMonth: startOfMonth2, startOfYear: startOfYear2, endOfYear: endOfYear2, eachMonthOfInterval: eachMonthOfInterval2, getMonth: getMonth2 } = dateLib;
    const months = eachMonthOfInterval2({
      start: startOfYear2(displayMonth),
      end: endOfYear2(displayMonth)
    });
    const options = months.map((month) => {
      const label = formatters2.formatMonthDropdown(month, dateLib);
      const value = getMonth2(month);
      const disabled = navStart && month < startOfMonth2(navStart) || navEnd && month > startOfMonth2(navEnd) || false;
      return { value, label, disabled };
    });
    return options;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getStyleForModifiers.js
  init_define_import_meta_env();
  function getStyleForModifiers(dayModifiers, styles = {}, modifiersStyles = {}) {
    let style = { ...styles?.[UI.Day] };
    Object.entries(dayModifiers).filter(([, active]) => active === true).forEach(([modifier]) => {
      style = {
        ...style,
        ...modifiersStyles?.[modifier]
      };
    });
    return style;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getWeekdays.js
  init_define_import_meta_env();
  function getWeekdays(dateLib, ISOWeek, broadcastCalendar, today) {
    const referenceToday = today ?? dateLib.today();
    const start = broadcastCalendar ? dateLib.startOfBroadcastWeek(referenceToday, dateLib) : ISOWeek ? dateLib.startOfISOWeek(referenceToday) : dateLib.startOfWeek(referenceToday);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = dateLib.addDays(start, i);
      days.push(day);
    }
    return days;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getYearOptions.js
  init_define_import_meta_env();
  function getYearOptions(navStart, navEnd, formatters2, dateLib, reverse = false) {
    if (!navStart)
      return void 0;
    if (!navEnd)
      return void 0;
    const { startOfYear: startOfYear2, endOfYear: endOfYear2, eachYearOfInterval: eachYearOfInterval2, getYear: getYear2 } = dateLib;
    const firstNavYear = startOfYear2(navStart);
    const lastNavYear = endOfYear2(navEnd);
    const years = eachYearOfInterval2({ start: firstNavYear, end: lastNavYear });
    if (reverse)
      years.reverse();
    return years.map((year) => {
      const label = formatters2.formatYearDropdown(year, dateLib);
      return {
        value: getYear2(year),
        label,
        disabled: false
      };
    });
  }

  // ../../../node_modules/react-day-picker/dist/esm/noonDateLib.js
  init_define_import_meta_env();
  function createNoonOverrides(timeZone, options = {}) {
    const { weekStartsOn, locale } = options;
    const fallbackWeekStartsOn = weekStartsOn ?? locale?.options?.weekStartsOn ?? 0;
    const toNoonTZDate = (date) => {
      const normalizedDate = typeof date === "number" || typeof date === "string" ? new Date(date) : date;
      return new TZDate(normalizedDate.getFullYear(), normalizedDate.getMonth(), normalizedDate.getDate(), 12, 0, 0, timeZone);
    };
    const toCalendarDate = (date) => {
      const zoned = toNoonTZDate(date);
      return new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 0, 0, 0, 0);
    };
    return {
      today: () => {
        return toNoonTZDate(TZDate.tz(timeZone));
      },
      newDate: (year, monthIndex, date) => {
        return new TZDate(year, monthIndex, date, 12, 0, 0, timeZone);
      },
      startOfDay: (date) => {
        return toNoonTZDate(date);
      },
      startOfWeek: (date, options2) => {
        const base = toNoonTZDate(date);
        const weekStartsOnValue = options2?.weekStartsOn ?? fallbackWeekStartsOn;
        const diff = (base.getDay() - weekStartsOnValue + 7) % 7;
        base.setDate(base.getDate() - diff);
        return base;
      },
      startOfISOWeek: (date) => {
        const base = toNoonTZDate(date);
        const diff = (base.getDay() - 1 + 7) % 7;
        base.setDate(base.getDate() - diff);
        return base;
      },
      startOfMonth: (date) => {
        const base = toNoonTZDate(date);
        base.setDate(1);
        return base;
      },
      startOfYear: (date) => {
        const base = toNoonTZDate(date);
        base.setMonth(0, 1);
        return base;
      },
      endOfWeek: (date, options2) => {
        const base = toNoonTZDate(date);
        const weekStartsOnValue = options2?.weekStartsOn ?? fallbackWeekStartsOn;
        const endDow = (weekStartsOnValue + 6) % 7;
        const diff = (endDow - base.getDay() + 7) % 7;
        base.setDate(base.getDate() + diff);
        return base;
      },
      endOfISOWeek: (date) => {
        const base = toNoonTZDate(date);
        const diff = (7 - base.getDay()) % 7;
        base.setDate(base.getDate() + diff);
        return base;
      },
      endOfMonth: (date) => {
        const base = toNoonTZDate(date);
        base.setMonth(base.getMonth() + 1, 0);
        return base;
      },
      endOfYear: (date) => {
        const base = toNoonTZDate(date);
        base.setMonth(11, 31);
        return base;
      },
      eachMonthOfInterval: (interval) => {
        const start = toNoonTZDate(interval.start);
        const end = toNoonTZDate(interval.end);
        const result = [];
        const cursor = new TZDate(start.getFullYear(), start.getMonth(), 1, 12, 0, 0, timeZone);
        const endKey = end.getFullYear() * 12 + end.getMonth();
        while (cursor.getFullYear() * 12 + cursor.getMonth() <= endKey) {
          result.push(new TZDate(cursor, timeZone));
          cursor.setMonth(cursor.getMonth() + 1, 1);
        }
        return result;
      },
      // Normalize to noon once before arithmetic (avoid DST/midnight edge cases),
      // mutate the same TZDate, and return it.
      addDays: (date, amount) => {
        const base = toNoonTZDate(date);
        base.setDate(base.getDate() + amount);
        return base;
      },
      addWeeks: (date, amount) => {
        const base = toNoonTZDate(date);
        base.setDate(base.getDate() + amount * 7);
        return base;
      },
      addMonths: (date, amount) => {
        const base = toNoonTZDate(date);
        base.setMonth(base.getMonth() + amount);
        return base;
      },
      addYears: (date, amount) => {
        const base = toNoonTZDate(date);
        base.setFullYear(base.getFullYear() + amount);
        return base;
      },
      eachYearOfInterval: (interval) => {
        const start = toNoonTZDate(interval.start);
        const end = toNoonTZDate(interval.end);
        const years = [];
        const cursor = new TZDate(start.getFullYear(), 0, 1, 12, 0, 0, timeZone);
        while (cursor.getFullYear() <= end.getFullYear()) {
          years.push(new TZDate(cursor, timeZone));
          cursor.setFullYear(cursor.getFullYear() + 1, 0, 1);
        }
        return years;
      },
      getWeek: (date, options2) => {
        const base = toCalendarDate(date);
        return getWeek(base, {
          weekStartsOn: options2?.weekStartsOn ?? fallbackWeekStartsOn,
          firstWeekContainsDate: options2?.firstWeekContainsDate ?? locale?.options?.firstWeekContainsDate ?? 1
        });
      },
      getISOWeek: (date) => {
        const base = toCalendarDate(date);
        return getISOWeek(base);
      },
      differenceInCalendarDays: (dateLeft, dateRight) => {
        const left = toCalendarDate(dateLeft);
        const right = toCalendarDate(dateRight);
        return differenceInCalendarDays(left, right);
      },
      differenceInCalendarMonths: (dateLeft, dateRight) => {
        const left = toCalendarDate(dateLeft);
        const right = toCalendarDate(dateRight);
        return differenceInCalendarMonths(left, right);
      }
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/useAnimation.js
  init_define_import_meta_env();
  var import_react28 = __toESM(require_react_shim());
  var asHtmlElement = (element) => {
    if (element instanceof HTMLElement)
      return element;
    return null;
  };
  var queryMonthEls = (element) => [
    ...element.querySelectorAll("[data-animated-month]") ?? []
  ];
  var queryMonthEl = (element) => asHtmlElement(element.querySelector("[data-animated-month]"));
  var queryCaptionEl = (element) => asHtmlElement(element.querySelector("[data-animated-caption]"));
  var queryWeeksEl = (element) => asHtmlElement(element.querySelector("[data-animated-weeks]"));
  var queryNavEl = (element) => asHtmlElement(element.querySelector("[data-animated-nav]"));
  var queryWeekdaysEl = (element) => asHtmlElement(element.querySelector("[data-animated-weekdays]"));
  function useAnimation(rootElRef, enabled, { classNames, months, focused, dateLib }) {
    const previousRootElSnapshotRef = (0, import_react28.useRef)(null);
    const previousMonthsRef = (0, import_react28.useRef)(months);
    const animatingRef = (0, import_react28.useRef)(false);
    (0, import_react28.useLayoutEffect)(() => {
      const previousMonths = previousMonthsRef.current;
      previousMonthsRef.current = months;
      if (!enabled || !rootElRef.current || // safety check because the ref can be set to anything by consumers
      !(rootElRef.current instanceof HTMLElement) || // validation required for the animation to work as expected
      months.length === 0 || previousMonths.length === 0 || months.length !== previousMonths.length) {
        return;
      }
      const isSameMonth2 = dateLib.isSameMonth(months[0].date, previousMonths[0].date);
      const isAfterPreviousMonth = dateLib.isAfter(months[0].date, previousMonths[0].date);
      const captionAnimationClass = isAfterPreviousMonth ? classNames[Animation.caption_after_enter] : classNames[Animation.caption_before_enter];
      const weeksAnimationClass = isAfterPreviousMonth ? classNames[Animation.weeks_after_enter] : classNames[Animation.weeks_before_enter];
      const previousRootElSnapshot = previousRootElSnapshotRef.current;
      const rootElSnapshot = rootElRef.current.cloneNode(true);
      if (rootElSnapshot instanceof HTMLElement) {
        const currentMonthElsSnapshot = queryMonthEls(rootElSnapshot);
        currentMonthElsSnapshot.forEach((currentMonthElSnapshot) => {
          if (!(currentMonthElSnapshot instanceof HTMLElement))
            return;
          const previousMonthElSnapshot = queryMonthEl(currentMonthElSnapshot);
          if (previousMonthElSnapshot && currentMonthElSnapshot.contains(previousMonthElSnapshot)) {
            currentMonthElSnapshot.removeChild(previousMonthElSnapshot);
          }
          const captionEl = queryCaptionEl(currentMonthElSnapshot);
          if (captionEl) {
            captionEl.classList.remove(captionAnimationClass);
          }
          const weeksEl = queryWeeksEl(currentMonthElSnapshot);
          if (weeksEl) {
            weeksEl.classList.remove(weeksAnimationClass);
          }
        });
        previousRootElSnapshotRef.current = rootElSnapshot;
      } else {
        previousRootElSnapshotRef.current = null;
      }
      if (animatingRef.current || isSameMonth2 || // skip animation if a day is focused because it can cause issues to the animation and is better for a11y
      focused) {
        return;
      }
      const previousMonthEls = previousRootElSnapshot instanceof HTMLElement ? queryMonthEls(previousRootElSnapshot) : [];
      const currentMonthEls = queryMonthEls(rootElRef.current);
      if (currentMonthEls?.every((el) => el instanceof HTMLElement) && previousMonthEls && previousMonthEls.every((el) => el instanceof HTMLElement)) {
        animatingRef.current = true;
        const cleanUpFunctions = [];
        rootElRef.current.style.isolation = "isolate";
        const navEl = queryNavEl(rootElRef.current);
        if (navEl) {
          navEl.style.zIndex = "1";
        }
        currentMonthEls.forEach((currentMonthEl, index) => {
          const previousMonthEl = previousMonthEls[index];
          if (!previousMonthEl) {
            return;
          }
          currentMonthEl.style.position = "relative";
          currentMonthEl.style.overflow = "hidden";
          const captionEl = queryCaptionEl(currentMonthEl);
          if (captionEl) {
            captionEl.classList.add(captionAnimationClass);
          }
          const weeksEl = queryWeeksEl(currentMonthEl);
          if (weeksEl) {
            weeksEl.classList.add(weeksAnimationClass);
          }
          const cleanUp = () => {
            animatingRef.current = false;
            if (rootElRef.current) {
              rootElRef.current.style.isolation = "";
            }
            if (navEl) {
              navEl.style.zIndex = "";
            }
            if (captionEl) {
              captionEl.classList.remove(captionAnimationClass);
            }
            if (weeksEl) {
              weeksEl.classList.remove(weeksAnimationClass);
            }
            currentMonthEl.style.position = "";
            currentMonthEl.style.overflow = "";
            if (currentMonthEl.contains(previousMonthEl)) {
              currentMonthEl.removeChild(previousMonthEl);
            }
          };
          cleanUpFunctions.push(cleanUp);
          previousMonthEl.style.pointerEvents = "none";
          previousMonthEl.style.position = "absolute";
          previousMonthEl.style.overflow = "hidden";
          previousMonthEl.setAttribute("aria-hidden", "true");
          const previousWeekdaysEl = queryWeekdaysEl(previousMonthEl);
          if (previousWeekdaysEl) {
            previousWeekdaysEl.style.opacity = "0";
          }
          const previousCaptionEl = queryCaptionEl(previousMonthEl);
          if (previousCaptionEl) {
            previousCaptionEl.classList.add(isAfterPreviousMonth ? classNames[Animation.caption_before_exit] : classNames[Animation.caption_after_exit]);
            previousCaptionEl.addEventListener("animationend", cleanUp);
          }
          const previousWeeksEl = queryWeeksEl(previousMonthEl);
          if (previousWeeksEl) {
            previousWeeksEl.classList.add(isAfterPreviousMonth ? classNames[Animation.weeks_before_exit] : classNames[Animation.weeks_after_exit]);
          }
          currentMonthEl.insertBefore(previousMonthEl, currentMonthEl.firstChild);
        });
      }
    });
  }

  // ../../../node_modules/react-day-picker/dist/esm/useCalendar.js
  init_define_import_meta_env();
  var import_react30 = __toESM(require_react_shim());

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getDates.js
  init_define_import_meta_env();
  function getDates(displayMonths, maxDate, props, dateLib) {
    const firstMonth = displayMonths[0];
    const lastMonth = displayMonths[displayMonths.length - 1];
    const { ISOWeek, fixedWeeks, broadcastCalendar } = props ?? {};
    const { addDays: addDays2, differenceInCalendarDays: differenceInCalendarDays2, differenceInCalendarMonths: differenceInCalendarMonths2, endOfBroadcastWeek: endOfBroadcastWeek2, endOfISOWeek: endOfISOWeek2, endOfMonth: endOfMonth2, endOfWeek: endOfWeek2, isAfter: isAfter2, startOfBroadcastWeek: startOfBroadcastWeek2, startOfISOWeek: startOfISOWeek2, startOfWeek: startOfWeek2 } = dateLib;
    const startWeekFirstDate = broadcastCalendar ? startOfBroadcastWeek2(firstMonth, dateLib) : ISOWeek ? startOfISOWeek2(firstMonth) : startOfWeek2(firstMonth);
    const displayMonthsWeekEnd = broadcastCalendar ? endOfBroadcastWeek2(lastMonth) : ISOWeek ? endOfISOWeek2(endOfMonth2(lastMonth)) : endOfWeek2(endOfMonth2(lastMonth));
    const constraintWeekEnd = maxDate && (broadcastCalendar ? endOfBroadcastWeek2(maxDate) : ISOWeek ? endOfISOWeek2(maxDate) : endOfWeek2(maxDate));
    const gridEndDate = constraintWeekEnd && isAfter2(displayMonthsWeekEnd, constraintWeekEnd) ? constraintWeekEnd : displayMonthsWeekEnd;
    const nOfDays = differenceInCalendarDays2(gridEndDate, startWeekFirstDate);
    const nOfMonths = differenceInCalendarMonths2(lastMonth, firstMonth) + 1;
    const dates = [];
    for (let i = 0; i <= nOfDays; i++) {
      const date = addDays2(startWeekFirstDate, i);
      dates.push(date);
    }
    const nrOfDaysWithFixedWeeks = broadcastCalendar ? 35 : 42;
    const extraDates = nrOfDaysWithFixedWeeks * nOfMonths;
    if (fixedWeeks && dates.length < extraDates) {
      const daysToAdd = extraDates - dates.length;
      for (let i = 0; i < daysToAdd; i++) {
        const date = addDays2(dates[dates.length - 1], 1);
        dates.push(date);
      }
    }
    return dates;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getDays.js
  init_define_import_meta_env();
  function getDays(calendarMonths) {
    const initialDays = [];
    return calendarMonths.reduce((days, month) => {
      const weekDays = month.weeks.reduce((weekDays2, week) => {
        return weekDays2.concat(week.days.slice());
      }, initialDays.slice());
      return days.concat(weekDays.slice());
    }, initialDays.slice());
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getDisplayMonths.js
  init_define_import_meta_env();
  function getDisplayMonths(firstDisplayedMonth, calendarEndMonth, props, dateLib) {
    const { numberOfMonths = 1 } = props;
    const months = [];
    for (let i = 0; i < numberOfMonths; i++) {
      const month = dateLib.addMonths(firstDisplayedMonth, i);
      if (calendarEndMonth && month > calendarEndMonth) {
        break;
      }
      months.push(month);
    }
    return months;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getInitialMonth.js
  init_define_import_meta_env();
  function getInitialMonth(props, navStart, navEnd, dateLib) {
    const { month, defaultMonth, today = dateLib.today(), numberOfMonths = 1 } = props;
    let initialMonth = month || defaultMonth || today;
    const { differenceInCalendarMonths: differenceInCalendarMonths2, addMonths: addMonths2, startOfMonth: startOfMonth2 } = dateLib;
    if (navEnd && differenceInCalendarMonths2(navEnd, initialMonth) < numberOfMonths - 1) {
      const offset = -1 * (numberOfMonths - 1);
      initialMonth = addMonths2(navEnd, offset);
    }
    if (navStart && differenceInCalendarMonths2(initialMonth, navStart) < 0) {
      initialMonth = navStart;
    }
    return startOfMonth2(initialMonth);
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getMonths.js
  init_define_import_meta_env();
  function getMonths(displayMonths, dates, props, dateLib) {
    const { addDays: addDays2, endOfBroadcastWeek: endOfBroadcastWeek2, endOfISOWeek: endOfISOWeek2, endOfMonth: endOfMonth2, endOfWeek: endOfWeek2, getISOWeek: getISOWeek2, getWeek: getWeek2, startOfBroadcastWeek: startOfBroadcastWeek2, startOfISOWeek: startOfISOWeek2, startOfWeek: startOfWeek2 } = dateLib;
    const dayPickerMonths = displayMonths.reduce((months, month) => {
      const firstDateOfFirstWeek = props.broadcastCalendar ? startOfBroadcastWeek2(month, dateLib) : props.ISOWeek ? startOfISOWeek2(month) : startOfWeek2(month);
      const lastDateOfLastWeek = props.broadcastCalendar ? endOfBroadcastWeek2(month) : props.ISOWeek ? endOfISOWeek2(endOfMonth2(month)) : endOfWeek2(endOfMonth2(month));
      const monthDates = dates.filter((date) => {
        return date >= firstDateOfFirstWeek && date <= lastDateOfLastWeek;
      });
      const nrOfDaysWithFixedWeeks = props.broadcastCalendar ? 35 : 42;
      if (props.fixedWeeks && monthDates.length < nrOfDaysWithFixedWeeks) {
        const extraDates = dates.filter((date) => {
          const daysToAdd = nrOfDaysWithFixedWeeks - monthDates.length;
          return date > lastDateOfLastWeek && date <= addDays2(lastDateOfLastWeek, daysToAdd);
        });
        monthDates.push(...extraDates);
      }
      const weeks = monthDates.reduce((weeks2, date) => {
        const weekNumber = props.ISOWeek ? getISOWeek2(date) : getWeek2(date);
        const week = weeks2.find((week2) => week2.weekNumber === weekNumber);
        const day = new CalendarDay(date, month, dateLib);
        if (!week) {
          weeks2.push(new CalendarWeek(weekNumber, [day]));
        } else {
          week.days.push(day);
        }
        return weeks2;
      }, []);
      const dayPickerMonth = new CalendarMonth(month, weeks);
      months.push(dayPickerMonth);
      return months;
    }, []);
    if (!props.reverseMonths) {
      return dayPickerMonths;
    } else {
      return dayPickerMonths.reverse();
    }
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getNavMonth.js
  init_define_import_meta_env();
  function getNavMonths(props, dateLib) {
    let { startMonth, endMonth } = props;
    const { startOfYear: startOfYear2, startOfDay: startOfDay2, startOfMonth: startOfMonth2, endOfMonth: endOfMonth2, addYears: addYears2, endOfYear: endOfYear2, newDate, today } = dateLib;
    const { fromYear, toYear, fromMonth, toMonth } = props;
    if (!startMonth && fromMonth) {
      startMonth = fromMonth;
    }
    if (!startMonth && fromYear) {
      startMonth = dateLib.newDate(fromYear, 0, 1);
    }
    if (!endMonth && toMonth) {
      endMonth = toMonth;
    }
    if (!endMonth && toYear) {
      endMonth = newDate(toYear, 11, 31);
    }
    const hasYearDropdown = props.captionLayout === "dropdown" || props.captionLayout === "dropdown-years";
    if (startMonth) {
      startMonth = startOfMonth2(startMonth);
    } else if (fromYear) {
      startMonth = newDate(fromYear, 0, 1);
    } else if (!startMonth && hasYearDropdown) {
      startMonth = startOfYear2(addYears2(props.today ?? today(), -100));
    }
    if (endMonth) {
      endMonth = endOfMonth2(endMonth);
    } else if (toYear) {
      endMonth = newDate(toYear, 11, 31);
    } else if (!endMonth && hasYearDropdown) {
      endMonth = endOfYear2(props.today ?? today());
    }
    return [
      startMonth ? startOfDay2(startMonth) : startMonth,
      endMonth ? startOfDay2(endMonth) : endMonth
    ];
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getNextMonth.js
  init_define_import_meta_env();
  function getNextMonth(firstDisplayedMonth, calendarEndMonth, options, dateLib) {
    if (options.disableNavigation) {
      return void 0;
    }
    const { pagedNavigation, numberOfMonths = 1 } = options;
    const { startOfMonth: startOfMonth2, addMonths: addMonths2, differenceInCalendarMonths: differenceInCalendarMonths2 } = dateLib;
    const offset = pagedNavigation ? numberOfMonths : 1;
    const month = startOfMonth2(firstDisplayedMonth);
    if (!calendarEndMonth) {
      return addMonths2(month, offset);
    }
    const monthsDiff = differenceInCalendarMonths2(calendarEndMonth, firstDisplayedMonth);
    if (monthsDiff < numberOfMonths) {
      return void 0;
    }
    return addMonths2(month, offset);
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getPreviousMonth.js
  init_define_import_meta_env();
  function getPreviousMonth(firstDisplayedMonth, calendarStartMonth, options, dateLib) {
    if (options.disableNavigation) {
      return void 0;
    }
    const { pagedNavigation, numberOfMonths } = options;
    const { startOfMonth: startOfMonth2, addMonths: addMonths2, differenceInCalendarMonths: differenceInCalendarMonths2 } = dateLib;
    const offset = pagedNavigation ? numberOfMonths ?? 1 : 1;
    const month = startOfMonth2(firstDisplayedMonth);
    if (!calendarStartMonth) {
      return addMonths2(month, -offset);
    }
    const monthsDiff = differenceInCalendarMonths2(month, calendarStartMonth);
    if (monthsDiff <= 0) {
      return void 0;
    }
    return addMonths2(month, -offset);
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getWeeks.js
  init_define_import_meta_env();
  function getWeeks(months) {
    const initialWeeks = [];
    return months.reduce((weeks, month) => {
      return weeks.concat(month.weeks.slice());
    }, initialWeeks.slice());
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/useControlledValue.js
  init_define_import_meta_env();
  var import_react29 = __toESM(require_react_shim());
  function useControlledValue(defaultValue, controlledValue) {
    const [uncontrolledValue, setValue] = (0, import_react29.useState)(defaultValue);
    const value = controlledValue === void 0 ? uncontrolledValue : controlledValue;
    return [value, setValue];
  }

  // ../../../node_modules/react-day-picker/dist/esm/useCalendar.js
  function useCalendar(props, dateLib) {
    const [navStart, navEnd] = getNavMonths(props, dateLib);
    const { startOfMonth: startOfMonth2, endOfMonth: endOfMonth2 } = dateLib;
    const initialMonth = getInitialMonth(props, navStart, navEnd, dateLib);
    const [firstMonth, setFirstMonth] = useControlledValue(
      initialMonth,
      // initialMonth is always computed from props.month if provided
      props.month ? initialMonth : void 0
    );
    (0, import_react30.useEffect)(() => {
      const newInitialMonth = getInitialMonth(props, navStart, navEnd, dateLib);
      setFirstMonth(newInitialMonth);
    }, [props.timeZone]);
    const { months, weeks, days, previousMonth, nextMonth } = (0, import_react30.useMemo)(() => {
      const displayMonths = getDisplayMonths(firstMonth, navEnd, { numberOfMonths: props.numberOfMonths }, dateLib);
      const dates = getDates(displayMonths, props.endMonth ? endOfMonth2(props.endMonth) : void 0, {
        ISOWeek: props.ISOWeek,
        fixedWeeks: props.fixedWeeks,
        broadcastCalendar: props.broadcastCalendar
      }, dateLib);
      const months2 = getMonths(displayMonths, dates, {
        broadcastCalendar: props.broadcastCalendar,
        fixedWeeks: props.fixedWeeks,
        ISOWeek: props.ISOWeek,
        reverseMonths: props.reverseMonths
      }, dateLib);
      const weeks2 = getWeeks(months2);
      const days2 = getDays(months2);
      const previousMonth2 = getPreviousMonth(firstMonth, navStart, props, dateLib);
      const nextMonth2 = getNextMonth(firstMonth, navEnd, props, dateLib);
      return {
        months: months2,
        weeks: weeks2,
        days: days2,
        previousMonth: previousMonth2,
        nextMonth: nextMonth2
      };
    }, [
      dateLib,
      firstMonth.getTime(),
      navEnd?.getTime(),
      navStart?.getTime(),
      props.disableNavigation,
      props.broadcastCalendar,
      props.endMonth?.getTime(),
      props.fixedWeeks,
      props.ISOWeek,
      props.numberOfMonths,
      props.pagedNavigation,
      props.reverseMonths
    ]);
    const { disableNavigation, onMonthChange } = props;
    const isDayInCalendar = (day) => weeks.some((week) => week.days.some((d) => d.isEqualTo(day)));
    const goToMonth = (date) => {
      if (disableNavigation) {
        return;
      }
      let newMonth = startOfMonth2(date);
      if (navStart && newMonth < startOfMonth2(navStart)) {
        newMonth = startOfMonth2(navStart);
      }
      if (navEnd && newMonth > startOfMonth2(navEnd)) {
        newMonth = startOfMonth2(navEnd);
      }
      setFirstMonth(newMonth);
      onMonthChange?.(newMonth);
    };
    const goToDay = (day) => {
      if (isDayInCalendar(day)) {
        return;
      }
      goToMonth(day.date);
    };
    const calendar = {
      months,
      weeks,
      days,
      navStart,
      navEnd,
      previousMonth,
      nextMonth,
      goToMonth,
      goToDay
    };
    return calendar;
  }

  // ../../../node_modules/react-day-picker/dist/esm/useFocus.js
  init_define_import_meta_env();
  var import_react31 = __toESM(require_react_shim());

  // ../../../node_modules/react-day-picker/dist/esm/helpers/calculateFocusTarget.js
  init_define_import_meta_env();
  var FocusTargetPriority;
  (function(FocusTargetPriority2) {
    FocusTargetPriority2[FocusTargetPriority2["Today"] = 0] = "Today";
    FocusTargetPriority2[FocusTargetPriority2["Selected"] = 1] = "Selected";
    FocusTargetPriority2[FocusTargetPriority2["LastFocused"] = 2] = "LastFocused";
    FocusTargetPriority2[FocusTargetPriority2["FocusedModifier"] = 3] = "FocusedModifier";
  })(FocusTargetPriority || (FocusTargetPriority = {}));
  function isFocusableDay(modifiers) {
    return !modifiers[DayFlag.disabled] && !modifiers[DayFlag.hidden] && !modifiers[DayFlag.outside];
  }
  function calculateFocusTarget(days, getModifiers, isSelected, lastFocused) {
    let focusTarget;
    let foundFocusTargetPriority = -1;
    for (const day of days) {
      const modifiers = getModifiers(day);
      if (isFocusableDay(modifiers)) {
        if (modifiers[DayFlag.focused] && foundFocusTargetPriority < FocusTargetPriority.FocusedModifier) {
          focusTarget = day;
          foundFocusTargetPriority = FocusTargetPriority.FocusedModifier;
        } else if (lastFocused?.isEqualTo(day) && foundFocusTargetPriority < FocusTargetPriority.LastFocused) {
          focusTarget = day;
          foundFocusTargetPriority = FocusTargetPriority.LastFocused;
        } else if (isSelected(day.date) && foundFocusTargetPriority < FocusTargetPriority.Selected) {
          focusTarget = day;
          foundFocusTargetPriority = FocusTargetPriority.Selected;
        } else if (modifiers[DayFlag.today] && foundFocusTargetPriority < FocusTargetPriority.Today) {
          focusTarget = day;
          foundFocusTargetPriority = FocusTargetPriority.Today;
        }
      }
    }
    if (!focusTarget) {
      focusTarget = days.find((day) => isFocusableDay(getModifiers(day)));
    }
    return focusTarget;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getNextFocus.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getFocusableDate.js
  init_define_import_meta_env();
  function getFocusableDate(moveBy, moveDir, refDate, navStart, navEnd, props, dateLib) {
    const { ISOWeek, broadcastCalendar } = props;
    const { addDays: addDays2, addMonths: addMonths2, addWeeks: addWeeks2, addYears: addYears2, endOfBroadcastWeek: endOfBroadcastWeek2, endOfISOWeek: endOfISOWeek2, endOfWeek: endOfWeek2, max: max2, min: min2, startOfBroadcastWeek: startOfBroadcastWeek2, startOfISOWeek: startOfISOWeek2, startOfWeek: startOfWeek2 } = dateLib;
    const moveFns = {
      day: addDays2,
      week: addWeeks2,
      month: addMonths2,
      year: addYears2,
      startOfWeek: (date) => broadcastCalendar ? startOfBroadcastWeek2(date, dateLib) : ISOWeek ? startOfISOWeek2(date) : startOfWeek2(date),
      endOfWeek: (date) => broadcastCalendar ? endOfBroadcastWeek2(date) : ISOWeek ? endOfISOWeek2(date) : endOfWeek2(date)
    };
    let focusableDate = moveFns[moveBy](refDate, moveDir === "after" ? 1 : -1);
    if (moveDir === "before" && navStart) {
      focusableDate = max2([navStart, focusableDate]);
    } else if (moveDir === "after" && navEnd) {
      focusableDate = min2([navEnd, focusableDate]);
    }
    return focusableDate;
  }

  // ../../../node_modules/react-day-picker/dist/esm/helpers/getNextFocus.js
  function getNextFocus(moveBy, moveDir, refDay, calendarStartMonth, calendarEndMonth, props, dateLib, attempt = 0) {
    if (attempt > 365) {
      return void 0;
    }
    const focusableDate = getFocusableDate(moveBy, moveDir, refDay.date, calendarStartMonth, calendarEndMonth, props, dateLib);
    const isDisabled = Boolean(props.disabled && dateMatchModifiers(focusableDate, props.disabled, dateLib));
    const isHidden = Boolean(props.hidden && dateMatchModifiers(focusableDate, props.hidden, dateLib));
    const targetMonth = focusableDate;
    const focusDay = new CalendarDay(focusableDate, targetMonth, dateLib);
    if (!isDisabled && !isHidden) {
      return focusDay;
    }
    return getNextFocus(moveBy, moveDir, focusDay, calendarStartMonth, calendarEndMonth, props, dateLib, attempt + 1);
  }

  // ../../../node_modules/react-day-picker/dist/esm/useFocus.js
  function useFocus(props, calendar, getModifiers, isSelected, dateLib) {
    const { autoFocus } = props;
    const [lastFocused, setLastFocused] = (0, import_react31.useState)();
    const focusTarget = calculateFocusTarget(calendar.days, getModifiers, isSelected || (() => false), lastFocused);
    const [focusedDay, setFocused] = (0, import_react31.useState)(autoFocus ? focusTarget : void 0);
    const blur = () => {
      setLastFocused(focusedDay);
      setFocused(void 0);
    };
    const moveFocus = (moveBy, moveDir) => {
      if (!focusedDay)
        return;
      const nextFocus = getNextFocus(moveBy, moveDir, focusedDay, calendar.navStart, calendar.navEnd, props, dateLib);
      if (!nextFocus)
        return;
      if (props.disableNavigation) {
        const isNextInCalendar = calendar.days.some((day) => day.isEqualTo(nextFocus));
        if (!isNextInCalendar) {
          return;
        }
      }
      calendar.goToDay(nextFocus);
      setFocused(nextFocus);
    };
    const isFocusTarget = (day) => {
      return Boolean(focusTarget?.isEqualTo(day));
    };
    const useFocus2 = {
      isFocusTarget,
      setFocused,
      focused: focusedDay,
      blur,
      moveFocus
    };
    return useFocus2;
  }

  // ../../../node_modules/react-day-picker/dist/esm/useSelection.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/selection/useMulti.js
  init_define_import_meta_env();
  function useMulti(props, dateLib) {
    const { selected: initiallySelected, required, onSelect } = props;
    const [internallySelected, setSelected] = useControlledValue(initiallySelected, onSelect ? initiallySelected : void 0);
    const selected = !onSelect ? internallySelected : initiallySelected;
    const { isSameDay: isSameDay2 } = dateLib;
    const isSelected = (date) => {
      return selected?.some((d) => isSameDay2(d, date)) ?? false;
    };
    const { min: min2, max: max2 } = props;
    const select = (triggerDate, modifiers, e) => {
      let newDates = [...selected ?? []];
      if (isSelected(triggerDate)) {
        if (selected?.length === min2) {
          return;
        }
        if (required && selected?.length === 1) {
          return;
        }
        newDates = selected?.filter((d) => !isSameDay2(d, triggerDate));
      } else {
        if (selected?.length === max2) {
          newDates = [triggerDate];
        } else {
          newDates = [...newDates, triggerDate];
        }
      }
      if (!onSelect) {
        setSelected(newDates);
      }
      onSelect?.(newDates, triggerDate, modifiers, e);
      return newDates;
    };
    return {
      selected,
      select,
      isSelected
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/selection/useRange.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/utils/addToRange.js
  init_define_import_meta_env();
  function addToRange(date, initialRange, min2 = 0, max2 = 0, required = false, dateLib = defaultDateLib) {
    const { from, to } = initialRange || {};
    const { isSameDay: isSameDay2, isAfter: isAfter2, isBefore: isBefore2 } = dateLib;
    let range;
    if (!from && !to) {
      range = { from: date, to: min2 > 0 ? void 0 : date };
    } else if (from && !to) {
      if (isSameDay2(from, date)) {
        if (min2 === 0) {
          range = { from, to: date };
        } else if (required) {
          range = { from, to: void 0 };
        } else {
          range = void 0;
        }
      } else if (isBefore2(date, from)) {
        range = { from: date, to: from };
      } else {
        range = { from, to: date };
      }
    } else if (from && to) {
      if (isSameDay2(from, date) && isSameDay2(to, date)) {
        if (required) {
          range = { from, to };
        } else {
          range = void 0;
        }
      } else if (isSameDay2(from, date)) {
        range = { from, to: min2 > 0 ? void 0 : date };
      } else if (isSameDay2(to, date)) {
        range = { from: date, to: min2 > 0 ? void 0 : date };
      } else if (isBefore2(date, from)) {
        range = { from: date, to };
      } else if (isAfter2(date, from)) {
        range = { from, to: date };
      } else if (isAfter2(date, to)) {
        range = { from, to: date };
      } else {
        throw new Error("Invalid range");
      }
    }
    if (range?.from && range?.to) {
      const diff = dateLib.differenceInCalendarDays(range.to, range.from);
      if (max2 > 0 && diff > max2) {
        range = { from: date, to: void 0 };
      } else if (min2 > 1 && diff < min2) {
        range = { from: date, to: void 0 };
      }
    }
    return range;
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/rangeContainsDayOfWeek.js
  init_define_import_meta_env();
  function rangeContainsDayOfWeek(range, dayOfWeek, dateLib = defaultDateLib) {
    const dayOfWeekArr = !Array.isArray(dayOfWeek) ? [dayOfWeek] : dayOfWeek;
    let date = range.from;
    const totalDays = dateLib.differenceInCalendarDays(range.to, range.from);
    const totalDaysLimit = Math.min(totalDays, 6);
    for (let i = 0; i <= totalDaysLimit; i++) {
      if (dayOfWeekArr.includes(date.getDay())) {
        return true;
      }
      date = dateLib.addDays(date, 1);
    }
    return false;
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/rangeContainsModifiers.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/utils/rangeOverlaps.js
  init_define_import_meta_env();
  function rangeOverlaps(rangeLeft, rangeRight, dateLib = defaultDateLib) {
    return rangeIncludesDate(rangeLeft, rangeRight.from, false, dateLib) || rangeIncludesDate(rangeLeft, rangeRight.to, false, dateLib) || rangeIncludesDate(rangeRight, rangeLeft.from, false, dateLib) || rangeIncludesDate(rangeRight, rangeLeft.to, false, dateLib);
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/rangeContainsModifiers.js
  function rangeContainsModifiers(range, modifiers, dateLib = defaultDateLib) {
    const matchers = Array.isArray(modifiers) ? modifiers : [modifiers];
    const nonFunctionMatchers = matchers.filter((matcher) => typeof matcher !== "function");
    const nonFunctionMatchersResult = nonFunctionMatchers.some((matcher) => {
      if (typeof matcher === "boolean")
        return matcher;
      if (dateLib.isDate(matcher)) {
        return rangeIncludesDate(range, matcher, false, dateLib);
      }
      if (isDatesArray(matcher, dateLib)) {
        return matcher.some((date) => rangeIncludesDate(range, date, false, dateLib));
      }
      if (isDateRange(matcher)) {
        if (matcher.from && matcher.to) {
          return rangeOverlaps(range, { from: matcher.from, to: matcher.to }, dateLib);
        }
        return false;
      }
      if (isDayOfWeekType(matcher)) {
        return rangeContainsDayOfWeek(range, matcher.dayOfWeek, dateLib);
      }
      if (isDateInterval(matcher)) {
        const isClosedInterval = dateLib.isAfter(matcher.before, matcher.after);
        if (isClosedInterval) {
          return rangeOverlaps(range, {
            from: dateLib.addDays(matcher.after, 1),
            to: dateLib.addDays(matcher.before, -1)
          }, dateLib);
        }
        return dateMatchModifiers(range.from, matcher, dateLib) || dateMatchModifiers(range.to, matcher, dateLib);
      }
      if (isDateAfterType(matcher) || isDateBeforeType(matcher)) {
        return dateMatchModifiers(range.from, matcher, dateLib) || dateMatchModifiers(range.to, matcher, dateLib);
      }
      return false;
    });
    if (nonFunctionMatchersResult) {
      return true;
    }
    const functionMatchers = matchers.filter((matcher) => typeof matcher === "function");
    if (functionMatchers.length) {
      let date = range.from;
      const totalDays = dateLib.differenceInCalendarDays(range.to, range.from);
      for (let i = 0; i <= totalDays; i++) {
        if (functionMatchers.some((matcher) => matcher(date))) {
          return true;
        }
        date = dateLib.addDays(date, 1);
      }
    }
    return false;
  }

  // ../../../node_modules/react-day-picker/dist/esm/selection/useRange.js
  function useRange(props, dateLib) {
    const { disabled, excludeDisabled, resetOnSelect, selected: initiallySelected, required, onSelect } = props;
    const [internallySelected, setSelected] = useControlledValue(initiallySelected, onSelect ? initiallySelected : void 0);
    const selected = !onSelect ? internallySelected : initiallySelected;
    const isSelected = (date) => selected && rangeIncludesDate(selected, date, false, dateLib);
    const select = (triggerDate, modifiers, e) => {
      const { min: min2, max: max2 } = props;
      let newRange;
      if (triggerDate) {
        const selectedFrom = selected?.from;
        const selectedTo = selected?.to;
        const hasFullRange = !!selectedFrom && !!selectedTo;
        const isClickingSingleDayRange = !!selectedFrom && !!selectedTo && dateLib.isSameDay(selectedFrom, selectedTo) && dateLib.isSameDay(triggerDate, selectedFrom);
        if (resetOnSelect && (hasFullRange || !selected?.from)) {
          if (!required && isClickingSingleDayRange) {
            newRange = void 0;
          } else {
            newRange = { from: triggerDate, to: void 0 };
          }
        } else {
          newRange = addToRange(triggerDate, selected, min2, max2, required, dateLib);
        }
      }
      if (excludeDisabled && disabled && newRange?.from && newRange.to) {
        if (rangeContainsModifiers({ from: newRange.from, to: newRange.to }, disabled, dateLib)) {
          newRange.from = triggerDate;
          newRange.to = void 0;
        }
      }
      if (!onSelect) {
        setSelected(newRange);
      }
      onSelect?.(newRange, triggerDate, modifiers, e);
      return newRange;
    };
    return {
      selected,
      select,
      isSelected
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/selection/useSingle.js
  init_define_import_meta_env();
  function useSingle(props, dateLib) {
    const { selected: initiallySelected, required, onSelect } = props;
    const [internallySelected, setSelected] = useControlledValue(initiallySelected, onSelect ? initiallySelected : void 0);
    const selected = !onSelect ? internallySelected : initiallySelected;
    const { isSameDay: isSameDay2 } = dateLib;
    const isSelected = (compareDate) => {
      return selected ? isSameDay2(selected, compareDate) : false;
    };
    const select = (triggerDate, modifiers, e) => {
      let newDate = triggerDate;
      if (!required && selected && selected && isSameDay2(triggerDate, selected)) {
        newDate = void 0;
      }
      if (!onSelect) {
        setSelected(newDate);
      }
      if (required) {
        onSelect?.(newDate, triggerDate, modifiers, e);
      } else {
        onSelect?.(newDate, triggerDate, modifiers, e);
      }
      return newDate;
    };
    return {
      selected,
      select,
      isSelected
    };
  }

  // ../../../node_modules/react-day-picker/dist/esm/useSelection.js
  function useSelection(props, dateLib) {
    const single = useSingle(props, dateLib);
    const multi = useMulti(props, dateLib);
    const range = useRange(props, dateLib);
    switch (props.mode) {
      case "single":
        return single;
      case "multiple":
        return multi;
      case "range":
        return range;
      default:
        return void 0;
    }
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/convertMatchersToTimeZone.js
  init_define_import_meta_env();

  // ../../../node_modules/react-day-picker/dist/esm/utils/toTimeZone.js
  init_define_import_meta_env();
  function toTimeZone(date, timeZone) {
    if (date instanceof TZDate && date.timeZone === timeZone) {
      return date;
    }
    return new TZDate(date, timeZone);
  }

  // ../../../node_modules/react-day-picker/dist/esm/utils/convertMatchersToTimeZone.js
  function toZoneNoon(date, timeZone, noonSafe) {
    if (!noonSafe)
      return toTimeZone(date, timeZone);
    const zoned = toTimeZone(date, timeZone);
    const noonZoned = new TZDate(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 12, 0, 0, timeZone);
    return new Date(noonZoned.getTime());
  }
  function convertMatcher(matcher, timeZone, noonSafe) {
    if (typeof matcher === "boolean" || typeof matcher === "function") {
      return matcher;
    }
    if (matcher instanceof Date) {
      return toZoneNoon(matcher, timeZone, noonSafe);
    }
    if (Array.isArray(matcher)) {
      return matcher.map((value) => value instanceof Date ? toZoneNoon(value, timeZone, noonSafe) : value);
    }
    if (isDateRange(matcher)) {
      return {
        ...matcher,
        from: matcher.from ? toTimeZone(matcher.from, timeZone) : matcher.from,
        to: matcher.to ? toTimeZone(matcher.to, timeZone) : matcher.to
      };
    }
    if (isDateInterval(matcher)) {
      return {
        before: toZoneNoon(matcher.before, timeZone, noonSafe),
        after: toZoneNoon(matcher.after, timeZone, noonSafe)
      };
    }
    if (isDateAfterType(matcher)) {
      return {
        after: toZoneNoon(matcher.after, timeZone, noonSafe)
      };
    }
    if (isDateBeforeType(matcher)) {
      return {
        before: toZoneNoon(matcher.before, timeZone, noonSafe)
      };
    }
    return matcher;
  }
  function convertMatchersToTimeZone(matchers, timeZone, noonSafe) {
    if (!matchers) {
      return matchers;
    }
    if (Array.isArray(matchers)) {
      return matchers.map((matcher) => convertMatcher(matcher, timeZone, noonSafe));
    }
    return convertMatcher(matchers, timeZone, noonSafe);
  }

  // ../../../node_modules/react-day-picker/dist/esm/DayPicker.js
  function DayPicker(initialProps) {
    let props = initialProps;
    const timeZone = props.timeZone;
    if (timeZone) {
      props = {
        ...initialProps,
        timeZone
      };
      if (props.today) {
        props.today = toTimeZone(props.today, timeZone);
      }
      if (props.month) {
        props.month = toTimeZone(props.month, timeZone);
      }
      if (props.defaultMonth) {
        props.defaultMonth = toTimeZone(props.defaultMonth, timeZone);
      }
      if (props.startMonth) {
        props.startMonth = toTimeZone(props.startMonth, timeZone);
      }
      if (props.endMonth) {
        props.endMonth = toTimeZone(props.endMonth, timeZone);
      }
      if (props.mode === "single" && props.selected) {
        props.selected = toTimeZone(props.selected, timeZone);
      } else if (props.mode === "multiple" && props.selected) {
        props.selected = props.selected?.map((date) => toTimeZone(date, timeZone));
      } else if (props.mode === "range" && props.selected) {
        props.selected = {
          from: props.selected.from ? toTimeZone(props.selected.from, timeZone) : props.selected.from,
          to: props.selected.to ? toTimeZone(props.selected.to, timeZone) : props.selected.to
        };
      }
      if (props.disabled !== void 0) {
        props.disabled = convertMatchersToTimeZone(props.disabled, timeZone);
      }
      if (props.hidden !== void 0) {
        props.hidden = convertMatchersToTimeZone(props.hidden, timeZone);
      }
      if (props.modifiers) {
        const nextModifiers = {};
        Object.keys(props.modifiers).forEach((key) => {
          nextModifiers[key] = convertMatchersToTimeZone(props.modifiers?.[key], timeZone);
        });
        props.modifiers = nextModifiers;
      }
    }
    const { components, formatters: formatters2, labels, dateLib, locale, classNames } = (0, import_react32.useMemo)(() => {
      const locale2 = { ...enUS2, ...props.locale };
      const weekStartsOn = props.broadcastCalendar ? 1 : props.weekStartsOn;
      const noonOverrides = props.noonSafe && props.timeZone ? createNoonOverrides(props.timeZone, {
        weekStartsOn,
        locale: locale2
      }) : void 0;
      const overrides = props.dateLib && noonOverrides ? { ...noonOverrides, ...props.dateLib } : props.dateLib ?? noonOverrides;
      const dateLib2 = new DateLib({
        locale: locale2,
        weekStartsOn,
        firstWeekContainsDate: props.firstWeekContainsDate,
        useAdditionalWeekYearTokens: props.useAdditionalWeekYearTokens,
        useAdditionalDayOfYearTokens: props.useAdditionalDayOfYearTokens,
        timeZone: props.timeZone,
        numerals: props.numerals
      }, overrides);
      return {
        dateLib: dateLib2,
        components: getComponents(props.components),
        formatters: getFormatters(props.formatters),
        labels: getLabels(props.labels, dateLib2.options),
        locale: locale2,
        classNames: { ...getDefaultClassNames(), ...props.classNames }
      };
    }, [
      props.locale,
      props.broadcastCalendar,
      props.weekStartsOn,
      props.firstWeekContainsDate,
      props.useAdditionalWeekYearTokens,
      props.useAdditionalDayOfYearTokens,
      props.timeZone,
      props.numerals,
      props.dateLib,
      props.noonSafe,
      props.components,
      props.formatters,
      props.labels,
      props.classNames
    ]);
    if (!props.today) {
      props = { ...props, today: dateLib.today() };
    }
    const { captionLayout, mode, navLayout, numberOfMonths = 1, onDayBlur, onDayClick, onDayFocus, onDayKeyDown, onDayMouseEnter, onDayMouseLeave, onNextClick, onPrevClick, showWeekNumber, styles } = props;
    const { formatCaption: formatCaption2, formatDay: formatDay2, formatMonthDropdown: formatMonthDropdown2, formatWeekNumber: formatWeekNumber2, formatWeekNumberHeader: formatWeekNumberHeader2, formatWeekdayName: formatWeekdayName2, formatYearDropdown: formatYearDropdown2 } = formatters2;
    const calendar = useCalendar(props, dateLib);
    const { days, months, navStart, navEnd, previousMonth, nextMonth, goToMonth } = calendar;
    const getModifiers = createGetModifiers(days, props, navStart, navEnd, dateLib);
    const { isSelected, select, selected: selectedValue } = useSelection(props, dateLib) ?? {};
    const { blur, focused, isFocusTarget, moveFocus, setFocused } = useFocus(props, calendar, getModifiers, isSelected ?? (() => false), dateLib);
    const { labelDayButton: labelDayButton2, labelGridcell: labelGridcell2, labelGrid: labelGrid2, labelMonthDropdown: labelMonthDropdown2, labelNav: labelNav2, labelPrevious: labelPrevious2, labelNext: labelNext2, labelWeekday: labelWeekday2, labelWeekNumber: labelWeekNumber2, labelWeekNumberHeader: labelWeekNumberHeader2, labelYearDropdown: labelYearDropdown2 } = labels;
    const weekdays = (0, import_react32.useMemo)(() => getWeekdays(dateLib, props.ISOWeek, props.broadcastCalendar, props.today), [dateLib, props.ISOWeek, props.broadcastCalendar, props.today]);
    const isInteractive = mode !== void 0 || onDayClick !== void 0;
    const handlePreviousClick = (0, import_react32.useCallback)(() => {
      if (!previousMonth)
        return;
      goToMonth(previousMonth);
      onPrevClick?.(previousMonth);
    }, [previousMonth, goToMonth, onPrevClick]);
    const handleNextClick = (0, import_react32.useCallback)(() => {
      if (!nextMonth)
        return;
      goToMonth(nextMonth);
      onNextClick?.(nextMonth);
    }, [goToMonth, nextMonth, onNextClick]);
    const handleDayClick = (0, import_react32.useCallback)((day, m) => (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFocused(day);
      if (m.disabled) {
        return;
      }
      select?.(day.date, m, e);
      onDayClick?.(day.date, m, e);
    }, [select, onDayClick, setFocused]);
    const handleDayFocus = (0, import_react32.useCallback)((day, m) => (e) => {
      setFocused(day);
      onDayFocus?.(day.date, m, e);
    }, [onDayFocus, setFocused]);
    const handleDayBlur = (0, import_react32.useCallback)((day, m) => (e) => {
      blur();
      onDayBlur?.(day.date, m, e);
    }, [blur, onDayBlur]);
    const handleDayKeyDown = (0, import_react32.useCallback)((day, modifiers) => (e) => {
      const keyMap = {
        ArrowLeft: [
          e.shiftKey ? "month" : "day",
          props.dir === "rtl" ? "after" : "before"
        ],
        ArrowRight: [
          e.shiftKey ? "month" : "day",
          props.dir === "rtl" ? "before" : "after"
        ],
        ArrowDown: [e.shiftKey ? "year" : "week", "after"],
        ArrowUp: [e.shiftKey ? "year" : "week", "before"],
        PageUp: [e.shiftKey ? "year" : "month", "before"],
        PageDown: [e.shiftKey ? "year" : "month", "after"],
        Home: ["startOfWeek", "before"],
        End: ["endOfWeek", "after"]
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        const [moveBy, moveDir] = keyMap[e.key];
        moveFocus(moveBy, moveDir);
      }
      onDayKeyDown?.(day.date, modifiers, e);
    }, [moveFocus, onDayKeyDown, props.dir]);
    const handleDayMouseEnter = (0, import_react32.useCallback)((day, modifiers) => (e) => {
      onDayMouseEnter?.(day.date, modifiers, e);
    }, [onDayMouseEnter]);
    const handleDayMouseLeave = (0, import_react32.useCallback)((day, modifiers) => (e) => {
      onDayMouseLeave?.(day.date, modifiers, e);
    }, [onDayMouseLeave]);
    const handleMonthChange = (0, import_react32.useCallback)((date) => (e) => {
      const selectedMonth = Number(e.target.value);
      const month = dateLib.setMonth(dateLib.startOfMonth(date), selectedMonth);
      goToMonth(month);
    }, [dateLib, goToMonth]);
    const handleYearChange = (0, import_react32.useCallback)((date) => (e) => {
      const selectedYear = Number(e.target.value);
      const month = dateLib.setYear(dateLib.startOfMonth(date), selectedYear);
      goToMonth(month);
    }, [dateLib, goToMonth]);
    const { className, style } = (0, import_react32.useMemo)(() => ({
      className: [classNames[UI.Root], props.className].filter(Boolean).join(" "),
      style: { ...styles?.[UI.Root], ...props.style }
    }), [classNames, props.className, props.style, styles]);
    const dataAttributes = getDataAttributes(props);
    const rootElRef = (0, import_react32.useRef)(null);
    useAnimation(rootElRef, Boolean(props.animate), {
      classNames,
      months,
      focused,
      dateLib
    });
    const contextValue = {
      dayPickerProps: props,
      selected: selectedValue,
      select,
      isSelected,
      months,
      nextMonth,
      previousMonth,
      goToMonth,
      getModifiers,
      components,
      classNames,
      styles,
      labels,
      formatters: formatters2
    };
    return import_react32.default.createElement(
      dayPickerContext.Provider,
      { value: contextValue },
      import_react32.default.createElement(
        components.Root,
        { rootRef: props.animate ? rootElRef : void 0, className, style, dir: props.dir, id: props.id, lang: props.lang ?? locale.code, nonce: props.nonce, title: props.title, role: props.role, "aria-label": props["aria-label"], "aria-labelledby": props["aria-labelledby"], ...dataAttributes },
        import_react32.default.createElement(
          components.Months,
          { className: classNames[UI.Months], style: styles?.[UI.Months] },
          !props.hideNavigation && !navLayout && import_react32.default.createElement(components.Nav, { "data-animated-nav": props.animate ? "true" : void 0, className: classNames[UI.Nav], style: styles?.[UI.Nav], "aria-label": labelNav2(), onPreviousClick: handlePreviousClick, onNextClick: handleNextClick, previousMonth, nextMonth }),
          months.map((calendarMonth, displayIndex) => {
            return import_react32.default.createElement(
              components.Month,
              {
                "data-animated-month": props.animate ? "true" : void 0,
                className: classNames[UI.Month],
                style: styles?.[UI.Month],
                // biome-ignore lint/suspicious/noArrayIndexKey: breaks animation
                key: displayIndex,
                displayIndex,
                calendarMonth
              },
              navLayout === "around" && !props.hideNavigation && displayIndex === 0 && import_react32.default.createElement(
                components.PreviousMonthButton,
                { type: "button", className: classNames[UI.PreviousMonthButton], tabIndex: previousMonth ? void 0 : -1, "aria-disabled": previousMonth ? void 0 : true, "aria-label": labelPrevious2(previousMonth), onClick: handlePreviousClick, "data-animated-button": props.animate ? "true" : void 0 },
                import_react32.default.createElement(components.Chevron, { disabled: previousMonth ? void 0 : true, className: classNames[UI.Chevron], orientation: props.dir === "rtl" ? "right" : "left" })
              ),
              import_react32.default.createElement(components.MonthCaption, { "data-animated-caption": props.animate ? "true" : void 0, className: classNames[UI.MonthCaption], style: styles?.[UI.MonthCaption], calendarMonth, displayIndex }, captionLayout?.startsWith("dropdown") ? import_react32.default.createElement(
                components.DropdownNav,
                { className: classNames[UI.Dropdowns], style: styles?.[UI.Dropdowns] },
                (() => {
                  const monthControl = captionLayout === "dropdown" || captionLayout === "dropdown-months" ? import_react32.default.createElement(components.MonthsDropdown, { key: "month", className: classNames[UI.MonthsDropdown], "aria-label": labelMonthDropdown2(), classNames, components, disabled: Boolean(props.disableNavigation), onChange: handleMonthChange(calendarMonth.date), options: getMonthOptions(calendarMonth.date, navStart, navEnd, formatters2, dateLib), style: styles?.[UI.Dropdown], value: dateLib.getMonth(calendarMonth.date) }) : import_react32.default.createElement("span", { key: "month" }, formatMonthDropdown2(calendarMonth.date, dateLib));
                  const yearControl = captionLayout === "dropdown" || captionLayout === "dropdown-years" ? import_react32.default.createElement(components.YearsDropdown, { key: "year", className: classNames[UI.YearsDropdown], "aria-label": labelYearDropdown2(dateLib.options), classNames, components, disabled: Boolean(props.disableNavigation), onChange: handleYearChange(calendarMonth.date), options: getYearOptions(navStart, navEnd, formatters2, dateLib, Boolean(props.reverseYears)), style: styles?.[UI.Dropdown], value: dateLib.getYear(calendarMonth.date) }) : import_react32.default.createElement("span", { key: "year" }, formatYearDropdown2(calendarMonth.date, dateLib));
                  const controls = dateLib.getMonthYearOrder() === "year-first" ? [yearControl, monthControl] : [monthControl, yearControl];
                  return controls;
                })(),
                import_react32.default.createElement("span", { role: "status", "aria-live": "polite", style: {
                  border: 0,
                  clip: "rect(0 0 0 0)",
                  height: "1px",
                  margin: "-1px",
                  overflow: "hidden",
                  padding: 0,
                  position: "absolute",
                  width: "1px",
                  whiteSpace: "nowrap",
                  wordWrap: "normal"
                } }, formatCaption2(calendarMonth.date, dateLib.options, dateLib))
              ) : import_react32.default.createElement(components.CaptionLabel, { className: classNames[UI.CaptionLabel], role: "status", "aria-live": "polite" }, formatCaption2(calendarMonth.date, dateLib.options, dateLib))),
              navLayout === "around" && !props.hideNavigation && displayIndex === numberOfMonths - 1 && import_react32.default.createElement(
                components.NextMonthButton,
                { type: "button", className: classNames[UI.NextMonthButton], tabIndex: nextMonth ? void 0 : -1, "aria-disabled": nextMonth ? void 0 : true, "aria-label": labelNext2(nextMonth), onClick: handleNextClick, "data-animated-button": props.animate ? "true" : void 0 },
                import_react32.default.createElement(components.Chevron, { disabled: nextMonth ? void 0 : true, className: classNames[UI.Chevron], orientation: props.dir === "rtl" ? "left" : "right" })
              ),
              displayIndex === numberOfMonths - 1 && navLayout === "after" && !props.hideNavigation && import_react32.default.createElement(components.Nav, { "data-animated-nav": props.animate ? "true" : void 0, className: classNames[UI.Nav], style: styles?.[UI.Nav], "aria-label": labelNav2(), onPreviousClick: handlePreviousClick, onNextClick: handleNextClick, previousMonth, nextMonth }),
              import_react32.default.createElement(
                components.MonthGrid,
                { role: "grid", "aria-multiselectable": mode === "multiple" || mode === "range", "aria-label": labelGrid2(calendarMonth.date, dateLib.options, dateLib) || void 0, className: classNames[UI.MonthGrid], style: styles?.[UI.MonthGrid] },
                !props.hideWeekdays && import_react32.default.createElement(
                  components.Weekdays,
                  { "data-animated-weekdays": props.animate ? "true" : void 0, className: classNames[UI.Weekdays], style: styles?.[UI.Weekdays] },
                  showWeekNumber && import_react32.default.createElement(components.WeekNumberHeader, { "aria-label": labelWeekNumberHeader2(dateLib.options), className: classNames[UI.WeekNumberHeader], style: styles?.[UI.WeekNumberHeader], scope: "col" }, formatWeekNumberHeader2()),
                  weekdays.map((weekday) => import_react32.default.createElement(components.Weekday, { "aria-label": labelWeekday2(weekday, dateLib.options, dateLib), className: classNames[UI.Weekday], key: String(weekday), style: styles?.[UI.Weekday], scope: "col" }, formatWeekdayName2(weekday, dateLib.options, dateLib)))
                ),
                import_react32.default.createElement(components.Weeks, { "data-animated-weeks": props.animate ? "true" : void 0, className: classNames[UI.Weeks], style: styles?.[UI.Weeks] }, calendarMonth.weeks.map((week) => {
                  return import_react32.default.createElement(
                    components.Week,
                    { className: classNames[UI.Week], key: week.weekNumber, style: styles?.[UI.Week], week },
                    showWeekNumber && import_react32.default.createElement(components.WeekNumber, { week, style: styles?.[UI.WeekNumber], "aria-label": labelWeekNumber2(week.weekNumber, {
                      locale
                    }), className: classNames[UI.WeekNumber], scope: "row", role: "rowheader" }, formatWeekNumber2(week.weekNumber, dateLib)),
                    week.days.map((day) => {
                      const { date } = day;
                      const modifiers = getModifiers(day);
                      modifiers[DayFlag.focused] = !modifiers.hidden && Boolean(focused?.isEqualTo(day));
                      modifiers[SelectionState.selected] = isSelected?.(date) || modifiers.selected;
                      if (isDateRange(selectedValue)) {
                        const { from, to } = selectedValue;
                        modifiers[SelectionState.range_start] = Boolean(from && to && dateLib.isSameDay(date, from));
                        modifiers[SelectionState.range_end] = Boolean(from && to && dateLib.isSameDay(date, to));
                        modifiers[SelectionState.range_middle] = rangeIncludesDate(selectedValue, date, true, dateLib);
                      }
                      const style2 = getStyleForModifiers(modifiers, styles, props.modifiersStyles);
                      const className2 = getClassNamesForModifiers(modifiers, classNames, props.modifiersClassNames);
                      const ariaLabel = !isInteractive && !modifiers.hidden ? labelGridcell2(date, modifiers, dateLib.options, dateLib) : void 0;
                      return import_react32.default.createElement(components.Day, { key: `${day.isoDate}_${day.displayMonthId}`, day, modifiers, className: className2.join(" "), style: style2, role: "gridcell", "aria-selected": modifiers.selected || void 0, "aria-label": ariaLabel, "data-day": day.isoDate, "data-month": day.outside ? day.dateMonthId : void 0, "data-selected": modifiers.selected || void 0, "data-disabled": modifiers.disabled || void 0, "data-hidden": modifiers.hidden || void 0, "data-outside": day.outside || void 0, "data-focused": modifiers.focused || void 0, "data-today": modifiers.today || void 0 }, !modifiers.hidden && isInteractive ? import_react32.default.createElement(components.DayButton, { className: classNames[UI.DayButton], style: styles?.[UI.DayButton], type: "button", day, modifiers, disabled: !modifiers.focused && modifiers.disabled || void 0, "aria-disabled": modifiers.focused && modifiers.disabled || void 0, tabIndex: isFocusTarget(day) ? 0 : -1, "aria-label": labelDayButton2(date, modifiers, dateLib.options, dateLib), onClick: handleDayClick(day, modifiers), onBlur: handleDayBlur(day, modifiers), onFocus: handleDayFocus(day, modifiers), onKeyDown: handleDayKeyDown(day, modifiers), onMouseEnter: handleDayMouseEnter(day, modifiers), onMouseLeave: handleDayMouseLeave(day, modifiers) }, formatDay2(date, dateLib.options, dateLib)) : !modifiers.hidden && formatDay2(day.date, dateLib.options, dateLib));
                    })
                  );
                }))
              )
            );
          })
        ),
        props.footer && import_react32.default.createElement(components.Footer, { className: classNames[UI.Footer], style: styles?.[UI.Footer], role: "status", "aria-live": "polite" }, props.footer)
      )
    );
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

  // client/src/components/ui/button.tsx
  init_define_import_meta_env();
  var React30 = __toESM(require_react_shim());

  // ../../../node_modules/@radix-ui/react-slot/dist/index.mjs
  init_define_import_meta_env();
  var React29 = __toESM(require_react_shim(), 1);

  // ../../../node_modules/@radix-ui/react-compose-refs/dist/index.mjs
  init_define_import_meta_env();
  var React28 = __toESM(require_react_shim(), 1);
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
  var use = React29[" use ".trim().toString()];
  function isPromiseLike(value) {
    return typeof value === "object" && value !== null && "then" in value;
  }
  function isLazyComponent(element) {
    return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
  }
  // @__NO_SIDE_EFFECTS__
  function createSlot(ownerName) {
    const SlotClone = /* @__PURE__ */ createSlotClone(ownerName);
    const Slot2 = React29.forwardRef((props, forwardedRef) => {
      let { children, ...slotProps } = props;
      if (isLazyComponent(children) && typeof use === "function") {
        children = use(children._payload);
      }
      const childrenArray = React29.Children.toArray(children);
      const slottable = childrenArray.find(isSlottable);
      if (slottable) {
        const newElement = slottable.props.children;
        const newChildren = childrenArray.map((child) => {
          if (child === slottable) {
            if (React29.Children.count(newElement) > 1) return React29.Children.only(null);
            return React29.isValidElement(newElement) ? newElement.props.children : null;
          } else {
            return child;
          }
        });
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotClone, { ...slotProps, ref: forwardedRef, children: React29.isValidElement(newElement) ? React29.cloneElement(newElement, void 0, newChildren) : null });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlotClone, { ...slotProps, ref: forwardedRef, children });
    });
    Slot2.displayName = `${ownerName}.Slot`;
    return Slot2;
  }
  var Slot = /* @__PURE__ */ createSlot("Slot");
  // @__NO_SIDE_EFFECTS__
  function createSlotClone(ownerName) {
    const SlotClone = React29.forwardRef((props, forwardedRef) => {
      let { children, ...slotProps } = props;
      if (isLazyComponent(children) && typeof use === "function") {
        children = use(children._payload);
      }
      if (React29.isValidElement(children)) {
        const childrenRef = getElementRef(children);
        const props2 = mergeProps(slotProps, children.props);
        if (children.type !== React29.Fragment) {
          props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
        }
        return React29.cloneElement(children, props2);
      }
      return React29.Children.count(children) > 1 ? React29.Children.only(null) : null;
    });
    SlotClone.displayName = `${ownerName}.SlotClone`;
    return SlotClone;
  }
  var SLOTTABLE_IDENTIFIER = /* @__PURE__ */ Symbol("radix.slottable");
  function isSlottable(child) {
    return React29.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
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
  var Button2 = React30.forwardRef(
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
  Button2.displayName = "Button";

  // client/src/components/ui/calendar.tsx
  var import_jsx_runtime3 = __toESM(require_react_shim());
  function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = "label",
    buttonVariant = "ghost",
    formatters: formatters2,
    components,
    ...props
  }) {
    const defaultClassNames = getDefaultClassNames();
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      DayPicker,
      {
        showOutsideDays,
        className: cn(
          "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
          String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
          String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
          className
        ),
        captionLayout,
        formatters: {
          formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
          ...formatters2
        },
        classNames: {
          root: cn("w-fit", defaultClassNames.root),
          months: cn(
            "relative flex flex-col gap-4 md:flex-row",
            defaultClassNames.months
          ),
          month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
          nav: cn(
            "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
            defaultClassNames.nav
          ),
          button_previous: cn(
            buttonVariants({ variant: buttonVariant }),
            "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
            defaultClassNames.button_previous
          ),
          button_next: cn(
            buttonVariants({ variant: buttonVariant }),
            "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
            defaultClassNames.button_next
          ),
          month_caption: cn(
            "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]",
            defaultClassNames.month_caption
          ),
          dropdowns: cn(
            "flex h-[--cell-size] w-full items-center justify-center gap-1.5 text-sm font-medium",
            defaultClassNames.dropdowns
          ),
          dropdown_root: cn(
            "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
            defaultClassNames.dropdown_root
          ),
          dropdown: cn(
            "bg-popover absolute inset-0 opacity-0",
            defaultClassNames.dropdown
          ),
          caption_label: cn(
            "select-none font-medium",
            captionLayout === "label" ? "text-sm" : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
            defaultClassNames.caption_label
          ),
          table: "w-full border-collapse",
          weekdays: cn("flex", defaultClassNames.weekdays),
          weekday: cn(
            "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
            defaultClassNames.weekday
          ),
          week: cn("mt-2 flex w-full", defaultClassNames.week),
          week_number_header: cn(
            "w-[--cell-size] select-none",
            defaultClassNames.week_number_header
          ),
          week_number: cn(
            "text-muted-foreground select-none text-[0.8rem]",
            defaultClassNames.week_number
          ),
          day: cn(
            "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
            defaultClassNames.day
          ),
          range_start: cn(
            "bg-accent rounded-l-md",
            defaultClassNames.range_start
          ),
          range_middle: cn("rounded-none", defaultClassNames.range_middle),
          range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
          today: cn(
            "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
            defaultClassNames.today
          ),
          outside: cn(
            "text-muted-foreground aria-selected:text-muted-foreground",
            defaultClassNames.outside
          ),
          disabled: cn(
            "text-muted-foreground opacity-50",
            defaultClassNames.disabled
          ),
          hidden: cn("invisible", defaultClassNames.hidden),
          ...classNames
        },
        components: {
          Root: ({ className: className2, rootRef, ...props2 }) => {
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                "data-slot": "calendar",
                ref: rootRef,
                className: cn(className2),
                ...props2
              }
            );
          },
          Chevron: ({ className: className2, orientation, ...props2 }) => {
            if (orientation === "left") {
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ds_exports.ChevronLeftIcon, { className: cn("size-4", className2), ...props2 });
            }
            if (orientation === "right") {
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                ds_exports.ChevronRightIcon,
                {
                  className: cn("size-4", className2),
                  ...props2
                }
              );
            }
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ds_exports.ChevronDownIcon, { className: cn("size-4", className2), ...props2 });
          },
          DayButton: CalendarDayButton,
          WeekNumber: ({ children, ...props2 }) => {
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { ...props2, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "flex size-[--cell-size] items-center justify-center text-center", children }) });
          },
          ...components
        },
        ...props
      }
    );
  }
  function CalendarDayButton({
    className,
    day,
    modifiers,
    ...props
  }) {
    const defaultClassNames = getDefaultClassNames();
    const ref = React31.useRef(null);
    React31.useEffect(() => {
      if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Button2,
      {
        ref,
        variant: "ghost",
        size: "icon",
        "data-day": day.date.toLocaleDateString(),
        "data-selected-single": modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle,
        "data-range-start": modifiers.range_start,
        "data-range-end": modifiers.range_end,
        "data-range-middle": modifiers.range_middle,
        className: cn(
          "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-[--cell-size] flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
          defaultClassNames.day,
          className
        ),
        ...props
      }
    );
  }

  // .design-sync/previews/Calendar.tsx
  var import_jsx_runtime4 = __toESM(require_react_shim(), 1);
  var Surface = ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "bg-background text-foreground", style: { padding: 24 }, children });
  function FabRunDate() {
    const [date, setDate] = (0, import_react33.useState)(new Date(2026, 5, 18));
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Calendar,
      {
        mode: "single",
        selected: date,
        onSelect: setDate,
        defaultMonth: new Date(2026, 5, 1),
        className: "rounded-md border"
      }
    ) });
  }
  function ProductionWindow() {
    const [range, setRange] = (0, import_react33.useState)({
      from: new Date(2026, 5, 10),
      to: new Date(2026, 5, 24)
    });
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Surface, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      Calendar,
      {
        mode: "range",
        selected: range,
        onSelect: setRange,
        defaultMonth: new Date(2026, 5, 1),
        numberOfMonths: 1,
        className: "rounded-md border"
      }
    ) });
  }
  return __toCommonJS(Calendar_exports);
})();
