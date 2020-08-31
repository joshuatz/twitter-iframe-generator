// @ts-check
/// <reference path="./globals.d.ts" />

/**
 * Configurable Constants
 */
const CACHE_KEY = 'cache';
const API_THROTTLE_MS = 500;
const MULTI_URL_PREVIEW_PLACEHOLDER = `<b>Preview is skipped for bulk export</b>`;
const SINGLE_URL_PREVIEW_PLACEHOLDER = `<i>Waiting for generation...</i>`;

/**
 * Elements
 */
const outputArea = /** @type {HTMLTextAreaElement} */ (document.getElementById('outputTextArea'));
const urlInputElem = /** @type {HTMLInputElement} */ (document.getElementById('tweetUrlInput'));
const multiUrlInputElem = /** @type {HTMLTextAreaElement} */ (document.getElementById('tweetUrlInputMultiple'));
const generateButton = document.getElementById('generateButton');
const placeholderOutTxt = outputArea.value;
const previewArea = document.getElementById('previewArea');
const inputForm = /** @type {HTMLFormElement} */ (document.getElementById('inputForm'));
const defaultHeightInput = /** @type {HTMLInputElement} */ (document.getElementById('defaultHeight'));
const removeBorderCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('removeBorder'));
const sandboxCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('sandbox'));
const sampleButton = document.getElementById('sampleButton');
const hideOverflowCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('hideOverflow'));
const aboutSection = document.getElementById('aboutSection');
const aboutButtons = document.querySelectorAll('.aboutButton');
const blockQuoteModeCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('blockQuoteModeCheckbox'));

/**
 * Cache
 */
const getCache = () => {
	const cacheStr = localStorage.getItem(CACHE_KEY) || `{}`;
	return JSON.parse(cacheStr);
};
const updateCache = (cache) => {
	localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};
let cache = getCache();

/**
 * @param {string} tweetUrl
 * @param {Config} config
 */
const getIframeCodeFromTweet = async (tweetUrl, config) => {
	const embedInfo = await getOEmbed(tweetUrl);
	console.log(embedInfo);
	let { html, width, height } = embedInfo;
	height = height || config.defaultHeight;
	let iframeCodeStr = '';
	const iframeProps = {
		style: null,
		width,
		height,
		'data-tweet-url': embedInfo.url,
		sandbox: config.sandbox
	};
	if (!config.blockQuoteMode && config.hideOverflow) {
		// To hide overflow, the style has to be injected *inside* the frame
		html += `<style>html{overflow:hidden !important;}</style>`;
	}
	if (config.removeBorder) {
		iframeProps.style = 'border:none;';
	}

	if (config.blockQuoteMode) {
		// Strip Twitter JS script tag
		html = html.replace(/<script[^<]+<\/script>/gi, '');
		iframeCodeStr = html;
	} else if (config.iframeType === 'dataUri') {
		const dataUri = `data:text/html;charset=utf-8,${escape(html)}`;
		iframeCodeStr = getIframeStrWithProps({
			...iframeProps,
			src: dataUri
		});
	} else {
		iframeCodeStr = getIframeStrWithProps({
			...iframeProps,
			srcdoc: simpleEscape(html)
		});
	}

	return iframeCodeStr;
};

