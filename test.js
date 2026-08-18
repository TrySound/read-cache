'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var pify = require('pify');
var readCache = require('./');
var test = require('./test-runner');

var writeFile = pify(fs.writeFile);
var unlink = pify(fs.unlink);
var fixture = 'fixture';
var otherFixture = 'fixture-other';
var oldTime = new Date(1000000000000);

function removeFixture(file) {
	try {
		fs.unlinkSync(file);
	} catch (err) {
		if (err.code !== 'ENOENT') {
			throw err;
		}
	}
}

function resetFixtures() {
	removeFixture(fixture);
	removeFixture(otherFixture);
	readCache.clear();
}

function syncError(fn) {
	try {
		fn();
	} catch (err) {
		return err;
	}

	return null;
}

test('async reads are cached by resolved path and converted on demand', function () {
	resetFixtures();

	return writeFile(fixture, 'original').then(function () {
		fs.utimesSync(fixture, oldTime, oldTime);
		return readCache(fixture);
	}).then(function (content) {
		assert.ok(content instanceof Buffer);
		assert.strictEqual(content.toString(), 'original');
		assert.strictEqual(readCache.get(path.resolve(fixture), 'utf8'), 'original');

		// Replacing the contents without changing mtime must return the cached value.
		return writeFile(fixture, 'replaced');
	}).then(function () {
		fs.utimesSync(fixture, oldTime, oldTime);
		return readCache(path.resolve(fixture), 'utf8');
	}).then(function (content) {
		assert.strictEqual(content, 'original');
		assert.ok(readCache.get(fixture) instanceof Buffer);
		removeFixture(fixture);
	});
});

test('async refreshes changed files and clears stale entries after errors', function () {
	resetFixtures();

	return writeFile(fixture, 'before').then(function () {
		fs.utimesSync(fixture, oldTime, oldTime);
		return readCache(fixture, 'utf8');
	}).then(function (content) {
		assert.strictEqual(content, 'before');
		return writeFile(fixture, 'after');
	}).then(function () {
		return readCache(fixture, 'utf8');
	}).then(function (content) {
		assert.strictEqual(content, 'after');
		return unlink(fixture);
	}).then(function () {
		// get() does no I/O, so the value remains available until a read fails.
		assert.strictEqual(readCache.get(fixture, 'utf8'), 'after');
		return readCache(fixture);
	}).then(function () {
		throw new Error('reading a missing file should reject');
	}, function (err) {
		assert.strictEqual(err.code, 'ENOENT');
		assert.strictEqual(readCache.get(fixture), null);
	});
});

test('sync reads use the cache, refresh changes, and propagate errors', function () {
	resetFixtures();
	fs.writeFileSync(fixture, 'original');
	fs.utimesSync(fixture, oldTime, oldTime);

	var content = readCache.sync(fixture);
	assert.ok(content instanceof Buffer);
	assert.strictEqual(content.toString(), 'original');
	assert.strictEqual(readCache.sync(path.resolve(fixture), 'utf8'), 'original');

	fs.writeFileSync(fixture, 'updated');
	assert.strictEqual(readCache.sync(fixture, 'utf8'), 'updated');

	fs.unlinkSync(fixture);
	assert.strictEqual(readCache.get(fixture, 'utf8'), 'updated');

	var err = syncError(function () {
		readCache.sync(fixture);
	});
	assert.ok(err instanceof Error);
	assert.strictEqual(err.code, 'ENOENT');
	assert.strictEqual(readCache.get(fixture), null);
});

test('get supports encodings without I/O and clear removes every entry', function () {
	resetFixtures();

	return Promise.all([
		writeFile(fixture, 'first'),
		writeFile(otherFixture, 'second')
	]).then(function () {
		return Promise.all([
			readCache(fixture),
			readCache(otherFixture)
		]);
	}).then(function () {
		assert.strictEqual(readCache.get(fixture, 'utf8'), 'first');
		assert.ok(readCache.get(fixture, 'not-an-encoding') instanceof Buffer);
		assert.strictEqual(readCache.get(otherFixture, 'utf8'), 'second');

		readCache.clear();
		assert.strictEqual(readCache.get(fixture), null);
		assert.strictEqual(readCache.get(otherFixture), null);
		resetFixtures();
	});
});

test.run().then(resetFixtures);
