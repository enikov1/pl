Нужно дорботать расширение чтобы оно еще могло парсить целиком всю информацию о фильме или сериале. И заполнять это все в админке по url.

Функционал с парсингом только плейлиста должен остаться в расширение.

Логика такая я указываю ссылку для парсинга и расширение заходит на нее парсит все данные прямо в моем браузере, дальше все эти данные сохраняет где-то.
После этого заходит на сайт на который мне нужно добавить это все.

Ссылки куда нужно добавлять я должны указывать в настройках расширения прямо
Вот пример ссылки - https://russerialov.net/admi_rs.php?mod=addnews&action=addnews
И при открытие ссылки оно должно заполнить все поля тем что напарсилось там

<div class="panel-body">
						
							<div class="form-group">
							  <label class="control-label col-sm-2">Заголовок:</label>
							  <div class="col-sm-10">
								<input type="text" class="form-control width-550 position-left" name="title" id="title" maxlength="250">
<button onclick="videoseed_search(); return false;" class="btn bg-success-800 btn-sm btn-raised legitRipple position-left">Искать в VideoSeed</button>
<button onclick="chatgpt_generate_description(); return false;" class="btn bg-success-800 btn-sm btn-raised legitRipple position-left" title="Сгенерировать описание через ChatGPT">
	<i class="fa fa-magic"></i> Генерировать описание
</button>
<button onclick="showReadyPrompt(); return false;" class="btn bg-primary-800 btn-sm btn-raised legitRipple position-left" title="Показать готовый промт для копирования в другую ИИ">
	<i class="fa fa-eye"></i> Показать готовый промт
</button><button onclick="find_relates(); return false;" class="visible-lg-inline-block btn bg-info-800 btn-sm btn-raised legitRipple">Найти похожие новости</button><i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right" data-rel="popover" data-trigger="hover" data-placement="auto right" data-content="Заголовок статьи обязателен к заполнению и может содержать не более 200 символов." data-original-title="" title=""></i> <div id="parser_btns"><button id="parse_start" class="btn btn-green btn-sm btn-raised legitRipple bg-info-800">Искать в базе alloha</button>&nbsp;<button id="parse_trailer" class="btn btn-green btn-sm btn-raised legitRipple bg-info-800">Искать трейлеры</button>&nbsp;</div><span id="related_news"></span>
<div id="videoseed_result" style="width: 100%;"></div>
<div id="chatgpt_result" style="width: 100%; margin-top: 10px;"></div>
							  </div>	
							</div>

							<div class="form-group">
							  <label class="control-label col-sm-2">Слова для заголовка</label>
							  <div class="col-sm-10">
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Сериал</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Фильм</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">ТВ-Шоу</button><br><br>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">1 сезон</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">2 сезон</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">3 сезон</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">4 сезон</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">5 сезон</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Все сезоны</button><br><br>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1, 2 серия)</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1, 2, 3, 4 серия)</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1-4 серии)</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1-8 серии)</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1-10 серии)</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1-16 серии)</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">(1-24 серии)</button><br><br>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Все</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Все серии</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">серия</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">подряд</button><br><br>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Премьера!</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">Новинка!</button><br><br>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">-</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">«</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">»</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">¤</button>
								<button type="button" class="btn bg-info-800 btn-sm add-title-text legitRipple">﹡</button><br><br>
								<button type="button" class="btn bg-info-400 btn-sm add-cat-text legitRipple">Заполнить категорию</button>
							  </div>	
							</div>
							 
							 <div class="form-group">
	<label class="control-label col-sm-2"><button id="sendYandex" class="btn-sm btn bg-danger legitRipple">Yandex Recrawl</button></label>
	<div class="col-sm-10">
		<label class="checkbox-inline">
  			<div class="checker border-teal-600 text-teal-800" id="uniform-yandexRecrawl"><span><input class="icheck" type="checkbox" name="yandexRecrawl" id="yandexRecrawl" value="yes"></span></div>Отправить в Yandex на переобход
		</label>
	</div>
</div>
<div class="form-group">
							  <label class="control-label col-sm-2">Дата:</label>
							  <div class="col-sm-10">
								<input data-rel="calendar" type="text" name="newdate" class="form-control" style="width:190px;" autocomplete="off"><i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="auto right" data-content="Оставьте данное поле пустым, чтобы использовать текущую дату и время. Если установленная дата еще не наступила, новость будет опубликована автоматически, в указанное время." data-original-title="" title=""></i><span class="position-left visible-lg-inline-block visible-md-inline-block visible-sm-inline-block visible-xs">автор&nbsp;публикации:</span><input type="text" name="new_author" class="form-control" style="width:190px;" value="admin2">
							  </div>
							</div>
							
							 <div class="form-group">
							  <label class="control-label col-sm-2">Категория:</label>
							  <div class="col-sm-10">
								<select data-placeholder="Выберите категорию ..." title="Выберите категорию ..." name="category[]" id="category" onchange="onCategoryChange(this)" class="categoryselect" multiple="" style="width: 100%; max-width: 350px; display: none;"><option value="0"></option><option value="9">2022</option><option value="10">2021</option><option value="11">2020</option><option value="12">2019</option><option value="45">2025</option><option value="14">СТС</option><option value="17">ТВЦ</option><option value="18">Домашний</option><option value="19">5 канал</option><option value="20">НТВ</option><option value="21">Россия 1</option><option value="22">Первый канал</option><option value="23">Военный</option><option value="24">Мелодрама</option><option value="25">Детектив</option><option value="26">Драма</option><option value="27">Комедия</option><option value="28">Криминал</option><option value="29">Боевик</option><option value="30">Триллер</option><option value="31">Мистика</option><option value="32">Исторический</option><option value="33">Фантастика</option><option value="34">Фильмы</option><option value="35">Сериалы</option><option value="36">Русские</option><option value="46">2026</option><option value="38">Зарубежные</option><option value="47">&nbsp;&nbsp;&nbsp;&nbsp;Сериалы</option><option value="48">&nbsp;&nbsp;&nbsp;&nbsp;Фильмы</option><option value="39">2023</option><option value="40">ТВ-шоу</option><option value="41">Про измену и предательство</option><option value="42">Про советское время и эпоху СССР</option><option value="43">Про семью и семейные отношения</option><option value="44">2024</option><option value="49">Ожидаемое</option></select><div class="chosen-container chosen-container-multi" title="Выберите категорию ..." id="category_chosen" style="width: 350px;"><ul class="chosen-choices">
  <li class="search-field">
    <input class="chosen-search-input default" type="text" autocomplete="off" value="Выберите категорию ..." style="width: 162px;">
  </li>
</ul>
<div class="chosen-drop">
  <ul class="chosen-results"></ul>
</div></div><input type="hidden" name="category_custom_sort" id="category_custom_sort" value="">
							  </div>
							</div><div class="form-group">
    <label class="control-label col-sm-2">Подборки</label>
    <div class="col-sm-10">
        <select data-placeholder="Выберите подборки" name="collections[]" class="categoryselect" multiple="" style="width: 100%; max-width: 450px; display: none;"><option value="1">Новогодние сериалы</option><option value="2">Сериалы к 8 марта</option><option value="3">Смотрим 9 мая</option><option value="4">Сериалы про подростков</option><option value="5">Про ментов и бандитов</option><option value="6">Про врачей и медицину</option><option value="7">Про любовь и отношения</option><option value="8">Про семью и детей</option><option value="9">Про маньяков</option><option value="10">Про расследования</option><option value="11">Про сестер</option><option value="12">Про измену и предательство</option><option value="13">Про братьев</option></select><div class="chosen-container chosen-container-multi" title="" style="width: 450px;"><ul class="chosen-choices">
  <li class="search-field">
    <input class="chosen-search-input default" type="text" autocomplete="off" value="Выберите подборки" style="width: 146px;">
  </li>
