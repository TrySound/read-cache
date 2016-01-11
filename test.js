import test from 'ava';
import fs from 'fs';
import del from 'del';
import pify from 'pify';
import readCache from './';

const readFile = pify(fs.readFile);
const writeFile = pify(fs.writeFile);

test.serial('async', t => {
	readCache.clear();
	t.is(readCache.get('fixture'), null);

	return writeFile('fixture', 'data').then(() => {
		return Promise.all([
			readCache('fixture'),
			readCache('node_modules/../fixture')
		]);
	}).then(contents => {
		t.ok(contents[0] instanceof Buffer);
		t.ok(contents[1] instanceof Buffer);
		t.is(contents[0].toString(), 'data');
		t.is(contents[1].toString(), 'data');
		return writeFile('fixture', 'changed data');
	}).then(() => {
		return Promise.all([
			readCache('fixture', 'utf-8'),
			readCache('node_modules/../fixture', 'utf-8')
		]);
	}).then(contents => {
		t.is(contents[0], 'changed data');
		t.is(contents[1], 'changed data');
		return del('fixture');
	}).then(() => {
		return readCache('fixture');
	}).then(() => {
		t.fail(`should reject an error if 'fixture' doesn't exist`);
	}).catch(() => {
		t.is(readCache.get('fixture'), null);
	});
});

test.serial('sync', t => {
	readCache.clear();
	t.is(readCache.get('fixture'), null);

	fs.writeFileSync('fixture', 'data')

	t.is(readCache.sync('fixture', 'utf-8'), 'data');
	t.is(readCache.sync('node_modules/../fixture', 'utf-8'), 'data');

	fs.writeFileSync('fixture', 'changed data')

	var contents = [
		readCache.sync('fixture'),
		readCache.sync('node_modules/../fixture')
	];
	t.ok(contents[0] instanceof Buffer);
	t.ok(contents[1] instanceof Buffer);
	t.is(contents[0].toString(), 'changed data');
	t.is(contents[1].toString(), 'changed data');

	del.sync('fixture');

	try {
		readCache.sync('fixture');
		t.fail(`should throw an error if 'fixture' doesn't exist`);
	} catch (e) {
		t.is(readCache.get('fixture'), null);
	}
});

test.serial('get', t => {
	return writeFile('fixture', 'data').then(() => {
		return readCache('fixture', 'utf-8');
	}).then(() => {
		t.is(readCache.get('node_modules/../fixture'), 'data');
		t.is(readCache.get('fixture'), 'data');
		return del('fixture');
	}).then(() => {
		t.is(readCache.get('node_modules/../fixture'), 'data');
		t.is(readCache.get('fixture'), 'data');
	});
});

test.serial('clear', t => {
	return writeFile('fixture', 'data').then(() => {
		return readCache('fixture', 'utf-8');
	}).then(content => {
		t.is(content, 'data');
		t.is(readCache.get('fixture'), 'data');
		readCache.clear();
		t.is(readCache.get('fixture'), null);
	});
});
