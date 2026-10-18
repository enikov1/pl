function setNativeValue(element, value) {
	if (!element) return;
	const proto =
		element.tagName === 'TEXTAREA'
			? window.HTMLTextAreaElement.prototype
			: window.HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
	if (setter) {
		setter.call(element, value);
	} else {
		element.value = value;
	}
	try {
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
	} catch {
		// Some DOM implementations don't support synthetic events
	}
}

function setTokenField(fieldId, value) {
	const el = document.getElementById(fieldId);
	if (!el) return;

	const tokens = Array.isArray(value) ? value : splitCommaList(value);
	setNativeValue(el, tokens.join(', '));
}

async function runInPageContext(action, args) {
	const response = await chrome.runtime.sendMessage({ type: 'RUN_IN_PAGE', action, args });
	if (!response?.success) {
		throw new Error(response?.error || `Page action failed: ${action}`);
	}
	return response.result;
}

async function setTokenFieldInPage(fieldId, value) {
	const tokens = Array.isArray(value) ? value : splitCommaList(value);
	if (tokens.length === 0) return false;

	try {
		await runInPageContext('setTokenField', [fieldId, tokens]);
		return true;
	} catch (error) {
		console.warn('[Video Data Extractor] tokenfield fallback for', fieldId, error);
		setTokenField(fieldId, tokens.join(', '));
		return true;
	}
}

function normalizeCategoryLabel(text) {
	return (text || '')
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

function genreToCategoryLabel(genre) {
	const normalized = genre.trim().toLowerCase();
	const map = {
		мелодрамы: 'Мелодрама',
		мелодрама: 'Мелодрама',
		детективы: 'Детектив',
		детектив: 'Детектив',
		драмы: 'Драма',
		драма: 'Драма',
		комедии: 'Комедия',
		комедия: 'Комедия',
		триллеры: 'Триллер',
		триллер: 'Триллер',
		боевики: 'Боевик',
		боевик: 'Боевик',
	};
	return map[normalized] || genre.trim();
}

function buildCategoryLabels(data) {
	const labels = [];

	if (data.year) {
		const yearMatch = String(data.year).match(/\d{4}/);
		if (yearMatch) labels.push(yearMatch[0]);
	}

	if (data.genres) {
		for (const genre of splitCommaList(data.genres)) {
			labels.push(genreToCategoryLabel(genre));
		}
	}

	if (data.chanel) {
		labels.push(data.chanel);
	}

	return labels;
}

function resolveCategoryValues(labels) {
	const select = document.getElementById('category');
	if (!select) return [];

	const values = [];
	const seen = new Set();

	for (const label of labels) {
		const raw = String(label).trim();
		if (!raw) continue;

		const normalized = normalizeCategoryLabel(raw);
		const isYear = /^\d{4}$/.test(raw);
		let matched = false;

		for (const option of select.options) {
			if (!option.value || option.value === '0') continue;

			const optionLabel = normalizeCategoryLabel(option.textContent);
			const isMatch = isYear
				? optionLabel === normalized
				: optionLabel === normalized || optionLabel.startsWith(normalized);

			if (isMatch && !seen.has(option.value)) {
				values.push(option.value);
				seen.add(option.value);
				matched = true;
				break;
			}
		}

		if (!matched && !isYear) {
			for (const option of select.options) {
				if (!option.value || option.value === '0') continue;
				const optionLabel = normalizeCategoryLabel(option.textContent);
				if (optionLabel.includes(normalized) && !seen.has(option.value)) {
					values.push(option.value);
					seen.add(option.value);
					break;
				}
			}
		}
	}

	return values;
}

async function setCategoryField(data) {
	const select = document.getElementById('category');
	if (!select) return false;

	const labels = buildCategoryLabels(data);
	const values = resolveCategoryValues(labels);

	if (values.length === 0) {
		console.warn('[Video Data Extractor] Categories not matched. Labels:', labels);
		return false;
	}

	try {
		await runInPageContext('setCategories', [values]);
		console.log('[Video Data Extractor] Categories set:', labels, '→', values);
		return true;
	} catch (error) {
		console.error('[Video Data Extractor] setCategories failed:', error);
		return false;
	}
}

async function fillDleAdminForm(data) {
	if (!data) return { filled: [], missing: [] };

	const filled = [];
	const missing = [];

	const simpleFields = {
		title: data.title,
		xf_title_ru: data.title_ru,
		xf_title_default: data.title_default || data.title_ru || data.title,
		xf_description: data.description,
		xf_age: data.age,
		xf_time: data.time,
		xf_sum_episode: data.sum_episode,
		xf_last_episode: data.last_episode,
		xf_last_season: data.last_season,
		xf_playlist: data.playlist
			? JSON.stringify(normalizePlaylistForExport(data.playlist))
			: '',
		xf_chanel: data.chanel,
		'xf_premera-v-rf': data.premera,
	};

	for (const [fieldId, value] of Object.entries(simpleFields)) {
		if (value === undefined || value === null || value === '') continue;

		const el = document.getElementById(fieldId);
		if (!el) {
			missing.push(fieldId);
			continue;
		}

		if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
			setNativeValue(el, String(value));
			filled.push(fieldId);
		}
	}

	const tokenFields = {
		xf_year: data.year,
		xf_countries: data.countries,
		xf_genres: data.genres,
		xf_actors: data.actors,
		xf_directors: data.directors,
	};

	for (const [fieldId, value] of Object.entries(tokenFields)) {
		if (!value) continue;
		if (document.getElementById(fieldId)) {
			await setTokenFieldInPage(fieldId, value);
			filled.push(fieldId);
		} else {
			missing.push(fieldId);
		}
	}

	if (await setCategoryField(data)) {
		filled.push('category');
	} else if (document.getElementById('category') && buildCategoryLabels(data).length > 0) {
		missing.push('category');
	}

	return { filled, missing };
}

