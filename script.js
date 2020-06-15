const CACHE_KEY = 'cache';

/**
 * Elements
 */
/** @type {HTMLTextAreaElement} */
const outputArea = document.getElementById('outputTextArea');
/** @type {HTMLInputElement} */
const urlInputElem = document.getElementById('tweetUrlInput');
const generateButton = document.getElementById('generateButton');
const placeholderOutTxt = outputArea.value;
const previewArea = document.getElementById('previewArea');
const inputForm = document.getElementById('inputForm');
const defaultHeightInput = document.getElementById('defaultHeight');
const removeBorderCheckbox = document.getElementById('removeBorder');
const sandboxCheckbox = document.getElementById('sandbox');

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
const generate = async () => {
	const config = getConfig();
	console.log(config);
	if (urlInputElem.value && urlInputElem.checkValidity()) {
		const tweetUrl = urlInputElem.value;
		try {
			const embedInfo = await getOEmbed(tweetUrl);
			let { html, width, height } = embedInfo;
			height = height || config.defaultHeight;
			let iframeCodeStr = '';
			let iframeStyleStr = '';
			if (config.removeBorder) {
				iframeStyleStr = 'border:none;';
			}
			if (config.iframeType === 'dataUri') {
				const dataUri = `data:text/html;charset=utf-8,${escape(html)}`;
				iframeCodeStr = getIframeStrWithUri(dataUri, iframeStyleStr, width, height, config.sandbox);
			} else {
				iframeCodeStr = getIframeStrWithSrcDoc(simpleEscape(html), iframeStyleStr, width, height, config.sandbox);
			}
			outputArea.value = iframeCodeStr;
			previewArea.innerHTML = iframeCodeStr;
		} catch (e) {
			// @TODO
			reset(false);
			console.error(e);
			alert('Something went wrong! Maybe an invalid Tweet URL? 😢');
		}
	} else {
		alert('Please enter a valid URL 🙃');
	}
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

const getConfig = () => {
	/** @type {Config} */
	const config = {
		iframeType: document.querySelector('input[name="iframeType"]:checked').value,
		defaultHeight: parseInt(defaultHeightInput.value, 10),
		removeBorder: !!removeBorderCheckbox.checked,
		sandbox: !!sandboxCheckbox.checked
	};
	return config;
};

const dataUriIframeInject = (t, e, a, n) => {
	(n = 'function' == typeof n ? n : function () {}), (a = 'boolean' != typeof a || a);
	var i = document.createElement('iframe'),
		c = 'data:text/html;charset=utf-8,' + escape(t);
	i.addEventListener('load', n), i.setAttribute('src', c), a ? (e.appendChild(i), (i.style.width = '100%'), (i.style.height = '100%')) : e.replaceWith(i);
};

const getIframeStrWithUri = (dataUri, optStyle = '', optWidth, optHeight, optSandbox = false) => {
	return `
<iframe src="${dataUri}" style="${optStyle}" ${optWidth ? `width="${optWidth}" ` : ''}${optHeight ? `height="${optHeight}" ` : ''}${optSandbox ? `sandbox ` : ``}></iframe>
`;
};

const getIframeStrWithSrcDoc = (rawHtml, optStyle = '', optWidth, optHeight, optSandbox = false) => {
	return `
<iframe srcdoc="${rawHtml}" style="${optStyle}" ${optWidth ? `width="${optWidth}" ` : ''}${optHeight ? `height="${optHeight}" ` : ''}${optSandbox ? `sandbox ` : ``}></iframe>
`;
};

/**
 * API Stuff
 */
/**
 *
 * @param {string} tweetIdOrUrl
 * @param {Partial<GetOEmbedParams>} optParams
 * @param {boolean} optUseCache
 * @returns {OEmbedRes}
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
 * Setup Event Listeners
 */
let generationInProgress = false;
generateButton.addEventListener('click', () => {
	if (!generationInProgress) {
		generationInProgress = true;
		generate().then(() => {
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
		generate().then(() => {
			generationInProgress = false;
		});
	}
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
 * @property {'srcDoc' | 'dataUri'} iframeType
 * @property {number} defaultHeight
 * @property {boolean} removeBorder
 * @property {boolean} sandbox
 */
