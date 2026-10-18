function buildMetadataResult(fields) {
	const {
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
	} = fields;

	return {
		title: cleanTitle,
		title_ru: cleanTitle,
		title_default: cleanTitle,
		poster,
		posterFileName: buildPosterFileName(cleanTitle, year),
		description,
		year,
		countries,
		genres,
		actors,
		directors,
		chanel: chanel || '',
		premera: premera || '',
		age: age || '',
		sum_episode,
		time,
		last_episode: stats.last_episode,
		last_season: stats.last_season,
		type,
		sourceUrl: window.location.href,
	};
}

function parseMetadataBySource(sourceId, playlist) {
	switch (sourceId) {
		case 'rosserial':
			return parseMetadataRosserial(playlist);
		case 'russian-seriali':
		default:
			return parseMetadataRussianSeriali(playlist);
	}
}

function parseFullMedia(forcedSourceId) {
	const playlist = extractPlaylist();
	const sourceId =
		forcedSourceId && forcedSourceId !== 'auto'
			? forcedSourceId
			: detectSourceFromDocument();
	const metadata = parseMetadataBySource(sourceId, playlist);

	return {
		...metadata,
		playlist,
		sourceId,
	};
}