</ul>
<div class="chosen-drop">
  <ul class="chosen-results"></ul>
</div></div>
    </div>
</div>
<!--start-->

							 <!-- <div class="form-group editor-group">
							  <label class="control-label col-md-2">Краткое описание:</label>
							  <div class="col-md-10"> -->							  <!-- </div>
							</div> -->
							
							 <!-- <div class="form-group editor-group">
							  <label class="control-label col-md-2">Полное описание:</label>
							  <div class="col-md-10"> -->							  <!-- </div> -->
							<!-- </div> -->
<div id="xfield_holder_poster" class="form-group">
  <label class="control-label col-sm-2">Постер: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[poster]" id="xf_poster" data-alert="Постер" value=""> 
  </div>
</div><div id="xfield_holder_title_default" class="form-group">
  <label class="control-label col-sm-2">title_default: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[title_default]" id="xf_title_default" data-alert="title_default" value=""> 
  </div>
</div><div id="xfield_holder_description" class="form-group editor-group">
  <label class="control-label col-md-2">Описание (не уникальное): </label>
  <div class="col-md-10">
     <div class="editor-panel no-border"><textarea style="width:100%;height:200px;" name="xfield[description]" id="xf_description" data-alert="Описание (не уникальное)" class="classic"></textarea></div>
  </div>
</div><div id="xfield_holder_title_ru" class="form-group">
  <label class="control-label col-sm-2">Название: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[title_ru]" id="xf_title_ru" data-alert="Название" value=""> 
  </div>
</div><div id="xfield_holder_age" class="form-group">
  <label class="control-label col-sm-2">Возрастное ограничение: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[age]" id="xf_age" data-alert="Возрастное ограничение" value=""> 
  </div>
</div><div id="xfield_holder_year" class="form-group">
  <label class="control-label col-sm-2">Год выхода: </label>
  <div class="col-sm-10">
     <div class="tokenfield form-control"><input type="text" class="form-control width-500" name="xfield[year]" id="xf_year" data-alert="Год выхода" value="" data-rel="links" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="xf_year-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div> 
  </div>
</div><div id="xfield_holder_countries" class="form-group">
  <label class="control-label col-sm-2">Страны: </label>
  <div class="col-sm-10">
     <div class="tokenfield form-control"><input type="text" class="form-control width-500" name="xfield[countries]" id="xf_countries" data-alert="Страны" value="" data-rel="links" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="xf_countries-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div> 
  </div>
</div><div id="xfield_holder_genres" class="form-group">
  <label class="control-label col-sm-2">Жанры: </label>
  <div class="col-sm-10">
     <div class="tokenfield form-control"><input type="text" class="form-control width-500" name="xfield[genres]" id="xf_genres" data-alert="Жанры" value="" data-rel="links" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="xf_genres-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div> 
  </div>
</div><div id="xfield_holder_actors" class="form-group">
  <label class="control-label col-sm-2">Актеры: </label>
  <div class="col-sm-10">
     <div class="tokenfield form-control"><input type="text" class="form-control width-500" name="xfield[actors]" id="xf_actors" data-alert="Актеры" value="" data-rel="links" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="xf_actors-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div> 
  </div>
</div><div id="xfield_holder_directors" class="form-group">
  <label class="control-label col-sm-2">Режиссеры: </label>
  <div class="col-sm-10">
     <div class="tokenfield form-control"><input type="text" class="form-control width-500" name="xfield[directors]" id="xf_directors" data-alert="Режиссеры" value="" data-rel="links" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="xf_directors-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div> 
  </div>
</div><div id="xfield_holder_last_season" class="form-group">
  <label class="control-label col-sm-2">Последний сезон: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[last_season]" id="xf_last_season" data-alert="Последний сезон" value=""> 
  </div>
</div><div id="xfield_holder_last_episode" class="form-group">
  <label class="control-label col-sm-2">Последний эпизод: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[last_episode]" id="xf_last_episode" data-alert="Последний эпизод" value=""> 
  </div>
</div><div id="xfield_holder_time" class="form-group">
  <label class="control-label col-sm-2">Продолжительность: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[time]" id="xf_time" data-alert="Продолжительность" value=""> 
  </div>
</div><div id="xfield_holder_premera-v-rf" class="form-group">
  <label class="control-label col-sm-2">Премьера в РФ: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[premera-v-rf]" id="xf_premera-v-rf" data-alert="Премьера в РФ" value=""> 
  </div>
</div><div id="xfield_holder_poster2" class="form-group">
  <label class="control-label col-sm-2">Постер 2:  <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Постер 2" data-original-title="" title=""></i></label>
  <div class="col-sm-10"><div id="xfupload_poster2"><div class="qq-uploader"><div id="uploadedfile_poster2" style="min-height: 2px;"></div><div class="qq-upload-button btn btn-green bg-teal btn-sm btn-raised" style="width: auto; position: relative; overflow: hidden; direction: ltr;">Загрузить изображение<input type="file" name="file" style="position: absolute; right: 0px; top: 0px; font-family: Arial; font-size: 118px; margin: 0px; padding: 0px; cursor: pointer; opacity: 0;"></div><ul class="qq-upload-list" style="display:none;"></ul></div></div><input type="hidden" name="xfield[poster2]" id="xf_poster2" data-alert="Постер 2" value="">
