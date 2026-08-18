'use strict';

var tests = [];

function test(name, fn) {
	tests.push({name: name, fn: fn});
}

function reportFailure(name, err) {
	console.error('not ok - ' + name);
	console.error(err && err.stack || err);
}

test.run = function () {
	var passed = 0;
	var failed = 0;
	var index = 0;

	function next() {
		if (index === tests.length) {
			console.log('\n' + passed + ' passed, ' + failed + ' failed');
			if (failed) {
				process.exitCode = 1;
			}
			return Promise.resolve();
		}

		var current = tests[index++];

		return Promise.resolve().then(current.fn).then(function () {
			passed++;
			console.log('ok - ' + current.name);
		}, function (err) {
			failed++;
			reportFailure(current.name, err);
		}).then(next);
	}

	return next();
};

module.exports = test;
