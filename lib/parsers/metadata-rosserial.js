function parseTimeLineValue(timeLine) {
	if (!timeLine) return { sum_episode: '', time: '' };

	const epMatch = timeLine.match(/(\d+)\s*сери/i);
	const minMatch = timeLine.match(/\d+\s*минут[аы]?/i);

	return {
		sum_episode: epMatch ? epMatch[1] : '',
		time: minMatch ? minMatch[0] : '',
	};
}

function parseEpisodeCount(raw) {
	if (!raw) return '';
	const match = String(raw).match(/(\d+)\s*сери/i);
	return match ? match[1] : '';
}

function parseMetadataRosserial(playlist) {
	const h1 =
		document.querySelector('h1[itemprop="name"]') ||
		document.querySelector('.ftitle h1') ||
		document.querySelector('#h1-ttl h1') ||
		document.querySelector('article.full h1');

	const fullTitle = h1 ? h1.textContent.trim() : document.title;
	const cleanTitle = extractTitleRu(fullTitle);

	const posterImg =
		document.querySelector('.fposter img[itemprop="image"]') ||
		document.querySelector('.fposter img#pageAfisha') ||
		document.querySelector('.fposter img');
	const poster = posterImg ? toAbsoluteUrl(posterImg.getAttribute('src') || '') : '';

	const descriptionEl =
		document.querySelector('.fdesc.full-text p') ||
		document.querySelector('.fdesc .limiter p') ||
		document.querySelector('.fdesc.full-text .limiter p') ||
		document.querySelector('.fdesc p');
	const description = descriptionEl ? descriptionEl.textContent.trim() : '';

	const year =
		parseSdLine('Год') ||
		fullTitle.match(/\((\d{4})\)/)?.[1] ||
		'';

	const countries = parseSdLine('Страна');
	const genres = parseSdLine('Жанр');
	const actors = parseSdLine('Актёры') || parseSdLine('В ролях');
	const directors = parseSdLine('Режиссер');
	const age = parseSdLine('Возраст');
	const premera = parseSdLine('Премьера');
	const chanel =
		normalizeTvChannel(parseSdLine('ТВ Канал')) || extractChannelFromPremiera(premera);

	const timeLine = parseSdLine('Время');
	const { sum_episode: episodesFromTime, time } = parseTimeLineValue(timeLine);

	let sum_episode =
		parseEpisodeCount(parseSdLine('Сколько серий')) ||
		episodesFromTime ||
		parseSdLine('Количество серий');
	const stats = computePlaylistStats(playlist || []);
	if (!sum_episode && stats.last_episode) {
		sum_episode = String(stats.last_episode);
	}
	if (sum_episode && !stats.last_episode) {
		stats.last_episode = sum_episode;
	}

	const isSerial =
		document.querySelector('.playlists-lists li') ||
		document.querySelector('.pcs-items .pcs-item') ||
		/сериал/i.test(fullTitle) ||
		/сериал/i.test(document.title) ||
		(playlist && playlist.length > 1) ||
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
		chanel,
		premera,
		age,
		sum_episode,
		time,
		stats,
		type,
	});
}
