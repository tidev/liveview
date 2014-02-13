
SRC = lib/platform/_head.js lib/platform/process.js lib/platform/events.js lib/platform/socket.js lib/platform/require.js lib/platform/_tail.js
BASE_DIR = $(CURDIR)/bin/liveview
# TODO kill only process make started
#`ps -ef | grep 'fserver\|bin\/ti' | awk "{print $2}"` > /dev/null

all: clean liveview.js liveview.min.js

# TODO FIX TEST CASE
# test:
# 	$(shell cd test/platform; \
# 		$(BASE_DIR) run -p ios \
# 			--project-dir ./test/platform \
# 			--device-family iphone \
# 			--sim-type iphone > $(tty))

test:
	@SILENT=TRUE ./node_modules/.bin/mocha \
		--require should \
		--reporter spec

liveview.js: $(SRC)
	cat $^ > build/$@

liveview.min.js: liveview.js
	uglifyjs --no-mangle build/$< > build/$@

clean:
	@ti clean --project-dir ./test/platform
	rm -f liveview{,.min}.js

.PHONY: clean test
