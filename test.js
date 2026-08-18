import test from 'ava';
import fs from 'fs';
import path from 'path';
import del from 'del';
import pify from 'pify';
import readCache from './';

const writeFile = pify(fs.writeFile);
const unlink = pify(fs.unlink);
const fixture = 'fixture';
const otherFixture = 'fixture-other';
const oldTime = new Date(1000000000000);

function resetFixtures() {
	del.sync([fixture, otherFixture]);
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

test.serial('async reads are cached by resolved path and converted on demand', t => {
	resetFixtures();

	return writeFile(fixture, 'original').then(() => {
		fs.utimesSync(fixture, oldTime, oldTime);
		return readCache(fixture);
	}).then(content => {
		t.ok(content instanceof Buffer);
		t.is(content.toString(), 'original');
		t.is(readCache.get(path.resolve(fixture), 'utf8'), 'original');

		// Replacing the contents without changing mtime must return the cached value.
		return writeFile(fixture, 'replaced');
	}).then(() => {
		fs.utimesSync(fixture, oldTime, oldTime);
		return readCache(path.resolve(fixture), 'utf8');
	}).then(content => {
		t.is(content, 'original');
		t.ok(readCache.get(fixture) instanceof Buffer);
		del.sync(fixture);
	});
});

test.serial('async refreshes changed files and clears stale entries after errors', t => {
	resetFixtures();

	return writeFile(fixture, 'before').then(() => {
		fs.utimesSync(fixture, oldTime, oldTime);
		return readCache(fixture, 'utf8');
	}).then(content => {
		t.is(content, 'before');
		return writeFile(fixture, 'after');
	}).then(() => {
		return readCache(fixture, 'utf8');
	}).then(content => {
		t.is(content, 'after');
		return unlink(fixture);
	}).then(() => {
		// get() does no I/O, so the value remains available until a read fails.
		t.is(readCache.get(fixture, 'utf8'), 'after');
		return readCache(fixture);
	}).then(() => {
		t.fail('reading a missing file should reject');
	}, err => {
		t.is(err.code, 'ENOENT');
		t.is(readCache.get(fixture), null);
	});
});

test.serial('sync reads use the cache, refresh changes, and propagate errors', t => {
	resetFixtures();
	fs.writeFileSync(fixture, 'original');
	fs.utimesSync(fixture, oldTime, oldTime);

	var content = readCache.sync(fixture);
	t.ok(content instanceof Buffer);
	t.is(content.toString(), 'original');
	t.is(readCache.sync(path.resolve(fixture), 'utf8'), 'original');

	fs.writeFileSync(fixture, 'updated');
	t.is(readCache.sync(fixture, 'utf8'), 'updated');

	fs.unlinkSync(fixture);
	t.is(readCache.get(fixture, 'utf8'), 'updated');

	var err = syncError(() => readCache.sync(fixture));
	t.ok(err instanceof Error);
	t.is(err.code, 'ENOENT');
	t.is(readCache.get(fixture), null);
});

test.serial('get supports encodings without I/O and clear removes every entry', t => {
	resetFixtures();

	return Promise.all([
		writeFile(fixture, 'first'),
		writeFile(otherFixture, 'second')
	]).then(() => {
		return Promise.all([
			readCache(fixture),
			readCache(otherFixture)
		]);
	}).then(() => {
		t.is(readCache.get(fixture, 'utf8'), 'first');
		t.ok(readCache.get(fixture, 'not-an-encoding') instanceof Buffer);
		t.is(readCache.get(otherFixture, 'utf8'), 'second');

		readCache.clear();
		t.is(readCache.get(fixture), null);
		t.is(readCache.get(otherFixture), null);
		resetFixtures();
	});
});
