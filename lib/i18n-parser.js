const fs = require('fs-extra');
const path = require('path');
const DOMParser = require('xmldom').DOMParser;

exports.parsei18n = function (localeDir) {
	const langData = {};
	if (!fs.existsSync(localeDir)) {
		return langData;
	}
	const langs = fs.readdirSync(localeDir).filter(function (name) {
		return fs.statSync(path.resolve(localeDir, name)).isDirectory();
	});
	for (const lang of langs) {
		const file = path.join(localeDir, lang, 'strings.xml');
		if (fs.existsSync(file)) {
			const dom = new DOMParser().parseFromString(fs.readFileSync(file, 'utf8'));
			const tags = {};
			for (let child in dom.documentElement.childNodes) {
				child = dom.documentElement.childNodes[child];
				if (child.nodeType === 1) {
					if (child && child.firstChild) {
						const name = child.getAttribute('name');
						tags[name] = child.firstChild.data;
					}
				}
			}
			langData[lang] = tags;
		}
	}
	return langData;
};
