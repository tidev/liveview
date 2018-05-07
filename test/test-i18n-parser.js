const parsei18n = require('../lib/i18n-parser').parsei18n;
const path = require('path');
const should = require('should'); // eslint-disable-line no-unused-vars
const fixturesDir = path.join(__dirname, 'fixtures', 'i18n-parser');

describe('parsei18n', () => {

	it('should return empty object when no i18n folder', () => {
		const i18n = parsei18n(path.join(fixturesDir, 'no-i18n'));
		should(i18n).deepEqual({});
	});

	it('should return valid object for i18n defintion', () => {
		const i18n = parsei18n(path.join(fixturesDir, 'valid-i18n', 'i18n'));
		should(i18n).deepEqual({
			de: {
				add_subtitle: 'Wählen Sie ein neues Bild',
				add_title: 'Bild auswählen'
			},
			en: {
				add_subtitle: 'Select a new Picture',
				add_title: 'Add Picture'
			}
		});
	});

	// Test to ensure https://jira.appcelerator.org/browse/TIMOB-16149 still works
	it('should correctly decode XML entities', () => {
		const i18n = parsei18n(path.join(fixturesDir, 'xml-entities', 'i18n'));
		should(i18n).deepEqual({
			en: {
				test_entities: 'Livéviéw & Titanium Rock! ♥'
			}
		});
	});
});
