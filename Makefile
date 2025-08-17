debug: src/gen/Commit.js src/gen/Icons.js types lint
release: debug bundle-js bundle-css

types: node_modules
	npx tsc --project ./jsconfig.json --pretty false

lint: node_modules
	npx eslint .

bundle-js: node_modules
	npx esbuild src/Main.js --bundle --minify --target=es2020 --outfile=build/bundle.js --log-override:empty-import-meta=silent --color=false

bundle-css: node_modules
	npx esbuild src/Main.css --bundle --minify --target=firefox102,chrome83,safari15 --outfile=build/bundle.css --color=false

src/gen/Commit.js src/gen/Icons.js: commit assets/icons scripts/build.mjs
	node scripts/build.mjs

node_modules: package.json
	npm install
	touch node_modules