// Main Generate Func
const generate = async (optEvent, saveToFile = false) => {
	const config = getConfig();
	console.log(config);
	if (config.urlInputType === 'single') {
		if (urlInputElem.value && urlInputElem.checkValidity()) {
			const tweetUrl = urlInputElem.value;
			try {
				const iframeCodeStr = await getIframeCodeFromTweet(tweetUrl, config);
				outputArea.value = iframeCodeStr;
				previewArea.innerHTML = iframeCodeStr;
				if (optEvent) {
					copyOutputToClipboard(optEvent);
				}
			} catch (e) {
				reset(false);
				console.error(e);
				alert('Something went wrong! Maybe an invalid Tweet URL? 😢');
			}
		} else {
			alert('Please enter a valid URL 🙃');
		}
	} else {
		// Iterate
		const iframeCodeStrArr = /** @type {string[]} */ ([]);
		const exportMdArr = [['Tweet URL', 'Iframe Code']];
		const tweetUrlsArr = multiUrlInputElem.value.split('\n').filter((val) => val !== '');
		for (let x = 0; x < tweetUrlsArr.length; x++) {
			const tweetUrl = tweetUrlsArr[x];

			// Throttle requests
			if (x > 0) {
				await new Promise((res) => setTimeout(res, API_THROTTLE_MS));
			}

			try {
				const iframeCodeStr = await getIframeCodeFromTweet(tweetUrl, config);
				iframeCodeStrArr.push(iframeCodeStr);
				exportMdArr.push([tweetUrl, iframeCodeStr]);
			} catch (e) {
				iframeCodeStrArr.push(`<!-- Failed to fetch tweet: ${tweetUrl}`);
				exportMdArr.push([tweetUrl, '']);
				console.error(`Failed to fetch tweet`, e);
			}
		}

		if (tweetUrlsArr.length) {
			// Join together output with line breaks
			const outputCode = iframeCodeStrArr.join('\n');
			outputArea.value = outputCode;
			if (optEvent) {
				copyOutputToClipboard(optEvent);
			}

			const stamp = new Date().getTime();
			if (saveToFile) {
				downloadCsv(exportMdArr, `twitter_embeds_${stamp}.csv`);
			}
		}
	}
};

/**
 * Copy output code to clipboard
 * @param {MouseEvent | Event} event
 */
const copyOutputToClipboard = async (event) => {
	const success = copyToClipboard(outputArea, event);

	if (success) {
		M.toast({
			html: 'Copied to clipboard!'
		});
	}
};

/**
 * Copy text to clipboard, from textarea
 *  - Note: event param is used as reminder that copy ops require short-lived event triggers
 * @param {HTMLTextAreaElement} textArea
 * @param {MouseEvent | Event} [event]
 * @returns {Promise<boolean>} sucess
 */
const copyToClipboard = async (textArea, event) => {
	let success = false;
	const text = textArea.value;
	textArea.select();

	if (navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text);
			success = true;
		} catch (err) {
			console.error('Failed to write to clipboard', err);
		}
	}

	if (!success) {
		success = document.execCommand('copy');
	}

	return success;
};

/**
 * Generate a CSV or TSV download from a MD Array
 * @param {Array<Array<any>>} mdArr
 * @param {string} [filename]
 * @param {',' | '\t'} [delimiter]
 */
