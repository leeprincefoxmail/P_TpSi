(function($) {
    var VERSION = "0.9.3";
    var utils = {
        isMsie: function() {
            var match = /(msie) ([\w.]+)/i.exec(navigator.userAgent);
            return match ? parseInt(match[2], 10) : false;
        },
        isBlankString: function(str) {
            return !str || /^\s*$/.test(str);
        },
        escapeRegExChars: function(str) {
            return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        },
        isString: function(obj) {
            return typeof obj === "string";
        },
        isNumber: function(obj) {
            return typeof obj === "number";
        },
        isArray: $.isArray,
        isFunction: $.isFunction,
        isObject: $.isPlainObject,
        isUndefined: function(obj) {
            return typeof obj === "undefined";
        },
        bind: $.proxy,
        bindAll: function(obj) {
            var val;
            for (var key in obj) {
                $.isFunction(val = obj[key]) && (obj[key] = $.proxy(val, obj));
            }
        },
        indexOf: function(haystack, needle) {
            for (var i = 0; i < haystack.length; i++) {
                if (haystack[i] === needle) {
                    return i;
                }
            }
            return -1;
        },
        each: $.each,
        map: $.map,
        filter: $.grep,
        every: function(obj, test) {
            var result = true;
            if (!obj) {
                return result;
            }
            $.each(obj, function(key, val) {
                if (!(result = test.call(null, val, key, obj))) {
                    return false;
                }
            });
            return !!result;
        },
        some: function(obj, test) {
            var result = false;
            if (!obj) {
                return result;
            }
            $.each(obj, function(key, val) {
                if (result = test.call(null, val, key, obj)) {
                    return false;
                }
            });
            return !!result;
        },
        mixin: $.extend,
        getUniqueId: function() {
            var counter = 0;
            return function() {
                return counter++;
            };
        }(),
        defer: function(fn) {
            setTimeout(fn, 0);
        },
        debounce: function(func, wait, immediate) {
            var timeout, result;
            return function() {
                var context = this,
                    args = arguments,
                    later, callNow;
                later = function() {
                    timeout = null;
                    if (!immediate) {
                        result = func.apply(context, args);
                    }
                };
                callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) {
                    result = func.apply(context, args);
                }
                return result;
            };
        },
        throttle: function(func, wait) {
            var context, args, timeout, result, previous, later;
            previous = 0;
            later = function() {
                previous = new Date();
                timeout = null;
                result = func.apply(context, args);
            };
            return function() {
                var now = new Date(),
                    remaining = wait - (now - previous);
                context = this;
                args = arguments;
                if (remaining <= 0) {
                    clearTimeout(timeout);
                    timeout = null;
                    previous = now;
                    result = func.apply(context, args);
                } else if (!timeout) {
                    timeout = setTimeout(later, remaining);
                }
                return result;
            };
        },
        tokenizeQuery: function(str) {
            return $.trim(str).toLowerCase().split(/[\s]+/);
        },
        tokenizeText: function(str) {
            return $.trim(str).toLowerCase().split(/[\s\-_]+/);
        },
        getProtocol: function() {
            return location.protocol;
        },
        noop: function() {}
    };
    var EventTarget = function() {
        var eventSplitter = /\s+/;
        return {
            on: function(events, callback) {
                var event;
                if (!callback) {
                    return this;
                }
                this._callbacks = this._callbacks || {};
                events = events.split(eventSplitter);
                while (event = events.shift()) {
                    this._callbacks[event] = this._callbacks[event] || [];
                    this._callbacks[event].push(callback);
                }
                return this;
            },
            trigger: function(events, data) {
                var event, callbacks;
                if (!this._callbacks) {
                    return this;
                }
                events = events.split(eventSplitter);
                while (event = events.shift()) {
                    if (callbacks = this._callbacks[event]) {
                        for (var i = 0; i < callbacks.length; i += 1) {
                            callbacks[i].call(this, {
                                type: event,
                                data: data
                            });
                        }
                    }
                }
                return this;
            }
        };
    }();
    var EventBus = function() {
        var namespace = "typeahead:";

        function EventBus(o) {
            if (!o || !o.el) {
                $.error("EventBus initialized without el");
            }
            this.$el = $(o.el);
        }
        utils.mixin(EventBus.prototype, {
            trigger: function(type) {
                var args = [].slice.call(arguments, 1);
                this.$el.trigger(namespace + type, args);
            }
        });
        return EventBus;
    }();
    var PersistentStorage = function() {
        var ls, methods;
        try {
            ls = window.localStorage;
            ls.setItem("~~~", "!");
            ls.removeItem("~~~");
        } catch (err) {
            ls = null;
        }

        function PersistentStorage(namespace) {
            this.prefix = ["__", namespace, "__"].join("");
            this.ttlKey = "__ttl__";
            this.keyMatcher = new RegExp("^" + this.prefix);
        }
        if (ls && window.JSON) {
            methods = {
                _prefix: function(key) {
                    return this.prefix + key;
                },
                _ttlKey: function(key) {
                    return this._prefix(key) + this.ttlKey;
                },
                get: function(key) {
                    if (this.isExpired(key)) {
                        this.remove(key);
                    }
                    return decode(ls.getItem(this._prefix(key)));
                },
                set: function(key, val, ttl) {
                    if (utils.isNumber(ttl)) {
                        ls.setItem(this._ttlKey(key), encode(now() + ttl));
                    } else {
                        ls.removeItem(this._ttlKey(key));
                    }
                    return ls.setItem(this._prefix(key), encode(val));
                },
                remove: function(key) {
                    ls.removeItem(this._ttlKey(key));
                    ls.removeItem(this._prefix(key));
                    return this;
                },
                clear: function() {
                    var i, key, keys = [],
                        len = ls.length;
                    for (i = 0; i < len; i++) {
                        if ((key = ls.key(i)).match(this.keyMatcher)) {
                            keys.push(key.replace(this.keyMatcher, ""));
                        }
                    }
                    for (i = keys.length; i--;) {
                        this.remove(keys[i]);
                    }
                    return this;
                },
                isExpired: function(key) {
                    var ttl = decode(ls.getItem(this._ttlKey(key)));
                    return utils.isNumber(ttl) && now() > ttl ? true : false;
                }
            };
        } else {
            methods = {
                get: utils.noop,
                set: utils.noop,
                remove: utils.noop,
                clear: utils.noop,
                isExpired: utils.noop
            };
        }
        utils.mixin(PersistentStorage.prototype, methods);
        return PersistentStorage;

        function now() {
            return new Date().getTime();
        }

        function encode(val) {
            return JSON.stringify(utils.isUndefined(val) ? null : val);
        }

        function decode(val) {
            return JSON.parse(val);
        }
    }();
    var RequestCache = function() {
        function RequestCache(o) {
            utils.bindAll(this);
            o = o || {};
            this.sizeLimit = o.sizeLimit || 10;
            this.cache = {};
            this.cachedKeysByAge = [];
        }
        utils.mixin(RequestCache.prototype, {
            get: function(url) {
                return this.cache[url];
            },
            set: function(url, resp) {
                var requestToEvict;
                if (this.cachedKeysByAge.length === this.sizeLimit) {
                    requestToEvict = this.cachedKeysByAge.shift();
                    delete this.cache[requestToEvict];
                }
                this.cache[url] = resp;
                this.cachedKeysByAge.push(url);
            }
        });
        return RequestCache;
    }();
    var Transport = function() {
        var pendingRequestsCount = 0,
            pendingRequests = {},
            maxPendingRequests, requestCache;

        function Transport(o) {
            utils.bindAll(this);
            o = utils.isString(o) ? {
                url: o
            } : o;
            requestCache = requestCache || new RequestCache();
            maxPendingRequests = utils.isNumber(o.maxParallelRequests) ? o.maxParallelRequests : maxPendingRequests || 6;
            this.url = o.url;
            this.wildcard = o.wildcard || "%QUERY";
            this.filter = o.filter;
            this.replace = o.replace;
            this.ajaxSettings = {
                type: "get",
                cache: o.cache,
                timeout: o.timeout,
                dataType: o.dataType || "json",
                beforeSend: o.beforeSend
            };
            this._get = (/^throttle$/i.test(o.rateLimitFn) ? utils.throttle : utils.debounce)(this._get, o.rateLimitWait || 300);
        }
        utils.mixin(Transport.prototype, {
            _get: function(url, cb) {
                var that = this;
                if (belowPendingRequestsThreshold()) {
                    this._sendRequest(url).done(done);
                } else {
                    this.onDeckRequestArgs = [].slice.call(arguments, 0);
                }

                function done(resp) {
                    var data = that.filter ? that.filter(resp) : resp;
                    cb && cb(data);
                    requestCache.set(url, resp);
                }
            },
            _sendRequest: function(url) {
                var that = this,
                    jqXhr = pendingRequests[url];
                if (!jqXhr) {
                    incrementPendingRequests();
                    jqXhr = pendingRequests[url] = $.ajax(url, this.ajaxSettings).always(always);
                }
                return jqXhr;

                function always() {
                    decrementPendingRequests();
                    pendingRequests[url] = null;
                    if (that.onDeckRequestArgs) {
                        that._get.apply(that, that.onDeckRequestArgs);
                        that.onDeckRequestArgs = null;
                    }
                }
            },
            get: function(query, cb) {
                var that = this,
                    encodedQuery = encodeURIComponent(query || ""),
                    url, resp;
                cb = cb || utils.noop;
                url = this.replace ? this.replace(this.url, encodedQuery) : this.url.replace(this.wildcard, encodedQuery);
                if (resp = requestCache.get(url)) {
                    utils.defer(function() {
                        cb(that.filter ? that.filter(resp) : resp);
                    });
                } else {
                    this._get(url, cb);
                }
                return !!resp;
            }
        });
        return Transport;

        function incrementPendingRequests() {
            pendingRequestsCount++;
        }

        function decrementPendingRequests() {
            pendingRequestsCount--;
        }

        function belowPendingRequestsThreshold() {
            return pendingRequestsCount < maxPendingRequests;
        }
    }();
    var Dataset = function() {
        var keys = {
            thumbprint: "thumbprint",
            protocol: "protocol",
            itemHash: "itemHash",
            adjacencyList: "adjacencyList"
        };

        function Dataset(o) {
            utils.bindAll(this);
            if (utils.isString(o.template) && !o.engine) {
                $.error("no template engine specified");
            }
            if (!o.local && !o.prefetch && !o.remote) {
                $.error("one of local, prefetch, or remote is required");
            }
            this.name = o.name || utils.getUniqueId();
            this.limit = o.limit || 5;
            this.minLength = o.minLength || 1;
            this.header = o.header;
            this.footer = o.footer;
            this.valueKey = o.valueKey || "value";
            this.template = compileTemplate(o.template, o.engine, this.valueKey);
            this.local = o.local;
            this.prefetch = o.prefetch;
            this.remote = o.remote;
            this.itemHash = {};
            this.adjacencyList = {};
            this.storage = o.name ? new PersistentStorage(o.name) : null;
        }
        utils.mixin(Dataset.prototype, {
            _processLocalData: function(data) {
                this._mergeProcessedData(this._processData(data));
            },
            _loadPrefetchData: function(o) {
                var that = this,
                    thumbprint = VERSION + (o.thumbprint || ""),
                    storedThumbprint, storedProtocol, storedItemHash, storedAdjacencyList, isExpired, deferred;
                if (this.storage) {
                    storedThumbprint = this.storage.get(keys.thumbprint);
                    storedProtocol = this.storage.get(keys.protocol);
                    storedItemHash = this.storage.get(keys.itemHash);
                    storedAdjacencyList = this.storage.get(keys.adjacencyList);
                }
                isExpired = storedThumbprint !== thumbprint || storedProtocol !== utils.getProtocol();
                o = utils.isString(o) ? {
                    url: o
                } : o;
                o.ttl = utils.isNumber(o.ttl) ? o.ttl : 24 * 60 * 60 * 1e3;
                if (storedItemHash && storedAdjacencyList && !isExpired) {
                    this._mergeProcessedData({
                        itemHash: storedItemHash,
                        adjacencyList: storedAdjacencyList
                    });
                    deferred = $.Deferred().resolve();
                } else {
                    deferred = $.getJSON(o.url).done(processPrefetchData);
                }
                return deferred;

                function processPrefetchData(data) {
                    var filteredData = o.filter ? o.filter(data) : data,
                        processedData = that._processData(filteredData),
                        itemHash = processedData.itemHash,
                        adjacencyList = processedData.adjacencyList;
                    if (that.storage) {
                        that.storage.set(keys.itemHash, itemHash, o.ttl);
                        that.storage.set(keys.adjacencyList, adjacencyList, o.ttl);
                        that.storage.set(keys.thumbprint, thumbprint, o.ttl);
                        that.storage.set(keys.protocol, utils.getProtocol(), o.ttl);
                    }
                    that._mergeProcessedData(processedData);
                }
            },
            _transformDatum: function(datum) {
                var value = utils.isString(datum) ? datum : datum[this.valueKey],
                    tokens = datum.tokens || utils.tokenizeText(value),
                    item = {
                        value: value,
                        tokens: tokens
                    };
                if (utils.isString(datum)) {
                    item.datum = {};
                    item.datum[this.valueKey] = datum;
                } else {
                    item.datum = datum;
                }
                item.tokens = utils.filter(item.tokens, function(token) {
                    return !utils.isBlankString(token);
                });
                item.tokens = utils.map(item.tokens, function(token) {
                    return token.toLowerCase();
                });
                return item;
            },
            _processData: function(data) {
                var that = this,
                    itemHash = {},
                    adjacencyList = {};
                utils.each(data, function(i, datum) {
                    var item = that._transformDatum(datum),
                        id = utils.getUniqueId(item.value);
                    itemHash[id] = item;
                    utils.each(item.tokens, function(i, token) {
                        var character = token.charAt(0),
                            adjacency = adjacencyList[character] || (adjacencyList[character] = [id]);
                        !~utils.indexOf(adjacency, id) && adjacency.push(id);
                    });
                });
                return {
                    itemHash: itemHash,
                    adjacencyList: adjacencyList
                };
            },
            _mergeProcessedData: function(processedData) {
                var that = this;
                utils.mixin(this.itemHash, processedData.itemHash);
                utils.each(processedData.adjacencyList, function(character, adjacency) {
                    var masterAdjacency = that.adjacencyList[character];
                    that.adjacencyList[character] = masterAdjacency ? masterAdjacency.concat(adjacency) : adjacency;
                });
            },
            _getLocalSuggestions: function(terms) {
                var that = this,
                    firstChars = [],
                    lists = [],
                    shortestList, suggestions = [];
                utils.each(terms, function(i, term) {
                    var firstChar = term.charAt(0);
                    !~utils.indexOf(firstChars, firstChar) && firstChars.push(firstChar);
                });
                utils.each(firstChars, function(i, firstChar) {
                    var list = that.adjacencyList[firstChar];
                    if (!list) {
                        return false;
                    }
                    lists.push(list);
                    if (!shortestList || list.length < shortestList.length) {
                        shortestList = list;
                    }
                });
                if (lists.length < firstChars.length) {
                    return [];
                }
                utils.each(shortestList, function(i, id) {
                    var item = that.itemHash[id],
                        isCandidate, isMatch;
                    isCandidate = utils.every(lists, function(list) {
                        return ~utils.indexOf(list, id);
                    });
                    isMatch = isCandidate && utils.every(terms, function(term) {
                        return utils.some(item.tokens, function(token) {
                            return token.indexOf(term) === 0;
                        });
                    });
                    isMatch && suggestions.push(item);
                });
                return suggestions;
            },
            initialize: function() {
                var deferred;
                this.local && this._processLocalData(this.local);
                this.transport = this.remote ? new Transport(this.remote) : null;
                deferred = this.prefetch ? this._loadPrefetchData(this.prefetch) : $.Deferred().resolve();
                this.local = this.prefetch = this.remote = null;
                this.initialize = function() {
                    return deferred;
                };
                return deferred;
            },
            getSuggestions: function(query, cb) {
                var that = this,
                    terms, suggestions, cacheHit = false;
                if (query.length < this.minLength) {
                    return;
                }
                terms = utils.tokenizeQuery(query);
                suggestions = this._getLocalSuggestions(terms).slice(0, this.limit);
                if (suggestions.length < this.limit && this.transport) {
                    cacheHit = this.transport.get(query, processRemoteData);
                }!cacheHit && cb && cb(suggestions);

                function processRemoteData(data) {
                    suggestions = suggestions.slice(0);
                    utils.each(data, function(i, datum) {
                        var item = that._transformDatum(datum),
                            isDuplicate;
                        isDuplicate = utils.some(suggestions, function(suggestion) {
                            return item.value === suggestion.value;
                        });
                        !isDuplicate && suggestions.push(item);
                        return suggestions.length < that.limit;
                    });
                    cb && cb(suggestions);
                }
            }
        });
        return Dataset;

        function compileTemplate(template, engine, valueKey) {
            var renderFn, compiledTemplate;
            if (utils.isFunction(template)) {
                renderFn = template;
            } else if (utils.isString(template)) {
                compiledTemplate = engine.compile(template);
                renderFn = utils.bind(compiledTemplate.render, compiledTemplate);
            } else {
                renderFn = function(context) {
                    return "<p>" + context[valueKey] + "</p>";
                };
            }
            return renderFn;
        }
    }();
    var InputView = function() {
        function InputView(o) {
            var that = this;
            utils.bindAll(this);
            this.specialKeyCodeMap = {
                9: "tab",
                27: "esc",
                37: "left",
                39: "right",
                13: "enter",
                38: "up",
                40: "down"
            };
            this.$hint = $(o.hint);
            this.$input = $(o.input).on("blur.tt", this._handleBlur).on("focus.tt", this._handleFocus).on("keydown.tt", this._handleSpecialKeyEvent);
            if (!utils.isMsie()) {
                this.$input.on("input.tt", this._compareQueryToInputValue);
            } else {
                this.$input.on("keydown.tt keypress.tt cut.tt paste.tt", function($e) {
                    if (that.specialKeyCodeMap[$e.which || $e.keyCode]) {
                        return;
                    }
                    utils.defer(that._compareQueryToInputValue);
                });
            }
            this.query = this.$input.val();
            this.$overflowHelper = buildOverflowHelper(this.$input);
        }
        utils.mixin(InputView.prototype, EventTarget, {
            _handleFocus: function() {
                this.trigger("focused");
            },
            _handleBlur: function() {
                this.trigger("blured");
            },
            _handleSpecialKeyEvent: function($e) {
                var keyName = this.specialKeyCodeMap[$e.which || $e.keyCode];
                keyName && this.trigger(keyName + "Keyed", $e);
            },
            _compareQueryToInputValue: function() {
                var inputValue = this.getInputValue(),
                    isSameQuery = compareQueries(this.query, inputValue),
                    isSameQueryExceptWhitespace = isSameQuery ? this.query.length !== inputValue.length : false;
                if (isSameQueryExceptWhitespace) {
                    this.trigger("whitespaceChanged", {
                        value: this.query
                    });
                } else if (!isSameQuery) {
                    this.trigger("queryChanged", {
                        value: this.query = inputValue
                    });
                }
            },
            destroy: function() {
                this.$hint.off(".tt");
                this.$input.off(".tt");
                this.$hint = this.$input = this.$overflowHelper = null;
            },
            focus: function() {
                this.$input.focus();
            },
            blur: function() {
                this.$input.blur();
            },
            getQuery: function() {
                return this.query;
            },
            setQuery: function(query) {
                this.query = query;
            },
            getInputValue: function() {
                return this.$input.val();
            },
            setInputValue: function(value, silent) {
                this.$input.val(value);
                !silent && this._compareQueryToInputValue();
            },
            getHintValue: function() {
                return this.$hint.val();
            },
            setHintValue: function(value) {
                this.$hint.val(value);
            },
            getLanguageDirection: function() {
                return (this.$input.css("direction") || "ltr").toLowerCase();
            },
            isOverflow: function() {
                this.$overflowHelper.text(this.getInputValue());
                return this.$overflowHelper.width() > this.$input.width();
            },
            isCursorAtEnd: function() {
                var valueLength = this.$input.val().length,
                    selectionStart = this.$input[0].selectionStart,
                    range;
                if (utils.isNumber(selectionStart)) {
                    return selectionStart === valueLength;
                } else if (document.selection) {
                    range = document.selection.createRange();
                    range.moveStart("character", -valueLength);
                    return valueLength === range.text.length;
                }
                return true;
            }
        });
        return InputView;

        function buildOverflowHelper($input) {
            return $("<span></span>").css({
                position: "absolute",
                left: "-9999px",
                visibility: "hidden",
                whiteSpace: "nowrap",
                fontFamily: $input.css("font-family"),
                fontSize: $input.css("font-size"),
                fontStyle: $input.css("font-style"),
                fontVariant: $input.css("font-variant"),
                fontWeight: $input.css("font-weight"),
                wordSpacing: $input.css("word-spacing"),
                letterSpacing: $input.css("letter-spacing"),
                textIndent: $input.css("text-indent"),
                textRendering: $input.css("text-rendering"),
                textTransform: $input.css("text-transform")
            }).insertAfter($input);
        }

        function compareQueries(a, b) {
            a = (a || "").replace(/^\s*/g, "").replace(/\s{2,}/g, " ");
            b = (b || "").replace(/^\s*/g, "").replace(/\s{2,}/g, " ");
            return a === b;
        }
    }();
    var DropdownView = function() {
        var html = {
                suggestionsList: '<span class="tt-suggestions"></span>'
            },
            css = {
                suggestionsList: {
                    display: "block"
                },
                suggestion: {
                    whiteSpace: "nowrap",
                    cursor: "pointer"
                },
                suggestionChild: {
                    whiteSpace: "normal"
                }
            };

        function DropdownView(o) {
            utils.bindAll(this);
            this.isOpen = false;
            this.isEmpty = true;
            this.isMouseOverDropdown = false;
            this.$menu = $(o.menu).on("mouseenter.tt", this._handleMouseenter).on("mouseleave.tt", this._handleMouseleave).on("click.tt", ".tt-suggestion", this._handleSelection).on("mouseover.tt", ".tt-suggestion", this._handleMouseover);
        }
        utils.mixin(DropdownView.prototype, EventTarget, {
            _handleMouseenter: function() {
                this.isMouseOverDropdown = true;
            },
            _handleMouseleave: function() {
                this.isMouseOverDropdown = false;
            },
            _handleMouseover: function($e) {
                var $suggestion = $($e.currentTarget);
                this._getSuggestions().removeClass("tt-is-under-cursor");
                $suggestion.addClass("tt-is-under-cursor");
            },
            _handleSelection: function($e) {
                var $suggestion = $($e.currentTarget);
                this.trigger("suggestionSelected", extractSuggestion($suggestion));
            },
            _show: function() {
                this.$menu.css("display", "block");
            },
            _hide: function() {
                this.$menu.hide();
            },
            _moveCursor: function(increment) {
                var $suggestions, $cur, nextIndex, $underCursor;
                if (!this.isVisible()) {
                    return;
                }
                $suggestions = this._getSuggestions();
                $cur = $suggestions.filter(".tt-is-under-cursor");
                $cur.removeClass("tt-is-under-cursor");
                nextIndex = $suggestions.index($cur) + increment;
                nextIndex = (nextIndex + 1) % ($suggestions.length + 1) - 1;
                if (nextIndex === -1) {
                    this.trigger("cursorRemoved");
                    return;
                } else if (nextIndex < -1) {
                    nextIndex = $suggestions.length - 1;
                }
                $underCursor = $suggestions.eq(nextIndex).addClass("tt-is-under-cursor");
                this._ensureVisibility($underCursor);
                this.trigger("cursorMoved", extractSuggestion($underCursor));
            },
            _getSuggestions: function() {
                return this.$menu.find(".tt-suggestions > .tt-suggestion");
            },
            _ensureVisibility: function($el) {
                var menuHeight = this.$menu.height() + parseInt(this.$menu.css("paddingTop"), 10) + parseInt(this.$menu.css("paddingBottom"), 10),
                    menuScrollTop = this.$menu.scrollTop(),
                    elTop = $el.position().top,
                    elBottom = elTop + $el.outerHeight(true);
                if (elTop < 0) {
                    this.$menu.scrollTop(menuScrollTop + elTop);
                } else if (menuHeight < elBottom) {
                    this.$menu.scrollTop(menuScrollTop + (elBottom - menuHeight));
                }
            },
            destroy: function() {
                this.$menu.off(".tt");
                this.$menu = null;
            },
            isVisible: function() {
                return this.isOpen && !this.isEmpty;
            },
            closeUnlessMouseIsOverDropdown: function() {
                if (!this.isMouseOverDropdown) {
                    this.close();
                }
            },
            close: function() {
                if (this.isOpen) {
                    this.isOpen = false;
                    this.isMouseOverDropdown = false;
                    this._hide();
                    this.$menu.find(".tt-suggestions > .tt-suggestion").removeClass("tt-is-under-cursor");
                    this.trigger("closed");
                }
            },
            open: function() {
                if (!this.isOpen) {
                    this.isOpen = true;
                    !this.isEmpty && this._show();
                    this.trigger("opened");
                }
            },
            setLanguageDirection: function(dir) {
                var ltrCss = {
                        left: "0",
                        right: "auto"
                    },
                    rtlCss = {
                        left: "auto",
                        right: " 0"
                    };
                dir === "ltr" ? this.$menu.css(ltrCss) : this.$menu.css(rtlCss);
            },
            moveCursorUp: function() {
                this._moveCursor(-1);
            },
            moveCursorDown: function() {
                this._moveCursor(+1);
            },
            getSuggestionUnderCursor: function() {
                var $suggestion = this._getSuggestions().filter(".tt-is-under-cursor").first();
                return $suggestion.length > 0 ? extractSuggestion($suggestion) : null;
            },
            getFirstSuggestion: function() {
                var $suggestion = this._getSuggestions().first();
                return $suggestion.length > 0 ? extractSuggestion($suggestion) : null;
            },
            renderSuggestions: function(dataset, suggestions) {
                var datasetClassName = "tt-dataset-" + dataset.name,
                    wrapper = '<div class="tt-suggestion">%body</div>',
                    compiledHtml, $suggestionsList, $dataset = this.$menu.find("." + datasetClassName),
                    elBuilder, fragment, $el;
                if ($dataset.length === 0) {
                    $suggestionsList = $(html.suggestionsList).css(css.suggestionsList);
                    $dataset = $("<div></div>").addClass(datasetClassName).append(dataset.header).append($suggestionsList).append(dataset.footer).appendTo(this.$menu);
                }
                if (suggestions.length > 0) {
                    this.isEmpty = false;
                    this.isOpen && this._show();
                    elBuilder = document.createElement("div");
                    fragment = document.createDocumentFragment();
                    utils.each(suggestions, function(i, suggestion) {
                        suggestion.dataset = dataset.name;
                        compiledHtml = dataset.template(suggestion.datum);
                        elBuilder.innerHTML = wrapper.replace("%body", compiledHtml);
                        $el = $(elBuilder.firstChild).css(css.suggestion).data("suggestion", suggestion);
                        $el.children().each(function() {
                            $(this).css(css.suggestionChild);
                        });
                        fragment.appendChild($el[0]);
                    });
                    $dataset.show().find(".tt-suggestions").html(fragment);
                } else {
                    this.clearSuggestions(dataset.name);
                }
                this.trigger("suggestionsRendered");
            },
            clearSuggestions: function(datasetName) {
                var $datasets = datasetName ? this.$menu.find(".tt-dataset-" + datasetName) : this.$menu.find('[class^="tt-dataset-"]'),
                    $suggestions = $datasets.find(".tt-suggestions");
                $datasets.hide();
                $suggestions.empty();
                if (this._getSuggestions().length === 0) {
                    this.isEmpty = true;
                    this._hide();
                }
            }
        });
        return DropdownView;

        function extractSuggestion($el) {
            return $el.data("suggestion");
        }
    }();
    var TypeaheadView = function() {
        var html = {
                wrapper: '<span class="twitter-typeahead"></span>',
                hint: '<input class="tt-hint" type="text" autocomplete="off" spellcheck="off" disabled>',
                dropdown: '<span class="tt-dropdown-menu"></span>'
            },
            css = {
                wrapper: {
                    position: "relative",
                    display: "inline-block"
                },
                hint: {
                    position: "absolute",
                    top: "0",
                    left: "0",
                    borderColor: "transparent",
                    boxShadow: "none"
                },
                query: {
                    position: "relative",
                    verticalAlign: "top",
                    backgroundColor: "transparent"
                },
                dropdown: {
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    zIndex: "100",
                    display: "none"
                }
            };
        if (utils.isMsie()) {
            utils.mixin(css.query, {
                backgroundImage: "url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)"
            });
        }
        if (utils.isMsie() && utils.isMsie() <= 7) {
            utils.mixin(css.wrapper, {
                display: "inline",
                zoom: "1"
            });
            utils.mixin(css.query, {
                marginTop: "-1px"
            });
        }

        function TypeaheadView(o) {
            var $menu, $input, $hint;
            utils.bindAll(this);
            this.$node = buildDomStructure(o.input);
            this.datasets = o.datasets;
            this.dir = null;
            this.eventBus = o.eventBus;
            $menu = this.$node.find(".tt-dropdown-menu");
            $input = this.$node.find(".tt-query");
            $hint = this.$node.find(".tt-hint");
            this.dropdownView = new DropdownView({
                menu: $menu
            }).on("suggestionSelected", this._handleSelection).on("cursorMoved", this._clearHint).on("cursorMoved", this._setInputValueToSuggestionUnderCursor).on("cursorRemoved", this._setInputValueToQuery).on("cursorRemoved", this._updateHint).on("suggestionsRendered", this._updateHint).on("opened", this._updateHint).on("closed", this._clearHint).on("opened closed", this._propagateEvent);
            this.inputView = new InputView({
                input: $input,
                hint: $hint
            }).on("focused", this._openDropdown).on("blured", this._closeDropdown).on("blured", this._setInputValueToQuery).on("enterKeyed tabKeyed", this._handleSelection).on("queryChanged", this._clearHint).on("queryChanged", this._clearSuggestions).on("queryChanged", this._getSuggestions).on("whitespaceChanged", this._updateHint).on("queryChanged whitespaceChanged", this._openDropdown).on("queryChanged whitespaceChanged", this._setLanguageDirection).on("escKeyed", this._closeDropdown).on("escKeyed", this._setInputValueToQuery).on("tabKeyed upKeyed downKeyed", this._managePreventDefault).on("upKeyed downKeyed", this._moveDropdownCursor).on("upKeyed downKeyed", this._openDropdown).on("tabKeyed leftKeyed rightKeyed", this._autocomplete);
        }
        utils.mixin(TypeaheadView.prototype, EventTarget, {
            _managePreventDefault: function(e) {
                var $e = e.data,
                    hint, inputValue, preventDefault = false;
                switch (e.type) {
                    case "tabKeyed":
                        hint = this.inputView.getHintValue();
                        inputValue = this.inputView.getInputValue();
                        preventDefault = hint && hint !== inputValue;
                        break;
                    case "upKeyed":
                    case "downKeyed":
                        preventDefault = !$e.shiftKey && !$e.ctrlKey && !$e.metaKey;
                        break;
                }
                preventDefault && $e.preventDefault();
            },
            _setLanguageDirection: function() {
                var dir = this.inputView.getLanguageDirection();
                if (dir !== this.dir) {
                    this.dir = dir;
                    this.$node.css("direction", dir);
                    this.dropdownView.setLanguageDirection(dir);
                }
            },
            _updateHint: function() {
                var suggestion = this.dropdownView.getFirstSuggestion(),
                    hint = suggestion ? suggestion.value : null,
                    dropdownIsVisible = this.dropdownView.isVisible(),
                    inputHasOverflow = this.inputView.isOverflow(),
                    inputValue, query, escapedQuery, beginsWithQuery, match;
                if (hint && dropdownIsVisible && !inputHasOverflow) {
                    inputValue = this.inputView.getInputValue();
                    query = inputValue.replace(/\s{2,}/g, " ").replace(/^\s+/g, "");
                    escapedQuery = utils.escapeRegExChars(query);
                    beginsWithQuery = new RegExp("^(?:" + escapedQuery + ")(.*$)", "i");
                    match = beginsWithQuery.exec(hint);
                    this.inputView.setHintValue(inputValue + (match ? match[1] : ""));
                }
            },
            _clearHint: function() {
                this.inputView.setHintValue("");
            },
            _clearSuggestions: function() {
                this.dropdownView.clearSuggestions();
            },
            _setInputValueToQuery: function() {
                this.inputView.setInputValue(this.inputView.getQuery());
            },
            _setInputValueToSuggestionUnderCursor: function(e) {
                var suggestion = e.data;
                this.inputView.setInputValue(suggestion.value, true);
            },
            _openDropdown: function() {
                this.dropdownView.open();
            },
            _closeDropdown: function(e) {
                this.dropdownView[e.type === "blured" ? "closeUnlessMouseIsOverDropdown" : "close"]();
            },
            _moveDropdownCursor: function(e) {
                var $e = e.data;
                if (!$e.shiftKey && !$e.ctrlKey && !$e.metaKey) {
                    this.dropdownView[e.type === "upKeyed" ? "moveCursorUp" : "moveCursorDown"]();
                }
            },
            _handleSelection: function(e) {
                var byClick = e.type === "suggestionSelected",
                    suggestion = byClick ? e.data : this.dropdownView.getSuggestionUnderCursor();
                if (suggestion) {
                    this.inputView.setInputValue(suggestion.value);
                    byClick ? this.inputView.focus() : e.data.preventDefault();
                    byClick && utils.isMsie() ? utils.defer(this.dropdownView.close) : this.dropdownView.close();
                    this.eventBus.trigger("selected", suggestion.datum, suggestion.dataset);
                }
            },
            _getSuggestions: function() {
                var that = this,
                    query = this.inputView.getQuery();
                if (utils.isBlankString(query)) {
                    return;
                }
                utils.each(this.datasets, function(i, dataset) {
                    dataset.getSuggestions(query, function(suggestions) {
                        if (query === that.inputView.getQuery()) {
                            that.dropdownView.renderSuggestions(dataset, suggestions);
                        }
                    });
                });
            },
            _autocomplete: function(e) {
                var isCursorAtEnd, ignoreEvent, query, hint, suggestion;
                if (e.type === "rightKeyed" || e.type === "leftKeyed") {
                    isCursorAtEnd = this.inputView.isCursorAtEnd();
                    ignoreEvent = this.inputView.getLanguageDirection() === "ltr" ? e.type === "leftKeyed" : e.type === "rightKeyed";
                    if (!isCursorAtEnd || ignoreEvent) {
                        return;
                    }
                }
                query = this.inputView.getQuery();
                hint = this.inputView.getHintValue();
                if (hint !== "" && query !== hint) {
                    suggestion = this.dropdownView.getFirstSuggestion();
                    this.inputView.setInputValue(suggestion.value);
                    this.eventBus.trigger("autocompleted", suggestion.datum, suggestion.dataset);
                }
            },
            _propagateEvent: function(e) {
                this.eventBus.trigger(e.type);
            },
            destroy: function() {
                this.inputView.destroy();
                this.dropdownView.destroy();
                destroyDomStructure(this.$node);
                this.$node = null;
            },
            setQuery: function(query) {
                this.inputView.setQuery(query);
                this.inputView.setInputValue(query);
                this._clearHint();
                this._clearSuggestions();
                this._getSuggestions();
            }
        });
        return TypeaheadView;

        function buildDomStructure(input) {
            var $wrapper = $(html.wrapper),
                $dropdown = $(html.dropdown),
                $input = $(input),
                $hint = $(html.hint);
            $wrapper = $wrapper.css(css.wrapper);
            $dropdown = $dropdown.css(css.dropdown);
            $hint.css(css.hint).css({
                backgroundAttachment: $input.css("background-attachment"),
                backgroundClip: $input.css("background-clip"),
                backgroundColor: $input.css("background-color"),
                backgroundImage: $input.css("background-image"),
                backgroundOrigin: $input.css("background-origin"),
                backgroundPosition: $input.css("background-position"),
                backgroundRepeat: $input.css("background-repeat"),
                backgroundSize: $input.css("background-size")
            });
            $input.data("ttAttrs", {
                dir: $input.attr("dir"),
                autocomplete: $input.attr("autocomplete"),
                spellcheck: $input.attr("spellcheck"),
                style: $input.attr("style")
            });
            $input.addClass("tt-query").attr({
                autocomplete: "off",
                spellcheck: false
            }).css(css.query);
            try {
                !$input.attr("dir") && $input.attr("dir", "auto");
            } catch (e) {}
            return $input.wrap($wrapper).parent().prepend($hint).append($dropdown);
        }

        function destroyDomStructure($node) {
            var $input = $node.find(".tt-query");
            utils.each($input.data("ttAttrs"), function(key, val) {
                utils.isUndefined(val) ? $input.removeAttr(key) : $input.attr(key, val);
            });
            $input.detach().removeData("ttAttrs").removeClass("tt-query").insertAfter($node);
            $node.remove();
        }
    }();
    (function() {
        var cache = {},
            viewKey = "ttView",
            methods;
        methods = {
            initialize: function(datasetDefs) {
                var datasets;
                datasetDefs = utils.isArray(datasetDefs) ? datasetDefs : [datasetDefs];
                if (datasetDefs.length === 0) {
                    $.error("no datasets provided");
                }
                datasets = utils.map(datasetDefs, function(o) {
                    var dataset = cache[o.name] ? cache[o.name] : new Dataset(o);
                    if (o.name) {
                        cache[o.name] = dataset;
                    }
                    return dataset;
                });
                return this.each(initialize);

                function initialize() {
                    var $input = $(this),
                        deferreds, eventBus = new EventBus({
                            el: $input
                        });
                    deferreds = utils.map(datasets, function(dataset) {
                        return dataset.initialize();
                    });
                    $input.data(viewKey, new TypeaheadView({
                        input: $input,
                        eventBus: eventBus = new EventBus({
                            el: $input
                        }),
                        datasets: datasets
                    }));
                    $.when.apply($, deferreds).always(function() {
                        utils.defer(function() {
                            eventBus.trigger("initialized");
                        });
                    });
                }
            },
            destroy: function() {
                return this.each(destroy);

                function destroy() {
                    var $this = $(this),
                        view = $this.data(viewKey);
                    if (view) {
                        view.destroy();
                        $this.removeData(viewKey);
                    }
                }
            },
            setQuery: function(query) {
                return this.each(setQuery);

                function setQuery() {
                    var view = $(this).data(viewKey);
                    view && view.setQuery(query);
                }
            }
        };
        jQuery.fn.typeahead = function(method) {
            if (methods[method]) {
                return methods[method].apply(this, [].slice.call(arguments, 1));
            } else {
                return methods.initialize.apply(this, arguments);
            }
        };
    })();
})(window.jQuery);

