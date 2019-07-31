all: encoder.wasm

PKG_VERSION=$$(git describe --tags)

vendor/lame/dist/lib/libmp3lame.a:
	cd vendor/lame && \
	emconfigure ./configure --prefix="$(shell pwd)/vendor/lame/dist" --disable-shared \
		--disable-gtktest --disable-analyzer-hooks --disable-decoder --disable-frontend CFLAGS="-O2" && \
	emmake make -j4 && \
	emmake make install

clean: clean-lame clean-wasm clean-release

encoder.wasm: vendor/lame/dist/lib/libmp3lame.a src/encoder.c
	mkdir -p dist && \
	emcc $^ -s WASM=1 -O2 \
	-s ASSERTIONS=0 \
	-s TOTAL_STACK=65536 \
	-s TOTAL_MEMORY=2097152 \
	-s EXPORTED_FUNCTIONS="['_malloc', '_free']" \
	-Ivendor/lame/dist/include \
	-o dist/encoder.js && \
	cp src/*.js dist/

release: encoder.wasm
	mkdir -p release && \
	cd release && \
	cp -r ../dist mp3enc-wasm && \
	tar -czvf mp3enc-wasm-${PKG_VERSION}.tar.gz mp3enc-wasm && \
	zip -r mp3enc-wasm-${PKG_VERSION}.zip mp3enc-wasm && \
	rm -rf mp3enc-wasm

clean-lame:
	cd vendor/lame && rm -rf dist && make clean

clean-wasm:
	rm -rf dist

clean-release:
	rm -rf release
