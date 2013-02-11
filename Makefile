
SRC = lib/platform/_head.js lib/platform/events.js lib/platform/process.js lib/platform/require.js lib/platform/_tail.js
BASE_DIR = $(CURDIR)/bin/liveti
# TODO kill only process make started
#`ps -ef | grep 'fserver\|bin\/ti' | awk "{print $2}"` > /dev/null

all: clean liveti.js liveti.min.js

# TODO FIX TEST CASE
# test:
# 	$(shell cd test/platform; \
# 		$(BASE_DIR) run -p ios \
# 			--project-dir ./test/platform \
# 			--device-family iphone \
# 			--sim-type iphone > $(tty))

liveti.js: $(SRC)
	cat $^ > build/$@

liveti.min.js: liveti.js
	uglifyjs --no-mangle build/$< > build/$@

clean:
	@ti clean --project-dir ./test/platform
	rm -f liveti{,.min}.js

.PHONY: clean test