const downloadCsv = (mdArr, filename, delimiter = ',') => {
	const extension = delimiter === ',' ? 'csv' : 'tsv';
	const mimeString = extension === 'csv' ? 'text/csv' : 'text/tab-separated-values';
	if (!/(\.tsv$|\.csv$)/.test(filename)) {
		filename += `.${extension}`;
	}
	// CSV requires some special escaping
	if (extension === 'csv') {
		mdArr = mdArr.map((arr) => {
			return arr.map((val) => {
				// If it contains a quote, you have to double escape
				val = val.replace(/"/gm, `""`);
				// Wrap entire string (this will also escape commas)
				val = `"${val}"`;
				return val;
			});
		});
	}
	const rawOutput = `data:${mimeString};charset=utf-8,${mdArr.map((r) => r.join(delimiter)).join('\n')}`;
	const link = document.createElement('a');
	link.setAttribute('href', encodeURI(rawOutput));
	link.setAttribute('download', filename);
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click(); // Prompt download
	link.parentNode.removeChild(link); // Cleanup
};

/**
 * Reset form
 * @param {boolean} resetUrl should URL input be reset?
 */
const reset = (resetUrl) => {
	outputArea.disabled = true;
	outputArea.value = placeholderOutTxt;
	previewArea.innerHTML = '';
	if (resetUrl) {
		urlInputElem.value = '';
	}
};

const loadSample = (optEvent) => {
	/** @type {Config} */
	const sampleConfig = {
		urlInput: 'https://twitter.com/1joshuatz/status/1178001362690293760',
		urlInputType: 'single',
		blockQuoteMode: false,
		iframeType: 'dataUri',
		defaultHeight: 620,
		removeBorder: true,
		sandbox: false,
		hideOverflow: true
	};
	mapConfigToInputs(sampleConfig);
	generate(optEvent);
};

const getConfig = () => {
	/** @type {Config} */
	const config = {
		urlInput: urlInputElem.value,
		// @ts-ignore
		urlInputType: document.querySelector('input[name="urlInputType"]:checked').value,
		blockQuoteMode: !!blockQuoteModeCheckbox.checked,
		// @ts-ignore
		iframeType: document.querySelector('input[name="iframeType"]:checked').value,
		defaultHeight: parseInt(defaultHeightInput.value, 10),
		removeBorder: !!removeBorderCheckbox.checked,
		sandbox: !!sandboxCheckbox.checked,
		hideOverflow: !!hideOverflowCheckbox.checked
	};
	return config;
};

/**
 * Map config to UI inputs
 * @param {Config} config
 */
const mapConfigToInputs = (config) => {
	urlInputElem.value = config.urlInput;
	// @ts-ignore
	document.querySelector(`input[name="urlInputType"][value="${config.urlInputType}"]`).checked = true;
	blockQuoteModeCheckbox.checked = config.blockQuoteMode;
	blockQuoteModeCheckbox.dispatchEvent(new Event('change'));
	// @ts-ignore
	document.querySelector(`input[name="iframeType"][value="${config.iframeType}"]`).checked = true;
	removeBorderCheckbox.checked = config.removeBorder;
	defaultHeightInput.value = config.defaultHeight.toString();
	hideOverflowCheckbox.checked = config.hideOverflow;
};

/**
 * Construct an IFrame string with arbitrary props and content
 * @param {Record<string, any>} props
 * @param {string} [fallbackContent] - Fallback content for if IFrames are disabled / unsupported
 * @param {boolean} [includeFalse] - Include value === false pairs
 */
const getIframeStrWithProps = (props, fallbackContent = '', includeFalse = false) => {
	let propStr = '';
	for (const key in props) {
		const propVal = props[key];
		if (!!propVal || (propVal === false && includeFalse)) {
			propStr += propStr.length ? ' ' : '';
			propStr += `${key}="${propVal.toString()}"`;
		}
	}
	return `<iframe ${propStr}>${fallbackContent}</iframe>`;
};

/**
 * API Stuff
 */
/**
 *
 * @param {string} tweetIdOrUrl
 * @param {Partial<GetOEmbedParams>} optParams
 * @param {boolean} optUseCache
 * @returns {Promise<OEmbedRes>}
 */
const getOEmbed = async (tweetIdOrUrl, optParams = {}, optUseCache = true) => {
	if (optUseCache && !!cache[tweetIdOrUrl]) {
		console.log('Used cache :)');
		return cache[tweetIdOrUrl];
	}
	const endpoint = 'https://publish.twitter.com/oembed';
	/** @type {GetOEmbedParams} */
	const params = {
		...optParams,
		url: tweetIdOrUrl
	};
	const url = new URL(endpoint);
	// @ts-ignore
	url.search = new URLSearchParams(params);

	// Use JSONP to get around missing CORs headers
	return new Promise((res, rej) => {
		let resolved = false;
		fetchViaJsonp(url.toString(), (data) => {
			resolved = true;
			if ('html' in data) {
				cache[tweetIdOrUrl] = data;
				updateCache(cache);
			}
			res(data);
		});
		setTimeout(() => {
			if (!resolved) {
				rej(new Error('fetch timeout or error'));
			}
		}, 5000);
	});
};

const fetchViaJsonp = (url, callback) => {
	var callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
	window[callbackName] = function (data) {
		delete window[callbackName];
		document.body.removeChild(script);
		callback(data);
	};

	var script = document.createElement('script');
	script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
	document.body.appendChild(script);
};

/**
 * Utilities
 */
const simpleEscape = (input) => {
	return input.replace(/&/g, '&amp;').replace(/"/g, `'`);
};

/**
 * Utility func - get elements by explicit or by selector
 * @param {Element | string} thing
 * @returns {Element[]}
 */
const getThings = (thing) => {
	let elems;
	if (typeof thing === 'string') {
		elems = Array.from(document.querySelectorAll(thing));
	} else {
		elems = [thing];
	}
	return elems;
};

/**
 *
 * @param {Element | string} thing
 * @param {boolean} setVisible
 */
const scaleInOut = (thing, setVisible) => {
	const elems = getThings(thing);
	elems.forEach((elem) => {
		if (setVisible) {
			elem.classList.remove('scale-out');
			elem.classList.remove('noHeight');
		} else {
			elem.classList.add('scale-out');
			elem.classList.add('noHeight');
		}
	});
};

/**
 *
 * @param {Element | string} thing
 * @param {'show' | 'hide'} method
 */
const showOrHide = (thing, method) => {
	const elems = getThings(thing);
	if (method === 'show') {
		elems.forEach((elem) => elem.classList.remove('hidden'));
	} else {
		elems.forEach((elem) => elem.classList.add('hidden'));
	}
};

/**
 * Setup Event Listeners
 */
let generationInProgress = false;
urlInputElem.addEventListener('change', () => {
	reset(false);
});
inputForm.addEventListener('submit', (evt) => {
	evt.preventDefault();
	if (!generationInProgress) {
		generationInProgress = true;
		generate(evt).then(() => {
			generationInProgress = false;
		});
	}
});
document.getElementById('saveButton').addEventListener('click', (evt) => {
	if (!generationInProgress) {
		generationInProgress = true;
		generate(evt, true).then(() => {
			generationInProgress = false;
		});
	}
});

let prevConfig = /** @type {Partial<Config>} */ ({});
const handleFormChange = () => {
	console.log('Form change!');
	const updatedConfig = getConfig();
	if (updatedConfig.urlInputType !== prevConfig.urlInputType) {
		if (updatedConfig.urlInputType === 'single') {
			showOrHide('.singleUrl', 'show');
			showOrHide('.multipleUrl', 'hide');
			previewArea.innerHTML = SINGLE_URL_PREVIEW_PLACEHOLDER;
		} else {
			showOrHide('.singleUrl', 'hide');
			showOrHide('.multipleUrl', 'show');
			previewArea.innerHTML = MULTI_URL_PREVIEW_PLACEHOLDER;
		}
	}
	if (updatedConfig.blockQuoteMode !== prevConfig.blockQuoteMode) {
		if (updatedConfig.blockQuoteMode) {
			document.querySelectorAll('.iframeOnly').forEach((elem) => {
				elem.setAttribute('disabled', '');
				elem.querySelectorAll('input').forEach((elem) => elem.setAttribute('disabled', ''));
			});
		} else {
			document.querySelectorAll('.iframeOnly').forEach((elem) => {
				elem.removeAttribute('disabled');
				elem.querySelectorAll('input').forEach((elem) => elem.removeAttribute('disabled'));
			});
		}
	}
	prevConfig = JSON.parse(JSON.stringify(updatedConfig));
};
handleFormChange();

inputForm.addEventListener('change', handleFormChange);
sampleButton.addEventListener('click', loadSample);
outputArea.addEventListener('click', copyOutputToClipboard);
aboutButtons.forEach((button) => {
	button.addEventListener('click', (evt) => {
		if (aboutSection.classList.contains('scale-out')) {
			scaleInOut(aboutSection, true);
			scrollTo(scrollX, 0);
		} else {
			scaleInOut(aboutSection, false);
		}
	});
});
aboutSection.querySelector('.closeButton').addEventListener('click', (evt) => {
	scaleInOut(aboutSection, false);
});

/**
 * Types
 */

/**
 * @typedef GetOEmbedParams
 * @property {string} url
 * @property {number} [maxwidth]
 * @property {boolean} [hide_media]
 * @property {boolean} [hide_thread]
 * @property {boolean} [omit_script]
 * @property {'left' | 'right' | 'center' | 'none'} [align]
 * @property {string} [related]
 * @property {'light' | 'dark'} [theme]
 * @property {string} [link_color]
 * @property {'video'} [widget_type]
 * @property {boolean} [dnt]
 */

/**
 * @typedef OEmbedRes
 * @property {string} url
 * @property {string} title
 * @property {string} html
 * @property {number | null} width
 * @property {number | null} height
 * @property {string} type
 * @property {string} cache_age
 * @property {string} provider_name
 * @property {string} provider_url
 * @property {string} version
 */

/**
 * @typedef Config
 * @property {string} urlInput
 * @property {'single' | 'multiple'} urlInputType
 * @property {boolean} blockQuoteMode
 * @property {'srcDoc' | 'dataUri'} iframeType
 * @property {number} defaultHeight
 * @property {boolean} removeBorder
 * @property {boolean} hideOverflow
 * @property {boolean} sandbox
 */
