Zepto plugin for Data Binding
==================

Plugin for [Zepto.js](http://zeptojs.com) that provides Javascript data binding between DOM elements and Javascript objects.  It is inspired by the binding API that [AngularJS](http://angularjs.org) provides, but limits itself to databinding and therefore is much more lightweight (about 7k).

## Example ##

Let's say hello.  First we'll include zepto.js and binder.js.  Next we'll set up some Javascript variables to bind to, `color` and `name`.  As you'll see, all bound variables go in `binder.scope`.  Then we'll bind our variables to the style and text of some greeting text.  Finally we'll provide a couple of inputs to change the variables with:

	<html>
		<head>
			<title>Hello</title>
			<script type="text/javascript" src="zepto.min.js"></script>
			<script type="text/javascript" src="binder.min.js"></script>
			<script type="text/javascript">
				binder.scope.color = 'blue';
				binder.scope.name = 'World';
			</script>
		</head>
		<body>
			<p>Hello <span id="colored" bind-style="'color:' + color" bind="name"></span>!</p>
			<form action="">
				<p>
					<label for="color">Color</label>
					<input id="color" type="text" bind="color" immediate="true" />
				</p>
				<p>
					<label for="name">Name</label>
					<input id="name" type="text" bind="name" immediate="true" />
				</p>
			</form>
		</body>
	</html>

You'll notice the `immediate` attribute on the inputs.  This makes the values update as you type.  Otherwise they'd only update when focus leaves the field.

There are also some bundled examples that demonstrate looping and filters.  More about these below.

## Usage ##

You can bind a Javascript variable to a DOM element by putting a `bind` or `data-bind` attribute on the DOM element.  In fact any custom attribute mentioned below can be prefixed by `data-`.  Binding expressions are similar to Javascript expressions, but have a few differences:

* They are resolved against `binder.scope`, not against `window` as with regular Javascript expressions.  `binder.scope` has a `window` member available if you need it.
* They are null-safe.  This means that, in the expression `a.b.c` if `a` is null or undefined no error will be thrown.
* They cannot contain control statements.  If you want complex logic in an expression then bind to a function call like `bind="myFunction()"`.
* They can contain filters, which modify the data before it is displayed.  For example `bind="amount | currency"` uses the currency filter to format the amount as a dollar value.

Most bindings are one-way, to display Javascript variables in DOM elements.  However bindings on form fields are two-way unless the binding contains a filter or something other than a simple expression.

The `bind` attribute binds to an element's text value, using Zepto's `.text()` or `.val()` function (depending on what element you bind to).  You can bind to an element's attributes as well.  Simply prefix the attribute with `bind-`, e.g. `bind-class`.  By default the following attributes can be bound this way:

* bind-checked
* bind-class
* bind-disabled
* bind-readonly
* bind-selected
* bind-src
* bind-style

If you want this plugin to look for a different set of attributes to bind to then you can replace them in the options, like:

	$(document).binder('options', {
		bindAttributes: ['bind-class',
						 'bind-src',
						 'bind-title']
	});

You can also use the options call to modify the default `separatorSymbol`, `decimalSymbol`, and `currencySymbol` used by the number and currency filters.

When you bind to a form field this plugin adds events to listen for the field value changing.  You can use the `immediate` attribute on text fields to update the value with every keystroke the user types.

However if you update the Javascript value via code then the plugin won't realize you made a change.  You can let it know via the following call:

	binder.sync();

All bindings are created when the document loads.  You can add bindings to elements that are loaded via Ajax:

	$('#my-loaded-item').binder();

## Looping ##

You can loop using the `repeat` (or `data-repeat`) attribute.  Place the attribute on the element to be repeated:

	<ul>
		<li repeat="item in items">
			<span bind="item.name"></span>
		</li>
	</ul>

Each `<li>` in the above example will be repeated, along with all of its children, for as many items as there are in the array.  You can also use `repeat="key, value in items"` to loop over the properties of a Javascript object.

Each child of a repeated item gets its own local scope.  Within that scope the following properties are available:

* `index`: the index or key of the repeated item.
* `first`: a boolean for whether this is the first item.
* `middle`: a boolean for whether this is neither the first nor last item.
* `last`: a boolean for whether this is the last item.

## Filters ##

Filters are functions that modify data before displaying it.  You can invoke a filter in your `bind` or `repeat` expression by putting it after a `|` (pipe) symbol, like this: `bind="account.balance | currency:'€'"`  Additional arguments may be provided to to the filter separated by colons, like the Euro symbol in the example.  Filters can be chained, separated by pipes, with the output of one filter becoming the input to the next.

A few filters are built in.  Here are the built-in filters:

* **filter**: filters a list by some criterion.  The single required argument is the criterion:
	* If it is a string (e.g. `items | filter:'hi'`) then all items with any property that matches the string will be included.  Properties are tested using substring matching, so 'hi' would match `{type: 'ship'}`
	* If it is a function (e.g. `items | filter:filterFunc`) then it will be called for each item and should return `true` for those that match.
	* If it is an object (e.g. `items | filter:matchObject`) then each property of the object will be compared to the same property of each item.  Items that match all properties in the object will be included.  Note that if one of the object's properties is named `$` then it will be compared to all properties of each item.
* **limitTo**: limits the number of items.  The first argument is required and is the number of items to limit to; an optional second argument is the index of the item to start from.  Either argument may be a negative number; in this case they are counted from the back of the list.  So `items | limitTo:-5` would return the last five items in the list.
* **orderBy**: sorts a list by some criteria.  The first argument is required and is the criteria to order by.  An optional second argument is a boolean for whether to sort in reverse.  The following can be specified as criteria:
	* If it is a string (e.g. `items | orderBy:'firstName'`) then items are sorted by that property, i.e. items would be sorted by their `.firstName` property in the example.  If the string starts with `-` (hyphen) then it is sorted in reverse.
	* If it is a function (e.g. `items | orderBy:fullNameFunc`) then items are sorted by whatever value the function returns.  For instance fullNameFunc in the example might be defined as `binder.scope.fullNameFunc = function(item){return item.firstName + ' ' + item.lastName}`
	* If it is an array (e.g. `items | orderBy['lastName', '-firstName']`) then each item in the array must be a string or a function, and they are handled as described above.  This allows sorting by multiple criteria.
* **number**: formats a number like `1,234.56`.  Optional arguments are `fractionSize`, `separatorSymbol`, and `decimalSymbol`.
* **currency**: formats a number as a currency value.  Optional arguments are `symbol`, `fractionSize`, `separatorSymbol`, and `decimalSymbol`.
* **date**: by default this filter does nothing.  However if a `dateFormat` function exists then this filter uses it to format the date.  An [excellent date formatting library is provided by Steve Levithan](http://blog.stevenlevithan.com/archives/date-time-format) which provides this function.  Optional arguments are whatever the dateFormat function accepts, such as `format` and `utc`.
* **lowercase**: returns a lowercased version of the value.
* **uppercase**: returns an uppercased version of the value.
* **json**: formats the value as a [JSON](http://www.json.org) string.

You can create your own custom filter functions.  Simply add your function to the `binder.filters` object:

	binder.filters.property = function(value, property) {
		return value[property];
	}

Then reference it in your binding expression:

	<span bind="person | property:'name'"></span>

## Q & A ##

1. Why not use [insert your favorite plugin here] instead?
	* It didn't fit my needs (lightweight, uses Zepto.js).
	* I didn't know about it.  Feel free to correct my error.
2. Why doesn't your plugin support [insert your favorite missing feature here]?
	* Probably because I didn't need it.  Feel free to file an enhancement request and I'll consider it.
3. I found a bug.
	* Please file it and I'll investigate.