<script>
jQuery(function($){
	new qq.FileUploader({
		element: document.getElementById('xfupload_poster2'),
		action: 'engine/ajax/controller.php?mod=upload',
		maxConnections: 1,
		multiple: false,
		allowdrop: false,
		encoding: 'multipart',
        sizeLimit: 0,
		allowedExtensions: ['gif', 'jpg', 'jpeg', 'png', 'bmp', 'webp', 'avif'],
	    params: {"subaction" : "upload", "news_id" : "0", "area" : "xfieldsimage", "author" : "admin2", "xfname" : "poster2", "user_hash" : "a2656b2874b2f91511e3042184577fd49fadd3ec"},
        template: '<div class="qq-uploader">' + 
                '<div id="uploadedfile_poster2" style="min-height: 2px;"></div>' +
                '<div class="qq-upload-button btn btn-green bg-teal btn-sm btn-raised" style="width: auto;">Загрузить изображение</div>' +
                '<ul class="qq-upload-list" style="display:none;"></ul>' + 
             '</div>',
		onSubmit: function(id, fileName) {

					$('<div id="uploadfile-'+id+'" class="file-box"><span class="qq-upload-file-status">Загрузка файла:</span><span class="qq-upload-file">&nbsp;'+fileName+'</span>&nbsp;<span class="qq-status"><span class="qq-upload-spinner"></span><span class="qq-upload-size"></span></span><div class="progress "><div class="progress-bar progress-blue" style="width: 0%"><span>0%</span></div></div></div>').appendTo('#xfupload_poster2');

        },
		onProgress: function(id, fileName, loaded, total){
					$('#uploadfile-'+id+' .qq-upload-size').text(DLEformatSize(loaded)+' из '+DLEformatSize(total));
					var proc = Math.round(loaded / total * 100);
					$('#uploadfile-'+id+' .progress-bar').css( "width", proc + '%' );
					$('#uploadfile-'+id+' .qq-upload-spinner').css( "display", "inline-block");

		},
		onComplete: function(id, fileName, response){

						if ( response.success ) {
							var returnbox = response.returnbox;
							var returnval = response.xfvalue;

							returnbox = returnbox.replace(/&lt;/g, "<");
							returnbox = returnbox.replace(/&gt;/g, ">");
							returnbox = returnbox.replace(/&amp;/g, "&");

							$('#uploadfile-'+id+' .qq-status').html('успешно завершена');
							$('#uploadedfile_poster2').html( returnbox );
							$('#xf_poster2').val(returnval);

							$('#xfupload_poster2 .qq-upload-button, #xfupload_poster2 .qq-upload-button input').attr("disabled","disabled");
							
							setTimeout(function() {
								$('#uploadfile-'+id).fadeOut('slow', function() { $(this).remove(); });
							}, 1000);
							
							$('#mediaupload').remove();

						} else {
							$('#uploadfile-'+id+' .qq-status').html('завершилось ошибкой');

							if( response.error ) $('#uploadfile-'+id+' .qq-status').append( '<br /><span class="text-danger">' + response.error + '</span>' );

							setTimeout(function() {
								$('#uploadfile-'+id).fadeOut('slow');
							}, 4000);
						}
		},
        messages: {
            typeError: "Файл {file} имеет неверное расширение. Только {extensions} разрешены к загрузке.",
            sizeError: "Файл {file} слишком большого размера, максимально допустимый размер файлов: {sizeLimit}.",
            emptyError: "Файл {file} пустой, выберите файлы повторно."
        },
		debug: false
    });
	
	if($('#xf_poster2').val() != "" ) {
		$('#xfupload_poster2 .qq-upload-button, #xfupload_poster2 .qq-upload-button input').attr("disabled","disabled");
	}
	
	if ( typeof Sortable != "undefined"  ) {
	
		var sortable_800f834e126c83bda6cfda5ea9f3dd9d = Sortable.create(document.getElementById('uploadedfile_poster2'), {
		  group: {
			name: 'xfuploadedimages',
			put: function (to) {
				return to.el.children.length < 1;
			}
		  },
		  handle: '.uploadimage',
		  draggable: '.uploadedfile',
		  onSort: function (evt) {
				
				if( sortable_800f834e126c83bda6cfda5ea9f3dd9d.el.children.length ) {
					$('#xfupload_poster2 .qq-upload-button, #xfupload_poster2 .qq-upload-button input').attr("disabled","disabled");
				} else {
					$('#xfupload_poster2 .qq-upload-button, #xfupload_poster2 .qq-upload-button input').removeAttr('disabled');
				}
				
				xfsinc('poster2');
		  },
		  animation: 150
		});
		
	}
	
});
</script>
  </div>
</div><div id="xfield_holder_gallery" class="form-group">
  <label class="control-label col-sm-2">Галлерея картинок:  </label>
  <div class="col-sm-10"><div id="xfupload_gallery"><div class="qq-uploader"><div id="uploadedfile_gallery" style="min-height: 2px;"></div><div class="qq-upload-button btn btn-green bg-teal btn-sm btn-raised" style="width: auto; position: relative; overflow: hidden; direction: ltr;">Загрузить изображения<input multiple="multiple" type="file" name="file" style="position: absolute; right: 0px; top: 0px; font-family: Arial; font-size: 118px; margin: 0px; padding: 0px; cursor: pointer; opacity: 0;"></div><ul class="qq-upload-list" style="display:none;"></ul></div></div><input type="hidden" name="xfield[gallery]" id="xf_gallery" data-alert="Галлерея картинок" value="">
<script>
	var maxallowfiles_2767cc3ede7592a47bd6657e3799565c = 0;
	var totaluploaded_2767cc3ede7592a47bd6657e3799565c = 0;
	var totalqueue_2767cc3ede7592a47bd6657e3799565c = 0;
	
	function xfimagegalerydelete_2767cc3ede7592a47bd6657e3799565c ( xfname, xfvalue, id )
	{
		DLEconfirm( 'Вы действительно хотите удалить изображение?', 'Информация', function () {
		
			ShowLoading('');
	
			$.post('engine/ajax/controller.php?mod=upload', { subaction: 'deluploads', user_hash: 'a2656b2874b2f91511e3042184577fd49fadd3ec', news_id: '0', author: 'admin2', 'images[]' : xfvalue }, function(data){
	
				HideLoading('');

				$('#xf_'+id).remove();
				totaluploaded_2767cc3ede7592a47bd6657e3799565c --;
				xfsinc('gallery');
				
				$('#xfupload_' + xfname + ' .qq-upload-button, #xfupload_' + xfname + ' .qq-upload-button input').removeAttr('disabled');
				
				$('#mediaupload').remove();
				
			});
			
		} );
		
		return false;

	};
