debug: types lint
release: debug bundle-html

types: node_modules gen-js
	npx tsc --project ./jsconfig.json

lint: node_modules gen-js
	npx eslint .

bundle-js: node_modules gen-js
	npx esbuild src/Main.js --bundle --minify --outfile=build/bundle.js \
		--target=es2020 --define:import.meta.main=false --drop:console \
		--sourcemap --sources-content=false

bundle-css: node_modules
	npx esbuild src/Main.css --bundle --minify --outfile=build/bundle.css \
		--target=firefox102,chrome83,safari15

bundle-fonts: node_modules
	npx esbuild assets/Font.css --bundle --minify --outfile=build/font.css \
		--target=firefox102,chrome83,safari15 --loader:.woff2=dataurl

bundle-html: bundle-js bundle-css bundle-fonts
	node scripts/htmlbundle.mjs

src/gen/Commit.js: commit scripts/gencommit.mjs
	node scripts/gencommit.mjs

src/gen/Icons.js: assets/icons scripts/genicons.mjs
	node scripts/genicons.mjs

gen-js: src/gen/Commit.js src/gen/Icons.js

node_modules: package.json
	npm install
	touch node_modules
