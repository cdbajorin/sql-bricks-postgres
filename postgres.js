// Postgres extension for SQLBricks
(function() {
  "use strict";

  var sql, _;
  if (typeof exports != 'undefined') {
    sql = require('sql-bricks');
    _ = require('underscore');
  } else {
    sql = window.SqlBricks;
    _ = window._;
  }

  var Select = sql.select;
  var Insert = sql.insert;
  var Update = sql.update;
  var Delete = sql.delete;

  Insert.prototype.returning =
    Update.prototype.returning =
    Delete.prototype.returning = function() {
      return this._addListArgs(arguments, '_returning');
    };

  Delete.prototype.using = function() {
    return this._addListArgs(arguments, '_using');
  };

  var returning_tmpl = '{{#if _returning}}RETURNING {{columns _returning}}{{/if}}';
  Insert.defineClause('returning', returning_tmpl, {after: 'values'});
  Update.defineClause('returning', returning_tmpl, {after: 'where'});
  Delete.defineClause('returning', returning_tmpl, {after: 'where'});

  Delete.defineClause('using', '{{#if _using}}USING {{tables _using}}{{/if}}', {after: 'delete'});

  // TODO: shouldn't LIMIT/OFFSET use handleValue()? Otherwise isn't it vulnerable to SQL Injection?
  Select.prototype.limit = function(val) {
    this._limit = val;
    return this;
  };
  Select.prototype.offset = function(val) {
    this._offset = val;
    return this;
  };

  Select.defineClause(
    'limit',
    '{{#ifNotNull _limit}}LIMIT {{_limit}}{{/ifNotNull}}',
    {after: 'orderBy'}
  );

  Select.defineClause(
    'offset',
    '{{#ifNotNull _offset}}OFFSET {{_offset}}{{/ifNotNull}}',
    {after: 'limit'}
  );

  // UPDATE ... FROM
  Update.prototype.from = function() {
    return this._addListArgs(arguments, '_from');
  };
  Update.defineClause('from', '{{#if _from}}FROM {{tables _from}}{{/if}}', {after: 'set'});

  // VALUES statement for SELECT/UPDATE/DELETE ... FROM VALUES
  function Values(_values) {
    if (!(this instanceof Values))
      return new Values(_values);

    Values.super_.call(this, 'values');
    this._values = _.isArray(_values) ? _values : [_values];
    return this;
  }
  sql.values = sql.inherits(Values, sql.Statement);
  Values.defineClause = Select.defineClause;

  Values.defineClause('values', function (opts) {
    var handleValues = this._types ? typedValues : sql._handleValues;
    var values = this._values.map(function (values) {
      return '(' + handleValues(_.values(values), opts).join(', ') + ')';
    }).join(', ');

    return 'VALUES ' + values;
  });

  Values.prototype.types = function () {
    this._types = true;
    return this;
  }

  function typeCoerce(val) {
    if (typeof val === 'number') {
      return (val % 1 ===  0) ? '::int' : '::float';
    } else if (typeof val === 'boolean') {
      return '::bool';
    } else {
      return ''
    }
  }
  function typedValues(vals, opts) {
    return vals.map(function (val) {
      return sql._handleValue(val, opts) + typeCoerce(val);
    });
  }

  Values.prototype.as = function (alias) {
    this._alias = alias;
    return this;
  }

  Values.prototype.columns = function () {
    this._columns = true;
    return this;
  }
  Values.prototype._strAlias = function (opts) {
    if (!this._alias) return '';

    var alias = ' ' + sql._autoQuote(this._alias);
    if (this._columns) {
      alias += ' (' + sql._handleColumns(_.keys(this._values[0])) + ')';
    }
    return alias;
  }

  if (typeof exports != 'undefined')
    module.exports = sql;
  else
    window.PostgresBricks = sql;

})();