jQuery(function($){
	var uploader_2767cc3ede7592a47bd6657e3799565c = new qq.FileUploader({
		element: document.getElementById('xfupload_gallery'),
		action: 'engine/ajax/controller.php?mod=upload',
		maxConnections: 1,
		multiple: true,
		allowdrop: false,
		encoding: 'multipart',
        sizeLimit: 0,
		allowedExtensions: ['gif', 'jpg', 'jpeg', 'png', 'bmp', 'webp', 'avif'],
	    params: {"subaction" : "upload", "news_id" : "0", "area" : "xfieldsimagegalery", "author" : "admin2", "xfname" : "gallery", "user_hash" : "a2656b2874b2f91511e3042184577fd49fadd3ec"},
        template: '<div class="qq-uploader">' + 
                '<div id="uploadedfile_gallery" style="min-height: 2px;"></div>' +
                '<div class="qq-upload-button btn btn-green bg-teal btn-sm btn-raised" style="width: auto;">Загрузить изображения</div>' +
                '<ul class="qq-upload-list" style="display:none;"></ul>' + 
             '</div>',
		onSubmit: function(id, fileName) {
		
					totalqueue_2767cc3ede7592a47bd6657e3799565c ++;
					
					if(maxallowfiles_2767cc3ede7592a47bd6657e3799565c && (totaluploaded_2767cc3ede7592a47bd6657e3799565c + totalqueue_2767cc3ede7592a47bd6657e3799565c ) > maxallowfiles_2767cc3ede7592a47bd6657e3799565c ) {
						totalqueue_2767cc3ede7592a47bd6657e3799565c --;
					
					    $('#xfupload_gallery .qq-upload-button, #xfupload_gallery .qq-upload-button input').attr("disabled","disabled");
						return false;
					}
							
					$('<div id="uploadfile-'+id+'" class="file-box"><span class="qq-upload-file-status">Загрузка файла:</span><span class="qq-upload-file">&nbsp;'+fileName+'</span>&nbsp;<span class="qq-status"><span class="qq-upload-spinner"></span><span class="qq-upload-size"></span></span><div class="progress "><div class="progress-bar progress-blue" style="width: 0%"><span>0%</span></div></div></div>').appendTo('#xfupload_gallery');

        },
		onProgress: function(id, fileName, loaded, total){
					$('#uploadfile-'+id+' .qq-upload-size').text(DLEformatSize(loaded)+' из '+DLEformatSize(total));
					var proc = Math.round(loaded / total * 100);
					$('#uploadfile-'+id+' .progress-bar').css( "width", proc + '%' );
					$('#uploadfile-'+id+' .qq-upload-spinner').css( "display", "inline-block");

		},
		onComplete: function(id, fileName, response){

						totalqueue_2767cc3ede7592a47bd6657e3799565c --;

						if ( response.success ) {
							totaluploaded_2767cc3ede7592a47bd6657e3799565c ++;

							var fieldvalue = $('#xf_gallery').val();
						
							var returnbox = response.returnbox;
							var returnval = response.xfvalue;

							returnbox = returnbox.replace(/&lt;/g, "<");
							returnbox = returnbox.replace(/&gt;/g, ">");
							returnbox = returnbox.replace(/&amp;/g, "&");

							$('#uploadfile-'+id+' .qq-status').html('успешно завершена');
							$('#uploadedfile_gallery').append( returnbox );
							
							if (fieldvalue == "") {
								$('#xf_gallery').val(returnval);
							} else {
								fieldvalue += ',' +returnval;
								$('#xf_gallery').val(fieldvalue);
							}

							if(maxallowfiles_2767cc3ede7592a47bd6657e3799565c && totaluploaded_2767cc3ede7592a47bd6657e3799565c == maxallowfiles_2767cc3ede7592a47bd6657e3799565c ) {
									$('#xfupload_gallery .qq-upload-button, #xfupload_gallery .qq-upload-button input').attr("disabled","disabled");
							}

							setTimeout(function() {
								$('#uploadfile-'+id).fadeOut('slow', function() { $(this).remove(); });
							}, 1000);
							
							$('#mediaupload').remove();
							
						} else {
							$('#uploadfile-'+id+' .qq-status').html('завершилось ошибкой');

							if( response.error ) $('#uploadfile-'+id+' .qq-status').append( '<br /><span class="text-danger">' + response.error + '</span>' );

							setTimeout(function() {
								$('#uploadfile-'+id).fadeOut('slow');
							}, 4000);
						}
		},
        messages: {
            typeError: "Файл {file} имеет неверное расширение. Только {extensions} разрешены к загрузке.",
            sizeError: "Файл {file} слишком большого размера, максимально допустимый размер файлов: {sizeLimit}.",
            emptyError: "Файл {file} пустой, выберите файлы повторно."
        },
		debug: false
    });
	
	if(maxallowfiles_2767cc3ede7592a47bd6657e3799565c && totaluploaded_2767cc3ede7592a47bd6657e3799565c >=  maxallowfiles_2767cc3ede7592a47bd6657e3799565c ) {
		$('#xfupload_gallery .qq-upload-button, #xfupload_gallery .qq-upload-button input').attr("disabled","disabled");
	}
	
	if ( typeof Sortable != "undefined"  ) {
	
		var sortable_2767cc3ede7592a47bd6657e3799565c = Sortable.create(document.getElementById('uploadedfile_gallery'), {
		  group: {
			name: 'xfuploadedimages',
			put: function (to) {
				if(maxallowfiles_2767cc3ede7592a47bd6657e3799565c && totaluploaded_2767cc3ede7592a47bd6657e3799565c >= maxallowfiles_2767cc3ede7592a47bd6657e3799565c ) {
					return false;
				} else {return true;}
			}
		  },
		  handle: '.uploadimage',
		  draggable: '.uploadedfile',
		  onSort: function (evt) {
				totaluploaded_2767cc3ede7592a47bd6657e3799565c = sortable_2767cc3ede7592a47bd6657e3799565c.el.children.length;
				
				if(maxallowfiles_2767cc3ede7592a47bd6657e3799565c && totaluploaded_2767cc3ede7592a47bd6657e3799565c >= maxallowfiles_2767cc3ede7592a47bd6657e3799565c ) {
					$('#xfupload_gallery .qq-upload-button, #xfupload_gallery .qq-upload-button input').attr("disabled","disabled");
				} else {
					$('#xfupload_gallery .qq-upload-button, #xfupload_gallery .qq-upload-button input').removeAttr('disabled');
				}
				
				xfsinc('gallery');
		  },
		  animation: 150
		});
		
	}
});
</script>
  </div>
</div><div id="xfield_holder_playlist" class="form-group">
  <label class="control-label col-sm-2">Плейлист серий [PL]: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[playlist]" id="xf_playlist" data-alert="Плейлист серий [PL]" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Плейлист серий" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_sum_episode" class="form-group">
  <label class="control-label col-sm-2">Всего серий: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[sum_episode]" id="xf_sum_episode" data-alert="Всего серий" value=""> 
  </div>
</div><div id="xfield_holder_chanel" class="form-group">
  <label class="control-label col-sm-2">Телеканал: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[chanel]" id="xf_chanel" data-alert="Телеканал" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Телеканал" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_title_orig" class="form-group">
  <label class="control-label col-sm-2">Униклаьное описание и заголовок:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[title_orig]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span>
  </div>
</div><div id="xfield_holder_anons" class="form-group">
  <label class="control-label col-sm-2">Анонс: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[anons]" id="xf_anons" data-alert="Анонс" value=""> 
  </div>
</div><div id="xfield_holder_partner" class="form-group">
  <label class="control-label col-sm-2">Партнерский плеер:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[partner]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span>
  </div>
</div><div id="xfield_holder_serial_final" class="form-group">
  <label class="control-label col-sm-2">Завершен сериал:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[serial_final]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span>
  </div>
</div><div id="xfield_holder_parse_id" class="form-group">
  <label class="control-label col-sm-2">Парсить плеер?:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[parse_id]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span>
  </div>
</div><div id="xfield_holder_parse_info" class="form-group">
  <label class="control-label col-sm-2">ID новости для парсинга: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[parse_info]" id="xf_parse_info" data-alert="ID новости для парсинга" value=""> 
  </div>
</div><div id="xfield_holder_parse_site" class="form-group">
  <label class="control-label col-sm-2">С какого сайта парсить?:</label>
  <div class="col-sm-10"><div class="btn-group bootstrap-select uniform"><button type="button" class="btn dropdown-toggle btn-default" data-toggle="dropdown" role="button" title="Нет"><span class="filter-option pull-left">Нет</span>&nbsp;<span class="bs-caret"><span class="caret"></span></span></button><div class="dropdown-menu open" role="combobox"><ul class="dropdown-menu inner" role="listbox" aria-expanded="false"><li data-original-index="0" class="selected"><a tabindex="0" class="" data-tokens="null" role="option" aria-disabled="false" aria-selected="true"><span class="text">Нет</span><span class=" fa fa-check check-mark"></span></a></li><li data-original-index="1"><a tabindex="0" class="" data-tokens="null" role="option" aria-disabled="false" aria-selected="false"><span class="text">Много сериалов</span><span class=" fa fa-check check-mark"></span></a></li><li data-original-index="2"><a tabindex="0" class="" data-tokens="null" role="option" aria-disabled="false" aria-selected="false"><span class="text">RoserialBe</span><span class=" fa fa-check check-mark"></span></a></li></ul></div><select class="uniform" name="xfield[parse_site]" tabindex="-98"><option value="0">Нет</option>
<option value="1">Много сериалов</option>
<option value="2">RoserialBe</option>
</select></div> 
  </div>
</div><div id="xfield_holder_check_balans" class="form-group">
  <label class="control-label col-sm-2">Использует балансера:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[check_balans]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span>
  </div>
