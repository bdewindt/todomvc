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
		_data = [],
		add: function(todoText, completed = false) {
			if (!Boolean(completed)) {
				throw new TypeError('Second argument must be a boolean'); 
			}

			this._data.push({
				id: util.uuid(),
				title: todoText,
				completed: completed
			});
			this.saveToDisk();
		},
		delete: function(index) {
			if (!index) {
				throw new RangeError('An argument is required')
			}
			if(!Number(index)) {
				throw new TypeError('Argument must be a number'); 
			}

			if (index && index <= _data.length - 1) {
				_data.splice(index, 1);
			} else {
				throw new RangeError('Argument must be a valid index');
			}

			this.saveToDisk();
		},
		deleteAll: function() {
			this._data = [];
			this.saveToDisk();
		},
		toggle: function(index) {
			if (!index) {
				throw RangeError ('An argument is required')
			}

			if (index <= _data.length - 1) {
				this._data[index].completed = !this._data[index].completed;
			} else {
				throw RangeError ('Argument must be a valid index')
			}
			this.saveToDisk();
		},
		toggleAll: function(value) {
			if (!value) {
				throw new RangeError('An argument is required')
			}
			if (!Boolean(value)) {
				throw new RangeError('Argument must be a Boolean');
			}

			this._data.forEach(function (todo) {
				todo.completed = value;
			});
			this.saveToDisk();
		},
		saveToDisk: function() {
			util.store('todos-jquery', this._data);
		},
		loadFromDisk: function() {
			_data = util.store('todos-jquery');;
		}

	};

	var App = {
		init: function () {
			this.todos = util.store('todos-jquery');
			//this.todos.loadFromDisk();
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();

			new Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render(this.getFilteredTodos());
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
		render: function (todos) {
			$('#todo-list').html(this.todoTemplate(todos));
			$('#main').toggle(todos.length > 0);
			$('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
			this.renderFooter();
			$('#new-todo').focus();
		},
		renderFooter: function () {
			var todoCount = this.todos.length;
			var activeTodoCount = this.getActiveTodos().length;
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			$('#footer').toggle(todoCount > 0).html(template);
		},
		toggleAll: function (e) {
			var isChecked = $(e.target).prop('checked');

			this.todos.forEach(function (todo) {
				todo.completed = isChecked;
			});
			// this.todos.toggle(isChecked)
			this.saveDataToDisk();
			this.render(this.getFilteredTodos());
		},
		getActiveTodos: function () {
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {
			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.saveDataToDisk();
			this.render(this.getFilteredTodos());
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		indexFromEl: function (el) {
			var id = $(el).closest('li').data('id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {
				if (todos[i].id === id) {
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

			this.todos.push({
				id: util.uuid(),
				title: val,
				completed: false
			});
			// this.todos.add(val);

			$input.val('');

			this.saveDataToDisk();
			this.render(this.getFilteredTodos());
		},
		toggle: function (e) {
			var i = this.indexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.saveDataToDisk();
			this.render(this.getFilteredTodos());
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
				this.destroy(e);
				return;
			}

			if ($el.data('abort')) {
				$el.data('abort', false);
			} else {
				this.todos[this.indexFromEl(el)].title = val;
			}
			this.saveDataToDisk();
			this.render(this.getFilteredTodos());
		},
		destroy: function (e) {
			this.todos.splice(this.indexFromEl(e.target), 1);
			//this.todos.delete(this.indexFromEl(e.target));
			this.render(this.getFilteredTodos());
		},
		saveDataToDisk: function () {
			util.store('todos-jquery', this.todos);
		}
	};

	App.init();
});
