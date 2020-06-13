/** @type {HTMLTextAreaElement} */
const outputArea = document.getElementById('outputTextArea');
/** @type {HTMLInputElement} */
const urlInputElem = document.getElementById('tweetUrlInput');
const generateButton = document.getElementById('generateButton');
const placeholderOutTxt = outputArea.value;
const previewArea = document.getElementById('previewArea');

const generate = async () => {
	if (urlInputElem.value && urlInputElem.checkValidity()) {
		const tweetUrl = urlInputElem.value;
		try {
			const embedInfo = await getOEmbed(tweetUrl);
			// dataUriIframeInject(embedInfo.html, previewArea, true);
			const dataUri = `data:text/html;charset=utf-8,${escape(embedInfo.html)}`;
			const iframeCodeStr = getIframeStr(dataUri, embedInfo.width, embedInfo.height);
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
}

const reset = (resetUrl) => {
	outputArea.disabled = true;
	outputArea.value = placeholderOutTxt;
	previewArea.innerHTML = '';
	if (resetUrl) {
		urlInputElem.value = '';
	}
}

const dataUriIframeInject = (t,e,a,n) => {n="function"==typeof n?n:function(){},a="boolean"!=typeof a||a;var i=document.createElement("iframe"),c="data:text/html;charset=utf-8,"+escape(t);i.addEventListener("load",n),i.setAttribute("src",c),a?(e.appendChild(i),i.style.width="100%",i.style.height="100%"):e.replaceWith(i)}

const getIframeStr = (dataUri, optWidth, optHeight) => {
	return `
<iframe src="${dataUri}" ${optWidth ? `width="${optWidth}" ` : ''}${optHeight ? `width="${optHeight}" ` : ''}></iframe>;
`
}

/**
 * API Stuff
 */
/**
 * 
 * @param {string} tweetIdOrUrl 
 * @param {Partial<GetOEmbedParams>} optParams 
 * @returns {OEmbedRes}
 */
const getOEmbed = async (tweetIdOrUrl, optParams = {}) => {
	const endpoint = 'https://publish.twitter.com/oembed';
	/** @type {GetOEmbedParams} */
	const params = {
		...optParams,
		url: tweetIdOrUrl
	}
	const url = new URL(endpoint);
	url.search = new URLSearchParams(params);

	// Use JSONP to get around missing CORs headers
	return new Promise((res, rej) => {
		let resolved = false;
		fetchViaJsonp(url.toString(), (data) => {
			resolved = true;
			res(data);
		});
		setTimeout(() => {
			if (!resolved) {
				rej(new Error('fetch timeout or error'));
			}
		}, 5000);
	});
}

const fetchViaJsonp = (url, callback) => {
	var callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
	window[callbackName] = function(data) {
		delete window[callbackName];
		document.body.removeChild(script);
		callback(data);
	};

	var script = document.createElement('script');
	script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
	document.body.appendChild(script);
}

/**
 * Setup Event Listeners
 */
generateButton.addEventListener('click', generate);
urlInputElem.addEventListener('change', () => {
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