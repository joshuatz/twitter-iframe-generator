// @ts-check
const CACHE_KEY = 'cache';

/**
 * Elements
 */
const outputArea = /** @type {HTMLTextAreaElement} */ (document.getElementById('outputTextArea'));
const urlInputElem = /** @type {HTMLInputElement} */ (document.getElementById('tweetUrlInput'));
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

// Main Generate Func
const generate = async (optEvent) => {
	const config = getConfig();
	console.log(config);
	if (urlInputElem.value && urlInputElem.checkValidity()) {
		const tweetUrl = urlInputElem.value;
		try {
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
 *
 * @param {Element} elem
 * @param {boolean} setVisible
 */
const scaleInOut = (elem, setVisible) => {
	if (setVisible) {
		elem.classList.remove('scale-out');
		elem.classList.remove('noHeight');
	} else {
		elem.classList.add('scale-out');
		elem.classList.add('noHeight');
	}
};

/**
 * Setup Event Listeners
 */
let generationInProgress = false;
generateButton.addEventListener('click', (evt) => {
	if (!generationInProgress) {
		generationInProgress = true;
		generate(evt).then(() => {
			generationInProgress = false;
		});
	}
});
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
inputForm.addEventListener('change', () => {
	console.log('Form change!');
});
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
blockQuoteModeCheckbox.addEventListener('change', () => {
	if (blockQuoteModeCheckbox.checked) {
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
	reset(false);
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