function Header() {
    var self = this;
    $.extend(self, {
        menus: {
            "user": {
                selector: $('#userSubMenu'),
                visible: {
                    right: 0
                },
                offset: 0,
                offsetDirection: 'right',
                buttonSelector: $('a#userNavLink'),
                hidden: {
                    right: -600
                }
            },
            "deal": {
                selector: $('#dealCategoryMenu'),
                visible: {
                    left: -12
                },
                offset: 200,
                offsetDirection: 'left',
                buttonSelector: $('a#dealMenuButton'),
                hidden: {
                    left: -600
                }
            },
            "coupon": {
                selector: $('#couponCategoryMenu'),
                visible: {
                    left: -12
                },
                offset: 250,
                offsetDirection: 'left',
                buttonSelector: $('a#couponMenuButton'),
                hidden: {
                    left: -600
                }
            },
            "blog": {
                selector: $('#blogMenu'),
                visible: {
                    left: -12
                },
                offset: 250,
                offsetDirection: 'left',
                buttonSelector: $('a#blogMenuButton'),
                hidden: {
                    left: -600
                }
            },
            "category": {
                selector: $('#categoryMenu'),
                visible: {
                    left: -12
                },
                offset: 0,
                offsetDirection: 'left',
                buttonSelector: $('a#menuButtonMore'),
                hidden: {
                    left: -600
                }
            }
        },
        init: function() {
            self.setUpTypeAhead();
            self.registerEvents();
            self.registerBodyEvents();
            $(window).resize(self.registerEvents);
        },
        registerEvents: function() {
            if (self.isMobile()) {
                $('#menuButton').off();
                $('#menuButton').on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.toggleMenu(e, self.menus.category);
                });
                $('#categoryMenu').off('hover');
                $('#userNavLink, #userSubMenu').off();
                $('#userNavLink').on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.toggleMenu(e, self.menus.user);
                });
                $('.menuMask').off();
                $('.menuMask').on('click', self.hideMenus);
            } else {
                $('#menuButtonMore, #categoryMenu').off();
                $('#menuButtonMore, #categoryMenu').on('hover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var forceHide = (e.type == 'mouseleave');
                    self.toggleMenu(e, self.menus.category, forceHide);
                });
                $('#menuButtonMore').on('click', function(e) {
                    return false;
                });
                $('#menuButton').off('click');
                $('#dealMenuButton, #dealCategoryMenu').off();
                $('#dealMenuButton, #dealCategoryMenu').on('hover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var forceHide = (e.type == 'mouseleave');
                    self.toggleMenu(e, self.menus.deal, forceHide);
                });
                $('#couponMenuButton, #couponCategoryMenu').off();
                $('#couponMenuButton, #couponCategoryMenu').on('hover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var forceHide = (e.type == 'mouseleave');
                    self.toggleMenu(e, self.menus.coupon, forceHide);
                });
                $('#blogMenuButton, #blogMenu').off();
                $('#blogMenuButton, #blogMenu').on('hover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var forceHide = (e.type == 'mouseleave');
                    self.toggleMenu(e, self.menus.blog, forceHide);
                });
                $('#userNavLink, #userSubMenu').off();
                $('#userNavLink, #userSubMenu').on('hover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    $(this).off('click');
                    var forceHide = (e.type == 'mouseleave');
                    self.toggleMenu(e, self.menus.user, forceHide);
                });
                $('.menuMask').off();
            }
           /* $('#mainLoginButton, #mainRegisterButton, #loginButton').click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                new LoginDialog();
            });*/
        },
        registerBodyEvents: function() {
            $('body').on('click', '#addDealLink, #addLinkLink', self.showURL).on('click', '#addToDPBack', self.showDPButtons).on('submit', '#addToDPUrlForm', self.getWebsiteInfo).on('click', '.deals-accordion-toggle, .coupons-accordion-toggle', self.toggleAccordion).on('click', '.closeCategoryAccordion', function(e) {
                self.toggleMenu(e, self.menus.category, true)
            });
        },
        toggleAccordion: function() {
            $(this).parent().find('.accordion-links').slideToggle();
            $(this).find('span').toggleClass('icon-font-down icon-font-up');
        },
        isMobile: function() {
            return $(window).width() <= 785;
        },
        toggleMenu: function(e, menu, forceHide) {
            forceHide = forceHide || false;
            $('.menu').each(function() {
                if ("#" + $(this).attr('id') != menu.selector.selector) {
                    $(this).removeClass('visible').hide();
                }
            });
            if (menu.selector.hasClass('visible') || forceHide) {
                menu.selector.removeClass('visible');
                if (self.isMobile()) {
                    menu.selector.animate(menu.hidden, {
                        duration: 300,
                        queue: false,
                        complete: function() {
                            if (!menu.selector.hasClass('visible')) {
                                menu.selector.hide();
                            }
                        }
                    });
                } else {
                    menu.selector.hide();
                }
                if (!$('.menu.visible').length) {
                    $('.menuMask').hide();
                }
            } else {
                menu.selector.addClass('visible').show();
                if (self.isMobile()) {
                    menu.selector.animate(menu.visible, {
                        duration: 300,
                        queue: false
                    });
                }
                $('.menuMask').show();
            }
        },
        hideMenus: function(e) {
            var target = $(e.target);
            if (target.hasClass('menu') || target.parents('.menu').length) {
                return;
            }
            $.each(self.menus, function(key, menu) {
                self.toggleMenu(e, menu, true);
            });
        },
        setUpTypeAhead: function() {
            $('.searchInput').each(function() {
                var $this = $(this);
                $this.typeahead([{
                    name: 'deals',
                    limit: 20,
                    engine: {
                        compile: function(template) {
                            return {
                                render: function(context) {
                                    return template.replace(/\{\{(\w+)\}\}/g, function(match, p1) {
                                        return jQuery('<div/>').html(context[p1] || '').html();
                                    });
                                }
                            }
                        }
                    },
                    template: '<div class="autoCompleteRow"><div class="autoCompleteLeft">{{display}}</div><div class="autoCompleteRight {{type}}">{{type}}</div></div>',
                    remote: '/Search/autoComplete?q=%QUERY'
                }]).on('typeahead:selected', function(e, datum) {
                    if (typeof datum !== 'undefined') {
                        if (datum.url) {
                            window.location = datum.url;
                            $.post("/Search/updateStoreSearchTotal", {
                                id: datum.id
                            });
                            return;
                        }
                    }
                    $this.parents('form:first').submit();
                });
            });
        },
        showURL: function(e) {
            var type = $(this).attr('data-type');
            if (!type) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            $('#addToDPSubmitType').val(type);
            $('#addToDPButtons').hide();
            $('#addToDPUrl').show();
            $('#addToDPSubmitURL').focus();
        },
        showDPButtons: function() {
            $('#addToDPButtons').show();
            $('#addToDPUrl').hide();
        },
        getWebsiteInfo: function() {
            var urlInput = $('#addToDPSubmitURL');
            var url = urlInput.val();
            var type = $('#addToDPSubmitType').val();
            var interestId = $('#addToDPSubmitButton').attr('data-interest-id');
            if (interestId) {
                var interestString = '?interestId=' + interestId;
            } else {
                var interestString = '';
            }
            var error = $('#addToDPUrlError');
            if (!url) {
                error.text('A URL is required to continue.').show();
                urlInput.focus();
                return;
            }
            error.hide();
            var dpURL = $('#addToDPUrl');
            var dpLoader = $('#addToDPLoader');
            dpURL.hide();
            dpLoader.show();
            var timer = setTimeout(function() {
                dpLoader.find('.loadingText').hide();
                dpLoader.find('.skipContainer').show();
            }, 10000);
            $.get('/Submit/getProduct' + interestString, {
                url: url,
                type: type
            }, function(res) {
                clearTimeout(timer);
                dpLoader.find('.loadingText').show();
                dpLoader.find('.skipContainer').hide();
                if (res.error) {
                    if (res.errorCode == 200) {
                        window.location = res.data;
                        return;
                    }
                    dpLoader.hide();
                    dpURL.show();
                    error.html(res.errorMessage).show();
                } else {
                    if (res.data) {
                        window.location = res.data;
                    } else {
                        dpLoader.hide();
                        dpURL.show();
                        error.text('Something went wrong. Please try again later.').show();
                    }
                }
            });
        }
    });
    self.init();
}
$(document).ready(function() {
    new Header();
});
! function(t) {
    function e() {}

    function i(t) {
        function i(e) {
            e.prototype.option || (e.prototype.option = function(e) {
                t.isPlainObject(e) && (this.options = t.extend(!0, this.options, e))
            })
        }

        function o(e, i) {
            t.fn[e] = function(o) {
                if ("string" == typeof o) {
                    for (var s = n.call(arguments, 1), a = 0, l = this.length; l > a; a++) {
                        var c = this[a],
                            h = t.data(c, e);
                        if (h)
                            if (t.isFunction(h[o]) && "_" !== o.charAt(0)) {
                                var p = h[o].apply(h, s);
                                if (void 0 !== p) return p
                            } else r("no such method '" + o + "' for " + e + " instance");
                        else r("cannot call methods on " + e + " prior to initialization; attempted to call '" + o + "'")
                    }
                    return this
                }
                return this.each(function() {
                    var n = t.data(this, e);
                    n ? (n.option(o), n._init()) : (n = new i(this, o), t.data(this, e, n))
                })
            }
        }
        if (t) {
            var r = "undefined" == typeof console ? e : function(t) {
                console.error(t)
            };
            return t.bridget = function(t, e) {
                i(e), o(t, e)
            }, t.bridget
        }
    }
    var n = Array.prototype.slice;
    "function" == typeof define && define.amd ? define("jquery-bridget/jquery.bridget", ["jquery"], i) : i("object" == typeof exports ? require("jquery") : t.jQuery)
}(window),
function(t) {
    function e(t) {
        return new RegExp("(^|\\s+)" + t + "(\\s+|$)")
    }

    function i(t, e) {
        var i = n(t, e) ? r : o;
        i(t, e)
    }
    var n, o, r;
    "classList" in document.documentElement ? (n = function(t, e) {
        return t.classList.contains(e)
    }, o = function(t, e) {
        t.classList.add(e)
    }, r = function(t, e) {
        t.classList.remove(e)
    }) : (n = function(t, i) {
        return e(i).test(t.className)
    }, o = function(t, e) {
        n(t, e) || (t.className = t.className + " " + e)
    }, r = function(t, i) {
        t.className = t.className.replace(e(i), " ")
    });
    var s = {
        hasClass: n,
        addClass: o,
        removeClass: r,
        toggleClass: i,
        has: n,
        add: o,
        remove: r,
        toggle: i
    };
    "function" == typeof define && define.amd ? define("classie/classie", s) : "object" == typeof exports ? module.exports = s : t.classie = s
}(window),
function() {
    function t() {}

    function e(t, e) {
        for (var i = t.length; i--;)
            if (t[i].listener === e) return i;
        return -1
    }

    function i(t) {
        return function() {
            return this[t].apply(this, arguments)
        }
    }
    var n = t.prototype,
        o = this,
        r = o.EventEmitter;
    n.getListeners = function(t) {
        var e, i, n = this._getEvents();
        if (t instanceof RegExp) {
            e = {};
            for (i in n) n.hasOwnProperty(i) && t.test(i) && (e[i] = n[i])
        } else e = n[t] || (n[t] = []);
        return e
    }, n.flattenListeners = function(t) {
        var e, i = [];
        for (e = 0; e < t.length; e += 1) i.push(t[e].listener);
        return i
    }, n.getListenersAsObject = function(t) {
        var e, i = this.getListeners(t);
        return i instanceof Array && (e = {}, e[t] = i), e || i
    }, n.addListener = function(t, i) {
        var n, o = this.getListenersAsObject(t),
            r = "object" == typeof i;
        for (n in o) o.hasOwnProperty(n) && -1 === e(o[n], i) && o[n].push(r ? i : {
            listener: i,
            once: !1
        });
        return this
    }, n.on = i("addListener"), n.addOnceListener = function(t, e) {
        return this.addListener(t, {
            listener: e,
            once: !0
        })
    }, n.once = i("addOnceListener"), n.defineEvent = function(t) {
        return this.getListeners(t), this
    }, n.defineEvents = function(t) {
        for (var e = 0; e < t.length; e += 1) this.defineEvent(t[e]);
        return this
    }, n.removeListener = function(t, i) {
        var n, o, r = this.getListenersAsObject(t);
        for (o in r) r.hasOwnProperty(o) && (n = e(r[o], i), -1 !== n && r[o].splice(n, 1));
        return this
    }, n.off = i("removeListener"), n.addListeners = function(t, e) {
        return this.manipulateListeners(!1, t, e)
    }, n.removeListeners = function(t, e) {
        return this.manipulateListeners(!0, t, e)
    }, n.manipulateListeners = function(t, e, i) {
        var n, o, r = t ? this.removeListener : this.addListener,
            s = t ? this.removeListeners : this.addListeners;
        if ("object" != typeof e || e instanceof RegExp)
            for (n = i.length; n--;) r.call(this, e, i[n]);
        else
            for (n in e) e.hasOwnProperty(n) && (o = e[n]) && ("function" == typeof o ? r.call(this, n, o) : s.call(this, n, o));
        return this
    }, n.removeEvent = function(t) {
        var e, i = typeof t,
            n = this._getEvents();
        if ("string" === i) delete n[t];
        else if (t instanceof RegExp)
            for (e in n) n.hasOwnProperty(e) && t.test(e) && delete n[e];
        else delete this._events;
        return this
    }, n.removeAllListeners = i("removeEvent"), n.emitEvent = function(t, e) {
        var i, n, o, r, s = this.getListenersAsObject(t);
        for (o in s)
            if (s.hasOwnProperty(o))
                for (n = s[o].length; n--;) i = s[o][n], i.once === !0 && this.removeListener(t, i.listener), r = i.listener.apply(this, e || []), r === this._getOnceReturnValue() && this.removeListener(t, i.listener);
        return this
    }, n.trigger = i("emitEvent"), n.emit = function(t) {
        var e = Array.prototype.slice.call(arguments, 1);
        return this.emitEvent(t, e)
    }, n.setOnceReturnValue = function(t) {
        return this._onceReturnValue = t, this
    }, n._getOnceReturnValue = function() {
        return this.hasOwnProperty("_onceReturnValue") ? this._onceReturnValue : !0
    }, n._getEvents = function() {
        return this._events || (this._events = {})
    }, t.noConflict = function() {
        return o.EventEmitter = r, t
    }, "function" == typeof define && define.amd ? define("eventEmitter/EventEmitter", [], function() {
        return t
    }) : "object" == typeof module && module.exports ? module.exports = t : o.EventEmitter = t
}.call(this),
    function(t) {
        function e(e) {
            var i = t.event;
            return i.target = i.target || i.srcElement || e, i
        }
        var i = document.documentElement,
            n = function() {};
        i.addEventListener ? n = function(t, e, i) {
            t.addEventListener(e, i, !1)
        } : i.attachEvent && (n = function(t, i, n) {
            t[i + n] = n.handleEvent ? function() {
                var i = e(t);
                n.handleEvent.call(n, i)
            } : function() {
                var i = e(t);
                n.call(t, i)
            }, t.attachEvent("on" + i, t[i + n])
        });
        var o = function() {};
        i.removeEventListener ? o = function(t, e, i) {
            t.removeEventListener(e, i, !1)
        } : i.detachEvent && (o = function(t, e, i) {
            t.detachEvent("on" + e, t[e + i]);
            try {
                delete t[e + i]
            } catch (n) {
                t[e + i] = void 0
            }
        });
        var r = {
            bind: n,
            unbind: o
        };
        "function" == typeof define && define.amd ? define("eventie/eventie", r) : "object" == typeof exports ? module.exports = r : t.eventie = r
    }(window),
    function(t) {
        function e(t) {
            if (t) {
                if ("string" == typeof n[t]) return t;
                t = t.charAt(0).toUpperCase() + t.slice(1);
                for (var e, o = 0, r = i.length; r > o; o++)
                    if (e = i[o] + t, "string" == typeof n[e]) return e
            }
        }
        var i = "Webkit Moz ms Ms O".split(" "),
            n = document.documentElement.style;
        "function" == typeof define && define.amd ? define("get-style-property/get-style-property", [], function() {
            return e
        }) : "object" == typeof exports ? module.exports = e : t.getStyleProperty = e
    }(window),
    function(t) {
        function e(t) {
            var e = parseFloat(t),
                i = -1 === t.indexOf("%") && !isNaN(e);
            return i && e
        }

        function i() {}

        function n() {
            for (var t = {
                    width: 0,
                    height: 0,
                    innerWidth: 0,
                    innerHeight: 0,
                    outerWidth: 0,
                    outerHeight: 0
                }, e = 0, i = s.length; i > e; e++) {
                var n = s[e];
                t[n] = 0
            }
            return t
        }

        function o(i) {
            function o() {
                if (!d) {
                    d = !0;
                    var n = t.getComputedStyle;
                    if (c = function() {
                            var t = n ? function(t) {
                                return n(t, null)
                            } : function(t) {
                                return t.currentStyle
                            };
                            return function(e) {
                                var i = t(e);
                                return i || r("Style returned " + i + ". Are you running this code in a hidden iframe on Firefox? See http://bit.ly/getsizebug1"), i
                            }
                        }(), h = i("boxSizing")) {
                        var o = document.createElement("div");
                        o.style.width = "200px", o.style.padding = "1px 2px 3px 4px", o.style.borderStyle = "solid", o.style.borderWidth = "1px 2px 3px 4px", o.style[h] = "border-box";
                        var s = document.body || document.documentElement;
                        s.appendChild(o);
                        var a = c(o);
                        p = 200 === e(a.width), s.removeChild(o)
                    }
                }
            }

            function a(t) {
                if (o(), "string" == typeof t && (t = document.querySelector(t)), t && "object" == typeof t && t.nodeType) {
                    var i = c(t);
                    if ("none" === i.display) return n();
                    var r = {};
                    r.width = t.offsetWidth, r.height = t.offsetHeight;
                    for (var a = r.isBorderBox = !(!h || !i[h] || "border-box" !== i[h]), d = 0, u = s.length; u > d; d++) {
                        var f = s[d],
                            v = i[f];
                        v = l(t, v);
                        var y = parseFloat(v);
                        r[f] = isNaN(y) ? 0 : y
                    }
                    var g = r.paddingLeft + r.paddingRight,
                        m = r.paddingTop + r.paddingBottom,
                        b = r.marginLeft + r.marginRight,
                        S = r.marginTop + r.marginBottom,
                        x = r.borderLeftWidth + r.borderRightWidth,
                        w = r.borderTopWidth + r.borderBottomWidth,
                        C = a && p,
                        E = e(i.width);
                    E !== !1 && (r.width = E + (C ? 0 : g + x));
                    var P = e(i.height);
                    return P !== !1 && (r.height = P + (C ? 0 : m + w)), r.innerWidth = r.width - (g + x), r.innerHeight = r.height - (m + w), r.outerWidth = r.width + b, r.outerHeight = r.height + S, r
                }
            }

            function l(e, i) {
                if (t.getComputedStyle || -1 === i.indexOf("%")) return i;
                var n = e.style,
                    o = n.left,
                    r = e.runtimeStyle,
                    s = r && r.left;
                return s && (r.left = e.currentStyle.left), n.left = i, i = n.pixelLeft, n.left = o, s && (r.left = s), i
            }
            var c, h, p, d = !1;
            return a
        }
        var r = "undefined" == typeof console ? i : function(t) {
                console.error(t)
            },
            s = ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "marginLeft", "marginRight", "marginTop", "marginBottom", "borderLeftWidth", "borderRightWidth", "borderTopWidth", "borderBottomWidth"];
        "function" == typeof define && define.amd ? define("get-size/get-size", ["get-style-property/get-style-property"], o) : "object" == typeof exports ? module.exports = o(require("desandro-get-style-property")) : t.getSize = o(t.getStyleProperty)
    }(window),
    function(t) {
        function e(t) {
            "function" == typeof t && (e.isReady ? t() : s.push(t))
        }

        function i(t) {
            var i = "readystatechange" === t.type && "complete" !== r.readyState;
            e.isReady || i || n()
        }

        function n() {
            e.isReady = !0;
            for (var t = 0, i = s.length; i > t; t++) {
                var n = s[t];
                n()
            }
        }

        function o(o) {
            return "complete" === r.readyState ? n() : (o.bind(r, "DOMContentLoaded", i), o.bind(r, "readystatechange", i), o.bind(t, "load", i)), e
        }
        var r = t.document,
            s = [];
        e.isReady = !1, "function" == typeof define && define.amd ? define("doc-ready/doc-ready", ["eventie/eventie"], o) : "object" == typeof exports ? module.exports = o(require("eventie")) : t.docReady = o(t.eventie)
    }(window),
    function(t) {
        function e(t, e) {
            return t[s](e)
        }

        function i(t) {
            if (!t.parentNode) {
                var e = document.createDocumentFragment();
                e.appendChild(t)
            }
        }

        function n(t, e) {
            i(t);
            for (var n = t.parentNode.querySelectorAll(e), o = 0, r = n.length; r > o; o++)
                if (n[o] === t) return !0;
            return !1
        }

        function o(t, n) {
            return i(t), e(t, n)
        }
        var r, s = function() {
            if (t.matches) return "matches";
            if (t.matchesSelector) return "matchesSelector";
            for (var e = ["webkit", "moz", "ms", "o"], i = 0, n = e.length; n > i; i++) {
                var o = e[i],
                    r = o + "MatchesSelector";
                if (t[r]) return r
            }
        }();
        if (s) {
            var a = document.createElement("div"),
                l = e(a, "div");
            r = l ? e : o
        } else r = n;
        "function" == typeof define && define.amd ? define("matches-selector/matches-selector", [], function() {
            return r
        }) : "object" == typeof exports ? module.exports = r : window.matchesSelector = r
    }(Element.prototype),
    function(t, e) {
        "function" == typeof define && define.amd ? define("fizzy-ui-utils/utils", ["doc-ready/doc-ready", "matches-selector/matches-selector"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("doc-ready"), require("desandro-matches-selector")) : t.fizzyUIUtils = e(t, t.docReady, t.matchesSelector)
    }(window, function(t, e, i) {
        var n = {};
        n.extend = function(t, e) {
            for (var i in e) t[i] = e[i];
            return t
        }, n.modulo = function(t, e) {
            return (t % e + e) % e
        };
        var o = Object.prototype.toString;
        n.isArray = function(t) {
            return "[object Array]" == o.call(t)
        }, n.makeArray = function(t) {
            var e = [];
            if (n.isArray(t)) e = t;
            else if (t && "number" == typeof t.length)
                for (var i = 0, o = t.length; o > i; i++) e.push(t[i]);
            else e.push(t);
            return e
        }, n.indexOf = Array.prototype.indexOf ? function(t, e) {
            return t.indexOf(e)
        } : function(t, e) {
            for (var i = 0, n = t.length; n > i; i++)
                if (t[i] === e) return i;
            return -1
        }, n.removeFrom = function(t, e) {
            var i = n.indexOf(t, e); - 1 != i && t.splice(i, 1)
        }, n.isElement = "function" == typeof HTMLElement || "object" == typeof HTMLElement ? function(t) {
            return t instanceof HTMLElement
        } : function(t) {
            return t && "object" == typeof t && 1 == t.nodeType && "string" == typeof t.nodeName
        }, n.setText = function() {
            function t(t, i) {
                e = e || (void 0 !== document.documentElement.textContent ? "textContent" : "innerText"), t[e] = i
            }
            var e;
            return t
        }(), n.getParent = function(t, e) {
            for (; t != document.body;)
                if (t = t.parentNode, i(t, e)) return t
        }, n.getQueryElement = function(t) {
            return "string" == typeof t ? document.querySelector(t) : t
        }, n.handleEvent = function(t) {
            var e = "on" + t.type;
            this[e] && this[e](t)
        }, n.filterFindElements = function(t, e) {
            t = n.makeArray(t);
            for (var o = [], r = 0, s = t.length; s > r; r++) {
                var a = t[r];
                if (n.isElement(a))
                    if (e) {
                        i(a, e) && o.push(a);
                        for (var l = a.querySelectorAll(e), c = 0, h = l.length; h > c; c++) o.push(l[c])
                    } else o.push(a)
            }
            return o
        }, n.debounceMethod = function(t, e, i) {
            var n = t.prototype[e],
                o = e + "Timeout";
            t.prototype[e] = function() {
                var t = this[o];
                t && clearTimeout(t);
                var e = arguments,
                    r = this;
                this[o] = setTimeout(function() {
                    n.apply(r, e), delete r[o]
                }, i || 100)
            }
        }, n.toDashed = function(t) {
            return t.replace(/(.)([A-Z])/g, function(t, e, i) {
                return e + "-" + i
            }).toLowerCase()
        };
        var r = t.console;
        return n.htmlInit = function(i, o) {
            e(function() {
                for (var e = n.toDashed(o), s = document.querySelectorAll(".js-" + e), a = "data-" + e + "-options", l = 0, c = s.length; c > l; l++) {
                    var h, p = s[l],
                        d = p.getAttribute(a);
                    try {
                        h = d && JSON.parse(d)
                    } catch (u) {
                        r && r.error("Error parsing " + a + " on " + p.nodeName.toLowerCase() + (p.id ? "#" + p.id : "") + ": " + u);
                        continue
                    }
                    var f = new i(p, h),
                        v = t.jQuery;
                    v && v.data(p, o, f)
                }
            })
        }, n
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/cell", ["get-size/get-size"], function(i) {
            return e(t, i)
        }) : "object" == typeof exports ? module.exports = e(t, require("get-size")) : (t.Flickity = t.Flickity || {}, t.Flickity.Cell = e(t, t.getSize))
    }(window, function(t, e) {
        function i(t, e) {
            this.element = t, this.parent = e, this.create()
        }
        var n = "attachEvent" in t;
        return i.prototype.create = function() {
            this.element.style.position = "absolute", n && this.element.setAttribute("unselectable", "on"), this.x = 0, this.shift = 0
        }, i.prototype.destroy = function() {
            this.element.style.position = "";
            var t = this.parent.originSide;
            this.element.style[t] = ""
        }, i.prototype.getSize = function() {
            this.size = e(this.element)
        }, i.prototype.setPosition = function(t) {
            this.x = t, this.setDefaultTarget(), this.renderPosition(t)
        }, i.prototype.setDefaultTarget = function() {
            var t = "left" == this.parent.originSide ? "marginLeft" : "marginRight";
            this.target = this.x + this.size[t] + this.size.width * this.parent.cellAlign
        }, i.prototype.renderPosition = function(t) {
            var e = this.parent.originSide;
            this.element.style[e] = this.parent.getPositionValue(t)
        }, i.prototype.wrapShift = function(t) {
            this.shift = t, this.renderPosition(this.x + this.parent.slideableWidth * t)
        }, i.prototype.remove = function() {
            this.element.parentNode.removeChild(this.element)
        }, i
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/animate", ["get-style-property/get-style-property", "fizzy-ui-utils/utils"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("desandro-get-style-property"), require("fizzy-ui-utils")) : (t.Flickity = t.Flickity || {}, t.Flickity.animatePrototype = e(t, t.getStyleProperty, t.fizzyUIUtils))
    }(window, function(t, e, i) {
        for (var n, o = 0, r = "webkit moz ms o".split(" "), s = t.requestAnimationFrame, a = t.cancelAnimationFrame, l = 0; l < r.length && (!s || !a); l++) n = r[l], s = s || t[n + "RequestAnimationFrame"], a = a || t[n + "CancelAnimationFrame"] || t[n + "CancelRequestAnimationFrame"];
        s && a || (s = function(e) {
            var i = (new Date).getTime(),
                n = Math.max(0, 16 - (i - o)),
                r = t.setTimeout(function() {
                    e(i + n)
                }, n);
            return o = i + n, r
        }, a = function(e) {
            t.clearTimeout(e)
        });
        var c = {};
        c.startAnimation = function() {
            this.isAnimating || (this.isAnimating = !0, this.restingFrames = 0, this.animate())
        }, c.animate = function() {
            this.applyDragForce(), this.applySelectedAttraction();
            var t = this.x;
            if (this.integratePhysics(), this.positionSlider(), this.settle(t), this.isAnimating) {
                var e = this;
                s(function() {
                    e.animate()
                })
            }
        };
        var h = e("transform"),
            p = !!e("perspective");
        return c.positionSlider = function() {
            var t = this.x;
            this.options.wrapAround && this.cells.length > 1 && (t = i.modulo(t, this.slideableWidth), t -= this.slideableWidth, this.shiftWrapCells(t)), t += this.cursorPosition, t = this.options.rightToLeft && h ? -t : t;
            var e = this.getPositionValue(t);
            h ? this.slider.style[h] = p && this.isAnimating ? "translate3d(" + e + ",0,0)" : "translateX(" + e + ")" : this.slider.style[this.originSide] = e
        }, c.positionSliderAtSelected = function() {
            if (this.cells.length) {
                var t = this.cells[this.selectedIndex];
                this.x = -t.target, this.positionSlider()
            }
        }, c.getPositionValue = function(t) {
            return this.options.percentPosition ? .01 * Math.round(t / this.size.innerWidth * 1e4) + "%" : Math.round(t) + "px"
        }, c.settle = function(t) {
            this.isPointerDown || Math.round(100 * this.x) != Math.round(100 * t) || this.restingFrames++, this.restingFrames > 2 && (this.isAnimating = !1, delete this.isFreeScrolling, p && this.positionSlider(), this.dispatchEvent("settle"))
        }, c.shiftWrapCells = function(t) {
            var e = this.cursorPosition + t;
            this._shiftCells(this.beforeShiftCells, e, -1);
            var i = this.size.innerWidth - (t + this.slideableWidth + this.cursorPosition);
            this._shiftCells(this.afterShiftCells, i, 1)
        }, c._shiftCells = function(t, e, i) {
            for (var n = 0, o = t.length; o > n; n++) {
                var r = t[n],
                    s = e > 0 ? i : 0;
                r.wrapShift(s), e -= r.size.outerWidth
            }
        }, c._unshiftCells = function(t) {
            if (t && t.length)
                for (var e = 0, i = t.length; i > e; e++) t[e].wrapShift(0)
        }, c.integratePhysics = function() {
            this.velocity += this.accel, this.x += this.velocity, this.velocity *= this.getFrictionFactor(), this.accel = 0
        }, c.applyForce = function(t) {
            this.accel += t
        }, c.getFrictionFactor = function() {
            return 1 - this.options[this.isFreeScrolling ? "freeScrollFriction" : "friction"]
        }, c.getRestingPosition = function() {
            return this.x + this.velocity / (1 - this.getFrictionFactor())
        }, c.applyDragForce = function() {
            if (this.isPointerDown) {
                var t = this.dragX - this.x,
                    e = t - this.velocity;
                this.applyForce(e)
            }
        }, c.applySelectedAttraction = function() {
            var t = this.cells.length;
            if (!this.isPointerDown && !this.isFreeScrolling && t) {
                var e = this.cells[this.selectedIndex],
                    i = this.options.wrapAround && t > 1 ? this.slideableWidth * Math.floor(this.selectedIndex / t) : 0,
                    n = -1 * (e.target + i) - this.x,
                    o = n * this.options.selectedAttraction;
                this.applyForce(o)
            }
        }, c
    }),
    function(t, e) {
        if ("function" == typeof define && define.amd) define("flickity/js/flickity", ["classie/classie", "eventEmitter/EventEmitter", "eventie/eventie", "get-size/get-size", "fizzy-ui-utils/utils", "./cell", "./animate"], function(i, n, o, r, s, a, l) {
            return e(t, i, n, o, r, s, a, l)
        });
        else if ("object" == typeof exports) module.exports = e(t, require("desandro-classie"), require("wolfy87-eventemitter"), require("eventie"), require("get-size"), require("fizzy-ui-utils"), require("./cell"), require("./animate"));
        else {
            var i = t.Flickity;
            t.Flickity = e(t, t.classie, t.EventEmitter, t.eventie, t.getSize, t.fizzyUIUtils, i.Cell, i.animatePrototype)
        }
    }(window, function(t, e, i, n, o, r, s, a) {
        function l(t, e) {
            for (t = r.makeArray(t); t.length;) e.appendChild(t.shift())
        }

        function c(t, e) {
            var i = r.getQueryElement(t);
            return i ? (this.element = i, h && (this.$element = h(this.element)), this.options = r.extend({}, this.constructor.defaults), this.option(e), void this._create()) : void(d && d.error("Bad element for Flickity: " + (i || t)))
        }
        var h = t.jQuery,
            p = t.getComputedStyle,
            d = t.console,
            u = 0,
            f = {};
        c.defaults = {
            accessibility: !0,
            cellAlign: "center",
            freeScrollFriction: .075,
            friction: .28,
            percentPosition: !0,
            resize: !0,
            selectedAttraction: .025,
            setGallerySize: !0
        }, c.createMethods = [], r.extend(c.prototype, i.prototype), c.prototype._create = function() {
            var e = this.guid = ++u;
            this.element.flickityGUID = e, f[e] = this, this.selectedIndex = this.options.initialIndex || 0, this.restingFrames = 0, this.x = 0, this.velocity = 0, this.accel = 0, this.originSide = this.options.rightToLeft ? "right" : "left", this.viewport = document.createElement("div"), this.viewport.className = "flickity-viewport", c.setUnselectable(this.viewport), this._createSlider(), (this.options.resize || this.options.watchCSS) && (n.bind(t, "resize", this), this.isResizeBound = !0);
            for (var i = 0, o = c.createMethods.length; o > i; i++) {
                var r = c.createMethods[i];
                this[r]()
            }
            this.options.watchCSS ? this.watchCSS() : this.activate()
        }, c.prototype.option = function(t) {
            r.extend(this.options, t)
        }, c.prototype.activate = function() {
            if (!this.isActive) {
                this.isActive = !0, e.add(this.element, "flickity-enabled"), this.options.rightToLeft && e.add(this.element, "flickity-rtl"), this.getSize();
                var t = this._filterFindCellElements(this.element.children);
                l(t, this.slider), this.viewport.appendChild(this.slider), this.element.appendChild(this.viewport), this.reloadCells(), this.options.accessibility && (this.element.tabIndex = 0, n.bind(this.element, "keydown", this)), this.emit("activate"), this.positionSliderAtSelected(), this.select(this.selectedIndex)
            }
        }, c.prototype._createSlider = function() {
            var t = document.createElement("div");
            t.className = "flickity-slider", t.style[this.originSide] = 0, this.slider = t
        }, c.prototype._filterFindCellElements = function(t) {
            return r.filterFindElements(t, this.options.cellSelector)
        }, c.prototype.reloadCells = function() {
            this.cells = this._makeCells(this.slider.children), this.positionCells(), this._getWrapShiftCells(), this.setGallerySize()
        }, c.prototype._makeCells = function(t) {
            for (var e = this._filterFindCellElements(t), i = [], n = 0, o = e.length; o > n; n++) {
                var r = e[n],
                    a = new s(r, this);
                i.push(a)
            }
            return i
        }, c.prototype.getLastCell = function() {
            return this.cells[this.cells.length - 1]
        }, c.prototype.positionCells = function() {
            this._sizeCells(this.cells), this._positionCells(0)
        }, c.prototype._positionCells = function(t) {
            t = t || 0, this.maxCellHeight = t ? this.maxCellHeight || 0 : 0;
            var e = 0;
            if (t > 0) {
                var i = this.cells[t - 1];
                e = i.x + i.size.outerWidth
            }
            for (var n, o = this.cells.length, r = t; o > r; r++) n = this.cells[r], n.setPosition(e), e += n.size.outerWidth, this.maxCellHeight = Math.max(n.size.outerHeight, this.maxCellHeight);
            this.slideableWidth = e, this._containCells()
        }, c.prototype._sizeCells = function(t) {
            for (var e = 0, i = t.length; i > e; e++) {
                var n = t[e];
                n.getSize()
            }
        }, c.prototype._init = c.prototype.reposition = function() {
            this.positionCells(), this.positionSliderAtSelected()
        }, c.prototype.getSize = function() {
            this.size = o(this.element), this.setCellAlign(), this.cursorPosition = this.size.innerWidth * this.cellAlign
        };
        var v = {
            center: {
                left: .5,
                right: .5
            },
            left: {
                left: 0,
                right: 1
            },
            right: {
                right: 0,
                left: 1
            }
        };
        c.prototype.setCellAlign = function() {
            var t = v[this.options.cellAlign];
            this.cellAlign = t ? t[this.originSide] : this.options.cellAlign
        }, c.prototype.setGallerySize = function() {
            this.options.setGallerySize && (this.viewport.style.height = this.maxCellHeight + "px")
        }, c.prototype._getWrapShiftCells = function() {
            if (this.options.wrapAround) {
                this._unshiftCells(this.beforeShiftCells), this._unshiftCells(this.afterShiftCells);
                var t = this.cursorPosition,
                    e = this.cells.length - 1;
                this.beforeShiftCells = this._getGapCells(t, e, -1), t = this.size.innerWidth - this.cursorPosition, this.afterShiftCells = this._getGapCells(t, 0, 1)
            }
        }, c.prototype._getGapCells = function(t, e, i) {
            for (var n = []; t > 0;) {
                var o = this.cells[e];
                if (!o) break;
                n.push(o), e += i, t -= o.size.outerWidth
            }
            return n
        }, c.prototype._containCells = function() {
            if (this.options.contain && !this.options.wrapAround && this.cells.length)
                for (var t = this.options.rightToLeft ? "marginRight" : "marginLeft", e = this.options.rightToLeft ? "marginLeft" : "marginRight", i = this.cells[0].size[t], n = this.getLastCell(), o = this.slideableWidth - n.size[e], r = o - this.size.innerWidth * (1 - this.cellAlign), s = o < this.size.innerWidth, a = 0, l = this.cells.length; l > a; a++) {
                    var c = this.cells[a];
                    c.setDefaultTarget(), s ? c.target = o * this.cellAlign : (c.target = Math.max(c.target, this.cursorPosition + i), c.target = Math.min(c.target, r))
                }
        }, c.prototype.dispatchEvent = function(t, e, i) {
            var n = [e].concat(i);
            if (this.emitEvent(t, n), h && this.$element)
                if (e) {
                    var o = h.Event(e);
                    o.type = t, this.$element.trigger(o, i)
                } else this.$element.trigger(t, i)
        }, c.prototype.select = function(t, e) {
            if (this.isActive) {
                var i = this.cells.length;
                this.options.wrapAround && i > 1 && (0 > t ? this.x -= this.slideableWidth : t >= i && (this.x += this.slideableWidth)), (this.options.wrapAround || e) && (t = r.modulo(t, i)), this.cells[t] && (this.selectedIndex = t, this.setSelectedCell(), this.startAnimation(), this.dispatchEvent("cellSelect"))
            }
        }, c.prototype.previous = function(t) {
            this.select(this.selectedIndex - 1, t)
        }, c.prototype.next = function(t) {
            this.select(this.selectedIndex + 1, t)
        }, c.prototype.setSelectedCell = function() {
            this._removeSelectedCellClass(), this.selectedCell = this.cells[this.selectedIndex], this.selectedElement = this.selectedCell.element, e.add(this.selectedElement, "is-selected")
        }, c.prototype._removeSelectedCellClass = function() {
            this.selectedCell && e.remove(this.selectedCell.element, "is-selected")
        }, c.prototype.getCell = function(t) {
            for (var e = 0, i = this.cells.length; i > e; e++) {
                var n = this.cells[e];
                if (n.element == t) return n
            }
        }, c.prototype.getCells = function(t) {
            t = r.makeArray(t);
            for (var e = [], i = 0, n = t.length; n > i; i++) {
                var o = t[i],
                    s = this.getCell(o);
                s && e.push(s)
            }
            return e
        }, c.prototype.getCellElements = function() {
            for (var t = [], e = 0, i = this.cells.length; i > e; e++) t.push(this.cells[e].element);
            return t
        }, c.prototype.getParentCell = function(t) {
            var e = this.getCell(t);
            return e ? e : (t = r.getParent(t, ".flickity-slider > *"), this.getCell(t))
        }, c.prototype.getAdjacentCellElements = function(t, e) {
            if (!t) return [this.selectedElement];
            e = void 0 === e ? this.selectedIndex : e;
            var i = this.cells.length;
            if (1 + 2 * t >= i) return this.getCellElements();
            for (var n = [], o = e - t; e + t >= o; o++) {
                var s = this.options.wrapAround ? r.modulo(o, i) : o,
                    a = this.cells[s];
                a && n.push(a.element)
            }
            return n
        }, c.prototype.uiChange = function() {
            this.emit("uiChange")
        }, c.prototype.childUIPointerDown = function(t) {
            this.emitEvent("childUIPointerDown", [t])
        }, c.prototype.onresize = function() {
            this.watchCSS(), this.resize()
        }, r.debounceMethod(c, "onresize", 150), c.prototype.resize = function() {
            this.isActive && (this.getSize(), this.options.wrapAround && (this.x = r.modulo(this.x, this.slideableWidth)), this.positionCells(), this._getWrapShiftCells(), this.setGallerySize(), this.positionSliderAtSelected())
        };
        var y = c.supportsConditionalCSS = function() {
            var t;
            return function() {
                if (void 0 !== t) return t;
                if (!p) return void(t = !1);
                var e = document.createElement("style"),
                    i = document.createTextNode('body:after { content: "foo"; display: none; }');
                e.appendChild(i), document.head.appendChild(e);
                var n = p(document.body, ":after").content;
                return t = -1 != n.indexOf("foo"), document.head.removeChild(e), t
            }
        }();
        c.prototype.watchCSS = function() {
            var t = this.options.watchCSS;
            if (t) {
                var e = y();
                if (!e) {
                    var i = "fallbackOn" == t ? "activate" : "deactivate";
                    return void this[i]()
                }
                var n = p(this.element, ":after").content; - 1 != n.indexOf("flickity") ? this.activate() : this.deactivate()
            }
        }, c.prototype.onkeydown = function(t) {
            if (this.options.accessibility && (!document.activeElement || document.activeElement == this.element))
                if (37 == t.keyCode) {
                    var e = this.options.rightToLeft ? "next" : "previous";
                    this.uiChange(), this[e]()
                } else if (39 == t.keyCode) {
                var i = this.options.rightToLeft ? "previous" : "next";
                this.uiChange(), this[i]()
            }
        }, c.prototype.deactivate = function() {
            if (this.isActive) {
                e.remove(this.element, "flickity-enabled"), e.remove(this.element, "flickity-rtl");
                for (var t = 0, i = this.cells.length; i > t; t++) {
                    var o = this.cells[t];
                    o.destroy()
                }
                this._removeSelectedCellClass(), this.element.removeChild(this.viewport), l(this.slider.children, this.element), this.options.accessibility && (this.element.removeAttribute("tabIndex"), n.unbind(this.element, "keydown", this)), this.isActive = !1, this.emit("deactivate")
            }
        }, c.prototype.destroy = function() {
            this.deactivate(), this.isResizeBound && n.unbind(t, "resize", this), this.emit("destroy"), h && this.$element && h.removeData(this.element, "flickity"), delete this.element.flickityGUID, delete f[this.guid]
        }, r.extend(c.prototype, a);
        var g = "attachEvent" in t;
        return c.setUnselectable = function(t) {
            g && t.setAttribute("unselectable", "on")
        }, c.data = function(t) {
            t = r.getQueryElement(t);
            var e = t && t.flickityGUID;
            return e && f[e]
        }, r.htmlInit(c, "flickity"), h && h.bridget && h.bridget("flickity", c), c.Cell = s, c
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("unipointer/unipointer", ["eventEmitter/EventEmitter", "eventie/eventie"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("wolfy87-eventemitter"), require("eventie")) : t.Unipointer = e(t, t.EventEmitter, t.eventie)
    }(window, function(t, e, i) {
        function n() {}

        function o() {}
        o.prototype = new e, o.prototype.bindStartEvent = function(t) {
            this._bindStartEvent(t, !0)
        }, o.prototype.unbindStartEvent = function(t) {
            this._bindStartEvent(t, !1)
        }, o.prototype._bindStartEvent = function(e, n) {
            n = void 0 === n ? !0 : !!n;
            var o = n ? "bind" : "unbind";
            t.navigator.pointerEnabled ? i[o](e, "pointerdown", this) : t.navigator.msPointerEnabled ? i[o](e, "MSPointerDown", this) : (i[o](e, "mousedown", this), i[o](e, "touchstart", this))
        }, o.prototype.handleEvent = function(t) {
            var e = "on" + t.type;
            this[e] && this[e](t)
        }, o.prototype.getTouch = function(t) {
            for (var e = 0, i = t.length; i > e; e++) {
                var n = t[e];
                if (n.identifier == this.pointerIdentifier) return n
            }
        }, o.prototype.onmousedown = function(t) {
            var e = t.button;
            e && 0 !== e && 1 !== e || this._pointerDown(t, t)
        }, o.prototype.ontouchstart = function(t) {
            this._pointerDown(t, t.changedTouches[0])
        }, o.prototype.onMSPointerDown = o.prototype.onpointerdown = function(t) {
            this._pointerDown(t, t)
        }, o.prototype._pointerDown = function(t, e) {
            this.isPointerDown || (this.isPointerDown = !0, this.pointerIdentifier = void 0 !== e.pointerId ? e.pointerId : e.identifier, this.pointerDown(t, e))
        }, o.prototype.pointerDown = function(t, e) {
            this._bindPostStartEvents(t), this.emitEvent("pointerDown", [t, e])
        };
        var r = {
            mousedown: ["mousemove", "mouseup"],
            touchstart: ["touchmove", "touchend", "touchcancel"],
            pointerdown: ["pointermove", "pointerup", "pointercancel"],
            MSPointerDown: ["MSPointerMove", "MSPointerUp", "MSPointerCancel"]
        };
        return o.prototype._bindPostStartEvents = function(e) {
            if (e) {
                for (var n = r[e.type], o = e.preventDefault ? t : document, s = 0, a = n.length; a > s; s++) {
                    var l = n[s];
                    i.bind(o, l, this)
                }
                this._boundPointerEvents = {
                    events: n,
                    node: o
                }
            }
        }, o.prototype._unbindPostStartEvents = function() {
            var t = this._boundPointerEvents;
            if (t && t.events) {
                for (var e = 0, n = t.events.length; n > e; e++) {
                    var o = t.events[e];
                    i.unbind(t.node, o, this)
                }
                delete this._boundPointerEvents
            }
        }, o.prototype.onmousemove = function(t) {
            this._pointerMove(t, t)
        }, o.prototype.onMSPointerMove = o.prototype.onpointermove = function(t) {
            t.pointerId == this.pointerIdentifier && this._pointerMove(t, t)
        }, o.prototype.ontouchmove = function(t) {
            var e = this.getTouch(t.changedTouches);
            e && this._pointerMove(t, e)
        }, o.prototype._pointerMove = function(t, e) {
            this.pointerMove(t, e)
        }, o.prototype.pointerMove = function(t, e) {
            this.emitEvent("pointerMove", [t, e])
        }, o.prototype.onmouseup = function(t) {
            this._pointerUp(t, t)
        }, o.prototype.onMSPointerUp = o.prototype.onpointerup = function(t) {
            t.pointerId == this.pointerIdentifier && this._pointerUp(t, t)
        }, o.prototype.ontouchend = function(t) {
            var e = this.getTouch(t.changedTouches);
            e && this._pointerUp(t, e)
        }, o.prototype._pointerUp = function(t, e) {
            this._pointerDone(), this.pointerUp(t, e)
        }, o.prototype.pointerUp = function(t, e) {
            this.emitEvent("pointerUp", [t, e])
        }, o.prototype._pointerDone = function() {
            this.isPointerDown = !1, delete this.pointerIdentifier, this._unbindPostStartEvents(), this.pointerDone()
        }, o.prototype.pointerDone = n, o.prototype.onMSPointerCancel = o.prototype.onpointercancel = function(t) {
            t.pointerId == this.pointerIdentifier && this._pointerCancel(t, t)
        }, o.prototype.ontouchcancel = function(t) {
            var e = this.getTouch(t.changedTouches);
            e && this._pointerCancel(t, e)
        }, o.prototype._pointerCancel = function(t, e) {
            this._pointerDone(), this.pointerCancel(t, e)
        }, o.prototype.pointerCancel = function(t, e) {
            this.emitEvent("pointerCancel", [t, e])
        }, o.getPointerPoint = function(t) {
            return {
                x: void 0 !== t.pageX ? t.pageX : t.clientX,
                y: void 0 !== t.pageY ? t.pageY : t.clientY
            }
        }, o
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("unidragger/unidragger", ["eventie/eventie", "unipointer/unipointer"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("eventie"), require("unipointer")) : t.Unidragger = e(t, t.eventie, t.Unipointer)
    }(window, function(t, e, i) {
        function n() {}

        function o(t) {
            t.preventDefault ? t.preventDefault() : t.returnValue = !1
        }

        function r() {}

        function s() {
            return !1
        }
        r.prototype = new i, r.prototype.bindHandles = function() {
            this._bindHandles(!0)
        }, r.prototype.unbindHandles = function() {
            this._bindHandles(!1)
        };
        var a = t.navigator;
        r.prototype._bindHandles = function(t) {
            t = void 0 === t ? !0 : !!t;
            var i;
            i = a.pointerEnabled ? function(e) {
                e.style.touchAction = t ? "none" : ""
            } : a.msPointerEnabled ? function(e) {
                e.style.msTouchAction = t ? "none" : ""
            } : function() {
                t && c(s)
            };
            for (var n = t ? "bind" : "unbind", o = 0, r = this.handles.length; r > o; o++) {
                var s = this.handles[o];
                this._bindStartEvent(s, t), i(s), e[n](s, "click", this)
            }
        };
        var l = "attachEvent" in document.documentElement,
            c = l ? function(t) {
                "IMG" == t.nodeName && (t.ondragstart = s);
                for (var e = t.querySelectorAll("img"), i = 0, n = e.length; n > i; i++) {
                    var o = e[i];
                    o.ondragstart = s
                }
            } : n;
        r.prototype.pointerDown = function(i, n) {
            if ("INPUT" == i.target.nodeName && "range" == i.target.type) return this.isPointerDown = !1, void delete this.pointerIdentifier;
            this._dragPointerDown(i, n);
            var o = document.activeElement;
            o && o.blur && o.blur(), this._bindPostStartEvents(i), this.pointerDownScroll = r.getScrollPosition(), e.bind(t, "scroll", this), this.emitEvent("pointerDown", [i, n])
        }, r.prototype._dragPointerDown = function(t, e) {
            this.pointerDownPoint = i.getPointerPoint(e);
            var n = "touchstart" == t.type,
                r = t.target.nodeName;
            n || "SELECT" == r || o(t)
        }, r.prototype.pointerMove = function(t, e) {
            var i = this._dragPointerMove(t, e);
            this.emitEvent("pointerMove", [t, e, i]), this._dragMove(t, e, i)
        }, r.prototype._dragPointerMove = function(t, e) {
            var n = i.getPointerPoint(e),
                o = {
                    x: n.x - this.pointerDownPoint.x,
                    y: n.y - this.pointerDownPoint.y
                };
            return !this.isDragging && this.hasDragStarted(o) && this._dragStart(t, e), o
        }, r.prototype.hasDragStarted = function(t) {
            return Math.abs(t.x) > 3 || Math.abs(t.y) > 3
        }, r.prototype.pointerUp = function(t, e) {
            this.emitEvent("pointerUp", [t, e]), this._dragPointerUp(t, e)
        }, r.prototype._dragPointerUp = function(t, e) {
            this.isDragging ? this._dragEnd(t, e) : this._staticClick(t, e)
        }, i.prototype.pointerDone = function() {
            e.unbind(t, "scroll", this)
        }, r.prototype._dragStart = function(t, e) {
            this.isDragging = !0, this.dragStartPoint = r.getPointerPoint(e), this.isPreventingClicks = !0, this.dragStart(t, e)
        }, r.prototype.dragStart = function(t, e) {
            this.emitEvent("dragStart", [t, e])
        }, r.prototype._dragMove = function(t, e, i) {
            this.isDragging && this.dragMove(t, e, i)
        }, r.prototype.dragMove = function(t, e, i) {
            o(t), this.emitEvent("dragMove", [t, e, i])
        }, r.prototype._dragEnd = function(t, e) {
            this.isDragging = !1;
            var i = this;
            setTimeout(function() {
                delete i.isPreventingClicks
            }), this.dragEnd(t, e)
        }, r.prototype.dragEnd = function(t, e) {
            this.emitEvent("dragEnd", [t, e])
        }, r.prototype.pointerDone = function() {
            e.unbind(t, "scroll", this), delete this.pointerDownScroll
        }, r.prototype.onclick = function(t) {
            this.isPreventingClicks && o(t)
        }, r.prototype._staticClick = function(t, e) {
            if (!this.isIgnoringMouseUp || "mouseup" != t.type) {
                var i = t.target.nodeName;
                if (("INPUT" == i || "TEXTAREA" == i) && t.target.focus(), this.staticClick(t, e), "mouseup" != t.type) {
                    this.isIgnoringMouseUp = !0;
                    var n = this;
                    setTimeout(function() {
                        delete n.isIgnoringMouseUp
                    }, 400)
                }
            }
        }, r.prototype.staticClick = function(t, e) {
            this.emitEvent("staticClick", [t, e])
        }, r.prototype.onscroll = function() {
            var t = r.getScrollPosition(),
                e = this.pointerDownScroll.x - t.x,
                i = this.pointerDownScroll.y - t.y;
            (Math.abs(e) > 3 || Math.abs(i) > 3) && this._pointerDone()
        }, r.getPointerPoint = function(t) {
            return {
                x: void 0 !== t.pageX ? t.pageX : t.clientX,
                y: void 0 !== t.pageY ? t.pageY : t.clientY
            }
        };
        var h = void 0 !== t.pageYOffset;
        return r.getScrollPosition = function() {
            return {
                x: h ? t.pageXOffset : document.body.scrollLeft,
                y: h ? t.pageYOffset : document.body.scrollTop
            }
        }, r.getPointerPoint = i.getPointerPoint, r
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/drag", ["classie/classie", "eventie/eventie", "./flickity", "unidragger/unidragger", "fizzy-ui-utils/utils"], function(i, n, o, r, s) {
            return e(t, i, n, o, r, s)
        }) : "object" == typeof exports ? module.exports = e(t, require("desandro-classie"), require("eventie"), require("./flickity"), require("unidragger"), require("fizzy-ui-utils")) : t.Flickity = e(t, t.classie, t.eventie, t.Flickity, t.Unidragger, t.fizzyUIUtils)
    }(window, function(t, e, i, n, o, r) {
        function s(t) {
            t.preventDefault ? t.preventDefault() : t.returnValue = !1
        }

        function a(e) {
            var i = o.getPointerPoint(e);
            return i.y - t.pageYOffset
        }
        r.extend(n.defaults, {
            draggable: !0,
            touchVerticalScroll: !0
        }), n.createMethods.push("_createDrag"), r.extend(n.prototype, o.prototype), n.prototype._createDrag = function() {
            this.on("activate", this.bindDrag), this.on("uiChange", this._uiChangeDrag), this.on("childUIPointerDown", this._childUIPointerDownDrag), this.on("deactivate", this.unbindDrag)
        }, n.prototype.bindDrag = function() {
            this.options.draggable && !this.isDragBound && (e.add(this.element, "is-draggable"), this.handles = [this.viewport], this.bindHandles(), this.isDragBound = !0)
        }, n.prototype.unbindDrag = function() {
            this.isDragBound && (e.remove(this.element, "is-draggable"), this.unbindHandles(), delete this.isDragBound)
        }, n.prototype._uiChangeDrag = function() {
            delete this.isFreeScrolling
        }, n.prototype._childUIPointerDownDrag = function(t) {
            s(t), this.pointerDownFocus(t)
        }, n.prototype.pointerDown = function(n, r) {
            if ("INPUT" == n.target.nodeName && "range" == n.target.type) return this.isPointerDown = !1, void delete this.pointerIdentifier;
            this._dragPointerDown(n, r);
            var s = document.activeElement;
            s && s.blur && s != this.element && s != document.body && s.blur(), this.pointerDownFocus(n), this.dragX = this.x, e.add(this.viewport, "is-pointer-down"), this._bindPostStartEvents(n), this.pointerDownScroll = o.getScrollPosition(), i.bind(t, "scroll", this), this.dispatchEvent("pointerDown", n, [r])
        };
        var l = {
                touchstart: !0,
                MSPointerDown: !0
            },
            c = {
                INPUT: !0,
                SELECT: !0
            };
        n.prototype.pointerDownFocus = function(t) {
            !this.options.accessibility || l[t.type] || c[t.target.nodeName] || this.element.focus()
        }, n.prototype.pointerMove = function(t, e) {
            var i = this._dragPointerMove(t, e);
            this.touchVerticalScrollMove(t, e, i), this._dragMove(t, e, i), this.dispatchEvent("pointerMove", t, [e, i])
        }, n.prototype.hasDragStarted = function(t) {
            return !this.isTouchScrolling && Math.abs(t.x) > 3
        }, n.prototype.pointerUp = function(t, i) {
            delete this.isTouchScrolling, e.remove(this.viewport, "is-pointer-down"), this.dispatchEvent("pointerUp", t, [i]), this._dragPointerUp(t, i)
        };
        var h = {
            touchmove: !0,
            MSPointerMove: !0
        };
        return n.prototype.touchVerticalScrollMove = function(e, i, n) {
            var o = this.options.touchVerticalScroll,
                r = "withDrag" == o ? !o : this.isDragging || !o;
            !r && h[e.type] && !this.isTouchScrolling && Math.abs(n.y) > 10 && (this.startScrollY = t.pageYOffset, this.pointerWindowStartY = a(i), this.isTouchScrolling = !0)
        }, n.prototype.dragStart = function(t, e) {
            this.dragStartPosition = this.x, this.startAnimation(), this.dispatchEvent("dragStart", t, [e])
        }, n.prototype.dragMove = function(t, e, i) {
            s(t), this.previousDragX = this.dragX;
            var n = this.options.rightToLeft ? -1 : 1,
                o = this.dragStartPosition + i.x * n;
            if (!this.options.wrapAround && this.cells.length) {
                var r = Math.max(-this.cells[0].target, this.dragStartPosition);
                o = o > r ? .5 * (o + r) : o;
                var a = Math.min(-this.getLastCell().target, this.dragStartPosition);
                o = a > o ? .5 * (o + a) : o
            }
            this.dragX = o, this.dragMoveTime = new Date, this.dispatchEvent("dragMove", t, [e, i])
        }, n.prototype.dragEnd = function(t, e) {
            this.options.freeScroll && (this.isFreeScrolling = !0);
            var i = this.dragEndRestingSelect();
            if (this.options.freeScroll && !this.options.wrapAround) {
                var n = this.getRestingPosition();
                this.isFreeScrolling = -n > this.cells[0].target && -n < this.getLastCell().target
            } else this.options.freeScroll || i != this.selectedIndex || (i += this.dragEndBoostSelect());
            delete this.previousDragX, this.select(i), this.dispatchEvent("dragEnd", t, [e])
        }, n.prototype.dragEndRestingSelect = function() {
            var t = this.getRestingPosition(),
                e = Math.abs(this.getCellDistance(-t, this.selectedIndex)),
                i = this._getClosestResting(t, e, 1),
                n = this._getClosestResting(t, e, -1),
                o = i.distance < n.distance ? i.index : n.index;
            return o
        }, n.prototype._getClosestResting = function(t, e, i) {
            for (var n = this.selectedIndex, o = 1 / 0, r = this.options.contain && !this.options.wrapAround ? function(t, e) {
                    return e >= t
                } : function(t, e) {
                    return e > t
                }; r(e, o) && (n += i, o = e, e = this.getCellDistance(-t, n), null !== e);) e = Math.abs(e);
            return {
                distance: o,
                index: n - i
            }
        }, n.prototype.getCellDistance = function(t, e) {
            var i = this.cells.length,
                n = this.options.wrapAround && i > 1,
                o = n ? r.modulo(e, i) : e,
                s = this.cells[o];
            if (!s) return null;
            var a = n ? this.slideableWidth * Math.floor(e / i) : 0;
            return t - (s.target + a)
        }, n.prototype.dragEndBoostSelect = function() {
            if (void 0 === this.previousDragX || !this.dragMoveTime || new Date - this.dragMoveTime > 100) return 0;
            var t = this.getCellDistance(-this.dragX, this.selectedIndex),
                e = this.previousDragX - this.dragX;
            return t > 0 && e > 0 ? 1 : 0 > t && 0 > e ? -1 : 0
        }, n.prototype.staticClick = function(t, e) {
            var i = this.getParentCell(t.target),
                n = i && i.element,
                o = i && r.indexOf(this.cells, i);
            this.dispatchEvent("staticClick", t, [e, n, o])
        }, n
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("tap-listener/tap-listener", ["unipointer/unipointer"], function(i) {
            return e(t, i)
        }) : "object" == typeof exports ? module.exports = e(t, require("unipointer")) : t.TapListener = e(t, t.Unipointer)
    }(window, function(t, e) {
        function i(t) {
            t.preventDefault ? t.preventDefault() : t.returnValue = !1
        }

        function n(t) {
            this.bindTap(t)
        }
        n.prototype = new e, n.prototype.bindTap = function(t) {
            t && (this.unbindTap(), this.tapElement = t, this._bindStartEvent(t, !0))
        }, n.prototype.unbindTap = function() {
            this.tapElement && (this._bindStartEvent(this.tapElement, !0), delete this.tapElement)
        };
        var o = n.prototype.pointerDown;
        n.prototype.pointerDown = function(t) {
            "touchstart" == t.type && i(t), o.apply(this, arguments)
        };
        var r = void 0 !== t.pageYOffset;
        return n.prototype.pointerUp = function(i, n) {
            var o = e.getPointerPoint(n),
                s = this.tapElement.getBoundingClientRect(),
                a = r ? t.pageXOffset : document.body.scrollLeft,
                l = r ? t.pageYOffset : document.body.scrollTop,
                c = o.x >= s.left + a && o.x <= s.right + a && o.y >= s.top + l && o.y <= s.bottom + l;
            c && this.emitEvent("tap", [i, n])
        }, n.prototype.destroy = function() {
            this.pointerDone(), this.unbindTap()
        }, n
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/prev-next-button", ["eventie/eventie", "./flickity", "tap-listener/tap-listener", "fizzy-ui-utils/utils"], function(i, n, o, r) {
            return e(t, i, n, o, r)
        }) : "object" == typeof exports ? module.exports = e(t, require("eventie"), require("./flickity"), require("tap-listener"), require("fizzy-ui-utils")) : e(t, t.eventie, t.Flickity, t.TapListener, t.fizzyUIUtils)
    }(window, function(t, e, i, n, o) {
        function r(t, e) {
            this.direction = t, this.parent = e, this._create()
        }

        function s(t) {
            return "string" == typeof t ? t : "M " + t.x0 + ",50 L " + t.x1 + "," + (t.y1 + 50) + " L " + t.x2 + "," + (t.y2 + 50) + " L " + t.x3 + ",50  L " + t.x2 + "," + (50 - t.y2) + " L " + t.x1 + "," + (50 - t.y1) + " Z"
        }
        var a = "http://www.w3.org/2000/svg",
            l = function() {
                function t() {
                    if (void 0 !== e) return e;
                    var t = document.createElement("div");
                    return t.innerHTML = "<svg/>", e = (t.firstChild && t.firstChild.namespaceURI) == a
                }
                var e;
                return t
            }();
        return r.prototype = new n, r.prototype._create = function() {
            this.isEnabled = !0, this.isPrevious = -1 == this.direction;
            var t = this.parent.options.rightToLeft ? 1 : -1;
            this.isLeft = this.direction == t;
            var e = this.element = document.createElement("button");
            if (e.className = "flickity-prev-next-button", e.className += this.isPrevious ? " previous" : " next", e.setAttribute("type", "button"), i.setUnselectable(e), l()) {
                var n = this.createSVG();
                e.appendChild(n)
            } else this.setArrowText(), e.className += " no-svg";
            var o = this;
            this.onCellSelect = function() {
                o.update()
            }, this.parent.on("cellSelect", this.onCellSelect), this.on("tap", this.onTap), this.on("pointerDown", function(t, e) {
                o.parent.childUIPointerDown(e)
            })
        }, r.prototype.activate = function() {
            this.update(), this.bindTap(this.element), e.bind(this.element, "click", this), this.parent.element.appendChild(this.element)
        }, r.prototype.deactivate = function() {
            this.parent.element.removeChild(this.element), n.prototype.destroy.call(this), e.unbind(this.element, "click", this)
        }, r.prototype.createSVG = function() {
            var t = document.createElementNS(a, "svg");
            t.setAttribute("viewBox", "0 0 100 100");
            var e = document.createElementNS(a, "path"),
                i = s(this.parent.options.arrowShape);
            return e.setAttribute("d", i), e.setAttribute("class", "arrow"), this.isLeft || e.setAttribute("transform", "translate(100, 100) rotate(180) "), t.appendChild(e), t
        }, r.prototype.setArrowText = function() {
            var t = this.parent.options,
                e = this.isLeft ? t.leftArrowText : t.rightArrowText;
            o.setText(this.element, e)
        }, r.prototype.onTap = function() {
            if (this.isEnabled) {
                this.parent.uiChange();
                var t = this.isPrevious ? "previous" : "next";
                this.parent[t]()
            }
        }, r.prototype.handleEvent = o.handleEvent, r.prototype.onclick = function() {
            var t = document.activeElement;
            t && t == this.element && this.onTap()
        }, r.prototype.enable = function() {
            this.isEnabled || (this.element.disabled = !1, this.isEnabled = !0)
        }, r.prototype.disable = function() {
            this.isEnabled && (this.element.disabled = !0, this.isEnabled = !1)
        }, r.prototype.update = function() {
            var t = this.parent.cells;
            if (this.parent.options.wrapAround && t.length > 1) return void this.enable();
            var e = t.length ? t.length - 1 : 0,
                i = this.isPrevious ? 0 : e,
                n = this.parent.selectedIndex == i ? "disable" : "enable";
            this[n]()
        }, r.prototype.destroy = function() {
            this.deactivate()
        }, o.extend(i.defaults, {
            prevNextButtons: !0,
            leftArrowText: "‹",
            rightArrowText: "›",
            arrowShape: {
                x0: 10,
                x1: 60,
                y1: 50,
                x2: 70,
                y2: 40,
                x3: 30
            }
        }), i.createMethods.push("_createPrevNextButtons"), i.prototype._createPrevNextButtons = function() {
            this.options.prevNextButtons && (this.prevButton = new r(-1, this), this.nextButton = new r(1, this), this.on("activate", this.activatePrevNextButtons))
        }, i.prototype.activatePrevNextButtons = function() {
            this.prevButton.activate(), this.nextButton.activate(), this.on("deactivate", this.deactivatePrevNextButtons)
        }, i.prototype.deactivatePrevNextButtons = function() {
            this.prevButton.deactivate(), this.nextButton.deactivate(), this.off("deactivate", this.deactivatePrevNextButtons)
        }, i.PrevNextButton = r, i
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/page-dots", ["eventie/eventie", "./flickity", "tap-listener/tap-listener", "fizzy-ui-utils/utils"], function(i, n, o, r) {
            return e(t, i, n, o, r)
        }) : "object" == typeof exports ? module.exports = e(t, require("eventie"), require("./flickity"), require("tap-listener"), require("fizzy-ui-utils")) : e(t, t.eventie, t.Flickity, t.TapListener, t.fizzyUIUtils)
    }(window, function(t, e, i, n, o) {
        function r(t) {
            this.parent = t, this._create()
        }
        return r.prototype = new n, r.prototype._create = function() {
            this.holder = document.createElement("ol"), this.holder.className = "flickity-page-dots", i.setUnselectable(this.holder), this.dots = [];
            var t = this;
            this.onCellSelect = function() {
                t.updateSelected()
            }, this.parent.on("cellSelect", this.onCellSelect), this.on("tap", this.onTap), this.on("pointerDown", function(e, i) {
                t.parent.childUIPointerDown(i)
            })
        }, r.prototype.activate = function() {
            this.setDots(), this.updateSelected(), this.bindTap(this.holder), this.parent.element.appendChild(this.holder)
        }, r.prototype.deactivate = function() {
            this.parent.element.removeChild(this.holder), n.prototype.destroy.call(this)
        }, r.prototype.setDots = function() {
            var t = this.parent.cells.length - this.dots.length;
            t > 0 ? this.addDots(t) : 0 > t && this.removeDots(-t)
        }, r.prototype.addDots = function(t) {
            for (var e = document.createDocumentFragment(), i = []; t;) {
                var n = document.createElement("li");
                n.className = "dot", e.appendChild(n), i.push(n), t--
            }
            this.holder.appendChild(e), this.dots = this.dots.concat(i)
        }, r.prototype.removeDots = function(t) {
            for (var e = this.dots.splice(this.dots.length - t, t), i = 0, n = e.length; n > i; i++) {
                var o = e[i];
                this.holder.removeChild(o)
            }
        }, r.prototype.updateSelected = function() {
            this.selectedDot && (this.selectedDot.className = "dot"), this.dots.length && (this.selectedDot = this.dots[this.parent.selectedIndex], this.selectedDot.className = "dot is-selected")
        }, r.prototype.onTap = function(t) {
            var e = t.target;
            if ("LI" == e.nodeName) {
                this.parent.uiChange();
                var i = o.indexOf(this.dots, e);
                this.parent.select(i)
            }
        }, r.prototype.destroy = function() {
            this.deactivate()
        }, i.PageDots = r, o.extend(i.defaults, {
            pageDots: !0
        }), i.createMethods.push("_createPageDots"), i.prototype._createPageDots = function() {
            this.options.pageDots && (this.pageDots = new r(this), this.on("activate", this.activatePageDots), this.on("cellAddedRemoved", this.onCellAddedRemovedPageDots), this.on("deactivate", this.deactivatePageDots))
        }, i.prototype.activatePageDots = function() {
            this.pageDots.activate()
        }, i.prototype.onCellAddedRemovedPageDots = function() {
            this.pageDots.setDots()
        }, i.prototype.deactivatePageDots = function() {
            this.pageDots.deactivate()
        }, i.PageDots = r, i
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/player", ["eventEmitter/EventEmitter", "eventie/eventie", "./flickity"], function(t, i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(require("wolfy87-eventemitter"), require("eventie"), require("./flickity")) : e(t.EventEmitter, t.eventie, t.Flickity)
    }(window, function(t, e, i) {
        function n(t) {
            if (this.isPlaying = !1, this.parent = t, r) {
                var e = this;
                this.onVisibilityChange = function() {
                    e.visibilityChange()
                }
            }
        }
        var o, r;
        return "hidden" in document ? (o = "hidden", r = "visibilitychange") : "webkitHidden" in document && (o = "webkitHidden", r = "webkitvisibilitychange"), n.prototype = new t, n.prototype.play = function() {
            this.isPlaying = !0, delete this.isPaused, r && document.addEventListener(r, this.onVisibilityChange, !1), this.tick()
        }, n.prototype.tick = function() {
            if (this.isPlaying && !this.isPaused) {
                this.tickTime = new Date;
                var t = this.parent.options.autoPlay;
                t = "number" == typeof t ? t : 3e3;
                var e = this;
                this.timeout = setTimeout(function() {
                    e.parent.next(!0), e.tick()
                }, t)
            }
        }, n.prototype.stop = function() {
            this.isPlaying = !1, delete this.isPaused, this.clear(), r && document.removeEventListener(r, this.onVisibilityChange, !1)
        }, n.prototype.clear = function() {
            clearTimeout(this.timeout)
        }, n.prototype.pause = function() {
            this.isPlaying && (this.isPaused = !0, this.clear())
        }, n.prototype.unpause = function() {
            this.isPaused && this.play()
        }, n.prototype.visibilityChange = function() {
            var t = document[o];
            this[t ? "pause" : "unpause"]()
        }, i.createMethods.push("_createPlayer"), i.prototype._createPlayer = function() {
            this.player = new n(this), this.on("activate", this.activatePlayer), this.on("uiChange", this.stopPlayer), this.on("pointerDown", this.stopPlayer), this.on("deactivate", this.deactivatePlayer)
        }, i.prototype.activatePlayer = function() {
            this.options.autoPlay && (this.player.play(), e.bind(this.element, "mouseenter", this), this.isMouseenterBound = !0)
        }, i.prototype.stopPlayer = function() {
            this.player.stop()
        }, i.prototype.deactivatePlayer = function() {
            this.player.stop(), this.isMouseenterBound && (e.unbind(this.element, "mouseenter", this), delete this.isMouseenterBound)
        }, i.prototype.onmouseenter = function() {
            this.player.pause(), e.bind(this.element, "mouseleave", this)
        }, i.prototype.onmouseleave = function() {
            this.player.unpause(), e.unbind(this.element, "mouseleave", this)
        }, i.Player = n, i
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/add-remove-cell", ["./flickity", "fizzy-ui-utils/utils"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("./flickity"), require("fizzy-ui-utils")) : e(t, t.Flickity, t.fizzyUIUtils)
    }(window, function(t, e, i) {
        function n(t) {
            for (var e = document.createDocumentFragment(), i = 0, n = t.length; n > i; i++) {
                var o = t[i];
                e.appendChild(o.element)
            }
            return e
        }
        return e.prototype.insert = function(t, e) {
            var i = this._makeCells(t);
            if (i && i.length) {
                var o = this.cells.length;
                e = void 0 === e ? o : e;
                var r = n(i),
                    s = e == o;
                if (s) this.slider.appendChild(r);
                else {
                    var a = this.cells[e].element;
                    this.slider.insertBefore(r, a)
                }
                if (0 === e) this.cells = i.concat(this.cells);
                else if (s) this.cells = this.cells.concat(i);
                else {
                    var l = this.cells.splice(e, o - e);
                    this.cells = this.cells.concat(i).concat(l)
                }
                this._sizeCells(i);
                var c = e > this.selectedIndex ? 0 : i.length;
                this._cellAddedRemoved(e, c)
            }
        }, e.prototype.append = function(t) {
            this.insert(t, this.cells.length)
        }, e.prototype.prepend = function(t) {
            this.insert(t, 0)
        }, e.prototype.remove = function(t) {
            var e, n, o, r = this.getCells(t),
                s = 0;
            for (e = 0, n = r.length; n > e; e++) {
                o = r[e];
                var a = i.indexOf(this.cells, o) < this.selectedIndex;
                s -= a ? 1 : 0
            }
            for (e = 0, n = r.length; n > e; e++) o = r[e], o.remove(), i.removeFrom(this.cells, o);
            r.length && this._cellAddedRemoved(0, s)
        }, e.prototype._cellAddedRemoved = function(t, e) {
            e = e || 0, this.selectedIndex += e, this.selectedIndex = Math.max(0, Math.min(this.cells.length - 1, this.selectedIndex)), this.emitEvent("cellAddedRemoved", [t, e]), this.cellChange(t, !0)
        }, e.prototype.cellSizeChange = function(t) {
            var e = this.getCell(t);
            if (e) {
                e.getSize();
                var n = i.indexOf(this.cells, e);
                this.cellChange(n)
            }
        }, e.prototype.cellChange = function(t, e) {
            var i = this.slideableWidth;
            this._positionCells(t), this._getWrapShiftCells(), this.setGallerySize(), this.options.freeScroll ? (this.x += i - this.slideableWidth, this.positionSlider()) : (e && this.positionSliderAtSelected(), this.select(this.selectedIndex))
        }, e
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/lazyload", ["classie/classie", "eventie/eventie", "./flickity", "fizzy-ui-utils/utils"], function(i, n, o, r) {
            return e(t, i, n, o, r)
        }) : "object" == typeof exports ? module.exports = e(t, require("desandro-classie"), require("eventie"), require("./flickity"), require("fizzy-ui-utils")) : e(t, t.classie, t.eventie, t.Flickity, t.fizzyUIUtils)
    }(window, function(t, e, i, n, o) {
        function r(t) {
            if ("IMG" == t.nodeName && t.getAttribute("data-flickity-lazyload")) return [t];
            var e = t.querySelectorAll("img[data-flickity-lazyload]");
            return o.makeArray(e)
        }

        function s(t, e) {
            this.img = t, this.flickity = e, this.load()
        }
        return n.createMethods.push("_createLazyload"), n.prototype._createLazyload = function() {
            this.on("cellSelect", this.lazyLoad)
        }, n.prototype.lazyLoad = function() {
            var t = this.options.lazyLoad;
            if (t) {
                for (var e = "number" == typeof t ? t : 0, i = this.getAdjacentCellElements(e), n = [], o = 0, a = i.length; a > o; o++) {
                    var l = i[o],
                        c = r(l);
                    n = n.concat(c)
                }
                for (o = 0, a = n.length; a > o; o++) {
                    var h = n[o];
                    new s(h, this)
                }
            }
        }, s.prototype.handleEvent = o.handleEvent, s.prototype.load = function() {
            i.bind(this.img, "load", this), i.bind(this.img, "error", this), this.img.src = this.img.getAttribute("data-flickity-lazyload"), this.img.removeAttribute("data-flickity-lazyload")
        }, s.prototype.onload = function(t) {
            this.complete(t, "flickity-lazyloaded")
        }, s.prototype.onerror = function() {
            this.complete(event, "flickity-lazyerror")
        }, s.prototype.complete = function(t, n) {
            i.unbind(this.img, "load", this), i.unbind(this.img, "error", this);
            var o = this.flickity.getParentCell(this.img),
                r = o && o.element;
            this.flickity.cellSizeChange(r), e.add(this.img, n), this.flickity.dispatchEvent("lazyLoad", t, r)
        }, n.LazyLoader = s, n
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity/js/index", ["./flickity", "./drag", "./prev-next-button", "./page-dots", "./player", "./add-remove-cell", "./lazyload"], e) : "object" == typeof exports && (module.exports = e(require("./flickity"), require("./drag"), require("./prev-next-button"), require("./page-dots"), require("./player"), require("./add-remove-cell"), require("./lazyload")))
    }(window, function(t) {
        return t
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("flickity-as-nav-for/as-nav-for", ["classie/classie", "flickity/js/index", "fizzy-ui-utils/utils"], function(i, n, o) {
            return e(t, i, n, o)
        }) : "object" == typeof exports ? module.exports = e(t, require("desandro-classie"), require("flickity"), require("fizzy-ui-utils")) : t.Flickity = e(t, t.classie, t.Flickity, t.fizzyUIUtils)
    }(window, function(t, e, i, n) {
        return i.createMethods.push("_createAsNavFor"), i.prototype._createAsNavFor = function() {
            this.on("activate", this.activateAsNavFor), this.on("deactivate", this.deactivateAsNavFor), this.on("destroy", this.destroyAsNavFor);
            var t = this.options.asNavFor;
            if (t) {
                var e = this;
                setTimeout(function() {
                    e.setNavCompanion(t)
                })
            }
        }, i.prototype.setNavCompanion = function(t) {
            t = n.getQueryElement(t);
            var e = i.data(t);
            if (e && e != this) {
                this.navCompanion = e;
                var o = this;
                this.onNavCompanionSelect = function() {
                    o.navCompanionSelect()
                }, e.on("cellSelect", this.onNavCompanionSelect), this.on("staticClick", this.onNavStaticClick), this.navCompanionSelect()
            }
        }, i.prototype.navCompanionSelect = function() {
            if (this.navCompanion) {
                var t = this.navCompanion.selectedIndex;
                this.select(t), this.removeNavSelectedElement(), this.selectedIndex == t && (this.navSelectedElement = this.cells[t].element, e.add(this.navSelectedElement, "is-nav-selected"))
            }
        }, i.prototype.activateAsNavFor = function() {
            this.navCompanionSelect()
        }, i.prototype.removeNavSelectedElement = function() {
            this.navSelectedElement && (e.remove(this.navSelectedElement, "is-nav-selected"), delete this.navSelectedElement)
        }, i.prototype.onNavStaticClick = function(t, e, i, n) {
            "number" == typeof n && this.navCompanion.select(n)
        }, i.prototype.deactivateAsNavFor = function() {
            this.removeNavSelectedElement()
        }, i.prototype.destroyAsNavFor = function() {
            this.navCompanion && (this.navCompanion.off("cellSelect", this.onNavCompanionSelect), this.off("staticClick", this.onNavStaticClick), delete this.navCompanion)
        }, i
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define("imagesloaded/imagesloaded", ["eventEmitter/EventEmitter", "eventie/eventie"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("wolfy87-eventemitter"), require("eventie")) : t.imagesLoaded = e(t, t.EventEmitter, t.eventie)
    }(window, function(t, e, i) {
        function n(t, e) {
            for (var i in e) t[i] = e[i];
            return t
        }

        function o(t) {
            return "[object Array]" === d.call(t)
        }

        function r(t) {
            var e = [];
            if (o(t)) e = t;
            else if ("number" == typeof t.length)
                for (var i = 0, n = t.length; n > i; i++) e.push(t[i]);
            else e.push(t);
            return e
        }

        function s(t, e, i) {
            if (!(this instanceof s)) return new s(t, e);
            "string" == typeof t && (t = document.querySelectorAll(t)), this.elements = r(t), this.options = n({}, this.options), "function" == typeof e ? i = e : n(this.options, e), i && this.on("always", i), this.getImages(), c && (this.jqDeferred = new c.Deferred);
            var o = this;
            setTimeout(function() {
                o.check()
            })
        }

        function a(t) {
            this.img = t
        }

        function l(t) {
            this.src = t, u[t] = this
        }
        var c = t.jQuery,
            h = t.console,
            p = "undefined" != typeof h,
            d = Object.prototype.toString;
        s.prototype = new e, s.prototype.options = {}, s.prototype.getImages = function() {
            this.images = [];
            for (var t = 0, e = this.elements.length; e > t; t++) {
                var i = this.elements[t];
                "IMG" === i.nodeName && this.addImage(i);
                var n = i.nodeType;
                if (n && (1 === n || 9 === n || 11 === n))
                    for (var o = i.querySelectorAll("img"), r = 0, s = o.length; s > r; r++) {
                        var a = o[r];
                        this.addImage(a)
                    }
            }
        }, s.prototype.addImage = function(t) {
            var e = new a(t);
            this.images.push(e)
        }, s.prototype.check = function() {
            function t(t, o) {
                return e.options.debug && p && h.log("confirm", t, o), e.progress(t), i++, i === n && e.complete(), !0
            }
            var e = this,
                i = 0,
                n = this.images.length;
            if (this.hasAnyBroken = !1, !n) return void this.complete();
            for (var o = 0; n > o; o++) {
                var r = this.images[o];
                r.on("confirm", t), r.check()
            }
        }, s.prototype.progress = function(t) {
            this.hasAnyBroken = this.hasAnyBroken || !t.isLoaded;
            var e = this;
            setTimeout(function() {
                e.emit("progress", e, t), e.jqDeferred && e.jqDeferred.notify && e.jqDeferred.notify(e, t)
            })
        }, s.prototype.complete = function() {
            var t = this.hasAnyBroken ? "fail" : "done";
            this.isComplete = !0;
            var e = this;
            setTimeout(function() {
                if (e.emit(t, e), e.emit("always", e), e.jqDeferred) {
                    var i = e.hasAnyBroken ? "reject" : "resolve";
                    e.jqDeferred[i](e)
                }
            })
        }, c && (c.fn.imagesLoaded = function(t, e) {
            var i = new s(this, t, e);
            return i.jqDeferred.promise(c(this))
        }), a.prototype = new e, a.prototype.check = function() {
            var t = u[this.img.src] || new l(this.img.src);
            if (t.isConfirmed) return void this.confirm(t.isLoaded, "cached was confirmed");
            if (this.img.complete && void 0 !== this.img.naturalWidth) return void this.confirm(0 !== this.img.naturalWidth, "naturalWidth");
            var e = this;
            t.on("confirm", function(t, i) {
                return e.confirm(t.isLoaded, i), !0
            }), t.check()
        }, a.prototype.confirm = function(t, e) {
            this.isLoaded = t, this.emit("confirm", this, e)
        };
        var u = {};
        return l.prototype = new e, l.prototype.check = function() {
            if (!this.isChecked) {
                var t = new Image;
                i.bind(t, "load", this), i.bind(t, "error", this), t.src = this.src, this.isChecked = !0
            }
        }, l.prototype.handleEvent = function(t) {
            var e = "on" + t.type;
            this[e] && this[e](t)
        }, l.prototype.onload = function(t) {
            this.confirm(!0, "onload"), this.unbindProxyEvents(t)
        }, l.prototype.onerror = function(t) {
            this.confirm(!1, "onerror"), this.unbindProxyEvents(t)
        }, l.prototype.confirm = function(t, e) {
            this.isConfirmed = !0, this.isLoaded = t, this.emit("confirm", this, e)
        }, l.prototype.unbindProxyEvents = function(t) {
            i.unbind(t.target, "load", this), i.unbind(t.target, "error", this)
        }, s
    }),
    function(t, e) {
        "function" == typeof define && define.amd ? define(["flickity/js/index", "imagesloaded/imagesloaded"], function(i, n) {
            return e(t, i, n)
        }) : "object" == typeof exports ? module.exports = e(t, require("flickity"), require("imagesloaded")) : t.Flickity = e(t, t.Flickity, t.imagesLoaded)
    }(window, function(t, e, i) {
        return e.createMethods.push("_createImagesLoaded"), e.prototype._createImagesLoaded = function() {
            this.on("activate", this.imagesLoaded)
        }, e.prototype.imagesLoaded = function() {
            function t(t, i) {
                var n = e.getParentCell(i.img);
                e.cellSizeChange(n && n.element), e.options.freeScroll || e.positionSliderAtSelected()
            }
            if (this.options.imagesLoaded) {
                var e = this;
                i(this.slider).on("progress", t)
            }
        }, e
    });

function Sliders() {
    var self = this;
    $.extend(self, {
        init: function() {
            self.initializeSliders();
        },
        initializeSliders: function() {
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                var isMobile = true;
            } else {
                var isMobile = false;
            }
            $('.main-gallery').flickity({
                cellAlign: 'left',
                contain: true,
                wrapAround: true,
                pageDots: false,
                autoPlay: isMobile,
                accessibility: false
            });
            $('.blog-gallery').flickity({
                cellAlign: 'left',
                wrapAround: true,
                pageDots: false,
                autoPlay: false,
                prevNextButtons: false,
                accessibility: false
            });
            $('.articleSearch').flickity({
                cellAlign: 'left',
                contain: true,
                wrapAround: true,
                pageDots: false,
                autoPlay: false,
                accessibility: false
            });
        }
    });
    $(document).ready(function() {
        self.init();
    });
}
new Sliders();