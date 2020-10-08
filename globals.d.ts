interface Window {
	M: any;
	turndownService?: TurndownService;
}

type TurndownFilterFunc = (node: HTMLElement, options: Object) => boolean;

interface TurndownService {
	turndown: (input: string) => string;
	addRule(
		key: string,
		rule: {
			filter: string[] | string | TurndownFilterFunc;
			replacement: (content: string, node: HTMLElement, options: Object) => string;
		}
	): void;
}

let M: any;
let TurndownService: {
	new (): TurndownService;
};
