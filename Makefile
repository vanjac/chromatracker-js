build: src/gen/Commit.js src/gen/Icons.js types lint

types: node_modules
	npm run types

lint: node_modules
	npm run lint

src/gen/Commit.js src/gen/Icons.js: commit assets/icons build.mjs
	node build.mjs

node_modules: package.json
	npm install
	touch node_modules
