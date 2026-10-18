function extractPlaylist() {
	const $ = createJQueryLikeHelper();
	const json_c = [];

	function pushEpisode(json_v, subE) {
		const data_title_sub = capitalizeFirstLetter(subE.text().replace(/\s+/g, ' ').trim());
		const data_file_sub = subE.attr('data-file');
		const data_anons = subE.attr('data-notice');
		const data_anons_active = subE.attr('data-announce');

		if (!data_title_sub || !data_file_sub) return;

		const file = normalizePlaylistFileUrl(data_file_sub);
		let json_series;
		if (data_anons && data_anons_active == 0) {
			json_series = { title: data_title_sub, file, text: data_anons };
		} else if (data_anons_active == 1) {
			json_series = { title: data_title_sub, file, text_anons: data_anons };
		} else {
			json_series = { title: data_title_sub, file };
		}
		json_v.push(json_series);
	}

	if ($('.playlists-lists li').length > 0) {
		$('.playlists-lists').find('li').each(function (i, e) {
			const json_v = [];
			const data_title = capitalizeFirstLetter(e.text().replace(/\s+/g, ' ').trim());
			const data_id = e.attr('data-id');

			if (!data_title) return;

			$(`.playlists-videos li[data-id="${data_id}"]`).each(function (j, subE) {
				pushEpisode(json_v, subE);
			});

			if (json_v.length > 0) {
				json_c.push({ title: data_title, folder: json_v });
			}
		});
	}

	if (json_c.length === 0) {
		const flatSelectors = [
			'.playlists-items ul > li[data-file]',
			'.playlists-videos ul > li[data-file]',
			'.playlists-items li[data-file]',
			'.playlists-videos li[data-file]',
		];

		const seen = new Set();
		for (const sel of flatSelectors) {
			$(sel).each(function (i, e) {
				const data_file = e.attr('data-file');
				const data_title = capitalizeFirstLetter(e.text().replace(/\s+/g, ' ').trim());

				if (!data_title || !data_file) return;

				const file = normalizePlaylistFileUrl(data_file);
				// Same URL can be used for multiple episodes (lazy player) — dedupe by file+title
				const dedupeKey = file + '\0' + data_title;
				if (seen.has(dedupeKey)) return;
				seen.add(dedupeKey);

				const data_anons = e.attr('data-notice');
				const data_anons_active = e.attr('data-announce');

				let json_data;
				if (data_anons && data_anons_active == 0) {
					json_data = { title: data_title, file, text: data_anons };
				} else if (data_anons_active == 1) {
					json_data = { title: data_title, file, text_anons: data_anons };
				} else {
					json_data = { title: data_title, file };
				}
				json_c.push(json_data);
			});

			if (json_c.length > 0) break;
		}
	}

	if (json_c.length === 0) {
		const selectOptions = document.querySelectorAll('select option[value]');
		selectOptions.forEach((opt) => {
			const data_title = capitalizeFirstLetter((opt.textContent || '').trim());
			const data_file = opt.getAttribute('value');
			if (data_title && data_file) {
				json_c.push({ title: data_title, file: normalizePlaylistFileUrl(data_file) });
			}
		});
	}

	if (json_c.length === 0) {
		const iframe = document.querySelector('.fplayer iframe');
		const file = iframe ? normalizePlaylistFileUrl(iframe.getAttribute('src')) : '';
		if (file) {
			json_c.push({ title: 'Фильм', file });
		}
	}

	return json_c;
}

function normalizePlaylistFileUrl(file) {
	const value = String(file || '').trim();
	if (!value) return '';

	let normalized = value.startsWith('//') ? 'https:' + value : value;

	// Rutube embed links often include tracking query params — strip them
	try {
		const parsed = new URL(normalized);
		if (/(^|\.)rutube\.ru$/i.test(parsed.hostname)) {
			parsed.search = '';
			parsed.hash = '';
			normalized = parsed.toString();
		}
	} catch {
		// keep as-is for non-absolute / malformed URLs
	}

	return normalized;
}

function normalizeEpisodeForExport(ep) {
	if (!ep?.file || !ep?.title) return null;

	const item = {
		title: String(ep.title),
		file: normalizePlaylistFileUrl(ep.file),
	};

	if (ep.text) item.text = ep.text;
	if (ep.text_anons) item.text_anons = ep.text_anons;

	return item;
}

function normalizePlaylistForExport(playlist) {
	if (!Array.isArray(playlist) || playlist.length === 0) return [];

	return playlist
		.map((item) => {
			if (Array.isArray(item.folder)) {
				const folder = item.folder.map(normalizeEpisodeForExport).filter(Boolean);
				if (!folder.length) return null;
				return { title: String(item.title || ''), folder };
			}
			return normalizeEpisodeForExport(item);
		})
		.filter(Boolean);
}

function countPlaylistItems(playlist) {
	if (!Array.isArray(playlist)) return { sources: 0, episodes: 0 };

	let sources = 0;
	let episodes = 0;

	for (const item of playlist) {
		if (Array.isArray(item.folder)) {
			sources += 1;
			episodes += item.folder.length;
		} else if (item?.file) {
			episodes += 1;
		}
	}

	if (sources === 0 && episodes > 0) {
		sources = 1;
	}

	return { sources, episodes };
}

function computePlaylistStats(playlist) {
	let last_episode = 0;
	let last_season = 0;

	for (const item of playlist) {
		if (item.folder) {
			const seasonNum = extractSeasonNumber(item.title);
			if (seasonNum > last_season) last_season = seasonNum;

			for (const ep of item.folder) {
				const epNum = extractEpisodeNumber(ep.title);
				if (epNum > last_episode) last_episode = epNum;
			}
		} else {
			const epNum = extractEpisodeNumber(item.title);
			if (epNum > last_episode) last_episode = epNum;
		}
	}

	if (last_episode === 0 && playlist.length > 0) {
		const flatCount = playlist.some((i) => i.folder)
			? playlist.reduce((sum, i) => sum + (i.folder ? i.folder.length : 0), 0)
			: playlist.length;
		last_episode = flatCount;
	}

	return { last_episode: last_episode || '', last_season: last_season || '' };
}
