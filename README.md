# read-cache [![Build Status](https://travis-ci.org/TrySound/read-cache.svg?branch=master)](https://travis-ci.org/TrySound/read-cache)

Reads and caches the entire contents of a file until it is modified.


## Install

```
$ npm i read-cache
```


## Usage

```js
// foo.js
var readCache = require('read-cache');

readCache('foo.js').then(function (contents) {
	console.log(contents);
});
```


## API

### readCache(path[, encoding])

Returns a promise that resolves to a content of the file.

### readCache.sync(path[, encoding])

Returns a content of the file.

### readCache.get(path)

Returns a content of cached file or null.

### readCache.clear()

Clears cache with loaded contents.


## License

MIT © [Bogdan Chadkin](mailto:trysound@yandex.ru)