</div><div id="xfield_holder_player_foto" class="form-group">
  <label class="control-label col-sm-2">player_foto:  </label>
  <div class="col-sm-10"><div id="xfupload_player_foto"><div class="qq-uploader"><div id="uploadedfile_player_foto" style="min-height: 2px;"></div><div class="qq-upload-button btn btn-green bg-teal btn-sm btn-raised" style="width: auto; position: relative; overflow: hidden; direction: ltr;">Загрузить изображение<input type="file" name="file" style="position: absolute; right: 0px; top: 0px; font-family: Arial; font-size: 118px; margin: 0px; padding: 0px; cursor: pointer; opacity: 0;"></div><ul class="qq-upload-list" style="display:none;"></ul></div></div><input type="hidden" name="xfield[player_foto]" id="xf_player_foto" data-alert="player_foto" value="">
<script>
jQuery(function($){
	new qq.FileUploader({
		element: document.getElementById('xfupload_player_foto'),
		action: 'engine/ajax/controller.php?mod=upload',
		maxConnections: 1,
		multiple: false,
		allowdrop: false,
		encoding: 'multipart',
        sizeLimit: 0,
		allowedExtensions: ['gif', 'jpg', 'jpeg', 'png', 'bmp', 'webp', 'avif'],
	    params: {"subaction" : "upload", "news_id" : "0", "area" : "xfieldsimage", "author" : "admin2", "xfname" : "player_foto", "user_hash" : "a2656b2874b2f91511e3042184577fd49fadd3ec"},
        template: '<div class="qq-uploader">' + 
                '<div id="uploadedfile_player_foto" style="min-height: 2px;"></div>' +
                '<div class="qq-upload-button btn btn-green bg-teal btn-sm btn-raised" style="width: auto;">Загрузить изображение</div>' +
                '<ul class="qq-upload-list" style="display:none;"></ul>' + 
             '</div>',
		onSubmit: function(id, fileName) {

					$('<div id="uploadfile-'+id+'" class="file-box"><span class="qq-upload-file-status">Загрузка файла:</span><span class="qq-upload-file">&nbsp;'+fileName+'</span>&nbsp;<span class="qq-status"><span class="qq-upload-spinner"></span><span class="qq-upload-size"></span></span><div class="progress "><div class="progress-bar progress-blue" style="width: 0%"><span>0%</span></div></div></div>').appendTo('#xfupload_player_foto');

        },
		onProgress: function(id, fileName, loaded, total){
					$('#uploadfile-'+id+' .qq-upload-size').text(DLEformatSize(loaded)+' из '+DLEformatSize(total));
					var proc = Math.round(loaded / total * 100);
					$('#uploadfile-'+id+' .progress-bar').css( "width", proc + '%' );
					$('#uploadfile-'+id+' .qq-upload-spinner').css( "display", "inline-block");

		},
		onComplete: function(id, fileName, response){

						if ( response.success ) {
							var returnbox = response.returnbox;
							var returnval = response.xfvalue;

							returnbox = returnbox.replace(/&lt;/g, "<");
							returnbox = returnbox.replace(/&gt;/g, ">");
							returnbox = returnbox.replace(/&amp;/g, "&");

							$('#uploadfile-'+id+' .qq-status').html('успешно завершена');
							$('#uploadedfile_player_foto').html( returnbox );
							$('#xf_player_foto').val(returnval);

							$('#xfupload_player_foto .qq-upload-button, #xfupload_player_foto .qq-upload-button input').attr("disabled","disabled");
							
							setTimeout(function() {
								$('#uploadfile-'+id).fadeOut('slow', function() { $(this).remove(); });
							}, 1000);
							
							$('#mediaupload').remove();

						} else {
							$('#uploadfile-'+id+' .qq-status').html('завершилось ошибкой');

							if( response.error ) $('#uploadfile-'+id+' .qq-status').append( '<br /><span class="text-danger">' + response.error + '</span>' );

							setTimeout(function() {
								$('#uploadfile-'+id).fadeOut('slow');
							}, 4000);
						}
		},
        messages: {
            typeError: "Файл {file} имеет неверное расширение. Только {extensions} разрешены к загрузке.",
            sizeError: "Файл {file} слишком большого размера, максимально допустимый размер файлов: {sizeLimit}.",
            emptyError: "Файл {file} пустой, выберите файлы повторно."
        },
		debug: false
    });
	
	if($('#xf_player_foto').val() != "" ) {
		$('#xfupload_player_foto .qq-upload-button, #xfupload_player_foto .qq-upload-button input').attr("disabled","disabled");
	}
	
	if ( typeof Sortable != "undefined"  ) {
	
		var sortable_bf435b3e6815479a6642ccdff39ec9c4 = Sortable.create(document.getElementById('uploadedfile_player_foto'), {
		  group: {
			name: 'xfuploadedimages',
			put: function (to) {
				return to.el.children.length < 1;
			}
		  },
		  handle: '.uploadimage',
		  draggable: '.uploadedfile',
		  onSort: function (evt) {
				
				if( sortable_bf435b3e6815479a6642ccdff39ec9c4.el.children.length ) {
					$('#xfupload_player_foto .qq-upload-button, #xfupload_player_foto .qq-upload-button input').attr("disabled","disabled");
				} else {
					$('#xfupload_player_foto .qq-upload-button, #xfupload_player_foto .qq-upload-button input').removeAttr('disabled');
				}
				
				xfsinc('player_foto');
		  },
		  animation: 150
		});
		
	}
	
});
</script>
  </div>
</div><div id="xfield_holder_id_kp" class="form-group">
  <label class="control-label col-sm-2">id_kp: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[id_kp]" id="xf_id_kp" data-alert="id_kp" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="id_kp" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_platform" class="form-group">
  <label class="control-label col-sm-2">Платформа: </label>
  <div class="col-sm-10">
     <div class="tokenfield form-control"><input type="text" class="form-control width-500" name="xfield[platform]" id="xf_platform" data-alert="Платформа" value="" data-rel="links" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="xf_platform-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Платформа" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_last_epizode" class="form-group">
  <label class="control-label col-sm-2">Последний эпизон (для подсказки): </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[last_epizode]" id="xf_last_epizode" data-alert="Последний эпизон (для подсказки)" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Последний эпизон (для подсказки)" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_idkp_actor" class="form-group">
  <label class="control-label col-sm-2">ID Кинопоиска: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[idkp_actor]" id="xf_idkp_actor" data-alert="ID Кинопоиска" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="ID Кинопоиска" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_canal_info" class="form-group">
  <label class="control-label col-sm-2">canal_info: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[canal_info]" id="xf_canal_info" data-alert="canal_info" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="canal_info" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_distributor" class="form-group">
  <label class="control-label col-sm-2">Дистрибьютор: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[distributor]" id="xf_distributor" data-alert="Дистрибьютор" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Дистрибьютор" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_production" class="form-group">
  <label class="control-label col-sm-2">Студии производства: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[production]" id="xf_production" data-alert="Студии производства" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Студии производства" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_iframe_alloha" class="form-group">
  <label class="control-label col-sm-2">iframe_alloha: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[iframe_alloha]" id="xf_iframe_alloha" data-alert="iframe_alloha" value=""><br><button data-type="iframe" type="button" class="upd-iframe btn bg-slate-600 btn-sm btn-raised position-left legitRipple">Обновить плеер alloha</button> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="iframe_alloha" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_kinopoisk_id" class="form-group">
  <label class="control-label col-sm-2">kinopoisk_id: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[kinopoisk_id]" id="xf_kinopoisk_id" data-alert="kinopoisk_id" value=""> <i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" data-rel="popover" data-trigger="hover" data-placement="right" data-content="kinopoisk_id" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_not_ru" class="form-group">
  <label class="control-label col-sm-2">Блокировка RU:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[not_ru]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span><i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" style="position: relative;top: -8px;" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Блокировка RU" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_not_ua" class="form-group">
  <label class="control-label col-sm-2">Блокировка UA:</label>
  <div class="col-sm-10"><input class="switch" type="checkbox" name="xfield[not_ua]" value="1" data-switchery="true" style="display: none;"><span class="switchery switchery-default" style="box-shadow: rgb(223, 223, 223) 0px 0px 0px 0px inset; border-color: rgb(223, 223, 223); background-color: rgb(255, 255, 255); transition: border 0.4s, box-shadow 0.4s;"><small style="left: 0px; transition: background-color 0.4s, left 0.2s;"></small></span><i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right position-left" style="position: relative;top: -8px;" data-rel="popover" data-trigger="hover" data-placement="right" data-content="Блокировка UA" data-original-title="" title=""></i>
  </div>
