debug: src/gen/Commit.js src/gen/Icons.js types lint
release: debug bundle-js bundle-css

types: node_modules
	npx tsc --project ./jsconfig.json

lint: node_modules
	npx eslint .

bundle-js: node_modules
	npx esbuild src/Main.js --bundle --minify --outfile=build/bundle.js \
		--target=es2020 --define:import.meta.main=false --drop:console \
		--sourcemap --sources-content=false

bundle-css: node_modules
	npx esbuild src/Main.css --bundle --minify --outfile=build/bundle.css \
		--target=firefox102,chrome83,safari15

bundle-fonts: node_modules
	npx esbuild assets/Font.css --bundle --minify --outfile=build/font.css \
		--target=firefox102,chrome83,safari15 --loader:.woff2=dataurl

src/gen/Commit.js src/gen/Icons.js: commit assets/icons scripts/build.mjs
	node scripts/build.mjs

node_modules: package.json
	npm install
	touch node_modules
