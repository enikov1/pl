function parseMetadataRussianSeriali(playlist) {
	const h1 =
		document.querySelector('h1[itemprop="name"]') ||
		document.querySelector('.ftitle h1') ||
		document.querySelector('article.full h1');

	const fullTitle = h1 ? h1.textContent.trim() : document.title;
	const cleanTitle = extractTitleRu(fullTitle);

	const posterImg = document.querySelector('.fposter img');
	const poster = posterImg ? toAbsoluteUrl(posterImg.getAttribute('src') || '') : '';

	const descriptionEl = document.querySelector('[itemprop="description"]');
	const description = descriptionEl ? descriptionEl.textContent.trim() : '';

	const yearEl = document.querySelector('[itemprop="copyrightYear"]');
	const year =
		(yearEl ? yearEl.textContent.trim() : '') ||
		parseSdLine('Год выпуска') ||
		parseSdLine('Год');

	const countries = parseSdLine('Страна');
	const genres =
		parseSdLine('Жанр') ||
		(document.querySelector('[itemprop="genre"]')?.textContent.trim() || '');
	const actors =
		parseSdLine('В ролях') ||
		parseSdLine('Актёры') ||
		(document.querySelector('[itemprop="actors"]')?.textContent.trim() || '');
	const directors =
		parseSdLine('Режиссер') ||
		(document.querySelector('[itemprop="director"]')?.textContent.trim() || '');

	let sum_episode = parseSdLine('Количество серий');
	const time = parseSdLine('Продолжительность');

	const stats = computePlaylistStats(playlist || []);
	if (!sum_episode && stats.last_episode) {
		sum_episode = String(stats.last_episode);
	}

	const isSerial =
		document.querySelector('.playlists-lists li') ||
		/сериал/i.test(fullTitle) ||
		(playlist && playlist.some((i) => i.folder));
	const type = isSerial ? 'serial' : 'film';

	return buildMetadataResult({
		cleanTitle,
		poster,
		description,
		year,
		countries,
		genres,
		actors,
		directors,
		sum_episode,
		time,
		stats,
		type,
	});
}
