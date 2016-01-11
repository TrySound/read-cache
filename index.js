var fs = require('fs');
var path = require('path');
var pify = require('pify');

var stat = pify(fs.stat);
var readFile = pify(fs.readFile);
var resolve = path.resolve;

var cache = Object.create(null);

module.exports = function (path, encoding) {
	path = resolve(path);

	return stat(path).then(function (stats) {
		var item = cache[path];

		if (item && item.mtime.getTime() === stats.mtime.getTime()) {
			return item.content;
		}

		return readFile(path, encoding).then(function (data) {
			cache[path] = {
				mtime: stats.mtime,
				content: data
			};

			return data;
		});
	}).catch(function (err) {
		cache[path] = null;
		return Promise.reject(err);
	});
};

module.exports.sync = function (path, encoding) {
	path = resolve(path);

	try {
		var stats = fs.statSync(path);
		var item = cache[path];

		if (item && item.mtime.getTime() === stats.mtime.getTime()) {
			return item.content;
		}

		var data = fs.readFileSync(path, encoding);

		cache[path] = {
			mtime: stats.mtime,
			content: data
		};

		return data;
	} catch (err) {
		cache[path] = null;
		throw err;
	}

};

module.exports.get = function (path) {
	path = resolve(path);
	return cache[path] ? cache[path].content : null;
};

module.exports.clear = function () {
	cache = Object.create(null);
};