</div><div id="xfield_holder_alloha_sng" class="form-group">
  <label class="control-label col-sm-2">Плеер для СНГ: </label>
  <div class="col-sm-10">
     <input type="text" class="form-control width-500" name="xfield[alloha_sng]" id="xf_alloha_sng" data-alert="Плеер для СНГ" value=""> 
  </div>
</div>
<script>
<!--
jQuery(function($){
    onCategoryChange($('#category'));
});
// -->
</script>							<div class="form-group">
							  <label class="control-label col-md-2 col-sm-3">Актеры</label>
							  <div class="col-md-10 col-sm-9">
								<div class="tokenfield form-control"><input type="text" name="actors" id="actors" autocomplete="off" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" tabindex="-1" style="position: absolute; left: -10000px;"><input type="text" class="token-input ui-autocomplete-input" autocomplete="off" placeholder="" id="actors-tokenfield" tabindex="0" style="min-width: 60px; width: 500px;"><span role="status" aria-live="polite" class="ui-helper-hidden-accessible"></span></div><button onclick="ActorsParse(); return false;" class="btn bg-slate-600 btn-sm btn-raised legitRipple">Парсинг актеров</button><i class="help-button visible-lg-inline-block text-primary-600 fa fa-question-circle position-right" data-rel="popover" data-trigger="hover" data-placement="auto right" data-content="Парсер делает запрос к Unofficial Kinopoisk за получением списка актеров к фильм. Если он его получает, то сопостовляет данные с бд. Добавляет несуществующих актеров и краткую информацию по ним." data-original-title="" title=""></i>
							  </div>
							 </div>
                          <script>
                          	function ActorsParse() {
                              var kpid = document.getElementById('xf_kinopoisk_id').value;

                              ShowLoading('');

                              if(kpid<1) {
                                  Growl.error({
                                      text: 'Kinopoisk ID не задан либо задан неверно!'
                                  });
                                  HideLoading('');
                              } else {
                                $.post('engine/ajax/controller.php?mod=actorsparser', { kpid: kpid, user_hash: 'a2656b2874b2f91511e3042184577fd49fadd3ec' }, function(data){
                                	
                                    $('#actors').tokenfield('setTokens', data.actors);
                                    
                                    HideLoading('');

                                }, "json");
                              }
                              return false;
                          	
                        	}
                          </script>							<div class="form-group">
							  <label class="control-label col-md-2">Опции новости:</label>
							  <div class="col-md-10">
								<div class="row">
									<div class="col-sm-6" style="max-width:300px;">
										<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-approve"><span class="checked"><input class="icheck" type="checkbox" id="approve" name="approve" value="1" checked=""></span></div>Опубликовать новость на сайте</label></div>
										<div class="checkbox" id="opt_holder_main"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_main"><span class="checked"><input class="icheck" type="checkbox" id="allow_main" name="allow_main" value="1" checked=""></span></div>Публиковать на главной</label></div>
										<div class="checkbox" id="opt_holder_rating"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_rating"><span class="checked"><input class="icheck" type="checkbox" id="allow_rating" name="allow_rating" value="1" checked=""></span></div>Разрешить рейтинг статьи</label></div>
										<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_br"><span class="checked"><input class="icheck" type="checkbox" id="allow_br" name="allow_br" value="1" checked=""></span></div>Автоматический перенос строк</label></div>
									</div>
									<div class="col-sm-6">
										<div class="checkbox" id="opt_holder_comments"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_comm"><span class="checked"><input class="icheck" type="checkbox" id="allow_comm" name="allow_comm" value="1" checked=""></span></div>Разрешить комментарии</label></div>
										<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-news_fixed"><span><input class="icheck" type="checkbox" id="news_fixed" name="news_fixed" value="1"></span></div>Зафиксировать новость</label></div>
										<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-disable_index"><span><input class="icheck" type="checkbox" id="disable_index" name="disable_index" value="1"></span></div>Запретить индексацию страницы для поисковиков</label></div>
										<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-disable_search"><span><input class="icheck" type="checkbox" id="disable_search" name="disable_search" value="1"></span></div>Исключить из поиска по сайту</label></div>
<div class="checkbox" id="opt_update_player"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_update_player"><span><input onchange="this.checked ? $('#input_update_player').show() : $('#input_update_player').hide()" class="icheck" type="checkbox" id="allow_update_player" name="allow_update_player" value="1"></span></div>Добавить в список обновления плеера</label></div><input style="display:none;" type="text" class="form-control width-500" name="input_update_player" id="input_update_player" placeholder="Ссылка на страницу сайта">
									</div>
								</div>
												<div class="row mt-15" id="opt_cat_rss">
					<div class="col-sm-6" style="max-width:300px;">
						<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800"><span class="checked"><input class="icheck" type="checkbox" name="allow_rss" value="1" checked=""></span></div>Опубликовать новость в RSS потоке</label></div>
						<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_rss_turbo"><span class="checked"><input class="icheck" type="checkbox" name="allow_rss_turbo" id="allow_rss_turbo" value="1" checked=""></span></div>Использовать в Яндекс Турбо</label></div>
					</div>
					<div class="col-sm-6">
						<div class="checkbox"><label><div class="checker border-teal-600 text-teal-800" id="uniform-allow_rss_dzen"><span class="checked"><input class="icheck" type="checkbox" name="allow_rss_dzen" id="allow_rss_dzen" value="1" checked=""></span></div>Использовать в Яндекс Дзен</label></div>
					</div>
				</div>
							  </div>
							 </div>

						</div>



