async function enrichWithPosterImage(data) {
	if (!data?.poster) return data;

	const posterFileName = data.posterFileName || buildPosterFileName(data.title_ru, data.year);

	try {
		const response = await fetch(data.poster);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
		const buffer = await response.arrayBuffer();
		const bytes = new Uint8Array(buffer);

		let binary = '';
		const chunkSize = 8192;
		for (let i = 0; i < bytes.length; i += chunkSize) {
			binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
		}

		return {
			...data,
			posterFileName,
			posterMimeType: mimeType,
			posterImageBase64: btoa(binary),
		};
	} catch (error) {
		console.warn('[Video Data Extractor] Poster download failed:', error);
		return { ...data, posterFileName };
	}
}

async function fetchPosterFromUrl(posterUrl, posterFileName) {
	return enrichWithPosterImage({ poster: posterUrl, posterFileName });
}