function waitForElement(selector, timeoutMs = 10000) {
	return new Promise((resolve, reject) => {
		const existing = document.querySelector(selector);
		if (existing) {
			resolve(existing);
			return;
		}

		const observer = new MutationObserver(() => {
			const el = document.querySelector(selector);
			if (el) {
				observer.disconnect();
				clearTimeout(timer);
				resolve(el);
			}
		});

		observer.observe(document.documentElement, { childList: true, subtree: true });

		const timer = setTimeout(() => {
			observer.disconnect();
			reject(new Error(`Element ${selector} not found within ${timeoutMs}ms`));
		}, timeoutMs);
	});
}

function extractDleUploadParams(xfname) {
	const scripts = Array.from(document.querySelectorAll('script'));

	for (const script of scripts) {
		const text = script.textContent || '';
		const hasField =
			text.includes(`xfupload_${xfname}`) ||
			text.includes(`"xfname" : "${xfname}"`) ||
			text.includes(`'xfname' : '${xfname}'`) ||
			text.includes(`"xfname":"${xfname}"`);

		if (!hasField) continue;

		const hashMatch = text.match(/user_hash['"]\s*:\s*['"]([a-f0-9]+)['"]/i);
		if (!hashMatch) continue;

		const authorMatch = text.match(/["']author["']\s*:\s*["']([^"']+)["']/);
		const newsIdMatch = text.match(/["']news_id["']\s*:\s*["']([^"']+)["']/);
		const areaMatch = text.match(/["']area["']\s*:\s*["']([^"']+)["']/);
		const actionMatch = text.match(/action\s*:\s*['"]([^'"]+)['"]/);

		return {
			subaction: 'upload',
			user_hash: hashMatch[1],
			author:
				authorMatch?.[1] ||
				document.querySelector('input[name="new_author"]')?.value ||
				'admin',
			news_id: newsIdMatch?.[1] || '0',
			area: areaMatch?.[1] || 'xfieldsimage',
			xfname,
			action: actionMatch?.[1] || 'engine/ajax/controller.php?mod=upload',
		};
	}

	return null;
}

function resolveDleUploadUrl(action) {
	const uploadAction = action || 'engine/ajax/controller.php?mod=upload';
	if (uploadAction.startsWith('http://') || uploadAction.startsWith('https://')) {
		return uploadAction;
	}
	return new URL(uploadAction, window.location.href).href;
}

function decodeBase64ToUint8Array(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function createPosterFile(data) {
	const fileName = data.posterFileName || buildPosterFileName(data.title_ru, data.year);
	const mimeType = data.posterMimeType || 'image/jpeg';
	const extension = getExtensionFromMime(mimeType, data.poster);
	const bytes = decodeBase64ToUint8Array(data.posterImageBase64);
	const blob = new Blob([bytes], { type: mimeType });
	return new File([blob], `${fileName}.${extension}`, { type: mimeType });
}

function parseDleUploadResponse(raw) {
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return { success: false, error: raw };
		}
	}
	return raw;
}

function applyPoster2UploadSuccess(response) {
	let returnbox = response.returnbox || '';
	returnbox = returnbox
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

	if (typeof window.jQuery !== 'undefined') {
		const $ = window.jQuery;
		$('#uploadedfile_poster2').html(returnbox);
		$('#xf_poster2').val(response.xfvalue || '');
		$('#xfupload_poster2 .qq-upload-button, #xfupload_poster2 .qq-upload-button input').attr(
			'disabled',
			'disabled'
		);
		if (typeof window.xfsinc === 'function') {
			window.xfsinc('poster2');
		}
	} else {
		const previewContainer = document.getElementById('uploadedfile_poster2');
		if (previewContainer && returnbox) {
			previewContainer.innerHTML = returnbox;
		}
		setNativeValue(document.getElementById('xf_poster2'), response.xfvalue || '');
	}

	return response;
}

async function waitForPosterUploadReady(timeoutMs = 20000) {
	await waitForElement('#xfupload_poster2');
	await waitForElement('#xf_poster2');

	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const params = extractDleUploadParams('poster2');
		if (params) return params;
		await new Promise((r) => setTimeout(r, 200));
	}

	throw new Error('DLE poster2 upload widget not ready (user_hash not found)');
}

async function waitForPoster2Value(timeoutMs = 20000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const val = document.getElementById('xf_poster2')?.value;
		if (val) return val;
		await new Promise((r) => setTimeout(r, 200));
	}
	return '';
}

async function ensurePosterImageData(data) {
	if (data.posterImageBase64) return data;
	if (!data.poster) {
		throw new Error('Poster image data is missing');
	}

	const fileName = data.posterFileName || buildPosterFileName(data.title_ru, data.year);
	const response = await chrome.runtime.sendMessage({
		type: 'FETCH_POSTER',
		posterUrl: data.poster,
		posterFileName: fileName,
	});

	if (!response?.success || !response.posterImageBase64) {
		throw new Error(response?.error || 'Failed to download poster for upload');
	}

	return {
		...data,
		posterImageBase64: response.posterImageBase64,
		posterMimeType: response.posterMimeType,
		posterFileName: response.posterFileName || fileName,
	};
}

async function uploadPoster2ViaFileInput(file) {
	const input = document.querySelector('#xfupload_poster2 input[type="file"]');
	if (!input) return false;

	const initialValue = document.getElementById('xf_poster2')?.value || '';

	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	input.files = dataTransfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));

	const newValue = await waitForPoster2Value(20000);
	return Boolean(newValue && newValue !== initialValue);
}

async function uploadPoster2ViaApi(file, params) {
	const uploadUrl = resolveDleUploadUrl(params.action);
	const formData = new FormData();
	const input = document.querySelector('#xfupload_poster2 input[type="file"]');
	const fieldName = input?.getAttribute('name') || 'qqfile';

	formData.append(fieldName, file);
	for (const [key, value] of Object.entries(params)) {
		if (key !== 'action') {
			formData.append(key, value);
		}
	}

	if (typeof window.jQuery !== 'undefined') {
		return new Promise((resolve, reject) => {
			window.jQuery.ajax({
				url: uploadUrl,
				type: 'POST',
				data: formData,
				processData: false,
				contentType: false,
				xhrFields: { withCredentials: true },
				success(raw) {
					const result = parseDleUploadResponse(raw);
					if (!result.success) {
						reject(new Error(result.error || 'Poster upload failed'));
						return;
					}
					resolve(applyPoster2UploadSuccess(result));
				},
				error(_xhr, _status, err) {
					reject(new Error(err || 'Poster upload request failed'));
				},
			});
		});
	}

	const response = await fetch(uploadUrl, {
		method: 'POST',
		body: formData,
		credentials: 'include',
	});

	if (!response.ok) {
		throw new Error(`Upload HTTP ${response.status}`);
	}

	const result = parseDleUploadResponse(await response.json());
	if (!result.success) {
		throw new Error(result.error || 'Poster upload failed');
	}

	return applyPoster2UploadSuccess(result);
}

async function uploadPoster2(data) {
	await waitForPosterUploadReady();

	const imageData = await ensurePosterImageData(data);
	const file = createPosterFile(imageData);
	const params = extractDleUploadParams('poster2');

	if (!params) {
		throw new Error('DLE upload params (user_hash) not found on page');
	}

	const uploadedViaInput = await uploadPoster2ViaFileInput(file);
	if (uploadedViaInput) {
		return { success: true, via: 'file-input' };
	}

	return uploadPoster2ViaApi(file, params);
}

async function waitForChosenReady(timeoutMs = 15000) {
	await waitForElement('#category');
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (document.getElementById('category_chosen')) return;
		await new Promise((r) => setTimeout(r, 200));
	}
}

async function tryAutofillDleAdmin(data) {
	await waitForElement('#title');
	await waitForChosenReady();
	await new Promise((r) => setTimeout(r, 1000));
	const result = await fillDleAdminForm(data);

	if (data.poster && document.getElementById('xf_poster2')) {
		try {
			await uploadPoster2(data);
			result.filled.push('xf_poster2');
		} catch (error) {
			result.poster2Error = error.message;
			console.error('[Video Data Extractor] poster2 upload failed:', error);
		}
	}

	return result;
}