Html структура что нужно парсить
<article class="full ignore-select" itemscope="" itemtype="https://schema.org/Movie">
    <meta itemprop="dateCreated" content="2026-04-16">
    <meta itemprop="inLanguage" content="ru"> 
    <div class="fpage">
        <div class="ftitle">
            <h1 itemprop="name">На льду Сериал 2026 2025 Все (1-9 Серии) подряд</h1>
            <div class="to-fav">
                <span class="fa fa-star fav-guest" title="Добавить в закладки"></span>
                
            </div>
        </div>
        <!-- END FTITLE -->
        <div class="fcols clearfix">
            <div class="fposter">
                <img src="/uploads/posts/2026-04/1776326999_na_ldu_2026.jpg" alt="На льду Сериал 2026 2025 Все (1-9 Серии) подряд">
                <div class="frating"><div id="ratig-layer-2900">
	<div class="rating" itemprop="aggregateRating" itemscope="" itemtype="https://schema.org/AggregateRating">
		<ul class="unit-rating">
		<li class="current-rating" style="width:70%;">70</li>
		<li><a href="#" title="Плохо" class="r1-unit" onclick="doRate('1', '2900'); return false;">1</a></li>
		<li><a href="#" title="Приемлемо" class="r2-unit" onclick="doRate('2', '2900'); return false;">2</a></li>
		<li><a href="#" title="Средне" class="r3-unit" onclick="doRate('3', '2900'); return false;">3</a></li>
		<li><a href="#" title="Хорошо" class="r4-unit" onclick="doRate('4', '2900'); return false;">4</a></li>
		<li><a href="#" title="Хорошо" class="r5-unit" onclick="doRate('5', '2900'); return false;">5</a></li>
		<li><a href="#" title="Хорошо" class="r6-unit" onclick="doRate('6', '2900'); return false;">6</a></li>
		<li><a href="#" title="Хорошо" class="r7-unit" onclick="doRate('7', '2900'); return false;">7</a></li>
		<li><a href="#" title="Хорошо" class="r8-unit" onclick="doRate('8', '2900'); return false;">8</a></li>
		<li><a href="#" title="Хорошо" class="r9-unit" onclick="doRate('9', '2900'); return false;">9</a></li>
		<li><a href="#" title="Отлично" class="r10-unit" onclick="doRate('10', '2900'); return false;">10</a></li>
		</ul><meta itemprop="itemReviewed" content="На льду Сериал 2026 2025 Все (1-9 Серии) подряд"><meta itemprop="worstRating" content="1"><meta itemprop="ratingCount" content="8"><meta itemprop="ratingValue" content="7.4"><meta itemprop="bestRating" content="5">
	</div>
</div></div>
            </div>
            <div class="finfo">
                <div class="sd-line"><span>Страна:</span> Россия</div>
                <div class="sd-line"><span>Год выпуска:</span> <span itemprop="copyrightYear">2026</span></div>
                <div class="sd-line"><span>Жанр:</span> <span itemprop="genre">Детектив,  Драма</span></div>

                <div class="sd-line"><span>Количество серий:</span> 9</div>
                <div class="sd-line"><span>Продолжительность:</span> 52 минуты</div>
                <div class="sd-line"><span>Режиссер:</span> <span itemprop="director">Максим Кулагин</span></div>
                <div class="sd-line"><span>В ролях:</span> <span itemprop="actors">Ангелина Пахомова, Артём Быстров, Виктория Толстоганова, Пётр Фёдоров, Марьяна Спивак, Павел Ворожцов, Варвара Володина, Мария Ахметзянова, Роман Евдокимов, Наталья Земцова, Наталья Павленкова, Антон Рогачёв, Марианна Шульц, Роман Васильев, Юлия Топольницкая, Полина Айнутдинова, Варвара Майорова, Агния Воробьёва, Мирослава Карпеева, Наталья Рогожкина, Алексей Бурмистров, Ксения Каталымова, Олег Савостюк, Евгения Капралова, Егор Заховаев, Сергей Шнырёв, Мария Кулик, Лариса Фёдорова, Сергей Фатьянов, Сергей Рожнов, Иван Рыжиков, Алексей Соколков</span></div>
            </div>
        </div>
        <!-- END FCOLS -->
        <div class="fdesc full-text clearfix">
            <div class="fdesc-title">Описание:</div>
            <span itemprop="description">Десять лет назад жизнь Ксении изменилась навсегда, когда она потеряла своего партнера по фигурному катанию Алексея в ужасной трагедии. Этот момент стал для нее не только личной утратой, но и настоящим ударом по ее карьере. С тех пор она покинула родной город и старалась забыть о прошлом, но время лечит не всегда, и вот настал момент, когда Ксения решила вернуться. Вернуться не только в родные края, но и в мир, который когда-то был ей так близок, мир фигурного катания, полный эмоций, соревнований и, увы, тайн. Ксения собирается разобраться в обстоятельствах гибели Алексея, которые до сих пор остаются неразгаданной загадкой. Она надеется, что возвращение в спортивную школу, где она когда-то тренировалась, поможет ей найти ответы на мучающие вопросы. В этом месте, полном воспоминаний и старых друзей, она занимает место тренера, что дает ей возможность не только обучать новых фигуристов, но и заново взглянуть на свою жизнь и на те события, которые привели к трагедии. Однако, погружаясь в прошлое, Ксения сталкивается с тем, что мир фигурного катания не изменился. Здесь по-прежнему идет жестокая борьба за признание, успех и чемпионские титулы. Она замечает, что среди юных фигуристов продолжают плестись интриги, а в их семьях скрываются мрачные секреты, о которых никто не решается говорить вслух. Весь этот клубок интриг и недомолвок начинает постепенно распутываться, и Ксения осознает, что за фасадом дружбы и сотрудничества скрываются гораздо более темные стороны. На посту главного тренера находится Алевтина женщина, обладающая жестким характером и строгими методами. Она не прощает слабостей и требует от своих подопечных максимума. Ксения вскоре понимает, что под руководством Алевтины может произойти что-то ужасное, и ей необходимо действовать, чтобы предотвратить новую трагедию. Но она даже не догадывается, что бывшая учительница знает больше, чем говорит, и что у нее имеются подробности о смерти Алексея, которые она тщательно скрывает от всех. Ксения оказывается в центре событий, где на кону стоят не только ее собственные амбиции, но и жизни тех, кто ей дорог. В этом мире, полном страстей и конфликтов, она должна найти смелость, чтобы раскрыть правду и, возможно, наконец-то освободиться от бремени прошлого.</span>
        </div>
    </div>
    
    
    <br>
    <!-- END FPAGE -->
    <div class="fplayer-title"><h2>смотреть На льду Сериал 2026 2025 Все (1-9 Серии) подряд онлайн бесплатно в хорошем качестве HD 1080</h2></div>
    <div class="fplayer tabs-box">
        <div class="tabs-b video-box visible">
            <div class="playlists-ajax" data-xfname="playlist" data-news_id="2900"><div class="playlists-player"><div class="playlists-lists"></div><div class="playlists-iframe"><iframe scrolling="no" src="https://vkvideo.ru/video_ext.php?oid=-47393707&amp;id=456246017" allowfullscreen="" frameborder="0" width="100%" height="100%"></iframe></div><div class="playlists-videos"><div class="playlists-items" style="overflow: hidden;"><ul style="transform: translateZ(0px) translateX(-4px); width: 1656px;"><li data-file="https://vkvideo.ru/video_ext.php?oid=-47393707&amp;id=456246017" data-id="0" class="active">1 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239017" data-id="0">2 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239018" data-id="0">3 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239019" data-id="0">4 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239020" data-id="0">5 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239021" data-id="0">6 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239022" data-id="0">7 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239023" data-id="0">8 Серия<span class="playlists-view"></span></li><li data-file="https://vkvideo.ru/video_ext.php?oid=-239767031&amp;id=456239024" data-id="0">9 Серия<span class="playlists-view"></span></li></ul><div class="playlists-prev disabled"></div><div class="playlists-next"></div></div></div></div></div>    
           
        </div>
