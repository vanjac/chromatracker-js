build: src/gen/Version.js src/gen/Icons.js types lint

types: node_modules
	npm run types

lint: node_modules
	npm run lint

src/gen/Version.js src/gen/Icons.js: version assets/icons build.mjs
	node build.mjs

node_modules: package.json
	npm install
	touch node_modules
