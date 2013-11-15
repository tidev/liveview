
0.1.34 / 2013-09-30
==================

* remove nulling of Module namespace on restart
* default to string name for locale
* add locale feature
* Merge pull request #58 from euforic/TIMOB-15009
* remove console logging for debugging
* [TIMOB-15009] update jsparse-tools to new 0.1.0 and remove var from global variable declarations in app.js
* Merge pull request #57 from euforic/TIMOB-14489
* bumb version to 0.1.34
* [TIMOB-14489] properly shutdown client socket before restart to speedup restart


0.1.33 / 2013-08-26
==================

 * Merge pull request #56 from euforic/TIMOB-14836
 * throw error instead of logging to console when server is unavailalbe
 * Merge pull request #55 from euforic/TIMOB-14489
 * TIMOB-14489 - error with Ti.pump attempting to read stream on close causing reload to hang
 * Merge pull request #54 from euforic/linuxTMPDIR
 * fix pid path unreachable due to permission on linux

0.1.32 / 2013-08-07
==================

 * Merge pull request #53 from euforic/bug/ipdetect
 * bump version
 * fix incorrect resolution of users network ip address

0.1.31 / 2013-08-07
==================

 * cleanup debug console output
 * bump version

0.1.30 / 2013-08-06
==================

 * Merge pull request #51 from euforic/bug/[TIMOB-14721](https://jira.appcelerator.org/browse/TIMOB-14721)
 * ignore try catch response in lex scope and clean up debug output
 * Merge pull request #50 from euforic/bug/[TIMOB-14721](https://jira.appcelerator.org/browse/TIMOB-14721)
 * remove debug code
 * add mising dep
 * grab app.js lexscope vars
 * Merge pull request #48 from euforic/bug/T[TIMOB-14260](https://jira.appcelerator.org/browse/TIMOB-14260)
 * bump version
 * extend http request timeout and catch undefined platform in request header

0.1.29 / 2013-07-26
==================

- [TIMOB-13850](https://jira.appcelerator.org/browse/TIMOB-13850) : Clicking login on field service app (from Studio Sample) throws error.
- [TIMOB-14226](https://jira.appcelerator.org/browse/TIMOB-14226) : building/running fails when LiveView server is not running - subsequently build/run works as expected
- [TIMOB-14262](https://jira.appcelerator.org/browse/TIMOB-14262) : Does not trigger code errors
- [TIMOB-14580](https://jira.appcelerator.org/browse/TIMOB-14580) : LiveView: Spoof Crittercism function when Liveview is running
- [TIMOB-14645](https://jira.appcelerator.org/browse/TIMOB-14580) : KitchenSink app fails to run with liveview enabled
- [TIMOB-14657](https://jira.appcelerator.org/browse/TIMOB-14657) : LiveView: File Server unavailable on Android Device
- Fixed Ti.Include override function not fetching and evaling code