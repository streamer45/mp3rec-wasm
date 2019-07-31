all: encoder.wasm

vendor/lame/dist/lib/libmp3lame.a:
	cd vendor/lame && \
	emconfigure ./configure --prefix="$(shell pwd)/vendor/lame/dist" --disable-shared \
		--disable-gtktest --disable-analyzer-hooks --disable-decoder --disable-frontend CFLAGS="-O2" && \
	emmake make -j4 && \
	emmake make install

clean: clean-lame clean-wasm

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

clean-lame:
	cd vendor/lame && rm -rf dist && make clean

clean-wasm:
	rm -rf dist
