/**
 * Binder: a Zepto plugin for data binding between forms and plain old
 * javascript objects.
 * 2012, David Gileadi
 *
 * Released into the public domain.
 *
 *THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 * @author gileadis@gmail.com
 * @version 1.0.0
 * 
 * @requires 
 * Zepto JavaScript Library: http://zeptojs.com
 */

$(document).ready(function() {

	$(document.body).binder();
});

(function( $ ) {

	var nextId				= 0,
		inited				= false,
		settings			= null,
		bindAttributes		= ['bind-checked',
								'bind-class',
								'bind-disabled',
								'bind-readonly',
								'bind-selected',
								'bind-src',
								'bind-style'],
		bindings			= {};

	var methods = {

		options : function(options) {

			settings = $.extend( {
				numberSeparator: ',',
				decimalSymbol: '.',
				currencySymbol: '$'
			}, options);
		},

		init : function(scope) {

			// one-time initialization
			if (!inited) {
				inited = true;

				$(document.body).binder('options', {});
			}

			// bind attributes
			$('[bind]', this).each(function() {
				$(this).binder('bind', $(this).attr('bind'), scope);
			});
			$('[data-bind]', this).each(function() {
				$(this).binder('bind', $(this).data('bind'), scope);
			});
			for (var i = 0; i < bindAttributes.length; i++) {
				var attr = bindAttributes[i];
				$('[' + attr + ']', this).each(function() {
					$(this).binder('bind', $(this).attr(attr), scope, attr.slice(5));
				});
				$('[data-' + attr + ']', this).each(function() {
					$(this).binder('bind', $(this).data(attr), scope, attr.slice(5));
				});
			}

			// handle repeat attribute
			$('[repeat]', this).each(function() {
				$(this).binder('repeat', $(this).attr('repeat'), scope);
			});
			$('[data-repeat]', this).each(function() {
				$(this).binder('repeat', $(this).data('repeat'), scope);
			});
		},

		bind : function(expression, scope, bindAttr) {

			if (!expression)
				return;

			$(this).each(function() {

				var isInput = $(this).is('input') || $(this).is('select') || $(this).is('textarea');

				// listen for changes to the element
				if (isInput) {
					var callback = function(e) {$(this).binder('sync')};
					if ($(this).attr('immediate') || $(this).data('immediate'))
						$(this).on('keyup', callback);
					$(this).on('change', callback);
				}

				// make sure the element has an id
				if (!$(this).attr('id'))
					$(this).attr('id', '_binder_id_' + nextId++);

				// parse the expression into a model getter/setter
				var modelGetter = parseGetter(expression);
				var modelSetter = isInput ? parseSetter(expression) : null;

				// create a DOM getter/setter
				var id = '#' + $(this).attr('id');
				var domGetter;
				if (modelSetter) {
					if (bindAttr)
						domGetter = function() {return $(id).prop(bindAttr)};
					else
						domGetter = function() {return $(id).val()};
				}
				var domSetter;
				if (bindAttr) {
					domSetter = function(value) {
						if (typeof value === 'boolean')
							$(id).prop(bindAttr, value);
						else
							$(id).attr(bindAttr, value);
					};
				} else if (isInput)
					domSetter = function(value) {$(id).val(value)};
				else
					domSetter = function(value) {$(id).text(value)};

				createBinding(id, modelGetter, modelSetter, domGetter, domSetter, scope);
			});
		},

		unbind : function() {

			$(this).each(function() {
				var id = '#' + $(this).attr('id');
				delete bindings[id];
			});
			return this;
		},

		repeat : function(expression, scope) {

			if (!expression)
				return;

			var parts = expression.split(/\s*\bin\b\s*/i);
			if (parts.length != 2)
				return;
			var locals = parts[0].split(/\s*,\s*/);
			var keyName = locals.length == 1 ? null : locals[0];
			var varName = locals.length == 1 ? locals[0] : locals[1];

			$(this).each(function() {

				var master = $(this);

				// make sure the element has an id
				if (!master.attr('id'))
					master.attr('id', '_binder_id_' + nextId++);
				var id = master.attr('id');

				master.hide();
				$('[id]', master).binder('unbind');

				var modelGetter = parseGetter(parts[1]);

				var binding = createBinding('#' + id, modelGetter, null, null, function(){}, scope);

				binding.domSetter = function(value) {

					// find existing clones to remove
					var clones = $('[data-' + id + '_clone]', master.parent());

					// send in the clones
					if (value) {
						var previous = master;
						var localScope;
						var first = true;
						for (var prop in value) {
							if (Object.prototype.hasOwnProperty.call(value, prop)) {
								var cloneId = id + '_clone_' + prop;
								var clone = $('#' + cloneId);
								if (clone.length) {
									clones = clones.not(clone);
									var bound = findBindings($('[id]', clone));
									for (var i = 0; i < bound.length; i++) {
										localScope = bound[i].scope;
										localScope[varName] = value[prop];
										if (keyName)
											localScope[keyName] = prop;
									}
								} else {
									localScope = new LocalScope(scope);
									localScope.index = prop;
									localScope.first = first;
									localScope.middle = !first;
									localScope.last = false;
									first = false;
									localScope[varName] = value[prop];
									if (keyName)
										localScope[keyName] = prop;

									clone = master.clone();
									clone.insertAfter(previous);
									clone.removeAttr('repeat').removeAttr('data-repeat');
									clone.attr('id', cloneId);
									clone.attr('data-' + id + '_clone', true);
									suffixIds(clone, '_clone_' + prop);
									clone.binder('init', localScope);
									clone.show();
								}
								previous = clone;
							}
						}
						if (localScope) {
							localScope.middle = false;
							localScope.last = true;
						}
					}

					// remove obsolete clones
					clones.trigger('removerepeat');
					$('[id]', clones).binder('unbind');
					clones.remove();
				}

				binding.value = null;
				binding.sync();
			});
		},

		sync : function() {

			binder.sync();
		}

	};

	$.fn.binder = function( method ) {

		if (methods[method])
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		else if (typeof method === 'object' || !method)
			return methods.init.apply(this, arguments);
		else
			throw 'Method ' +  method + ' does not exist';
	};

	safeArgs = function(expression) {

		// make expressions null-safe: turn a.b into (a||{}).b
		var safe = expression;
		var result;
		do {
			result = safe;
			safe = result.replace(/([\w\.\(\)\{\}\|]*\b(?![\d])\w+)\./, '($1||{}).');
		} while (safe != result);

		// prefix all initial expressions with scope
		return result.replace(/(^|\s|\()((?!\d|false|true|this|null|undefined)\w+)/ig, '$1scope.$2');
	}

	parseGetter = function(expression) {

		// strip off functions
		var filters = expression.split(/\s*\|\s*/g);

		// qualify and null-safe the initial expression
		var result = safeArgs(filters[0]);

		// turn any filters into function calls
		for (var i = 1; i < filters.length; i++) {
			var args = filters[i].split(/\s*:\s*/g)
			result = 'binder.filters.' + args[0] + '(' + result;
			for (var j = 1; j < args.length; j++)
				result += ', ' + safeArgs(args[j]);
			result += ')';
		}

		return function(scope) {return eval(result)}
	}

	parseSetter = function(expression) {

		// we can't set if filtered or a literal or an arithmetic expression
		var r = /['"|+\-*/%<>&\^=~!]|\b(\d+|false|true|null|undefined)\b/i;
		if (r.test(expression))
			return null;

		var parts = expression.split(/\./g);

		return function(scope, value) {

			if (parts && parts.length > 1) {
				var parent = scope;
				for (var i = 0; i < parts.length; i++) {
					if (!parent[parts[i]])
						parent[parts[i]] = (i < parts.length - 1) ? {} : '';
					parent = parent[parts[i]];
				}
				parts = null;
			}

			eval('scope.' + expression + ' = value');
		}
	}

	createBinding = function(id, modelGetter, modelSetter, domGetter, domSetter, scope) {

		if (!scope)
			scope = binder.scope;

		// add the binding
		var binding = {
			id : id,
			scope : scope,
			domGetter : domGetter,
			modelGetter : modelGetter,
			domSetter : domSetter,
			modelSetter : modelSetter,
			sync : function() {

				// get the value
				var update;
				var model = this.modelGetter(this.scope);
				if (!compareObjects(model, this.value)) {
					this.value = model;
					update = 'dom';
				} else if (this.domGetter) {
					var dom = this.domGetter();
					if (dom != this.value) {
						this.value = dom;
						update = 'model';
					} else
						return false;
				} else
					return false;

				// propagate the value
				if (update === 'dom')
					this.domSetter(this.value);
				else if (this.modelSetter && update === 'model')
					this.modelSetter(this.scope, this.value);
// if (update)
// console.log('sync happened for ' + this.id + ': "' + this.value + '" to ' + update)

				return update != null;
			},
			isDirty : function() { return this.modelGetter(this.scope) != this.value || (this.domGetter && this.domGetter() != this.value); }
		};
		binding.sync();
		if (!bindings[id])
			bindings[id] = [];
		bindings[id].push(binding);
		return binding;
	}

	findBindings = function(elements) {

		var results = [];
		$(elements).each(function() {
			var id = '#' + $(this).attr('id');
			if (bindings[id])
				results = results.concat(bindings[id]);
		});
		return results;
	}

	compareObjects = function(a, b) {

		if (a == b)
			return true;
		else if (a == null || b == null)
			return false;
		else if (typeof a === 'object' && typeof b === 'object') {
			if (a.length && b.length && a.length != b.length)
				return false;
			for (var prop in a)
				if (Object.prototype.hasOwnProperty.call(a, prop))
					if (a[prop] != b[prop])
						return false;
			// TODO: to really check this, we should also see if b has any properties that a doesn't
			return true;
		} else
			return false;
	}

	suffixIds = function(element, suffix) {

		element.children().each(function() {
			var id = $(this).attr('id');
			if (id) {
				$(this).attr('id', id + suffix);
				$('[for="' + id + '"]', element).attr('for', id + suffix);
			}
			suffixIds($(this), suffix);
		});
	}

	// Filters:

	filter = function(items, expression) {

		if (!items || !expression)
			return items;

		var f;
		if (typeof expression === 'function')
			f = expression;
		else if (typeof expression === 'string') {
			f = function(item) {
				if (typeof item === 'string')
					return item.indexOf(expression) != -1;
				else
					for (var p in item)
						if (String(item[p]).indexOf(expression) != -1)
							return true;
				return false;
			}
		} else {
			f = function(item) {
				for (var p in expression) {
					if (p === '$') {
						var found = false;
						for (var q in item)
							if (String(item[q]).indexOf(expression[p]) != -1) {
								found = true;
								break;
							}
						if (!found)
							return false;
					} else if (item[p] == null)
						return false;
					else if (String(item[p]).indexOf(String(expression[p])) == -1)
						return false;
				}
				return true;
			}
		}

		return items.filter(f);
	}

	orderBy = function(items, expressions, reverse) {

		if (!items || !expressions)
			return items;

		var fs = [];
		expressions = [].concat(expressions);
		var compare = function(a, b) {
			var result;
			if (isNaN(a) || isNaN(b))
				result = a > b ? 1 : -1;
			else
				result = a - b;
			return reverse ? -result : result;
		}
		for (var i = 0; i < expressions.length; i++) {
			var expression = expressions[i];
			if (typeof expression === 'function') {
				fs.push({
					func: expression,
					f: function(a, b) { return compare(this.func(a), this.func(b)) }
				});
			} else if (typeof expression === 'string') {
				var negate = expression.charAt(0) == '-';
				var prop = expression.replace(/^[+\-]\s*/, '');
				fs.push({
					prop: prop,
					f: function(a, b) {
						var result = compare(a[this.prop], b[this.prop]);
						return negate ? -result : result;
					}
				});
			}
		}

		var results = items.slice(0);
		results.sort(function(a, b) {
			for (var i = 0; i < fs.length; i++) {
				var result = fs[i].f(a, b);
				if (result != 0)
					return result;
			}
			return 0;
		});
		return results;
	}

	limitTo = function(items, limit, start) {

		if (items && items.length) {
			if (start) {
				if (start > 0 && start < items.length)
					items = items.slice(start);
				else if (start < 0 && -start < items.length)
					items = items.slice(0, items.length + start);
			}
			if (limit > 0 && limit < items.length)
				items = items.slice(0, limit);
			else if (limit < 0 && -limit < items.length)
				items = items.slice(items.length + limit);
		}
		return items;
	}

	number = function(number, fractionSize, separator, decimalSymbol) {

		if (!number)
			return number;
		if (separator == null)
			separator = settings.numberSeparator;
		if (decimalSymbol == null)
			decimalSymbol = settings.decimalSymbol;

		number = String(number);
		var decimalAt = number.indexOf('.');
		if (decimalAt === -1) {
			decimalAt = number.length;
			if (fractionSize)
				number += decimalSymbol;
		} else if (decimalSymbol != '.') {
			number = number.slice(0, decimalAt) + decimalSymbol + number.slice(decimalAt + 1);
		}
		if (fractionSize) {
			if (decimalAt + fractionSize + 1 < number.length)
				number = number.slice(0, decimalAt + 1 + fractionSize);
			else
				while (decimalAt + fractionSize + 1 > number.length)
					number += '0';
		}
		decimalAt -= 3;
		while (decimalAt > 0) {
			number = number.slice(0, decimalAt) + separator + number.slice(decimalAt);
			decimalAt -= 3;
		}
		return number;
	}

	currency = function(text, symbol, fractionSize, separator, decimalSymbol) {
		return (symbol || settings.currencySymbol) + number(text, fractionSize || 2, separator, decimalSymbol);
	}

	date = function(date, format) {
		// use http://blog.stevenlevithan.com/archives/date-time-format if available
		if (window.dateFormat)
			return dateFormat(date, format);
		return date;
	}

	json = function(value) {
		return JSON.stringify(value);
	}

	lowercase = function(text) {
		return text ? text.toLowerCase() : text;
	}

	uppercase = function(text) {
		return text ? text.toUpperCase() : text;
	}

	// create the global scope object
	window.binder = {
		scope: {
			window: window
		},
		filters: {
			currency: currency,
			date: date,
			filter: filter,
			json: json,
			limitTo: limitTo,
			lowercase: lowercase,
			number: number,
			orderBy: orderBy,
			uppercase: uppercase
		},
		sync: function() {

			// synchronize all bindings; only loop for a maximum of ten times
			for (var i = 0; i < 10; i++) {
				var changed = false;
				for (var id in bindings) {
					var binding = bindings[id];
					for (var j = 0; j < binding.length; j++)
						changed |= binding[j].sync();
				}

				if (!changed)
					break;
			}
// console.log('finished looping after ' + i + ' times')
		}
	};

	// local scope that falls back to the global scope
	LocalScope = function(parent) {
		this.prototype = binder.scope;
	}

})( Zepto );