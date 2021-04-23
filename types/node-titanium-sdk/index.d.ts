declare module 'node-titanium-sdk' {
	function validateCorrectSDK(logger: any, config: any, cli: any, cmd: string);
	function validateTiappXml(logger: any, config: any, tiapp: any);
}

declare module 'node-titanium-sdk/lib/tiappxml' {
	export default class TiAppXml {
		constructor(path: string);
		properties: any;
	}
}
