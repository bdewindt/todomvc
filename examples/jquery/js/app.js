/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		uuid: function () {
			/*jshint bitwise:false */
			var i, random;
			var uuid = '';

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}

			return uuid;
		},
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			if (arguments.length > 1) {
				return localStorage.setItem(namespace, JSON.stringify(data));
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};

	var todos = {
		_data: [],
		filter: "all",
		add: function(todoText, completed = false) {
			if (typeof(completed) != "boolean") {
				throw new TypeError('Second argument must be a boolean'); 
			}

			this._data.push({
				id: util.uuid(),
				title: todoText,
				completed: completed
			});
			this.saveToDisk();
		},
		update: function(index, value) {
			this._data[index].title = value;
			this.saveToDisk();
		},
		delete: function(index) {
			if (index == null) {
				throw new RangeError('An argument is required')
			}
			if(typeof(index) != "number") {
				throw new TypeError('Argument must be a number'); 
			}

			if (index <= this._data.length - 1) {
				this._data.splice(index, 1);
			} else {
				throw new RangeError('Argument must be a valid index');
			}

			this.saveToDisk();
		},
		deleteAll: function() {
			this._data = [];
			this.saveToDisk();
		},
		deleteCompleted: function () {
			this._data = this.activeTodos();
			this.filter = 'all';
			this.saveToDisk();
		},
		toggle: function(index) {
			if (index == null) {
				throw RangeError ('An argument is required')
			}

			if (index <= this._data.length - 1) {
				this._data[index].completed = !this._data[index].completed;
			} else {
				throw RangeError ('Argument must be a valid index')
			}
			this.saveToDisk();
		},
		toggleAll: function(value) {
			if (value == null) {
				throw new RangeError('An argument is required')
			}
			if (typeof(value) != "boolean") {
				throw new RangeError('Argument must be a Boolean');
			}

			this._data.forEach(function (todo) {
				todo.completed = value;
			});
			this.saveToDisk();
		},
		activeTodos: function () {
			return this._data.filter(function (todo) {
				return !todo.completed;
			});
		},
		completedTodos: function () {
			return this._data.filter(function (todo) {
				return todo.completed;
			});
		},
		filteredTodos: function () {
			if (this.filter === 'active') {
				return this.activeTodos();
			}

			if (this.filter === 'completed') {
				return this.completedTodos();
			}

			return this._data;
		},
		saveToDisk: function() {
			util.store('todos-jquery', this._data);
		},
		loadFromDisk: function() {
			this._data = util.store('todos-jquery');;
		}

	};

	var App = {
		init: function () {
			todos.loadFromDisk();
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();

			new Router({
				'/:filter': function (filter) {
					todos.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		bindEvents: function () {
			$('#new-todo').on('keyup', this.create.bind(this));
			$('#toggle-all').on('change', this.toggleAll.bind(this));
			$('#footer').on('click', '#clear-completed', this.destroyCompleted.bind(this));
			$('#todo-list')
				.on('change', '.toggle', this.toggle.bind(this))
				.on('dblclick', 'label', this.edit.bind(this))
				.on('keyup', '.edit', this.editKeyup.bind(this))
				.on('focusout', '.edit', this.update.bind(this))
				.on('click', '.destroy', this.destroy.bind(this));
		},
		render: function (list) {
			list = todos.filteredTodos() 
			$('#todo-list').html(this.todoTemplate(list));
			$('#main').toggle(list.length > 0);
			$('#toggle-all').prop('checked', todos.activeTodos().length === 0);
			this.renderFooter();
			$('#new-todo').focus();
		},
		renderFooter: function () {
			var todoCount = todos._data.length;
			var activeTodoCount = todos.activeTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			$('#footer').toggle(todoCount > 0).html(template);
		},
		destroyCompleted: function () {
			todos.deleteCompleted();
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var list = todos._data;
			var i = list.length;

			while (i--) {
				if (list[i].id === id) {
					return i;
				}
			}
		},
		create: function (e) {
			var $input = $(e.target);
			var val = $input.val().trim();

			if (e.which !== ENTER_KEY || !val) {
				return;
			}

			todos.add(val);

			$input.val('');

			this.render();
		},
		toggle: function (e) {
			var i = this.indexFromEl(e.target);
			todos.toggle(i)
			this.render();
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			todos.toggleAll(isChecked);

			this.render();
},
		edit: function (e) {
			var $input = $(e.target).closest('li').addClass('editing').find('.edit');
			$input.val($input.val()).focus();
		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {
				e.target.blur();
			}

			if (e.which === ESCAPE_KEY) {
				$(e.target).data('abort', true).blur();
			}
		},
		update: function (e) {
			var el = e.target;
			var $el = $(el);
			var val = $el.val().trim();

			if (!val) {
				todos.delete(e);
				return;
			}

			if ($el.data('abort')) {
				$el.data('abort', false);
			} else {
				todos.update(this.indexFromEl(el),val);
			}
			this.render();
		},
		destroy: function (e) {
			todos.delete(this.indexFromEl(e.target));
			this.render();
		}
	};

	App.init();
});
