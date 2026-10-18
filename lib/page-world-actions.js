// These functions run in the page MAIN world via chrome.scripting.executeScript

function setCategoriesInPage(values) {
	const select = document.getElementById('category');
	if (!select) {
		throw new Error('category select not found');
	}

	const normalizedValues = values.map(String);

	if (typeof jQuery !== 'undefined') {
		const $cat = jQuery('#category');
		$cat.val(normalizedValues);
		$cat.trigger('chosen:updated');
		$cat.trigger('liszt:updated');
		$cat.trigger('change');

		if (typeof onCategoryChange === 'function') {
			onCategoryChange(select);
		}

		return $cat.val() || normalizedValues;
	}

	for (const option of select.options) {
		option.selected = normalizedValues.includes(option.value);
	}
	select.dispatchEvent(new Event('change', { bubbles: true }));
	return normalizedValues;
}

function setTokenFieldInPage(fieldId, tokens) {
	if (typeof jQuery !== 'undefined') {
		const $el = jQuery('#' + fieldId);
		if ($el.length && typeof $el.tokenfield === 'function') {
			$el.tokenfield('setTokens', tokens);
			return true;
		}
	}

	const el = document.getElementById(fieldId);
	if (!el) return false;

	el.value = tokens.join(', ');
	el.dispatchEvent(new Event('input', { bubbles: true }));
	el.dispatchEvent(new Event('change', { bubbles: true }));
	return true;
}