<!-- uSocial -->
<script async="" src="https://usocial.pro/usocial/usocial.js?uid=60c7edba45f43735&amp;v=6.1.5" data-script="usocial" charset="utf-8"></script>
<div class="uSocial-Share" data-pid="cba74037bf896e9d94da1514aa1a435a" data-type="share" data-options="round-rect,style1,default,absolute,horizontal,size32,eachCounter1,counter0,nomobile,mobile_position_right" data-social="vk,ok,lj,telegram,wa,vi,bookmarks,email" data-key="0" data-url="https://russian-seriali.net/2900-na-ldu-serial-2026-2025-vse-1-9-serii-podrjad.html" style="display: block;"><div class="uscl-bar uscl-round-rect uscl-style1 uscl-default uscl-absolute uscl-horizontal uscl-size32 uscl-eachCounter1 uscl-counter0 uscl-nomobile uscl-mobile_position_right"><div class="uscl-list"><div class="uscl-item"><span data-item="vk" title="Поделиться ВКонтакте" class="ico_uscl_soc ico_uscl ico_uscl-vk uscl-vk"><span class="uscl-each-counter">0</span></span></div><div class="uscl-item"><span data-item="ok" title="Поделиться в OK.ru" class="ico_uscl_soc ico_uscl ico_uscl-ok uscl-ok"><span class="uscl-each-counter">2</span></span></div><div class="uscl-item"><span data-item="lj" title="Поделиться в LiveJournal" class="ico_uscl_soc ico_uscl ico_uscl-lj uscl-lj"><span class="uscl-each-counter">13</span></span></div><div class="uscl-item"><span data-item="telegram" title="Поделиться в Telegram" class="ico_uscl_soc ico_uscl ico_uscl-telegram uscl-telegram"><span class="uscl-each-counter">37</span></span></div><div class="uscl-item"><span data-item="wa" title="Поделиться в WhatsApp" class="ico_uscl_soc ico_uscl ico_uscl-wa uscl-wa"><span class="uscl-each-counter">15</span></span></div><div class="uscl-item"><span data-item="vi" title="Поделиться в Viber" class="ico_uscl_soc ico_uscl ico_uscl-vi uscl-vi"><span class="uscl-each-counter">12</span></span></div><div class="uscl-item--bookmarks uscl-item"><a data-item="bookmarks" href="#" rel="sidebar" title="На льду Сериал 2026 2025 Все (1-9 Серии) подряд смотреть онлайн бесплатно в хорошем качестве" class="ico_uscl ico_uscl-bookmarks uscl-bookmarks"></a></div><div class="uscl-item"><span data-item="email" title="Поделиться по E-mail" class="ico_uscl ico_uscl-email uscl-email"></span></div><div class="uscl-item uscl-slide"><span class="uscl-slide-close ico_uscl-arrow ico_uscl"></span></div></div><span class="uscl-slide-open ico_uscl-like"></span><div id="uSocial-popup" class="uscl-popup"><div class="uscl-popup-background"></div><div class="uscl-popup-dialog"><div class="uscl-popup-header"><div class="uscl-popup-headline"></div><span class="uscl-popup-close ico_uscl ico_uscl-close"></span></div><div class="uscl-popup-body"></div></div></div></div></div>
<!-- /uSocial -->          
    </div>
  <!-- END FPLAYER -->
    
<br>    
<div class="rels">
        <div class="rels-t">Рекомендуем посмотреть</div>
        <div class="rels-c owl-carousel owl-loaded owl-drag" id="owl-rels">
            
        <div class="owl-stage-outer"><div class="owl-stage" style="transform: translate3d(0px, 0px, 0px); transition: all; width: 615px;"><div class="owl-item active" style="width: auto; margin-right: 20px;"><a class="side-item1" href="https://russian-seriali.net/799-hrustalnaja-koroleva-serial-2023-2022-vse-1-4-serii-podrjad.html">
	<div class="si1-img img-box">
		<img data-src="/uploads/mini/rels/3f/b9c4b8a3d010c0bdad5a1eed6e1911.webp" alt="Хрустальная королева Сериал 2023 2022 Все (1-4 Серии) подряд" src="/uploads/mini/rels/3f/b9c4b8a3d010c0bdad5a1eed6e1911.webp" class="lazy-loaded">
	</div>
	<div class="si1-title">Хрустальная королева Сериал 2023 2022 Все (1-4 Серии) подряд</div>
</a></div><div class="owl-item active" style="width: auto; margin-right: 20px;"><a class="side-item1" href="https://russian-seriali.net/1355-zoloto-serial-2025-2024-vse-1-8-serii-podrjad.html">
	<div class="si1-img img-box">
		<img data-src="/uploads/mini/rels/05/5634c3e2ff58980b841cfa621a68cc.webp" alt="Золото Сериал 2025 2024 Все (1-8 Серии) подряд" src="/uploads/mini/rels/05/5634c3e2ff58980b841cfa621a68cc.webp" class="lazy-loaded">
	</div>
	<div class="si1-title">Золото Сериал 2025 2024 Все (1-8 Серии) подряд</div>
</a></div><div class="owl-item active" style="width: auto; margin-right: 20px;"><a class="side-item1" href="https://russian-seriali.net/867-ryzhik-hd-serial-2019-rossija-vse-1-4-serii-podrjad.html">
	<div class="si1-img img-box">
		<img data-src="/uploads/mini/rels/ad/33d652c9a85b3c5fa719084096d96e.webp" alt="Рыжик Сериал 2019 Россия Все (1-4 Серии) подряд" src="/uploads/mini/rels/ad/33d652c9a85b3c5fa719084096d96e.webp" class="lazy-loaded">
	</div>
	<div class="si1-title">Рыжик Сериал 2019 Россия Все (1-4 Серии) подряд</div>
</a></div><div class="owl-item active" style="width: auto; margin-right: 20px;"><a class="side-item1" href="https://russian-seriali.net/1862-izmena-serial-2012-2011-rossija-vse-1-8-serii-podrjad.html">
	<div class="si1-img img-box">
		<img data-src="/uploads/mini/rels/22/b83a44f24ec7c61defc1733f381bc3.webp" alt="Измена Сериал 2012 2011 Россия Все (1-8 Серии) подряд" src="/uploads/mini/rels/22/b83a44f24ec7c61defc1733f381bc3.webp" class="lazy-loaded">
	</div>
	<div class="si1-title">Измена Сериал 2012 2011 Россия Все (1-8 Серии) подряд</div>
</a></div><div class="owl-item active" style="width: auto; margin-right: 20px;"><a class="side-item1" href="https://russian-seriali.net/1105-koshkin-dom-serial-2020-vse-1-4-serii-podrjad.html">
	<div class="si1-img img-box">
		<img data-src="/uploads/mini/rels/ec/78095b8e480433cc659fb65bbb48e6.webp" alt="Кошкин дом Сериал 2020 Все (1-4 Серии) подряд" src="/uploads/mini/rels/ec/78095b8e480433cc659fb65bbb48e6.webp" class="lazy-loaded">
	</div>
	<div class="si1-title">Кошкин дом Сериал 2020 Все (1-4 Серии) подряд</div>
</a></div></div></div><div class="owl-nav disabled"><div class="owl-prev"><span class="fa fa-chevron-left"></span></div><div class="owl-next"><span class="fa fa-chevron-right"></span></div></div><div class="owl-dots disabled"></div></div>
    </div>    
    
</article>