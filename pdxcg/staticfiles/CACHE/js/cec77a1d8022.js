(function($)
{
    var scrollElement = 'html, body';
    var active_input = '';

    // Settings
    var COMMENT_SCROLL_TOP_OFFSET = 40;
    var PREVIEW_SCROLL_TOP_OFFSET = 20;


    $.fn.ready(function()
    {
        var commentform = $('form.js-comments-form');
        if( commentform.length > 0 )
        {
            // Detect last active input.
            // Submit if return is hit, or any button other then preview is hit.
            commentform.find(':input').focus(setActiveInput).mousedown(setActiveInput);
            commentform.submit(onCommentFormSubmit);
        }


        // Bind events for threaded comment reply
        if($.fn.on) {
            // jQuery 1.7+
            $('body').on('click', '.comment-reply-link', showThreadedReplyForm);
        }
        else {
            $('.comment-reply-link').live('click', showThreadedReplyForm);
        }

        $('.comment-cancel-reply-link').click(cancelThreadedReplyForm);
        $('.js-comments-form').wrap('<div class="js-comments-form-orig-position"></div>');


        // Find the element to use for scrolling.
        // This code is much shorter then jQuery.scrollTo()
        $('html, body').each(function()
        {
            // See which tag updates the scrollTop attribute
            var $rootEl = $(this);
            var initScrollTop = $rootEl.attr('scrollTop');
            $rootEl.attr('scrollTop', initScrollTop + 1);
            if( $rootEl.attr('scrollTop') == initScrollTop + 1 )
            {
                scrollElement = this.nodeName.toLowerCase();
                $rootEl.attr('scrollTop', initScrollTop);  // Firefox 2 reset
                return false;
            }
        });


        // On load, scroll to proper comment.
        var hash = window.location.hash;
        if( hash.substring(0, 2) == "#c" )
        {
            var id = parseInt(hash.substring(2));
            if( ! isNaN(id))   // e.g. #comments in URL
                scrollToComment(id, 1000);
        }
    });


    function setActiveInput()
    {
        active_input = this.name;
    }


    function onCommentFormSubmit(event)
    {
        event.preventDefault();  // only after ajax call worked.
        var form = event.target;
        var preview = (active_input == 'preview');

        ajaxComment(form, {
            onsuccess: (preview ? null : onCommentPosted),
            preview: preview
        });
        return false;
    }


    function scrollToComment(id, speed)
    {
        // Allow initialisation before scrolling.
        var $comment = $("#c" + id);
        if( $comment.length == 0 ) {
            if( window.console ) console.warn("scrollToComment() - #c" + id + " not found.");
            return;
        }

        if( window.on_scroll_to_comment && window.on_scroll_to_comment({comment: $comment}) === false )
            return;

        // Scroll to the comment.
        scrollToElement( $comment, speed, COMMENT_SCROLL_TOP_OFFSET );
    }


    function scrollToElement( $element, speed, offset )
    {
        if( $element.length )
            $(scrollElement).animate( {scrollTop: $element.offset().top - (offset || 0) }, speed || 1000 );
    }


    function onCommentPosted( comment_id, is_moderated, $comment )
    {
        var $message_span;
        if( is_moderated )
            $message_span = $("#comment-moderated-message").fadeIn(200);
        else
            $message_span = $("#comment-added-message").fadeIn(200);

        setTimeout(function(){ scrollToComment(comment_id, 1000); }, 1000);
        setTimeout(function(){ $message_span.fadeOut(500) }, 4000);
    }


    function showThreadedReplyForm(event) {
        event.preventDefault();

        var $a = $(this);
        var comment_id = $a.data('comment-id');

        $('#id_parent').val(comment_id);
        $('.js-comments-form').insertAfter($a.closest('.comment-item'));
    };


    function cancelThreadedReplyForm(event) {
        if(event)
            event.preventDefault();

        $('#id_comment').val('');
        $('#id_parent').val('');
        $('.js-comments-form').appendTo($('.js-comments-form-orig-position'));
    }


    /*
      Based on django-ajaxcomments, BSD licensed.
      Copyright (c) 2009 Brandon Konkle and individual contributors.

      Updated to be more generic, more fancy, and usable with different templates.
     */
    var commentBusy = false;
    var previewAutoAdded = false;

    function ajaxComment(form, args)
    {
        var onsuccess = args.onsuccess;
        var preview = !!args.preview;

        $('div.comment-error').remove();
        if (commentBusy) {
            return false;
        }

        commentBusy = true;
        var $form = $(form);
        var comment = $form.serialize() + (preview ? '&preview=1' : '');
        var url = $form.attr('action') || './';
        var ajaxurl = $form.attr('data-ajax-action');

        // Add a wait animation
        if( ! preview )
            $('#comment-waiting').fadeIn(1000);

        // Use AJAX to post the comment.
        $.ajax({
            type: 'POST',
            url: ajaxurl || url,
            data: comment,
            dataType: 'json',
            success: function(data) {
                commentBusy = false;
                removeWaitAnimation();
                removeErrors();

                if (data.success) {
                    var $added;
                    if( preview )
                        $added = commentPreview(data);
                    else
                        $added = commentSuccess(data);

                    if( onsuccess )
                        args.onsuccess(data.comment_id, data.is_moderated, $added);
                }
                else {
                    commentFailure(data);
                }
            },
            error: function(data) {
                commentBusy = false;
                removeWaitAnimation();

                // Submit as non-ajax instead
                //$form.unbind('submit').submit();
            }
        });

        return false;
    }

    function commentSuccess(data)
    {
        // Clean form
        $('form.js-comments-form textarea').last().val("");
        $('#id_comment').val('');
        cancelThreadedReplyForm();  // in case threaded comments are used.

        // Show comment
        var had_preview = removePreview();
        var $new_comment = addComment(data);

        if( had_preview )
            // Avoid double jump when preview was removed. Instead refade to final comment.
            $new_comment.hide().fadeIn(600);
        else
            // Smooth introduction to the new comment.
            $new_comment.hide().show(600);

        return $new_comment;
    }

    function addComment(data)
    {
        // data contains the server-side response.
        var html = data['html']
        var parent_id = data['parent_id'];

        var $new_comment;
        if(parent_id)
        {
            var $parentLi = $("#c" + parseInt(parent_id)).parent('li.comment-wrapper');
            var $commentUl = $parentLi.children('ul');
            if( $commentUl.length == 0 )
                $commentUl = $parentLi.append('<ul class="comment-list-wrapper"></ul>').children('ul.comment-list-wrapper');
            $commentUl.append('<li class="comment-wrapper">' + html + '</li>');
        }
        else
        {
            // Each top-level of django-threadedcomments starts in a new <ul>
            // when you use the comment.open / comment.close logic as prescribed.
            if(data['use_threadedcomments'])
                html = '<ul class="comment-list-wrapper"><li class="comment-wrapper">' + html + '</li></ul>';

            var $comments = getCommentsDiv();
            $comments.append(html).removeClass('empty');
        }

        return $("#c" + parseInt(data.comment_id));
    }

    function commentPreview(data)
    {
        var $previewarea = $("#comment-preview-area");
        if( $previewarea.length == 0 )
        {
            // If not explicitly added to the HTML, include a previewarea in the comments.
            // This should at least give the same markup.
            getCommentsDiv().append('<div id="comment-preview-area"></div>').addClass('has-preview');
            $previewarea = $("#comment-preview-area");
            previewAutoAdded = true;
        }

        var had_preview = $previewarea.hasClass('has-preview-loaded');
        $previewarea.html(data.html).addClass('has-preview-loaded');
        if( ! had_preview )
            $previewarea.hide().show(600);

        // Scroll to preview, but allow time to render it.
        setTimeout(function(){ scrollToElement( $previewarea, 500, PREVIEW_SCROLL_TOP_OFFSET ); }, 500);
    }

    function commentFailure(data)
    {
        // Show mew errors
        for (var field_name in data.errors) {
            if(field_name) {
                var $field = $('#id_' + field_name);

                // Twitter bootstrap style
                $field.after('<span class="js-errors">' + data.errors[field_name] + '</span>');
                $field.closest('.control-group').addClass('error');
            }
        }
    }

    function removeErrors()
    {
        $('form.js-comments-form .js-errors').remove();
        $('form.js-comments-form .control-group.error').removeClass('error');
    }

    function getCommentsDiv()
    {
        var $comments = $("#comments");
        if( $comments.length == 0 )
            alert("Internal error - unable to display comment.\n\nreason: container is missing in the page.");
        return $comments;
    }

    function removePreview()
    {
        var $previewarea = $("#comment-preview-area");
        var had_preview = $previewarea.hasClass('has-preview-loaded');

        if( previewAutoAdded )
            $previewarea.remove();  // make sure it's added at the end again later.
        else
            $previewarea.html('');

        // Update classes. allowing CSS to add/remove margins for example.
        $previewarea.removeClass('has-preview-loaded')
        $("#comments").removeClass('has-preview');

        return had_preview;
    }

    function removeWaitAnimation()
    {
        // Remove the wait animation and message
        $('#comment-waiting').hide().stop();
    }

})(window.jQuery);

;(function($){$.fn.formset=function(opts)
{var options=$.extend({},$.fn.formset.defaults,opts),flatExtraClasses=options.extraClasses.join(' '),$$=$(this),applyExtraClasses=function(row,ndx){if(options.extraClasses){row.removeClass(flatExtraClasses);row.addClass(options.extraClasses[ndx%options.extraClasses.length]);}},updateElementIndex=function(elem,prefix,ndx){var idRegex=new RegExp('('+prefix+'-\\d+-)|(^)'),replacement=prefix+'-'+ndx+'-';if(elem.attr("for"))elem.attr("for",elem.attr("for").replace(idRegex,replacement));if(elem.attr('id'))elem.attr('id',elem.attr('id').replace(idRegex,replacement));if(elem.attr('name'))elem.attr('name',elem.attr('name').replace(idRegex,replacement));},hasChildElements=function(row){return row.find('input,select,textarea,label').length>0;},insertDeleteLink=function(row){if(row.is('TR')){row.children(':last').append('<a class="'+options.deleteCssClass+'" href="javascript:void(0)">'+options.deleteText+'</a>');}else if(row.is('UL')||row.is('OL')){row.append('<li><a class="'+options.deleteCssClass+'" href="javascript:void(0)">'+options.deleteText+'</a></li>');}else{row.append('<a class="'+options.deleteCssClass+'" href="javascript:void(0)">'+options.deleteText+'</a>');}
row.find('a.'+options.deleteCssClass).click(function(){var row=$(this).parents('.'+options.formCssClass),del=row.find('input:hidden[id $= "-DELETE"]');if(del.length){del.val('on');row.hide();}else{row.remove();var forms=$('.'+options.formCssClass).not('.formset-custom-template');$('#id_'+options.prefix+'-TOTAL_FORMS').val(forms.length);for(var i=0,formCount=forms.length;i<formCount;i++){applyExtraClasses(forms.eq(i),i);forms.eq(i).find('input,select,textarea,label').each(function(){updateElementIndex($(this),options.prefix,i);});}}
if(options.removed)options.removed(row);return false;});};$$.each(function(i){var row=$(this),del=row.find('input:checkbox[id $= "-DELETE"]');if(del.length){del.before('<input type="hidden" name="'+del.attr('name')+'" id="'+del.attr('id')+'" />');del.remove();}
if(hasChildElements(row)){insertDeleteLink(row);row.addClass(options.formCssClass);applyExtraClasses(row,i);}});if($$.length){var addButton,template;if(options.formTemplate){template=(options.formTemplate instanceof $)?options.formTemplate:$(options.formTemplate);template.removeAttr('id').addClass(options.formCssClass).addClass('formset-custom-template');template.find('input,select,textarea,label').each(function(){updateElementIndex($(this),options.prefix,2012);});insertDeleteLink(template);}else{template=$('.'+options.formCssClass+':last').clone(true).removeAttr('id');template.find('input:hidden[id $= "-DELETE"]').remove();template.find('input,select,textarea,label').each(function(){var elem=$(this);if(elem.is('input:checkbox')||elem.is('input:radio')){elem.attr('checked',false);}else{elem.val('');}});}
options.formTemplate=template;if($$.attr('tagName')=='TR'){var numCols=$$.eq(0).children().length;$$.parent().append('<tr><td colspan="'+numCols+'"><a class="'+options.addCssClass+'" href="javascript:void(0)">'+options.addText+'</a></tr>');addButton=$$.parent().find('tr:last a');addButton.parents('tr').addClass(options.formCssClass+'-add');}else{$$.filter(':last').after('<a class="'+options.addCssClass+'" href="javascript:void(0)">'+options.addText+'</a>');addButton=$$.filter(':last').next();}
addButton.click(function(){var formCount=parseInt($('#id_'+options.prefix+'-TOTAL_FORMS').val()),row=options.formTemplate.clone(true).removeClass('formset-custom-template'),buttonRow=$(this).parents('tr.'+options.formCssClass+'-add').get(0)||this;applyExtraClasses(row,formCount);row.insertBefore($(buttonRow)).show();row.find('input,select,textarea,label').each(function(){updateElementIndex($(this),options.prefix,formCount);});$('#id_'+options.prefix+'-TOTAL_FORMS').val(formCount+1);if(options.added)options.added(row);return false;});}
return $$;}
$.fn.formset.defaults={prefix:'form',formTemplate:null,addText:'add another',deleteText:'remove',addCssClass:'add-row',deleteCssClass:'delete-row',formCssClass:'dynamic-form',extraClasses:[],added:null,removed:null};})(jQuery)
function pybb_delete_post(url, post_id, confirm_text) {
    conf = confirm(confirm_text);
    if (!conf) return false;
    obj = {url: url,
        type: 'POST',
        dataType: 'text',
        success: function (data, textStatus) {
            if (data.length > 0) {
                window.location = data;
            } else {
                $("#" + post_id).slideUp();
            }
        }
    };
    $.ajax(obj);
}

jQuery(function ($) {
    function getSelectedText() {
        if (document.selection) {
            return document.selection.createRange().text;
        } else {
            return window.getSelection().toString();
        }
    }

    var textarea = $('#id_body');

    if (textarea.length > 0) {
        $('.quote-link').on('click', function(e){
            e.preventDefault();
            var url = $(this).attr('href');
            $.get(
                url,
                function(data) {
                    if (textarea.val())
                        textarea.val(textarea.val() + '\n');
                    textarea.val(textarea.val() + data);
                }
            );
        });

        $('.quote-selected-link').on('click', function (e) {
            e.preventDefault();
            var selectedText = getSelectedText();
            if (selectedText != '') {
                if (textarea.val())
                    textarea.val(textarea.val() + '\n');

                var nickName = '';
                if ($(this).closest('.post-row').length == 1 &&
                    $(this).closest('.post-row').find('.post-username').length == 1) {
                    nickName = $(this).closest('.post').find('.post-username').text();
                }

                textarea.val(
                    textarea.val() +
                    (nickName ? ('[quote="' + $.trim(nickName) + '"]') : '[quote]') +
                    selectedText +
                    '[/quote]\n'
                );
            }
        });

        $('.post-row .post-username').on('click', function (e) {
            if (e.shiftKey) {
                var nick = $.trim($(this).text());
                if (textarea.val())
                    textarea.val(textarea.val() + '\n');
                textarea.val(textarea.val() + '[b]' + nick + '[/b], ');
                return e.preventDefault();
            }
        });
    }
});

/*
 * jQuery stringToSlug plug-in 1.3.0
 *
 * Plugin HomePage http://leocaseiro.com.br/jquery-plugin-string-to-slug/
 *
 * Copyright (c) 2009 Leo Caseiro
 *
 * Based on Edson Hilios (http://www.edsonhilios.com.br/ Algoritm
 *
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

jQuery.fn.stringToSlug = function(options) {
	var defaults = {
		setEvents: 'keyup keydown blur', //set Events that your script will work
		getPut: '#id_slug', //set output field
		space: '-', //Sets the space character. If the hyphen,
		prefix: '',
		suffix: '',
		replace: '', //Sample: /\s?\([^\)]*\)/gi
		AND: 'and',
		callback: false
	};

	var opts = jQuery.extend(defaults, options);

	jQuery(this).bind(defaults.setEvents, function () {
		var text = jQuery(this).val();
		text = defaults.prefix + text + defaults.suffix; //Concatenate with prefix and suffix
		text = text.replace(defaults.replace, ""); //replace
		text = jQuery.trim(text.toString()); //Remove side spaces and convert to String Object

		var chars = []; //Cria vetor de caracteres
		for (var i = 0; i < 32; i++) {
			chars.push ('');
		}

		/*** Abaixo a lista de caracteres ***/
		chars.push(
			defaults.space, // Unicode 32
			'',   // !
			'',   // "
			'',   // #
			'',   // $
			'',   // %
			defaults.AND,   // &
			"",   // '
			defaults.space,  // (
			defaults.space,  // ,
			'',   // *
			'',   // +
			defaults.space,  // ,
			defaults.space,  // -
			defaults.space,  // .
			defaults.space,  // /
			'0',  // 0
			'1',  // 1
			'2',  // 2
			'3',  // 3
			'4',  // 4
			'5',  // 5
			'6',  // 6
			'7',  // 7
			'8',  // 8
			'9',  // 9
			defaults.space,   // :
			defaults.space,   // ;
			'',   // <
			defaults.space,   // =
			'',   // >
			'',   // ?
			'',   // @
			'A',  // A
			'B',  // B
			'C',  // C
			'D',  // D
			'E',  // E
			'F',  // F
			'G',  // G
			'H',  // H
			'I',  // I
			'J',  // J
			'K',  // K
			'L',  // L
			'M',  // M
			'N',  // N
			'O',  // O
			'P',  // P
			'Q',  // Q
			'R',  // R
			'S',  // S
			'T',  // T
			'U',  // U
			'V',  // V
			'W',  // W
			'X',  // X
			'Y',  // Y
			'Z',  // Z
			defaults.space,  // [
			defaults.space,  // /
			defaults.space,  // ]
			'',   // ^
			defaults.space,  // _
			'',   // `
			'a',  // a
			'b',  // b
			'c',  // c
			'd',  // d
			'e',  // e
			'f',  // f
			'g',  // g
			'h',  // h
			'i',  // i
			'j',  // j
			'k',  // k
			'l',  // l
			'm',  // m
			'n',  // n
			'o',  // o
			'p',  // p
			'q',  // q
			'r',  // r
			's',  // s
			't',  // t
			'u',  // u
			'v',  // v
			'w',  // w
			'x',  // x
			'y',  // y
			'z',  // z
			defaults.space,  // {
			'',   // |
			defaults.space,  // }
			'',   // ~
			'', // ? 007F control char: del

			// start of C1 Controls (Range: 0080–009F)
			// TODO: shouldn't control chars be empty?
			'C', // 0080 control char
			'A',
			'',
			'f',
			'',
			'',
			'T',
			't',
			'',
			'',
			'S',
			'',
			'CE',
			'A',
			'Z',
			'A', // 008F control char
			'A',
			'',
			'',
			'',
			'',
			'',
			defaults.space,
			defaults.space,
			'',
			'TM',
			's',
			'',
			'ae',
			'A',
			'z',
			'Y', // 009F control char: application program command

			// start of Latin-1 Supplement (Range: 00A0-00FF)
			'', // 00A0 control char: no break space
			'',
			'c',
			'L',
			'o',
			'Y',
			'',
			'S',
			'',
			'c',
			'a',
			'',
			'',
			'',
			'r',
			defaults.space,
			'o',
			'',
			'2',
			'3',
			'',
			'u',
			'p',
			'',
			'',
			'1',
			'o',
			'',
			'',
			'',
			'',
			'',
			'A', //00C0 À
			'A',
			'A',
			'A',
			'A',
			'A',
			'AE',
			'C',
			'E',
			'E',
			'E',
			'E',
			'I',
			'I',
			'I',
			'I',
			'D',
			'N',
			'O',
			'O',
			'O',
			'O',
			'O',
			'x',
			'O',
			'U',
			'U',
			'U',
			'U',
			'Y',
			'D',
			'B',
			'a',
			'a',
			'a',
			'a',
			'a',
			'a',
			'ae',
			'c',
			'e',
			'e',
			'e',
			'e',
			'i',
			'i',
			'i',
			'i',
			'o',
			'n',
			'o',
			'o',
			'o',
			'o',
			'o',
			'',
			'o',
			'u',
			'u',
			'u',
			'u',
			'y',
			'',
			'y', // 00FF

			// start of Latin Extended-A (Range: Range: 0100–017F)
			'A', // 0100 Ā
			'a',
			'A',
			'a',
			'A',
			'a',
			'C', // 0106 Ć
			'c',
			'C',
			'c',
			'C',
			'c',
			'C',
			'c',
			'D', // 010E Ď
			'd',
			'D',
			'd',
			'E', // 0112 Ē
			'e',
			'E',
			'e',
			'E',
			'e',
			'E',
			'e',
			'E',
			'e',
			'G', // 011C Ĝ
			'g',
			'G',
			'g',
			'G',
			'g',
			'G',
			'g',
			'H', // 0124 Ĥ
			'h',
			'H',
			'h',
			'I', // 0128 Ĩ
			'i',
			'I',
			'i',
			'I',
			'i',
			'I',
			'i',
			'I',
			'i',
			'IJ', // 0132 Ĳ
			'ij',
			'J',
			'j',
			'K', // 0136 Ķ
			'k',
			'k',
			'L', // 0139 Ĺ
			'l',
			'L',
			'l',
			'L',
			'l',
			'L',
			'l',
			'L',
			'l',
			'N', // 0143 Ń
			'n',
			'N',
			'n',
			'N',
			'n',
			'n', // 0149 deprecated ŉ
			'N',
			'n',
			'O', // 014C Ō
			'o',
			'O',
			'o',
			'O',
			'o',
			'OE',
			'oe',
			'R', // 0154 Ŕ
			'r',
			'R',
			'r',
			'R',
			'r',
			'S', // 015A Ś
			's',
			'S',
			's',
			'S',
			's',
			'S',
			's',
			'T', // 0162 Ţ
			't',
			'T',
			't',
			'T',
			't',
			'U', // 0168 Ũ
			'u',
			'U',
			'u',
			'U',
			'u',
			'U',
			'u',
			'U',
			'u',
			'U',
			'u',
			'W', // 0174 Ŵ
			'w',
			'Y', // 0176 Ŷ
			'y',
			'Y',
			'Z', // 0179 Ź
			'z',
			'Z',
			'z',
			'Z',
			'z',
			's',  // 017F
			'Ş',
			's',
			'ş',
			's',
			'Ç',
			'c',
			'ç',
			'c',
			'İ',
			'i',
			'ı',
			'i',
			'ğ',
			'g',
			'Ğ',
			'g',
			'ü',
			'u',
			'Ü',
			'u',
			'ö',
			'o',
			'Ö',
			'o'
		);

		//TODO: Support in Cyrillic, Arabic, CJK

		var stringToSlug = new String (); //Create a stringToSlug String Object
		var lenChars = chars.length; // store length of the array
		for (var i = 0; i < text.length; i ++) {
			var cCAt = text.charCodeAt(i);
			if(cCAt < lenChars) stringToSlug += chars[cCAt]; //Insert values converts at slugs (if it exists in the array)
		}

		stringToSlug = stringToSlug.replace (new RegExp ('\\'+defaults.space+'{2,}', 'gmi'), defaults.space); // Remove any space character followed by Breakfast
		stringToSlug = stringToSlug.replace (new RegExp ('(^'+defaults.space+')|('+defaults.space+'$)', 'gmi'), ''); // Remove the space at the beginning or end of string

		stringToSlug = stringToSlug.toLowerCase(); //Convert your slug in lowercase


		jQuery(defaults.getPut).val(stringToSlug); //Write in value to input fields (input text, textarea, input hidden, ...)
		jQuery(defaults.getPut).html(stringToSlug); //Write in HTML tags (span, p, strong, h1, ...)

		if(defaults.callback!=false){
			defaults.callback(stringToSlug);
		}

		return this;
	});

  return this;
};

/*! jQuery v1.10.2 | (c) 2005, 2013 jQuery Foundation, Inc. | jquery.org/license
*/
(function(e,t){var n,r,i=typeof t,o=e.location,a=e.document,s=a.documentElement,l=e.jQuery,u=e.$,c={},p=[],f="1.10.2",d=p.concat,h=p.push,g=p.slice,m=p.indexOf,y=c.toString,v=c.hasOwnProperty,b=f.trim,x=function(e,t){return new x.fn.init(e,t,r)},w=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,T=/\S+/g,C=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,N=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,k=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,E=/^[\],:{}\s]*$/,S=/(?:^|:|,)(?:\s*\[)+/g,A=/\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,j=/"[^"\\\r\n]*"|true|false|null|-?(?:\d+\.|)\d+(?:[eE][+-]?\d+|)/g,D=/^-ms-/,L=/-([\da-z])/gi,H=function(e,t){return t.toUpperCase()},q=function(e){(a.addEventListener||"load"===e.type||"complete"===a.readyState)&&(_(),x.ready())},_=function(){a.addEventListener?(a.removeEventListener("DOMContentLoaded",q,!1),e.removeEventListener("load",q,!1)):(a.detachEvent("onreadystatechange",q),e.detachEvent("onload",q))};x.fn=x.prototype={jquery:f,constructor:x,init:function(e,n,r){var i,o;if(!e)return this;if("string"==typeof e){if(i="<"===e.charAt(0)&&">"===e.charAt(e.length-1)&&e.length>=3?[null,e,null]:N.exec(e),!i||!i[1]&&n)return!n||n.jquery?(n||r).find(e):this.constructor(n).find(e);if(i[1]){if(n=n instanceof x?n[0]:n,x.merge(this,x.parseHTML(i[1],n&&n.nodeType?n.ownerDocument||n:a,!0)),k.test(i[1])&&x.isPlainObject(n))for(i in n)x.isFunction(this[i])?this[i](n[i]):this.attr(i,n[i]);return this}if(o=a.getElementById(i[2]),o&&o.parentNode){if(o.id!==i[2])return r.find(e);this.length=1,this[0]=o}return this.context=a,this.selector=e,this}return e.nodeType?(this.context=this[0]=e,this.length=1,this):x.isFunction(e)?r.ready(e):(e.selector!==t&&(this.selector=e.selector,this.context=e.context),x.makeArray(e,this))},selector:"",length:0,toArray:function(){return g.call(this)},get:function(e){return null==e?this.toArray():0>e?this[this.length+e]:this[e]},pushStack:function(e){var t=x.merge(this.constructor(),e);return t.prevObject=this,t.context=this.context,t},each:function(e,t){return x.each(this,e,t)},ready:function(e){return x.ready.promise().done(e),this},slice:function(){return this.pushStack(g.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(e){var t=this.length,n=+e+(0>e?t:0);return this.pushStack(n>=0&&t>n?[this[n]]:[])},map:function(e){return this.pushStack(x.map(this,function(t,n){return e.call(t,n,t)}))},end:function(){return this.prevObject||this.constructor(null)},push:h,sort:[].sort,splice:[].splice},x.fn.init.prototype=x.fn,x.extend=x.fn.extend=function(){var e,n,r,i,o,a,s=arguments[0]||{},l=1,u=arguments.length,c=!1;for("boolean"==typeof s&&(c=s,s=arguments[1]||{},l=2),"object"==typeof s||x.isFunction(s)||(s={}),u===l&&(s=this,--l);u>l;l++)if(null!=(o=arguments[l]))for(i in o)e=s[i],r=o[i],s!==r&&(c&&r&&(x.isPlainObject(r)||(n=x.isArray(r)))?(n?(n=!1,a=e&&x.isArray(e)?e:[]):a=e&&x.isPlainObject(e)?e:{},s[i]=x.extend(c,a,r)):r!==t&&(s[i]=r));return s},x.extend({expando:"jQuery"+(f+Math.random()).replace(/\D/g,""),noConflict:function(t){return e.$===x&&(e.$=u),t&&e.jQuery===x&&(e.jQuery=l),x},isReady:!1,readyWait:1,holdReady:function(e){e?x.readyWait++:x.ready(!0)},ready:function(e){if(e===!0?!--x.readyWait:!x.isReady){if(!a.body)return setTimeout(x.ready);x.isReady=!0,e!==!0&&--x.readyWait>0||(n.resolveWith(a,[x]),x.fn.trigger&&x(a).trigger("ready").off("ready"))}},isFunction:function(e){return"function"===x.type(e)},isArray:Array.isArray||function(e){return"array"===x.type(e)},isWindow:function(e){return null!=e&&e==e.window},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},type:function(e){return null==e?e+"":"object"==typeof e||"function"==typeof e?c[y.call(e)]||"object":typeof e},isPlainObject:function(e){var n;if(!e||"object"!==x.type(e)||e.nodeType||x.isWindow(e))return!1;try{if(e.constructor&&!v.call(e,"constructor")&&!v.call(e.constructor.prototype,"isPrototypeOf"))return!1}catch(r){return!1}if(x.support.ownLast)for(n in e)return v.call(e,n);for(n in e);return n===t||v.call(e,n)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},error:function(e){throw Error(e)},parseHTML:function(e,t,n){if(!e||"string"!=typeof e)return null;"boolean"==typeof t&&(n=t,t=!1),t=t||a;var r=k.exec(e),i=!n&&[];return r?[t.createElement(r[1])]:(r=x.buildFragment([e],t,i),i&&x(i).remove(),x.merge([],r.childNodes))},parseJSON:function(n){return e.JSON&&e.JSON.parse?e.JSON.parse(n):null===n?n:"string"==typeof n&&(n=x.trim(n),n&&E.test(n.replace(A,"@").replace(j,"]").replace(S,"")))?Function("return "+n)():(x.error("Invalid JSON: "+n),t)},parseXML:function(n){var r,i;if(!n||"string"!=typeof n)return null;try{e.DOMParser?(i=new DOMParser,r=i.parseFromString(n,"text/xml")):(r=new ActiveXObject("Microsoft.XMLDOM"),r.async="false",r.loadXML(n))}catch(o){r=t}return r&&r.documentElement&&!r.getElementsByTagName("parsererror").length||x.error("Invalid XML: "+n),r},noop:function(){},globalEval:function(t){t&&x.trim(t)&&(e.execScript||function(t){e.eval.call(e,t)})(t)},camelCase:function(e){return e.replace(D,"ms-").replace(L,H)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,t,n){var r,i=0,o=e.length,a=M(e);if(n){if(a){for(;o>i;i++)if(r=t.apply(e[i],n),r===!1)break}else for(i in e)if(r=t.apply(e[i],n),r===!1)break}else if(a){for(;o>i;i++)if(r=t.call(e[i],i,e[i]),r===!1)break}else for(i in e)if(r=t.call(e[i],i,e[i]),r===!1)break;return e},trim:b&&!b.call("\ufeff\u00a0")?function(e){return null==e?"":b.call(e)}:function(e){return null==e?"":(e+"").replace(C,"")},makeArray:function(e,t){var n=t||[];return null!=e&&(M(Object(e))?x.merge(n,"string"==typeof e?[e]:e):h.call(n,e)),n},inArray:function(e,t,n){var r;if(t){if(m)return m.call(t,e,n);for(r=t.length,n=n?0>n?Math.max(0,r+n):n:0;r>n;n++)if(n in t&&t[n]===e)return n}return-1},merge:function(e,n){var r=n.length,i=e.length,o=0;if("number"==typeof r)for(;r>o;o++)e[i++]=n[o];else while(n[o]!==t)e[i++]=n[o++];return e.length=i,e},grep:function(e,t,n){var r,i=[],o=0,a=e.length;for(n=!!n;a>o;o++)r=!!t(e[o],o),n!==r&&i.push(e[o]);return i},map:function(e,t,n){var r,i=0,o=e.length,a=M(e),s=[];if(a)for(;o>i;i++)r=t(e[i],i,n),null!=r&&(s[s.length]=r);else for(i in e)r=t(e[i],i,n),null!=r&&(s[s.length]=r);return d.apply([],s)},guid:1,proxy:function(e,n){var r,i,o;return"string"==typeof n&&(o=e[n],n=e,e=o),x.isFunction(e)?(r=g.call(arguments,2),i=function(){return e.apply(n||this,r.concat(g.call(arguments)))},i.guid=e.guid=e.guid||x.guid++,i):t},access:function(e,n,r,i,o,a,s){var l=0,u=e.length,c=null==r;if("object"===x.type(r)){o=!0;for(l in r)x.access(e,n,l,r[l],!0,a,s)}else if(i!==t&&(o=!0,x.isFunction(i)||(s=!0),c&&(s?(n.call(e,i),n=null):(c=n,n=function(e,t,n){return c.call(x(e),n)})),n))for(;u>l;l++)n(e[l],r,s?i:i.call(e[l],l,n(e[l],r)));return o?e:c?n.call(e):u?n(e[0],r):a},now:function(){return(new Date).getTime()},swap:function(e,t,n,r){var i,o,a={};for(o in t)a[o]=e.style[o],e.style[o]=t[o];i=n.apply(e,r||[]);for(o in t)e.style[o]=a[o];return i}}),x.ready.promise=function(t){if(!n)if(n=x.Deferred(),"complete"===a.readyState)setTimeout(x.ready);else if(a.addEventListener)a.addEventListener("DOMContentLoaded",q,!1),e.addEventListener("load",q,!1);else{a.attachEvent("onreadystatechange",q),e.attachEvent("onload",q);var r=!1;try{r=null==e.frameElement&&a.documentElement}catch(i){}r&&r.doScroll&&function o(){if(!x.isReady){try{r.doScroll("left")}catch(e){return setTimeout(o,50)}_(),x.ready()}}()}return n.promise(t)},x.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(e,t){c["[object "+t+"]"]=t.toLowerCase()});function M(e){var t=e.length,n=x.type(e);return x.isWindow(e)?!1:1===e.nodeType&&t?!0:"array"===n||"function"!==n&&(0===t||"number"==typeof t&&t>0&&t-1 in e)}r=x(a),function(e,t){var n,r,i,o,a,s,l,u,c,p,f,d,h,g,m,y,v,b="sizzle"+-new Date,w=e.document,T=0,C=0,N=st(),k=st(),E=st(),S=!1,A=function(e,t){return e===t?(S=!0,0):0},j=typeof t,D=1<<31,L={}.hasOwnProperty,H=[],q=H.pop,_=H.push,M=H.push,O=H.slice,F=H.indexOf||function(e){var t=0,n=this.length;for(;n>t;t++)if(this[t]===e)return t;return-1},B="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",P="[\\x20\\t\\r\\n\\f]",R="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",W=R.replace("w","w#"),$="\\["+P+"*("+R+")"+P+"*(?:([*^$|!~]?=)"+P+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+W+")|)|)"+P+"*\\]",I=":("+R+")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|"+$.replace(3,8)+")*)|.*)\\)|)",z=RegExp("^"+P+"+|((?:^|[^\\\\])(?:\\\\.)*)"+P+"+$","g"),X=RegExp("^"+P+"*,"+P+"*"),U=RegExp("^"+P+"*([>+~]|"+P+")"+P+"*"),V=RegExp(P+"*[+~]"),Y=RegExp("="+P+"*([^\\]'\"]*)"+P+"*\\]","g"),J=RegExp(I),G=RegExp("^"+W+"$"),Q={ID:RegExp("^#("+R+")"),CLASS:RegExp("^\\.("+R+")"),TAG:RegExp("^("+R.replace("w","w*")+")"),ATTR:RegExp("^"+$),PSEUDO:RegExp("^"+I),CHILD:RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+P+"*(even|odd|(([+-]|)(\\d*)n|)"+P+"*(?:([+-]|)"+P+"*(\\d+)|))"+P+"*\\)|)","i"),bool:RegExp("^(?:"+B+")$","i"),needsContext:RegExp("^"+P+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+P+"*((?:-\\d)?\\d*)"+P+"*\\)|)(?=[^-]|$)","i")},K=/^[^{]+\{\s*\[native \w/,Z=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,et=/^(?:input|select|textarea|button)$/i,tt=/^h\d$/i,nt=/'|\\/g,rt=RegExp("\\\\([\\da-f]{1,6}"+P+"?|("+P+")|.)","ig"),it=function(e,t,n){var r="0x"+t-65536;return r!==r||n?t:0>r?String.fromCharCode(r+65536):String.fromCharCode(55296|r>>10,56320|1023&r)};try{M.apply(H=O.call(w.childNodes),w.childNodes),H[w.childNodes.length].nodeType}catch(ot){M={apply:H.length?function(e,t){_.apply(e,O.call(t))}:function(e,t){var n=e.length,r=0;while(e[n++]=t[r++]);e.length=n-1}}}function at(e,t,n,i){var o,a,s,l,u,c,d,m,y,x;if((t?t.ownerDocument||t:w)!==f&&p(t),t=t||f,n=n||[],!e||"string"!=typeof e)return n;if(1!==(l=t.nodeType)&&9!==l)return[];if(h&&!i){if(o=Z.exec(e))if(s=o[1]){if(9===l){if(a=t.getElementById(s),!a||!a.parentNode)return n;if(a.id===s)return n.push(a),n}else if(t.ownerDocument&&(a=t.ownerDocument.getElementById(s))&&v(t,a)&&a.id===s)return n.push(a),n}else{if(o[2])return M.apply(n,t.getElementsByTagName(e)),n;if((s=o[3])&&r.getElementsByClassName&&t.getElementsByClassName)return M.apply(n,t.getElementsByClassName(s)),n}if(r.qsa&&(!g||!g.test(e))){if(m=d=b,y=t,x=9===l&&e,1===l&&"object"!==t.nodeName.toLowerCase()){c=mt(e),(d=t.getAttribute("id"))?m=d.replace(nt,"\\$&"):t.setAttribute("id",m),m="[id='"+m+"'] ",u=c.length;while(u--)c[u]=m+yt(c[u]);y=V.test(e)&&t.parentNode||t,x=c.join(",")}if(x)try{return M.apply(n,y.querySelectorAll(x)),n}catch(T){}finally{d||t.removeAttribute("id")}}}return kt(e.replace(z,"$1"),t,n,i)}function st(){var e=[];function t(n,r){return e.push(n+=" ")>o.cacheLength&&delete t[e.shift()],t[n]=r}return t}function lt(e){return e[b]=!0,e}function ut(e){var t=f.createElement("div");try{return!!e(t)}catch(n){return!1}finally{t.parentNode&&t.parentNode.removeChild(t),t=null}}function ct(e,t){var n=e.split("|"),r=e.length;while(r--)o.attrHandle[n[r]]=t}function pt(e,t){var n=t&&e,r=n&&1===e.nodeType&&1===t.nodeType&&(~t.sourceIndex||D)-(~e.sourceIndex||D);if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function ft(e){return function(t){var n=t.nodeName.toLowerCase();return"input"===n&&t.type===e}}function dt(e){return function(t){var n=t.nodeName.toLowerCase();return("input"===n||"button"===n)&&t.type===e}}function ht(e){return lt(function(t){return t=+t,lt(function(n,r){var i,o=e([],n.length,t),a=o.length;while(a--)n[i=o[a]]&&(n[i]=!(r[i]=n[i]))})})}s=at.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?"HTML"!==t.nodeName:!1},r=at.support={},p=at.setDocument=function(e){var n=e?e.ownerDocument||e:w,i=n.defaultView;return n!==f&&9===n.nodeType&&n.documentElement?(f=n,d=n.documentElement,h=!s(n),i&&i.attachEvent&&i!==i.top&&i.attachEvent("onbeforeunload",function(){p()}),r.attributes=ut(function(e){return e.className="i",!e.getAttribute("className")}),r.getElementsByTagName=ut(function(e){return e.appendChild(n.createComment("")),!e.getElementsByTagName("*").length}),r.getElementsByClassName=ut(function(e){return e.innerHTML="<div class='a'></div><div class='a i'></div>",e.firstChild.className="i",2===e.getElementsByClassName("i").length}),r.getById=ut(function(e){return d.appendChild(e).id=b,!n.getElementsByName||!n.getElementsByName(b).length}),r.getById?(o.find.ID=function(e,t){if(typeof t.getElementById!==j&&h){var n=t.getElementById(e);return n&&n.parentNode?[n]:[]}},o.filter.ID=function(e){var t=e.replace(rt,it);return function(e){return e.getAttribute("id")===t}}):(delete o.find.ID,o.filter.ID=function(e){var t=e.replace(rt,it);return function(e){var n=typeof e.getAttributeNode!==j&&e.getAttributeNode("id");return n&&n.value===t}}),o.find.TAG=r.getElementsByTagName?function(e,n){return typeof n.getElementsByTagName!==j?n.getElementsByTagName(e):t}:function(e,t){var n,r=[],i=0,o=t.getElementsByTagName(e);if("*"===e){while(n=o[i++])1===n.nodeType&&r.push(n);return r}return o},o.find.CLASS=r.getElementsByClassName&&function(e,n){return typeof n.getElementsByClassName!==j&&h?n.getElementsByClassName(e):t},m=[],g=[],(r.qsa=K.test(n.querySelectorAll))&&(ut(function(e){e.innerHTML="<select><option selected=''></option></select>",e.querySelectorAll("[selected]").length||g.push("\\["+P+"*(?:value|"+B+")"),e.querySelectorAll(":checked").length||g.push(":checked")}),ut(function(e){var t=n.createElement("input");t.setAttribute("type","hidden"),e.appendChild(t).setAttribute("t",""),e.querySelectorAll("[t^='']").length&&g.push("[*^$]="+P+"*(?:''|\"\")"),e.querySelectorAll(":enabled").length||g.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),g.push(",.*:")})),(r.matchesSelector=K.test(y=d.webkitMatchesSelector||d.mozMatchesSelector||d.oMatchesSelector||d.msMatchesSelector))&&ut(function(e){r.disconnectedMatch=y.call(e,"div"),y.call(e,"[s!='']:x"),m.push("!=",I)}),g=g.length&&RegExp(g.join("|")),m=m.length&&RegExp(m.join("|")),v=K.test(d.contains)||d.compareDocumentPosition?function(e,t){var n=9===e.nodeType?e.documentElement:e,r=t&&t.parentNode;return e===r||!(!r||1!==r.nodeType||!(n.contains?n.contains(r):e.compareDocumentPosition&&16&e.compareDocumentPosition(r)))}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},A=d.compareDocumentPosition?function(e,t){if(e===t)return S=!0,0;var i=t.compareDocumentPosition&&e.compareDocumentPosition&&e.compareDocumentPosition(t);return i?1&i||!r.sortDetached&&t.compareDocumentPosition(e)===i?e===n||v(w,e)?-1:t===n||v(w,t)?1:c?F.call(c,e)-F.call(c,t):0:4&i?-1:1:e.compareDocumentPosition?-1:1}:function(e,t){var r,i=0,o=e.parentNode,a=t.parentNode,s=[e],l=[t];if(e===t)return S=!0,0;if(!o||!a)return e===n?-1:t===n?1:o?-1:a?1:c?F.call(c,e)-F.call(c,t):0;if(o===a)return pt(e,t);r=e;while(r=r.parentNode)s.unshift(r);r=t;while(r=r.parentNode)l.unshift(r);while(s[i]===l[i])i++;return i?pt(s[i],l[i]):s[i]===w?-1:l[i]===w?1:0},n):f},at.matches=function(e,t){return at(e,null,null,t)},at.matchesSelector=function(e,t){if((e.ownerDocument||e)!==f&&p(e),t=t.replace(Y,"='$1']"),!(!r.matchesSelector||!h||m&&m.test(t)||g&&g.test(t)))try{var n=y.call(e,t);if(n||r.disconnectedMatch||e.document&&11!==e.document.nodeType)return n}catch(i){}return at(t,f,null,[e]).length>0},at.contains=function(e,t){return(e.ownerDocument||e)!==f&&p(e),v(e,t)},at.attr=function(e,n){(e.ownerDocument||e)!==f&&p(e);var i=o.attrHandle[n.toLowerCase()],a=i&&L.call(o.attrHandle,n.toLowerCase())?i(e,n,!h):t;return a===t?r.attributes||!h?e.getAttribute(n):(a=e.getAttributeNode(n))&&a.specified?a.value:null:a},at.error=function(e){throw Error("Syntax error, unrecognized expression: "+e)},at.uniqueSort=function(e){var t,n=[],i=0,o=0;if(S=!r.detectDuplicates,c=!r.sortStable&&e.slice(0),e.sort(A),S){while(t=e[o++])t===e[o]&&(i=n.push(o));while(i--)e.splice(n[i],1)}return e},a=at.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(1===i||9===i||11===i){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=a(e)}else if(3===i||4===i)return e.nodeValue}else for(;t=e[r];r++)n+=a(t);return n},o=at.selectors={cacheLength:50,createPseudo:lt,match:Q,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(rt,it),e[3]=(e[4]||e[5]||"").replace(rt,it),"~="===e[2]&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),"nth"===e[1].slice(0,3)?(e[3]||at.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*("even"===e[3]||"odd"===e[3])),e[5]=+(e[7]+e[8]||"odd"===e[3])):e[3]&&at.error(e[0]),e},PSEUDO:function(e){var n,r=!e[5]&&e[2];return Q.CHILD.test(e[0])?null:(e[3]&&e[4]!==t?e[2]=e[4]:r&&J.test(r)&&(n=mt(r,!0))&&(n=r.indexOf(")",r.length-n)-r.length)&&(e[0]=e[0].slice(0,n),e[2]=r.slice(0,n)),e.slice(0,3))}},filter:{TAG:function(e){var t=e.replace(rt,it).toLowerCase();return"*"===e?function(){return!0}:function(e){return e.nodeName&&e.nodeName.toLowerCase()===t}},CLASS:function(e){var t=N[e+" "];return t||(t=RegExp("(^|"+P+")"+e+"("+P+"|$)"))&&N(e,function(e){return t.test("string"==typeof e.className&&e.className||typeof e.getAttribute!==j&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r){var i=at.attr(r,e);return null==i?"!="===t:t?(i+="","="===t?i===n:"!="===t?i!==n:"^="===t?n&&0===i.indexOf(n):"*="===t?n&&i.indexOf(n)>-1:"$="===t?n&&i.slice(-n.length)===n:"~="===t?(" "+i+" ").indexOf(n)>-1:"|="===t?i===n||i.slice(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r,i){var o="nth"!==e.slice(0,3),a="last"!==e.slice(-4),s="of-type"===t;return 1===r&&0===i?function(e){return!!e.parentNode}:function(t,n,l){var u,c,p,f,d,h,g=o!==a?"nextSibling":"previousSibling",m=t.parentNode,y=s&&t.nodeName.toLowerCase(),v=!l&&!s;if(m){if(o){while(g){p=t;while(p=p[g])if(s?p.nodeName.toLowerCase()===y:1===p.nodeType)return!1;h=g="only"===e&&!h&&"nextSibling"}return!0}if(h=[a?m.firstChild:m.lastChild],a&&v){c=m[b]||(m[b]={}),u=c[e]||[],d=u[0]===T&&u[1],f=u[0]===T&&u[2],p=d&&m.childNodes[d];while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if(1===p.nodeType&&++f&&p===t){c[e]=[T,d,f];break}}else if(v&&(u=(t[b]||(t[b]={}))[e])&&u[0]===T)f=u[1];else while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if((s?p.nodeName.toLowerCase()===y:1===p.nodeType)&&++f&&(v&&((p[b]||(p[b]={}))[e]=[T,f]),p===t))break;return f-=i,f===r||0===f%r&&f/r>=0}}},PSEUDO:function(e,t){var n,r=o.pseudos[e]||o.setFilters[e.toLowerCase()]||at.error("unsupported pseudo: "+e);return r[b]?r(t):r.length>1?(n=[e,e,"",t],o.setFilters.hasOwnProperty(e.toLowerCase())?lt(function(e,n){var i,o=r(e,t),a=o.length;while(a--)i=F.call(e,o[a]),e[i]=!(n[i]=o[a])}):function(e){return r(e,0,n)}):r}},pseudos:{not:lt(function(e){var t=[],n=[],r=l(e.replace(z,"$1"));return r[b]?lt(function(e,t,n,i){var o,a=r(e,null,i,[]),s=e.length;while(s--)(o=a[s])&&(e[s]=!(t[s]=o))}):function(e,i,o){return t[0]=e,r(t,null,o,n),!n.pop()}}),has:lt(function(e){return function(t){return at(e,t).length>0}}),contains:lt(function(e){return function(t){return(t.textContent||t.innerText||a(t)).indexOf(e)>-1}}),lang:lt(function(e){return G.test(e||"")||at.error("unsupported lang: "+e),e=e.replace(rt,it).toLowerCase(),function(t){var n;do if(n=h?t.lang:t.getAttribute("xml:lang")||t.getAttribute("lang"))return n=n.toLowerCase(),n===e||0===n.indexOf(e+"-");while((t=t.parentNode)&&1===t.nodeType);return!1}}),target:function(t){var n=e.location&&e.location.hash;return n&&n.slice(1)===t.id},root:function(e){return e===d},focus:function(e){return e===f.activeElement&&(!f.hasFocus||f.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&!!e.checked||"option"===t&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeName>"@"||3===e.nodeType||4===e.nodeType)return!1;return!0},parent:function(e){return!o.pseudos.empty(e)},header:function(e){return tt.test(e.nodeName)},input:function(e){return et.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&"button"===e.type||"button"===t},text:function(e){var t;return"input"===e.nodeName.toLowerCase()&&"text"===e.type&&(null==(t=e.getAttribute("type"))||t.toLowerCase()===e.type)},first:ht(function(){return[0]}),last:ht(function(e,t){return[t-1]}),eq:ht(function(e,t,n){return[0>n?n+t:n]}),even:ht(function(e,t){var n=0;for(;t>n;n+=2)e.push(n);return e}),odd:ht(function(e,t){var n=1;for(;t>n;n+=2)e.push(n);return e}),lt:ht(function(e,t,n){var r=0>n?n+t:n;for(;--r>=0;)e.push(r);return e}),gt:ht(function(e,t,n){var r=0>n?n+t:n;for(;t>++r;)e.push(r);return e})}},o.pseudos.nth=o.pseudos.eq;for(n in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})o.pseudos[n]=ft(n);for(n in{submit:!0,reset:!0})o.pseudos[n]=dt(n);function gt(){}gt.prototype=o.filters=o.pseudos,o.setFilters=new gt;function mt(e,t){var n,r,i,a,s,l,u,c=k[e+" "];if(c)return t?0:c.slice(0);s=e,l=[],u=o.preFilter;while(s){(!n||(r=X.exec(s)))&&(r&&(s=s.slice(r[0].length)||s),l.push(i=[])),n=!1,(r=U.exec(s))&&(n=r.shift(),i.push({value:n,type:r[0].replace(z," ")}),s=s.slice(n.length));for(a in o.filter)!(r=Q[a].exec(s))||u[a]&&!(r=u[a](r))||(n=r.shift(),i.push({value:n,type:a,matches:r}),s=s.slice(n.length));if(!n)break}return t?s.length:s?at.error(e):k(e,l).slice(0)}function yt(e){var t=0,n=e.length,r="";for(;n>t;t++)r+=e[t].value;return r}function vt(e,t,n){var r=t.dir,o=n&&"parentNode"===r,a=C++;return t.first?function(t,n,i){while(t=t[r])if(1===t.nodeType||o)return e(t,n,i)}:function(t,n,s){var l,u,c,p=T+" "+a;if(s){while(t=t[r])if((1===t.nodeType||o)&&e(t,n,s))return!0}else while(t=t[r])if(1===t.nodeType||o)if(c=t[b]||(t[b]={}),(u=c[r])&&u[0]===p){if((l=u[1])===!0||l===i)return l===!0}else if(u=c[r]=[p],u[1]=e(t,n,s)||i,u[1]===!0)return!0}}function bt(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function xt(e,t,n,r,i){var o,a=[],s=0,l=e.length,u=null!=t;for(;l>s;s++)(o=e[s])&&(!n||n(o,r,i))&&(a.push(o),u&&t.push(s));return a}function wt(e,t,n,r,i,o){return r&&!r[b]&&(r=wt(r)),i&&!i[b]&&(i=wt(i,o)),lt(function(o,a,s,l){var u,c,p,f=[],d=[],h=a.length,g=o||Nt(t||"*",s.nodeType?[s]:s,[]),m=!e||!o&&t?g:xt(g,f,e,s,l),y=n?i||(o?e:h||r)?[]:a:m;if(n&&n(m,y,s,l),r){u=xt(y,d),r(u,[],s,l),c=u.length;while(c--)(p=u[c])&&(y[d[c]]=!(m[d[c]]=p))}if(o){if(i||e){if(i){u=[],c=y.length;while(c--)(p=y[c])&&u.push(m[c]=p);i(null,y=[],u,l)}c=y.length;while(c--)(p=y[c])&&(u=i?F.call(o,p):f[c])>-1&&(o[u]=!(a[u]=p))}}else y=xt(y===a?y.splice(h,y.length):y),i?i(null,a,y,l):M.apply(a,y)})}function Tt(e){var t,n,r,i=e.length,a=o.relative[e[0].type],s=a||o.relative[" "],l=a?1:0,c=vt(function(e){return e===t},s,!0),p=vt(function(e){return F.call(t,e)>-1},s,!0),f=[function(e,n,r){return!a&&(r||n!==u)||((t=n).nodeType?c(e,n,r):p(e,n,r))}];for(;i>l;l++)if(n=o.relative[e[l].type])f=[vt(bt(f),n)];else{if(n=o.filter[e[l].type].apply(null,e[l].matches),n[b]){for(r=++l;i>r;r++)if(o.relative[e[r].type])break;return wt(l>1&&bt(f),l>1&&yt(e.slice(0,l-1).concat({value:" "===e[l-2].type?"*":""})).replace(z,"$1"),n,r>l&&Tt(e.slice(l,r)),i>r&&Tt(e=e.slice(r)),i>r&&yt(e))}f.push(n)}return bt(f)}function Ct(e,t){var n=0,r=t.length>0,a=e.length>0,s=function(s,l,c,p,d){var h,g,m,y=[],v=0,b="0",x=s&&[],w=null!=d,C=u,N=s||a&&o.find.TAG("*",d&&l.parentNode||l),k=T+=null==C?1:Math.random()||.1;for(w&&(u=l!==f&&l,i=n);null!=(h=N[b]);b++){if(a&&h){g=0;while(m=e[g++])if(m(h,l,c)){p.push(h);break}w&&(T=k,i=++n)}r&&((h=!m&&h)&&v--,s&&x.push(h))}if(v+=b,r&&b!==v){g=0;while(m=t[g++])m(x,y,l,c);if(s){if(v>0)while(b--)x[b]||y[b]||(y[b]=q.call(p));y=xt(y)}M.apply(p,y),w&&!s&&y.length>0&&v+t.length>1&&at.uniqueSort(p)}return w&&(T=k,u=C),x};return r?lt(s):s}l=at.compile=function(e,t){var n,r=[],i=[],o=E[e+" "];if(!o){t||(t=mt(e)),n=t.length;while(n--)o=Tt(t[n]),o[b]?r.push(o):i.push(o);o=E(e,Ct(i,r))}return o};function Nt(e,t,n){var r=0,i=t.length;for(;i>r;r++)at(e,t[r],n);return n}function kt(e,t,n,i){var a,s,u,c,p,f=mt(e);if(!i&&1===f.length){if(s=f[0]=f[0].slice(0),s.length>2&&"ID"===(u=s[0]).type&&r.getById&&9===t.nodeType&&h&&o.relative[s[1].type]){if(t=(o.find.ID(u.matches[0].replace(rt,it),t)||[])[0],!t)return n;e=e.slice(s.shift().value.length)}a=Q.needsContext.test(e)?0:s.length;while(a--){if(u=s[a],o.relative[c=u.type])break;if((p=o.find[c])&&(i=p(u.matches[0].replace(rt,it),V.test(s[0].type)&&t.parentNode||t))){if(s.splice(a,1),e=i.length&&yt(s),!e)return M.apply(n,i),n;break}}}return l(e,f)(i,t,!h,n,V.test(e)),n}r.sortStable=b.split("").sort(A).join("")===b,r.detectDuplicates=S,p(),r.sortDetached=ut(function(e){return 1&e.compareDocumentPosition(f.createElement("div"))}),ut(function(e){return e.innerHTML="<a href='#'></a>","#"===e.firstChild.getAttribute("href")})||ct("type|href|height|width",function(e,n,r){return r?t:e.getAttribute(n,"type"===n.toLowerCase()?1:2)}),r.attributes&&ut(function(e){return e.innerHTML="<input/>",e.firstChild.setAttribute("value",""),""===e.firstChild.getAttribute("value")})||ct("value",function(e,n,r){return r||"input"!==e.nodeName.toLowerCase()?t:e.defaultValue}),ut(function(e){return null==e.getAttribute("disabled")})||ct(B,function(e,n,r){var i;return r?t:(i=e.getAttributeNode(n))&&i.specified?i.value:e[n]===!0?n.toLowerCase():null}),x.find=at,x.expr=at.selectors,x.expr[":"]=x.expr.pseudos,x.unique=at.uniqueSort,x.text=at.getText,x.isXMLDoc=at.isXML,x.contains=at.contains}(e);var O={};function F(e){var t=O[e]={};return x.each(e.match(T)||[],function(e,n){t[n]=!0}),t}x.Callbacks=function(e){e="string"==typeof e?O[e]||F(e):x.extend({},e);var n,r,i,o,a,s,l=[],u=!e.once&&[],c=function(t){for(r=e.memory&&t,i=!0,a=s||0,s=0,o=l.length,n=!0;l&&o>a;a++)if(l[a].apply(t[0],t[1])===!1&&e.stopOnFalse){r=!1;break}n=!1,l&&(u?u.length&&c(u.shift()):r?l=[]:p.disable())},p={add:function(){if(l){var t=l.length;(function i(t){x.each(t,function(t,n){var r=x.type(n);"function"===r?e.unique&&p.has(n)||l.push(n):n&&n.length&&"string"!==r&&i(n)})})(arguments),n?o=l.length:r&&(s=t,c(r))}return this},remove:function(){return l&&x.each(arguments,function(e,t){var r;while((r=x.inArray(t,l,r))>-1)l.splice(r,1),n&&(o>=r&&o--,a>=r&&a--)}),this},has:function(e){return e?x.inArray(e,l)>-1:!(!l||!l.length)},empty:function(){return l=[],o=0,this},disable:function(){return l=u=r=t,this},disabled:function(){return!l},lock:function(){return u=t,r||p.disable(),this},locked:function(){return!u},fireWith:function(e,t){return!l||i&&!u||(t=t||[],t=[e,t.slice?t.slice():t],n?u.push(t):c(t)),this},fire:function(){return p.fireWith(this,arguments),this},fired:function(){return!!i}};return p},x.extend({Deferred:function(e){var t=[["resolve","done",x.Callbacks("once memory"),"resolved"],["reject","fail",x.Callbacks("once memory"),"rejected"],["notify","progress",x.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return x.Deferred(function(n){x.each(t,function(t,o){var a=o[0],s=x.isFunction(e[t])&&e[t];i[o[1]](function(){var e=s&&s.apply(this,arguments);e&&x.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[a+"With"](this===r?n.promise():this,s?[e]:arguments)})}),e=null}).promise()},promise:function(e){return null!=e?x.extend(e,r):r}},i={};return r.pipe=r.then,x.each(t,function(e,o){var a=o[2],s=o[3];r[o[1]]=a.add,s&&a.add(function(){n=s},t[1^e][2].disable,t[2][2].lock),i[o[0]]=function(){return i[o[0]+"With"](this===i?r:this,arguments),this},i[o[0]+"With"]=a.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=g.call(arguments),r=n.length,i=1!==r||e&&x.isFunction(e.promise)?r:0,o=1===i?e:x.Deferred(),a=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?g.call(arguments):r,n===s?o.notifyWith(t,n):--i||o.resolveWith(t,n)}},s,l,u;if(r>1)for(s=Array(r),l=Array(r),u=Array(r);r>t;t++)n[t]&&x.isFunction(n[t].promise)?n[t].promise().done(a(t,u,n)).fail(o.reject).progress(a(t,l,s)):--i;return i||o.resolveWith(u,n),o.promise()}}),x.support=function(t){var n,r,o,s,l,u,c,p,f,d=a.createElement("div");if(d.setAttribute("className","t"),d.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",n=d.getElementsByTagName("*")||[],r=d.getElementsByTagName("a")[0],!r||!r.style||!n.length)return t;s=a.createElement("select"),u=s.appendChild(a.createElement("option")),o=d.getElementsByTagName("input")[0],r.style.cssText="top:1px;float:left;opacity:.5",t.getSetAttribute="t"!==d.className,t.leadingWhitespace=3===d.firstChild.nodeType,t.tbody=!d.getElementsByTagName("tbody").length,t.htmlSerialize=!!d.getElementsByTagName("link").length,t.style=/top/.test(r.getAttribute("style")),t.hrefNormalized="/a"===r.getAttribute("href"),t.opacity=/^0.5/.test(r.style.opacity),t.cssFloat=!!r.style.cssFloat,t.checkOn=!!o.value,t.optSelected=u.selected,t.enctype=!!a.createElement("form").enctype,t.html5Clone="<:nav></:nav>"!==a.createElement("nav").cloneNode(!0).outerHTML,t.inlineBlockNeedsLayout=!1,t.shrinkWrapBlocks=!1,t.pixelPosition=!1,t.deleteExpando=!0,t.noCloneEvent=!0,t.reliableMarginRight=!0,t.boxSizingReliable=!0,o.checked=!0,t.noCloneChecked=o.cloneNode(!0).checked,s.disabled=!0,t.optDisabled=!u.disabled;try{delete d.test}catch(h){t.deleteExpando=!1}o=a.createElement("input"),o.setAttribute("value",""),t.input=""===o.getAttribute("value"),o.value="t",o.setAttribute("type","radio"),t.radioValue="t"===o.value,o.setAttribute("checked","t"),o.setAttribute("name","t"),l=a.createDocumentFragment(),l.appendChild(o),t.appendChecked=o.checked,t.checkClone=l.cloneNode(!0).cloneNode(!0).lastChild.checked,d.attachEvent&&(d.attachEvent("onclick",function(){t.noCloneEvent=!1}),d.cloneNode(!0).click());for(f in{submit:!0,change:!0,focusin:!0})d.setAttribute(c="on"+f,"t"),t[f+"Bubbles"]=c in e||d.attributes[c].expando===!1;d.style.backgroundClip="content-box",d.cloneNode(!0).style.backgroundClip="",t.clearCloneStyle="content-box"===d.style.backgroundClip;for(f in x(t))break;return t.ownLast="0"!==f,x(function(){var n,r,o,s="padding:0;margin:0;border:0;display:block;box-sizing:content-box;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;",l=a.getElementsByTagName("body")[0];l&&(n=a.createElement("div"),n.style.cssText="border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px",l.appendChild(n).appendChild(d),d.innerHTML="<table><tr><td></td><td>t</td></tr></table>",o=d.getElementsByTagName("td"),o[0].style.cssText="padding:0;margin:0;border:0;display:none",p=0===o[0].offsetHeight,o[0].style.display="",o[1].style.display="none",t.reliableHiddenOffsets=p&&0===o[0].offsetHeight,d.innerHTML="",d.style.cssText="box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;",x.swap(l,null!=l.style.zoom?{zoom:1}:{},function(){t.boxSizing=4===d.offsetWidth}),e.getComputedStyle&&(t.pixelPosition="1%"!==(e.getComputedStyle(d,null)||{}).top,t.boxSizingReliable="4px"===(e.getComputedStyle(d,null)||{width:"4px"}).width,r=d.appendChild(a.createElement("div")),r.style.cssText=d.style.cssText=s,r.style.marginRight=r.style.width="0",d.style.width="1px",t.reliableMarginRight=!parseFloat((e.getComputedStyle(r,null)||{}).marginRight)),typeof d.style.zoom!==i&&(d.innerHTML="",d.style.cssText=s+"width:1px;padding:1px;display:inline;zoom:1",t.inlineBlockNeedsLayout=3===d.offsetWidth,d.style.display="block",d.innerHTML="<div></div>",d.firstChild.style.width="5px",t.shrinkWrapBlocks=3!==d.offsetWidth,t.inlineBlockNeedsLayout&&(l.style.zoom=1)),l.removeChild(n),n=d=o=r=null)}),n=s=l=u=r=o=null,t
}({});var B=/(?:\{[\s\S]*\}|\[[\s\S]*\])$/,P=/([A-Z])/g;function R(e,n,r,i){if(x.acceptData(e)){var o,a,s=x.expando,l=e.nodeType,u=l?x.cache:e,c=l?e[s]:e[s]&&s;if(c&&u[c]&&(i||u[c].data)||r!==t||"string"!=typeof n)return c||(c=l?e[s]=p.pop()||x.guid++:s),u[c]||(u[c]=l?{}:{toJSON:x.noop}),("object"==typeof n||"function"==typeof n)&&(i?u[c]=x.extend(u[c],n):u[c].data=x.extend(u[c].data,n)),a=u[c],i||(a.data||(a.data={}),a=a.data),r!==t&&(a[x.camelCase(n)]=r),"string"==typeof n?(o=a[n],null==o&&(o=a[x.camelCase(n)])):o=a,o}}function W(e,t,n){if(x.acceptData(e)){var r,i,o=e.nodeType,a=o?x.cache:e,s=o?e[x.expando]:x.expando;if(a[s]){if(t&&(r=n?a[s]:a[s].data)){x.isArray(t)?t=t.concat(x.map(t,x.camelCase)):t in r?t=[t]:(t=x.camelCase(t),t=t in r?[t]:t.split(" ")),i=t.length;while(i--)delete r[t[i]];if(n?!I(r):!x.isEmptyObject(r))return}(n||(delete a[s].data,I(a[s])))&&(o?x.cleanData([e],!0):x.support.deleteExpando||a!=a.window?delete a[s]:a[s]=null)}}}x.extend({cache:{},noData:{applet:!0,embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"},hasData:function(e){return e=e.nodeType?x.cache[e[x.expando]]:e[x.expando],!!e&&!I(e)},data:function(e,t,n){return R(e,t,n)},removeData:function(e,t){return W(e,t)},_data:function(e,t,n){return R(e,t,n,!0)},_removeData:function(e,t){return W(e,t,!0)},acceptData:function(e){if(e.nodeType&&1!==e.nodeType&&9!==e.nodeType)return!1;var t=e.nodeName&&x.noData[e.nodeName.toLowerCase()];return!t||t!==!0&&e.getAttribute("classid")===t}}),x.fn.extend({data:function(e,n){var r,i,o=null,a=0,s=this[0];if(e===t){if(this.length&&(o=x.data(s),1===s.nodeType&&!x._data(s,"parsedAttrs"))){for(r=s.attributes;r.length>a;a++)i=r[a].name,0===i.indexOf("data-")&&(i=x.camelCase(i.slice(5)),$(s,i,o[i]));x._data(s,"parsedAttrs",!0)}return o}return"object"==typeof e?this.each(function(){x.data(this,e)}):arguments.length>1?this.each(function(){x.data(this,e,n)}):s?$(s,e,x.data(s,e)):null},removeData:function(e){return this.each(function(){x.removeData(this,e)})}});function $(e,n,r){if(r===t&&1===e.nodeType){var i="data-"+n.replace(P,"-$1").toLowerCase();if(r=e.getAttribute(i),"string"==typeof r){try{r="true"===r?!0:"false"===r?!1:"null"===r?null:+r+""===r?+r:B.test(r)?x.parseJSON(r):r}catch(o){}x.data(e,n,r)}else r=t}return r}function I(e){var t;for(t in e)if(("data"!==t||!x.isEmptyObject(e[t]))&&"toJSON"!==t)return!1;return!0}x.extend({queue:function(e,n,r){var i;return e?(n=(n||"fx")+"queue",i=x._data(e,n),r&&(!i||x.isArray(r)?i=x._data(e,n,x.makeArray(r)):i.push(r)),i||[]):t},dequeue:function(e,t){t=t||"fx";var n=x.queue(e,t),r=n.length,i=n.shift(),o=x._queueHooks(e,t),a=function(){x.dequeue(e,t)};"inprogress"===i&&(i=n.shift(),r--),i&&("fx"===t&&n.unshift("inprogress"),delete o.stop,i.call(e,a,o)),!r&&o&&o.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return x._data(e,n)||x._data(e,n,{empty:x.Callbacks("once memory").add(function(){x._removeData(e,t+"queue"),x._removeData(e,n)})})}}),x.fn.extend({queue:function(e,n){var r=2;return"string"!=typeof e&&(n=e,e="fx",r--),r>arguments.length?x.queue(this[0],e):n===t?this:this.each(function(){var t=x.queue(this,e,n);x._queueHooks(this,e),"fx"===e&&"inprogress"!==t[0]&&x.dequeue(this,e)})},dequeue:function(e){return this.each(function(){x.dequeue(this,e)})},delay:function(e,t){return e=x.fx?x.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,n){var r,i=1,o=x.Deferred(),a=this,s=this.length,l=function(){--i||o.resolveWith(a,[a])};"string"!=typeof e&&(n=e,e=t),e=e||"fx";while(s--)r=x._data(a[s],e+"queueHooks"),r&&r.empty&&(i++,r.empty.add(l));return l(),o.promise(n)}});var z,X,U=/[\t\r\n\f]/g,V=/\r/g,Y=/^(?:input|select|textarea|button|object)$/i,J=/^(?:a|area)$/i,G=/^(?:checked|selected)$/i,Q=x.support.getSetAttribute,K=x.support.input;x.fn.extend({attr:function(e,t){return x.access(this,x.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){x.removeAttr(this,e)})},prop:function(e,t){return x.access(this,x.prop,e,t,arguments.length>1)},removeProp:function(e){return e=x.propFix[e]||e,this.each(function(){try{this[e]=t,delete this[e]}catch(n){}})},addClass:function(e){var t,n,r,i,o,a=0,s=this.length,l="string"==typeof e&&e;if(x.isFunction(e))return this.each(function(t){x(this).addClass(e.call(this,t,this.className))});if(l)for(t=(e||"").match(T)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(U," "):" ")){o=0;while(i=t[o++])0>r.indexOf(" "+i+" ")&&(r+=i+" ");n.className=x.trim(r)}return this},removeClass:function(e){var t,n,r,i,o,a=0,s=this.length,l=0===arguments.length||"string"==typeof e&&e;if(x.isFunction(e))return this.each(function(t){x(this).removeClass(e.call(this,t,this.className))});if(l)for(t=(e||"").match(T)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(U," "):"")){o=0;while(i=t[o++])while(r.indexOf(" "+i+" ")>=0)r=r.replace(" "+i+" "," ");n.className=e?x.trim(r):""}return this},toggleClass:function(e,t){var n=typeof e;return"boolean"==typeof t&&"string"===n?t?this.addClass(e):this.removeClass(e):x.isFunction(e)?this.each(function(n){x(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if("string"===n){var t,r=0,o=x(this),a=e.match(T)||[];while(t=a[r++])o.hasClass(t)?o.removeClass(t):o.addClass(t)}else(n===i||"boolean"===n)&&(this.className&&x._data(this,"__className__",this.className),this.className=this.className||e===!1?"":x._data(this,"__className__")||"")})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;r>n;n++)if(1===this[n].nodeType&&(" "+this[n].className+" ").replace(U," ").indexOf(t)>=0)return!0;return!1},val:function(e){var n,r,i,o=this[0];{if(arguments.length)return i=x.isFunction(e),this.each(function(n){var o;1===this.nodeType&&(o=i?e.call(this,n,x(this).val()):e,null==o?o="":"number"==typeof o?o+="":x.isArray(o)&&(o=x.map(o,function(e){return null==e?"":e+""})),r=x.valHooks[this.type]||x.valHooks[this.nodeName.toLowerCase()],r&&"set"in r&&r.set(this,o,"value")!==t||(this.value=o))});if(o)return r=x.valHooks[o.type]||x.valHooks[o.nodeName.toLowerCase()],r&&"get"in r&&(n=r.get(o,"value"))!==t?n:(n=o.value,"string"==typeof n?n.replace(V,""):null==n?"":n)}}}),x.extend({valHooks:{option:{get:function(e){var t=x.find.attr(e,"value");return null!=t?t:e.text}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,o="select-one"===e.type||0>i,a=o?null:[],s=o?i+1:r.length,l=0>i?s:o?i:0;for(;s>l;l++)if(n=r[l],!(!n.selected&&l!==i||(x.support.optDisabled?n.disabled:null!==n.getAttribute("disabled"))||n.parentNode.disabled&&x.nodeName(n.parentNode,"optgroup"))){if(t=x(n).val(),o)return t;a.push(t)}return a},set:function(e,t){var n,r,i=e.options,o=x.makeArray(t),a=i.length;while(a--)r=i[a],(r.selected=x.inArray(x(r).val(),o)>=0)&&(n=!0);return n||(e.selectedIndex=-1),o}}},attr:function(e,n,r){var o,a,s=e.nodeType;if(e&&3!==s&&8!==s&&2!==s)return typeof e.getAttribute===i?x.prop(e,n,r):(1===s&&x.isXMLDoc(e)||(n=n.toLowerCase(),o=x.attrHooks[n]||(x.expr.match.bool.test(n)?X:z)),r===t?o&&"get"in o&&null!==(a=o.get(e,n))?a:(a=x.find.attr(e,n),null==a?t:a):null!==r?o&&"set"in o&&(a=o.set(e,r,n))!==t?a:(e.setAttribute(n,r+""),r):(x.removeAttr(e,n),t))},removeAttr:function(e,t){var n,r,i=0,o=t&&t.match(T);if(o&&1===e.nodeType)while(n=o[i++])r=x.propFix[n]||n,x.expr.match.bool.test(n)?K&&Q||!G.test(n)?e[r]=!1:e[x.camelCase("default-"+n)]=e[r]=!1:x.attr(e,n,""),e.removeAttribute(Q?n:r)},attrHooks:{type:{set:function(e,t){if(!x.support.radioValue&&"radio"===t&&x.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}},propFix:{"for":"htmlFor","class":"className"},prop:function(e,n,r){var i,o,a,s=e.nodeType;if(e&&3!==s&&8!==s&&2!==s)return a=1!==s||!x.isXMLDoc(e),a&&(n=x.propFix[n]||n,o=x.propHooks[n]),r!==t?o&&"set"in o&&(i=o.set(e,r,n))!==t?i:e[n]=r:o&&"get"in o&&null!==(i=o.get(e,n))?i:e[n]},propHooks:{tabIndex:{get:function(e){var t=x.find.attr(e,"tabindex");return t?parseInt(t,10):Y.test(e.nodeName)||J.test(e.nodeName)&&e.href?0:-1}}}}),X={set:function(e,t,n){return t===!1?x.removeAttr(e,n):K&&Q||!G.test(n)?e.setAttribute(!Q&&x.propFix[n]||n,n):e[x.camelCase("default-"+n)]=e[n]=!0,n}},x.each(x.expr.match.bool.source.match(/\w+/g),function(e,n){var r=x.expr.attrHandle[n]||x.find.attr;x.expr.attrHandle[n]=K&&Q||!G.test(n)?function(e,n,i){var o=x.expr.attrHandle[n],a=i?t:(x.expr.attrHandle[n]=t)!=r(e,n,i)?n.toLowerCase():null;return x.expr.attrHandle[n]=o,a}:function(e,n,r){return r?t:e[x.camelCase("default-"+n)]?n.toLowerCase():null}}),K&&Q||(x.attrHooks.value={set:function(e,n,r){return x.nodeName(e,"input")?(e.defaultValue=n,t):z&&z.set(e,n,r)}}),Q||(z={set:function(e,n,r){var i=e.getAttributeNode(r);return i||e.setAttributeNode(i=e.ownerDocument.createAttribute(r)),i.value=n+="","value"===r||n===e.getAttribute(r)?n:t}},x.expr.attrHandle.id=x.expr.attrHandle.name=x.expr.attrHandle.coords=function(e,n,r){var i;return r?t:(i=e.getAttributeNode(n))&&""!==i.value?i.value:null},x.valHooks.button={get:function(e,n){var r=e.getAttributeNode(n);return r&&r.specified?r.value:t},set:z.set},x.attrHooks.contenteditable={set:function(e,t,n){z.set(e,""===t?!1:t,n)}},x.each(["width","height"],function(e,n){x.attrHooks[n]={set:function(e,r){return""===r?(e.setAttribute(n,"auto"),r):t}}})),x.support.hrefNormalized||x.each(["href","src"],function(e,t){x.propHooks[t]={get:function(e){return e.getAttribute(t,4)}}}),x.support.style||(x.attrHooks.style={get:function(e){return e.style.cssText||t},set:function(e,t){return e.style.cssText=t+""}}),x.support.optSelected||(x.propHooks.selected={get:function(e){var t=e.parentNode;return t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex),null}}),x.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){x.propFix[this.toLowerCase()]=this}),x.support.enctype||(x.propFix.enctype="encoding"),x.each(["radio","checkbox"],function(){x.valHooks[this]={set:function(e,n){return x.isArray(n)?e.checked=x.inArray(x(e).val(),n)>=0:t}},x.support.checkOn||(x.valHooks[this].get=function(e){return null===e.getAttribute("value")?"on":e.value})});var Z=/^(?:input|select|textarea)$/i,et=/^key/,tt=/^(?:mouse|contextmenu)|click/,nt=/^(?:focusinfocus|focusoutblur)$/,rt=/^([^.]*)(?:\.(.+)|)$/;function it(){return!0}function ot(){return!1}function at(){try{return a.activeElement}catch(e){}}x.event={global:{},add:function(e,n,r,o,a){var s,l,u,c,p,f,d,h,g,m,y,v=x._data(e);if(v){r.handler&&(c=r,r=c.handler,a=c.selector),r.guid||(r.guid=x.guid++),(l=v.events)||(l=v.events={}),(f=v.handle)||(f=v.handle=function(e){return typeof x===i||e&&x.event.triggered===e.type?t:x.event.dispatch.apply(f.elem,arguments)},f.elem=e),n=(n||"").match(T)||[""],u=n.length;while(u--)s=rt.exec(n[u])||[],g=y=s[1],m=(s[2]||"").split(".").sort(),g&&(p=x.event.special[g]||{},g=(a?p.delegateType:p.bindType)||g,p=x.event.special[g]||{},d=x.extend({type:g,origType:y,data:o,handler:r,guid:r.guid,selector:a,needsContext:a&&x.expr.match.needsContext.test(a),namespace:m.join(".")},c),(h=l[g])||(h=l[g]=[],h.delegateCount=0,p.setup&&p.setup.call(e,o,m,f)!==!1||(e.addEventListener?e.addEventListener(g,f,!1):e.attachEvent&&e.attachEvent("on"+g,f))),p.add&&(p.add.call(e,d),d.handler.guid||(d.handler.guid=r.guid)),a?h.splice(h.delegateCount++,0,d):h.push(d),x.event.global[g]=!0);e=null}},remove:function(e,t,n,r,i){var o,a,s,l,u,c,p,f,d,h,g,m=x.hasData(e)&&x._data(e);if(m&&(c=m.events)){t=(t||"").match(T)||[""],u=t.length;while(u--)if(s=rt.exec(t[u])||[],d=g=s[1],h=(s[2]||"").split(".").sort(),d){p=x.event.special[d]||{},d=(r?p.delegateType:p.bindType)||d,f=c[d]||[],s=s[2]&&RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"),l=o=f.length;while(o--)a=f[o],!i&&g!==a.origType||n&&n.guid!==a.guid||s&&!s.test(a.namespace)||r&&r!==a.selector&&("**"!==r||!a.selector)||(f.splice(o,1),a.selector&&f.delegateCount--,p.remove&&p.remove.call(e,a));l&&!f.length&&(p.teardown&&p.teardown.call(e,h,m.handle)!==!1||x.removeEvent(e,d,m.handle),delete c[d])}else for(d in c)x.event.remove(e,d+t[u],n,r,!0);x.isEmptyObject(c)&&(delete m.handle,x._removeData(e,"events"))}},trigger:function(n,r,i,o){var s,l,u,c,p,f,d,h=[i||a],g=v.call(n,"type")?n.type:n,m=v.call(n,"namespace")?n.namespace.split("."):[];if(u=f=i=i||a,3!==i.nodeType&&8!==i.nodeType&&!nt.test(g+x.event.triggered)&&(g.indexOf(".")>=0&&(m=g.split("."),g=m.shift(),m.sort()),l=0>g.indexOf(":")&&"on"+g,n=n[x.expando]?n:new x.Event(g,"object"==typeof n&&n),n.isTrigger=o?2:3,n.namespace=m.join("."),n.namespace_re=n.namespace?RegExp("(^|\\.)"+m.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,n.result=t,n.target||(n.target=i),r=null==r?[n]:x.makeArray(r,[n]),p=x.event.special[g]||{},o||!p.trigger||p.trigger.apply(i,r)!==!1)){if(!o&&!p.noBubble&&!x.isWindow(i)){for(c=p.delegateType||g,nt.test(c+g)||(u=u.parentNode);u;u=u.parentNode)h.push(u),f=u;f===(i.ownerDocument||a)&&h.push(f.defaultView||f.parentWindow||e)}d=0;while((u=h[d++])&&!n.isPropagationStopped())n.type=d>1?c:p.bindType||g,s=(x._data(u,"events")||{})[n.type]&&x._data(u,"handle"),s&&s.apply(u,r),s=l&&u[l],s&&x.acceptData(u)&&s.apply&&s.apply(u,r)===!1&&n.preventDefault();if(n.type=g,!o&&!n.isDefaultPrevented()&&(!p._default||p._default.apply(h.pop(),r)===!1)&&x.acceptData(i)&&l&&i[g]&&!x.isWindow(i)){f=i[l],f&&(i[l]=null),x.event.triggered=g;try{i[g]()}catch(y){}x.event.triggered=t,f&&(i[l]=f)}return n.result}},dispatch:function(e){e=x.event.fix(e);var n,r,i,o,a,s=[],l=g.call(arguments),u=(x._data(this,"events")||{})[e.type]||[],c=x.event.special[e.type]||{};if(l[0]=e,e.delegateTarget=this,!c.preDispatch||c.preDispatch.call(this,e)!==!1){s=x.event.handlers.call(this,e,u),n=0;while((o=s[n++])&&!e.isPropagationStopped()){e.currentTarget=o.elem,a=0;while((i=o.handlers[a++])&&!e.isImmediatePropagationStopped())(!e.namespace_re||e.namespace_re.test(i.namespace))&&(e.handleObj=i,e.data=i.data,r=((x.event.special[i.origType]||{}).handle||i.handler).apply(o.elem,l),r!==t&&(e.result=r)===!1&&(e.preventDefault(),e.stopPropagation()))}return c.postDispatch&&c.postDispatch.call(this,e),e.result}},handlers:function(e,n){var r,i,o,a,s=[],l=n.delegateCount,u=e.target;if(l&&u.nodeType&&(!e.button||"click"!==e.type))for(;u!=this;u=u.parentNode||this)if(1===u.nodeType&&(u.disabled!==!0||"click"!==e.type)){for(o=[],a=0;l>a;a++)i=n[a],r=i.selector+" ",o[r]===t&&(o[r]=i.needsContext?x(r,this).index(u)>=0:x.find(r,this,null,[u]).length),o[r]&&o.push(i);o.length&&s.push({elem:u,handlers:o})}return n.length>l&&s.push({elem:this,handlers:n.slice(l)}),s},fix:function(e){if(e[x.expando])return e;var t,n,r,i=e.type,o=e,s=this.fixHooks[i];s||(this.fixHooks[i]=s=tt.test(i)?this.mouseHooks:et.test(i)?this.keyHooks:{}),r=s.props?this.props.concat(s.props):this.props,e=new x.Event(o),t=r.length;while(t--)n=r[t],e[n]=o[n];return e.target||(e.target=o.srcElement||a),3===e.target.nodeType&&(e.target=e.target.parentNode),e.metaKey=!!e.metaKey,s.filter?s.filter(e,o):e},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return null==e.which&&(e.which=null!=t.charCode?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,n){var r,i,o,s=n.button,l=n.fromElement;return null==e.pageX&&null!=n.clientX&&(i=e.target.ownerDocument||a,o=i.documentElement,r=i.body,e.pageX=n.clientX+(o&&o.scrollLeft||r&&r.scrollLeft||0)-(o&&o.clientLeft||r&&r.clientLeft||0),e.pageY=n.clientY+(o&&o.scrollTop||r&&r.scrollTop||0)-(o&&o.clientTop||r&&r.clientTop||0)),!e.relatedTarget&&l&&(e.relatedTarget=l===e.target?n.toElement:l),e.which||s===t||(e.which=1&s?1:2&s?3:4&s?2:0),e}},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==at()&&this.focus)try{return this.focus(),!1}catch(e){}},delegateType:"focusin"},blur:{trigger:function(){return this===at()&&this.blur?(this.blur(),!1):t},delegateType:"focusout"},click:{trigger:function(){return x.nodeName(this,"input")&&"checkbox"===this.type&&this.click?(this.click(),!1):t},_default:function(e){return x.nodeName(e.target,"a")}},beforeunload:{postDispatch:function(e){e.result!==t&&(e.originalEvent.returnValue=e.result)}}},simulate:function(e,t,n,r){var i=x.extend(new x.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?x.event.trigger(i,null,t):x.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},x.removeEvent=a.removeEventListener?function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)}:function(e,t,n){var r="on"+t;e.detachEvent&&(typeof e[r]===i&&(e[r]=null),e.detachEvent(r,n))},x.Event=function(e,n){return this instanceof x.Event?(e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.returnValue===!1||e.getPreventDefault&&e.getPreventDefault()?it:ot):this.type=e,n&&x.extend(this,n),this.timeStamp=e&&e.timeStamp||x.now(),this[x.expando]=!0,t):new x.Event(e,n)},x.Event.prototype={isDefaultPrevented:ot,isPropagationStopped:ot,isImmediatePropagationStopped:ot,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=it,e&&(e.preventDefault?e.preventDefault():e.returnValue=!1)},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=it,e&&(e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0)},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=it,this.stopPropagation()}},x.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(e,t){x.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,o=e.handleObj;return(!i||i!==r&&!x.contains(r,i))&&(e.type=o.origType,n=o.handler.apply(this,arguments),e.type=t),n}}}),x.support.submitBubbles||(x.event.special.submit={setup:function(){return x.nodeName(this,"form")?!1:(x.event.add(this,"click._submit keypress._submit",function(e){var n=e.target,r=x.nodeName(n,"input")||x.nodeName(n,"button")?n.form:t;r&&!x._data(r,"submitBubbles")&&(x.event.add(r,"submit._submit",function(e){e._submit_bubble=!0}),x._data(r,"submitBubbles",!0))}),t)},postDispatch:function(e){e._submit_bubble&&(delete e._submit_bubble,this.parentNode&&!e.isTrigger&&x.event.simulate("submit",this.parentNode,e,!0))},teardown:function(){return x.nodeName(this,"form")?!1:(x.event.remove(this,"._submit"),t)}}),x.support.changeBubbles||(x.event.special.change={setup:function(){return Z.test(this.nodeName)?(("checkbox"===this.type||"radio"===this.type)&&(x.event.add(this,"propertychange._change",function(e){"checked"===e.originalEvent.propertyName&&(this._just_changed=!0)}),x.event.add(this,"click._change",function(e){this._just_changed&&!e.isTrigger&&(this._just_changed=!1),x.event.simulate("change",this,e,!0)})),!1):(x.event.add(this,"beforeactivate._change",function(e){var t=e.target;Z.test(t.nodeName)&&!x._data(t,"changeBubbles")&&(x.event.add(t,"change._change",function(e){!this.parentNode||e.isSimulated||e.isTrigger||x.event.simulate("change",this.parentNode,e,!0)}),x._data(t,"changeBubbles",!0))}),t)},handle:function(e){var n=e.target;return this!==n||e.isSimulated||e.isTrigger||"radio"!==n.type&&"checkbox"!==n.type?e.handleObj.handler.apply(this,arguments):t},teardown:function(){return x.event.remove(this,"._change"),!Z.test(this.nodeName)}}),x.support.focusinBubbles||x.each({focus:"focusin",blur:"focusout"},function(e,t){var n=0,r=function(e){x.event.simulate(t,e.target,x.event.fix(e),!0)};x.event.special[t]={setup:function(){0===n++&&a.addEventListener(e,r,!0)},teardown:function(){0===--n&&a.removeEventListener(e,r,!0)}}}),x.fn.extend({on:function(e,n,r,i,o){var a,s;if("object"==typeof e){"string"!=typeof n&&(r=r||n,n=t);for(a in e)this.on(a,n,r,e[a],o);return this}if(null==r&&null==i?(i=n,r=n=t):null==i&&("string"==typeof n?(i=r,r=t):(i=r,r=n,n=t)),i===!1)i=ot;else if(!i)return this;return 1===o&&(s=i,i=function(e){return x().off(e),s.apply(this,arguments)},i.guid=s.guid||(s.guid=x.guid++)),this.each(function(){x.event.add(this,e,i,r,n)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,n,r){var i,o;if(e&&e.preventDefault&&e.handleObj)return i=e.handleObj,x(e.delegateTarget).off(i.namespace?i.origType+"."+i.namespace:i.origType,i.selector,i.handler),this;if("object"==typeof e){for(o in e)this.off(o,n,e[o]);return this}return(n===!1||"function"==typeof n)&&(r=n,n=t),r===!1&&(r=ot),this.each(function(){x.event.remove(this,e,r,n)})},trigger:function(e,t){return this.each(function(){x.event.trigger(e,t,this)})},triggerHandler:function(e,n){var r=this[0];return r?x.event.trigger(e,n,r,!0):t}});var st=/^.[^:#\[\.,]*$/,lt=/^(?:parents|prev(?:Until|All))/,ut=x.expr.match.needsContext,ct={children:!0,contents:!0,next:!0,prev:!0};x.fn.extend({find:function(e){var t,n=[],r=this,i=r.length;if("string"!=typeof e)return this.pushStack(x(e).filter(function(){for(t=0;i>t;t++)if(x.contains(r[t],this))return!0}));for(t=0;i>t;t++)x.find(e,r[t],n);return n=this.pushStack(i>1?x.unique(n):n),n.selector=this.selector?this.selector+" "+e:e,n},has:function(e){var t,n=x(e,this),r=n.length;return this.filter(function(){for(t=0;r>t;t++)if(x.contains(this,n[t]))return!0})},not:function(e){return this.pushStack(ft(this,e||[],!0))},filter:function(e){return this.pushStack(ft(this,e||[],!1))},is:function(e){return!!ft(this,"string"==typeof e&&ut.test(e)?x(e):e||[],!1).length},closest:function(e,t){var n,r=0,i=this.length,o=[],a=ut.test(e)||"string"!=typeof e?x(e,t||this.context):0;for(;i>r;r++)for(n=this[r];n&&n!==t;n=n.parentNode)if(11>n.nodeType&&(a?a.index(n)>-1:1===n.nodeType&&x.find.matchesSelector(n,e))){n=o.push(n);break}return this.pushStack(o.length>1?x.unique(o):o)},index:function(e){return e?"string"==typeof e?x.inArray(this[0],x(e)):x.inArray(e.jquery?e[0]:e,this):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){var n="string"==typeof e?x(e,t):x.makeArray(e&&e.nodeType?[e]:e),r=x.merge(this.get(),n);return this.pushStack(x.unique(r))},addBack:function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}});function pt(e,t){do e=e[t];while(e&&1!==e.nodeType);return e}x.each({parent:function(e){var t=e.parentNode;return t&&11!==t.nodeType?t:null},parents:function(e){return x.dir(e,"parentNode")},parentsUntil:function(e,t,n){return x.dir(e,"parentNode",n)},next:function(e){return pt(e,"nextSibling")},prev:function(e){return pt(e,"previousSibling")},nextAll:function(e){return x.dir(e,"nextSibling")},prevAll:function(e){return x.dir(e,"previousSibling")},nextUntil:function(e,t,n){return x.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return x.dir(e,"previousSibling",n)},siblings:function(e){return x.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return x.sibling(e.firstChild)},contents:function(e){return x.nodeName(e,"iframe")?e.contentDocument||e.contentWindow.document:x.merge([],e.childNodes)}},function(e,t){x.fn[e]=function(n,r){var i=x.map(this,t,n);return"Until"!==e.slice(-5)&&(r=n),r&&"string"==typeof r&&(i=x.filter(r,i)),this.length>1&&(ct[e]||(i=x.unique(i)),lt.test(e)&&(i=i.reverse())),this.pushStack(i)}}),x.extend({filter:function(e,t,n){var r=t[0];return n&&(e=":not("+e+")"),1===t.length&&1===r.nodeType?x.find.matchesSelector(r,e)?[r]:[]:x.find.matches(e,x.grep(t,function(e){return 1===e.nodeType}))},dir:function(e,n,r){var i=[],o=e[n];while(o&&9!==o.nodeType&&(r===t||1!==o.nodeType||!x(o).is(r)))1===o.nodeType&&i.push(o),o=o[n];return i},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)1===e.nodeType&&e!==t&&n.push(e);return n}});function ft(e,t,n){if(x.isFunction(t))return x.grep(e,function(e,r){return!!t.call(e,r,e)!==n});if(t.nodeType)return x.grep(e,function(e){return e===t!==n});if("string"==typeof t){if(st.test(t))return x.filter(t,e,n);t=x.filter(t,e)}return x.grep(e,function(e){return x.inArray(e,t)>=0!==n})}function dt(e){var t=ht.split("|"),n=e.createDocumentFragment();if(n.createElement)while(t.length)n.createElement(t.pop());return n}var ht="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",gt=/ jQuery\d+="(?:null|\d+)"/g,mt=RegExp("<(?:"+ht+")[\\s/>]","i"),yt=/^\s+/,vt=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,bt=/<([\w:]+)/,xt=/<tbody/i,wt=/<|&#?\w+;/,Tt=/<(?:script|style|link)/i,Ct=/^(?:checkbox|radio)$/i,Nt=/checked\s*(?:[^=]|=\s*.checked.)/i,kt=/^$|\/(?:java|ecma)script/i,Et=/^true\/(.*)/,St=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,At={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],area:[1,"<map>","</map>"],param:[1,"<object>","</object>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:x.support.htmlSerialize?[0,"",""]:[1,"X<div>","</div>"]},jt=dt(a),Dt=jt.appendChild(a.createElement("div"));At.optgroup=At.option,At.tbody=At.tfoot=At.colgroup=At.caption=At.thead,At.th=At.td,x.fn.extend({text:function(e){return x.access(this,function(e){return e===t?x.text(this):this.empty().append((this[0]&&this[0].ownerDocument||a).createTextNode(e))},null,e,arguments.length)},append:function(){return this.domManip(arguments,function(e){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var t=Lt(this,e);t.appendChild(e)}})},prepend:function(){return this.domManip(arguments,function(e){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var t=Lt(this,e);t.insertBefore(e,t.firstChild)}})},before:function(){return this.domManip(arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return this.domManip(arguments,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},remove:function(e,t){var n,r=e?x.filter(e,this):this,i=0;for(;null!=(n=r[i]);i++)t||1!==n.nodeType||x.cleanData(Ft(n)),n.parentNode&&(t&&x.contains(n.ownerDocument,n)&&_t(Ft(n,"script")),n.parentNode.removeChild(n));return this},empty:function(){var e,t=0;for(;null!=(e=this[t]);t++){1===e.nodeType&&x.cleanData(Ft(e,!1));while(e.firstChild)e.removeChild(e.firstChild);e.options&&x.nodeName(e,"select")&&(e.options.length=0)}return this},clone:function(e,t){return e=null==e?!1:e,t=null==t?e:t,this.map(function(){return x.clone(this,e,t)})},html:function(e){return x.access(this,function(e){var n=this[0]||{},r=0,i=this.length;if(e===t)return 1===n.nodeType?n.innerHTML.replace(gt,""):t;if(!("string"!=typeof e||Tt.test(e)||!x.support.htmlSerialize&&mt.test(e)||!x.support.leadingWhitespace&&yt.test(e)||At[(bt.exec(e)||["",""])[1].toLowerCase()])){e=e.replace(vt,"<$1></$2>");try{for(;i>r;r++)n=this[r]||{},1===n.nodeType&&(x.cleanData(Ft(n,!1)),n.innerHTML=e);n=0}catch(o){}}n&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(){var e=x.map(this,function(e){return[e.nextSibling,e.parentNode]}),t=0;return this.domManip(arguments,function(n){var r=e[t++],i=e[t++];i&&(r&&r.parentNode!==i&&(r=this.nextSibling),x(this).remove(),i.insertBefore(n,r))},!0),t?this:this.remove()},detach:function(e){return this.remove(e,!0)},domManip:function(e,t,n){e=d.apply([],e);var r,i,o,a,s,l,u=0,c=this.length,p=this,f=c-1,h=e[0],g=x.isFunction(h);if(g||!(1>=c||"string"!=typeof h||x.support.checkClone)&&Nt.test(h))return this.each(function(r){var i=p.eq(r);g&&(e[0]=h.call(this,r,i.html())),i.domManip(e,t,n)});if(c&&(l=x.buildFragment(e,this[0].ownerDocument,!1,!n&&this),r=l.firstChild,1===l.childNodes.length&&(l=r),r)){for(a=x.map(Ft(l,"script"),Ht),o=a.length;c>u;u++)i=l,u!==f&&(i=x.clone(i,!0,!0),o&&x.merge(a,Ft(i,"script"))),t.call(this[u],i,u);if(o)for(s=a[a.length-1].ownerDocument,x.map(a,qt),u=0;o>u;u++)i=a[u],kt.test(i.type||"")&&!x._data(i,"globalEval")&&x.contains(s,i)&&(i.src?x._evalUrl(i.src):x.globalEval((i.text||i.textContent||i.innerHTML||"").replace(St,"")));l=r=null}return this}});function Lt(e,t){return x.nodeName(e,"table")&&x.nodeName(1===t.nodeType?t:t.firstChild,"tr")?e.getElementsByTagName("tbody")[0]||e.appendChild(e.ownerDocument.createElement("tbody")):e}function Ht(e){return e.type=(null!==x.find.attr(e,"type"))+"/"+e.type,e}function qt(e){var t=Et.exec(e.type);return t?e.type=t[1]:e.removeAttribute("type"),e}function _t(e,t){var n,r=0;for(;null!=(n=e[r]);r++)x._data(n,"globalEval",!t||x._data(t[r],"globalEval"))}function Mt(e,t){if(1===t.nodeType&&x.hasData(e)){var n,r,i,o=x._data(e),a=x._data(t,o),s=o.events;if(s){delete a.handle,a.events={};for(n in s)for(r=0,i=s[n].length;i>r;r++)x.event.add(t,n,s[n][r])}a.data&&(a.data=x.extend({},a.data))}}function Ot(e,t){var n,r,i;if(1===t.nodeType){if(n=t.nodeName.toLowerCase(),!x.support.noCloneEvent&&t[x.expando]){i=x._data(t);for(r in i.events)x.removeEvent(t,r,i.handle);t.removeAttribute(x.expando)}"script"===n&&t.text!==e.text?(Ht(t).text=e.text,qt(t)):"object"===n?(t.parentNode&&(t.outerHTML=e.outerHTML),x.support.html5Clone&&e.innerHTML&&!x.trim(t.innerHTML)&&(t.innerHTML=e.innerHTML)):"input"===n&&Ct.test(e.type)?(t.defaultChecked=t.checked=e.checked,t.value!==e.value&&(t.value=e.value)):"option"===n?t.defaultSelected=t.selected=e.defaultSelected:("input"===n||"textarea"===n)&&(t.defaultValue=e.defaultValue)}}x.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){x.fn[e]=function(e){var n,r=0,i=[],o=x(e),a=o.length-1;for(;a>=r;r++)n=r===a?this:this.clone(!0),x(o[r])[t](n),h.apply(i,n.get());return this.pushStack(i)}});function Ft(e,n){var r,o,a=0,s=typeof e.getElementsByTagName!==i?e.getElementsByTagName(n||"*"):typeof e.querySelectorAll!==i?e.querySelectorAll(n||"*"):t;if(!s)for(s=[],r=e.childNodes||e;null!=(o=r[a]);a++)!n||x.nodeName(o,n)?s.push(o):x.merge(s,Ft(o,n));return n===t||n&&x.nodeName(e,n)?x.merge([e],s):s}function Bt(e){Ct.test(e.type)&&(e.defaultChecked=e.checked)}x.extend({clone:function(e,t,n){var r,i,o,a,s,l=x.contains(e.ownerDocument,e);if(x.support.html5Clone||x.isXMLDoc(e)||!mt.test("<"+e.nodeName+">")?o=e.cloneNode(!0):(Dt.innerHTML=e.outerHTML,Dt.removeChild(o=Dt.firstChild)),!(x.support.noCloneEvent&&x.support.noCloneChecked||1!==e.nodeType&&11!==e.nodeType||x.isXMLDoc(e)))for(r=Ft(o),s=Ft(e),a=0;null!=(i=s[a]);++a)r[a]&&Ot(i,r[a]);if(t)if(n)for(s=s||Ft(e),r=r||Ft(o),a=0;null!=(i=s[a]);a++)Mt(i,r[a]);else Mt(e,o);return r=Ft(o,"script"),r.length>0&&_t(r,!l&&Ft(e,"script")),r=s=i=null,o},buildFragment:function(e,t,n,r){var i,o,a,s,l,u,c,p=e.length,f=dt(t),d=[],h=0;for(;p>h;h++)if(o=e[h],o||0===o)if("object"===x.type(o))x.merge(d,o.nodeType?[o]:o);else if(wt.test(o)){s=s||f.appendChild(t.createElement("div")),l=(bt.exec(o)||["",""])[1].toLowerCase(),c=At[l]||At._default,s.innerHTML=c[1]+o.replace(vt,"<$1></$2>")+c[2],i=c[0];while(i--)s=s.lastChild;if(!x.support.leadingWhitespace&&yt.test(o)&&d.push(t.createTextNode(yt.exec(o)[0])),!x.support.tbody){o="table"!==l||xt.test(o)?"<table>"!==c[1]||xt.test(o)?0:s:s.firstChild,i=o&&o.childNodes.length;while(i--)x.nodeName(u=o.childNodes[i],"tbody")&&!u.childNodes.length&&o.removeChild(u)}x.merge(d,s.childNodes),s.textContent="";while(s.firstChild)s.removeChild(s.firstChild);s=f.lastChild}else d.push(t.createTextNode(o));s&&f.removeChild(s),x.support.appendChecked||x.grep(Ft(d,"input"),Bt),h=0;while(o=d[h++])if((!r||-1===x.inArray(o,r))&&(a=x.contains(o.ownerDocument,o),s=Ft(f.appendChild(o),"script"),a&&_t(s),n)){i=0;while(o=s[i++])kt.test(o.type||"")&&n.push(o)}return s=null,f},cleanData:function(e,t){var n,r,o,a,s=0,l=x.expando,u=x.cache,c=x.support.deleteExpando,f=x.event.special;for(;null!=(n=e[s]);s++)if((t||x.acceptData(n))&&(o=n[l],a=o&&u[o])){if(a.events)for(r in a.events)f[r]?x.event.remove(n,r):x.removeEvent(n,r,a.handle);
u[o]&&(delete u[o],c?delete n[l]:typeof n.removeAttribute!==i?n.removeAttribute(l):n[l]=null,p.push(o))}},_evalUrl:function(e){return x.ajax({url:e,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})}}),x.fn.extend({wrapAll:function(e){if(x.isFunction(e))return this.each(function(t){x(this).wrapAll(e.call(this,t))});if(this[0]){var t=x(e,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstChild&&1===e.firstChild.nodeType)e=e.firstChild;return e}).append(this)}return this},wrapInner:function(e){return x.isFunction(e)?this.each(function(t){x(this).wrapInner(e.call(this,t))}):this.each(function(){var t=x(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=x.isFunction(e);return this.each(function(n){x(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){x.nodeName(this,"body")||x(this).replaceWith(this.childNodes)}).end()}});var Pt,Rt,Wt,$t=/alpha\([^)]*\)/i,It=/opacity\s*=\s*([^)]*)/,zt=/^(top|right|bottom|left)$/,Xt=/^(none|table(?!-c[ea]).+)/,Ut=/^margin/,Vt=RegExp("^("+w+")(.*)$","i"),Yt=RegExp("^("+w+")(?!px)[a-z%]+$","i"),Jt=RegExp("^([+-])=("+w+")","i"),Gt={BODY:"block"},Qt={position:"absolute",visibility:"hidden",display:"block"},Kt={letterSpacing:0,fontWeight:400},Zt=["Top","Right","Bottom","Left"],en=["Webkit","O","Moz","ms"];function tn(e,t){if(t in e)return t;var n=t.charAt(0).toUpperCase()+t.slice(1),r=t,i=en.length;while(i--)if(t=en[i]+n,t in e)return t;return r}function nn(e,t){return e=t||e,"none"===x.css(e,"display")||!x.contains(e.ownerDocument,e)}function rn(e,t){var n,r,i,o=[],a=0,s=e.length;for(;s>a;a++)r=e[a],r.style&&(o[a]=x._data(r,"olddisplay"),n=r.style.display,t?(o[a]||"none"!==n||(r.style.display=""),""===r.style.display&&nn(r)&&(o[a]=x._data(r,"olddisplay",ln(r.nodeName)))):o[a]||(i=nn(r),(n&&"none"!==n||!i)&&x._data(r,"olddisplay",i?n:x.css(r,"display"))));for(a=0;s>a;a++)r=e[a],r.style&&(t&&"none"!==r.style.display&&""!==r.style.display||(r.style.display=t?o[a]||"":"none"));return e}x.fn.extend({css:function(e,n){return x.access(this,function(e,n,r){var i,o,a={},s=0;if(x.isArray(n)){for(o=Rt(e),i=n.length;i>s;s++)a[n[s]]=x.css(e,n[s],!1,o);return a}return r!==t?x.style(e,n,r):x.css(e,n)},e,n,arguments.length>1)},show:function(){return rn(this,!0)},hide:function(){return rn(this)},toggle:function(e){return"boolean"==typeof e?e?this.show():this.hide():this.each(function(){nn(this)?x(this).show():x(this).hide()})}}),x.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Wt(e,"opacity");return""===n?"1":n}}}},cssNumber:{columnCount:!0,fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":x.support.cssFloat?"cssFloat":"styleFloat"},style:function(e,n,r,i){if(e&&3!==e.nodeType&&8!==e.nodeType&&e.style){var o,a,s,l=x.camelCase(n),u=e.style;if(n=x.cssProps[l]||(x.cssProps[l]=tn(u,l)),s=x.cssHooks[n]||x.cssHooks[l],r===t)return s&&"get"in s&&(o=s.get(e,!1,i))!==t?o:u[n];if(a=typeof r,"string"===a&&(o=Jt.exec(r))&&(r=(o[1]+1)*o[2]+parseFloat(x.css(e,n)),a="number"),!(null==r||"number"===a&&isNaN(r)||("number"!==a||x.cssNumber[l]||(r+="px"),x.support.clearCloneStyle||""!==r||0!==n.indexOf("background")||(u[n]="inherit"),s&&"set"in s&&(r=s.set(e,r,i))===t)))try{u[n]=r}catch(c){}}},css:function(e,n,r,i){var o,a,s,l=x.camelCase(n);return n=x.cssProps[l]||(x.cssProps[l]=tn(e.style,l)),s=x.cssHooks[n]||x.cssHooks[l],s&&"get"in s&&(a=s.get(e,!0,r)),a===t&&(a=Wt(e,n,i)),"normal"===a&&n in Kt&&(a=Kt[n]),""===r||r?(o=parseFloat(a),r===!0||x.isNumeric(o)?o||0:a):a}}),e.getComputedStyle?(Rt=function(t){return e.getComputedStyle(t,null)},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),l=s?s.getPropertyValue(n)||s[n]:t,u=e.style;return s&&(""!==l||x.contains(e.ownerDocument,e)||(l=x.style(e,n)),Yt.test(l)&&Ut.test(n)&&(i=u.width,o=u.minWidth,a=u.maxWidth,u.minWidth=u.maxWidth=u.width=l,l=s.width,u.width=i,u.minWidth=o,u.maxWidth=a)),l}):a.documentElement.currentStyle&&(Rt=function(e){return e.currentStyle},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),l=s?s[n]:t,u=e.style;return null==l&&u&&u[n]&&(l=u[n]),Yt.test(l)&&!zt.test(n)&&(i=u.left,o=e.runtimeStyle,a=o&&o.left,a&&(o.left=e.currentStyle.left),u.left="fontSize"===n?"1em":l,l=u.pixelLeft+"px",u.left=i,a&&(o.left=a)),""===l?"auto":l});function on(e,t,n){var r=Vt.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function an(e,t,n,r,i){var o=n===(r?"border":"content")?4:"width"===t?1:0,a=0;for(;4>o;o+=2)"margin"===n&&(a+=x.css(e,n+Zt[o],!0,i)),r?("content"===n&&(a-=x.css(e,"padding"+Zt[o],!0,i)),"margin"!==n&&(a-=x.css(e,"border"+Zt[o]+"Width",!0,i))):(a+=x.css(e,"padding"+Zt[o],!0,i),"padding"!==n&&(a+=x.css(e,"border"+Zt[o]+"Width",!0,i)));return a}function sn(e,t,n){var r=!0,i="width"===t?e.offsetWidth:e.offsetHeight,o=Rt(e),a=x.support.boxSizing&&"border-box"===x.css(e,"boxSizing",!1,o);if(0>=i||null==i){if(i=Wt(e,t,o),(0>i||null==i)&&(i=e.style[t]),Yt.test(i))return i;r=a&&(x.support.boxSizingReliable||i===e.style[t]),i=parseFloat(i)||0}return i+an(e,t,n||(a?"border":"content"),r,o)+"px"}function ln(e){var t=a,n=Gt[e];return n||(n=un(e,t),"none"!==n&&n||(Pt=(Pt||x("<iframe frameborder='0' width='0' height='0'/>").css("cssText","display:block !important")).appendTo(t.documentElement),t=(Pt[0].contentWindow||Pt[0].contentDocument).document,t.write("<!doctype html><html><body>"),t.close(),n=un(e,t),Pt.detach()),Gt[e]=n),n}function un(e,t){var n=x(t.createElement(e)).appendTo(t.body),r=x.css(n[0],"display");return n.remove(),r}x.each(["height","width"],function(e,n){x.cssHooks[n]={get:function(e,r,i){return r?0===e.offsetWidth&&Xt.test(x.css(e,"display"))?x.swap(e,Qt,function(){return sn(e,n,i)}):sn(e,n,i):t},set:function(e,t,r){var i=r&&Rt(e);return on(e,t,r?an(e,n,r,x.support.boxSizing&&"border-box"===x.css(e,"boxSizing",!1,i),i):0)}}}),x.support.opacity||(x.cssHooks.opacity={get:function(e,t){return It.test((t&&e.currentStyle?e.currentStyle.filter:e.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":t?"1":""},set:function(e,t){var n=e.style,r=e.currentStyle,i=x.isNumeric(t)?"alpha(opacity="+100*t+")":"",o=r&&r.filter||n.filter||"";n.zoom=1,(t>=1||""===t)&&""===x.trim(o.replace($t,""))&&n.removeAttribute&&(n.removeAttribute("filter"),""===t||r&&!r.filter)||(n.filter=$t.test(o)?o.replace($t,i):o+" "+i)}}),x(function(){x.support.reliableMarginRight||(x.cssHooks.marginRight={get:function(e,n){return n?x.swap(e,{display:"inline-block"},Wt,[e,"marginRight"]):t}}),!x.support.pixelPosition&&x.fn.position&&x.each(["top","left"],function(e,n){x.cssHooks[n]={get:function(e,r){return r?(r=Wt(e,n),Yt.test(r)?x(e).position()[n]+"px":r):t}}})}),x.expr&&x.expr.filters&&(x.expr.filters.hidden=function(e){return 0>=e.offsetWidth&&0>=e.offsetHeight||!x.support.reliableHiddenOffsets&&"none"===(e.style&&e.style.display||x.css(e,"display"))},x.expr.filters.visible=function(e){return!x.expr.filters.hidden(e)}),x.each({margin:"",padding:"",border:"Width"},function(e,t){x.cssHooks[e+t]={expand:function(n){var r=0,i={},o="string"==typeof n?n.split(" "):[n];for(;4>r;r++)i[e+Zt[r]+t]=o[r]||o[r-2]||o[0];return i}},Ut.test(e)||(x.cssHooks[e+t].set=on)});var cn=/%20/g,pn=/\[\]$/,fn=/\r?\n/g,dn=/^(?:submit|button|image|reset|file)$/i,hn=/^(?:input|select|textarea|keygen)/i;x.fn.extend({serialize:function(){return x.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=x.prop(this,"elements");return e?x.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!x(this).is(":disabled")&&hn.test(this.nodeName)&&!dn.test(e)&&(this.checked||!Ct.test(e))}).map(function(e,t){var n=x(this).val();return null==n?null:x.isArray(n)?x.map(n,function(e){return{name:t.name,value:e.replace(fn,"\r\n")}}):{name:t.name,value:n.replace(fn,"\r\n")}}).get()}}),x.param=function(e,n){var r,i=[],o=function(e,t){t=x.isFunction(t)?t():null==t?"":t,i[i.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};if(n===t&&(n=x.ajaxSettings&&x.ajaxSettings.traditional),x.isArray(e)||e.jquery&&!x.isPlainObject(e))x.each(e,function(){o(this.name,this.value)});else for(r in e)gn(r,e[r],n,o);return i.join("&").replace(cn,"+")};function gn(e,t,n,r){var i;if(x.isArray(t))x.each(t,function(t,i){n||pn.test(e)?r(e,i):gn(e+"["+("object"==typeof i?t:"")+"]",i,n,r)});else if(n||"object"!==x.type(t))r(e,t);else for(i in t)gn(e+"["+i+"]",t[i],n,r)}x.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){x.fn[t]=function(e,n){return arguments.length>0?this.on(t,null,e,n):this.trigger(t)}}),x.fn.extend({hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return 1===arguments.length?this.off(e,"**"):this.off(t,e||"**",n)}});var mn,yn,vn=x.now(),bn=/\?/,xn=/#.*$/,wn=/([?&])_=[^&]*/,Tn=/^(.*?):[ \t]*([^\r\n]*)\r?$/gm,Cn=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Nn=/^(?:GET|HEAD)$/,kn=/^\/\//,En=/^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,Sn=x.fn.load,An={},jn={},Dn="*/".concat("*");try{yn=o.href}catch(Ln){yn=a.createElement("a"),yn.href="",yn=yn.href}mn=En.exec(yn.toLowerCase())||[];function Hn(e){return function(t,n){"string"!=typeof t&&(n=t,t="*");var r,i=0,o=t.toLowerCase().match(T)||[];if(x.isFunction(n))while(r=o[i++])"+"===r[0]?(r=r.slice(1)||"*",(e[r]=e[r]||[]).unshift(n)):(e[r]=e[r]||[]).push(n)}}function qn(e,n,r,i){var o={},a=e===jn;function s(l){var u;return o[l]=!0,x.each(e[l]||[],function(e,l){var c=l(n,r,i);return"string"!=typeof c||a||o[c]?a?!(u=c):t:(n.dataTypes.unshift(c),s(c),!1)}),u}return s(n.dataTypes[0])||!o["*"]&&s("*")}function _n(e,n){var r,i,o=x.ajaxSettings.flatOptions||{};for(i in n)n[i]!==t&&((o[i]?e:r||(r={}))[i]=n[i]);return r&&x.extend(!0,e,r),e}x.fn.load=function(e,n,r){if("string"!=typeof e&&Sn)return Sn.apply(this,arguments);var i,o,a,s=this,l=e.indexOf(" ");return l>=0&&(i=e.slice(l,e.length),e=e.slice(0,l)),x.isFunction(n)?(r=n,n=t):n&&"object"==typeof n&&(a="POST"),s.length>0&&x.ajax({url:e,type:a,dataType:"html",data:n}).done(function(e){o=arguments,s.html(i?x("<div>").append(x.parseHTML(e)).find(i):e)}).complete(r&&function(e,t){s.each(r,o||[e.responseText,t,e])}),this},x.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){x.fn[t]=function(e){return this.on(t,e)}}),x.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:yn,type:"GET",isLocal:Cn.test(mn[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Dn,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":x.parseJSON,"text xml":x.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?_n(_n(e,x.ajaxSettings),t):_n(x.ajaxSettings,e)},ajaxPrefilter:Hn(An),ajaxTransport:Hn(jn),ajax:function(e,n){"object"==typeof e&&(n=e,e=t),n=n||{};var r,i,o,a,s,l,u,c,p=x.ajaxSetup({},n),f=p.context||p,d=p.context&&(f.nodeType||f.jquery)?x(f):x.event,h=x.Deferred(),g=x.Callbacks("once memory"),m=p.statusCode||{},y={},v={},b=0,w="canceled",C={readyState:0,getResponseHeader:function(e){var t;if(2===b){if(!c){c={};while(t=Tn.exec(a))c[t[1].toLowerCase()]=t[2]}t=c[e.toLowerCase()]}return null==t?null:t},getAllResponseHeaders:function(){return 2===b?a:null},setRequestHeader:function(e,t){var n=e.toLowerCase();return b||(e=v[n]=v[n]||e,y[e]=t),this},overrideMimeType:function(e){return b||(p.mimeType=e),this},statusCode:function(e){var t;if(e)if(2>b)for(t in e)m[t]=[m[t],e[t]];else C.always(e[C.status]);return this},abort:function(e){var t=e||w;return u&&u.abort(t),k(0,t),this}};if(h.promise(C).complete=g.add,C.success=C.done,C.error=C.fail,p.url=((e||p.url||yn)+"").replace(xn,"").replace(kn,mn[1]+"//"),p.type=n.method||n.type||p.method||p.type,p.dataTypes=x.trim(p.dataType||"*").toLowerCase().match(T)||[""],null==p.crossDomain&&(r=En.exec(p.url.toLowerCase()),p.crossDomain=!(!r||r[1]===mn[1]&&r[2]===mn[2]&&(r[3]||("http:"===r[1]?"80":"443"))===(mn[3]||("http:"===mn[1]?"80":"443")))),p.data&&p.processData&&"string"!=typeof p.data&&(p.data=x.param(p.data,p.traditional)),qn(An,p,n,C),2===b)return C;l=p.global,l&&0===x.active++&&x.event.trigger("ajaxStart"),p.type=p.type.toUpperCase(),p.hasContent=!Nn.test(p.type),o=p.url,p.hasContent||(p.data&&(o=p.url+=(bn.test(o)?"&":"?")+p.data,delete p.data),p.cache===!1&&(p.url=wn.test(o)?o.replace(wn,"$1_="+vn++):o+(bn.test(o)?"&":"?")+"_="+vn++)),p.ifModified&&(x.lastModified[o]&&C.setRequestHeader("If-Modified-Since",x.lastModified[o]),x.etag[o]&&C.setRequestHeader("If-None-Match",x.etag[o])),(p.data&&p.hasContent&&p.contentType!==!1||n.contentType)&&C.setRequestHeader("Content-Type",p.contentType),C.setRequestHeader("Accept",p.dataTypes[0]&&p.accepts[p.dataTypes[0]]?p.accepts[p.dataTypes[0]]+("*"!==p.dataTypes[0]?", "+Dn+"; q=0.01":""):p.accepts["*"]);for(i in p.headers)C.setRequestHeader(i,p.headers[i]);if(p.beforeSend&&(p.beforeSend.call(f,C,p)===!1||2===b))return C.abort();w="abort";for(i in{success:1,error:1,complete:1})C[i](p[i]);if(u=qn(jn,p,n,C)){C.readyState=1,l&&d.trigger("ajaxSend",[C,p]),p.async&&p.timeout>0&&(s=setTimeout(function(){C.abort("timeout")},p.timeout));try{b=1,u.send(y,k)}catch(N){if(!(2>b))throw N;k(-1,N)}}else k(-1,"No Transport");function k(e,n,r,i){var c,y,v,w,T,N=n;2!==b&&(b=2,s&&clearTimeout(s),u=t,a=i||"",C.readyState=e>0?4:0,c=e>=200&&300>e||304===e,r&&(w=Mn(p,C,r)),w=On(p,w,C,c),c?(p.ifModified&&(T=C.getResponseHeader("Last-Modified"),T&&(x.lastModified[o]=T),T=C.getResponseHeader("etag"),T&&(x.etag[o]=T)),204===e||"HEAD"===p.type?N="nocontent":304===e?N="notmodified":(N=w.state,y=w.data,v=w.error,c=!v)):(v=N,(e||!N)&&(N="error",0>e&&(e=0))),C.status=e,C.statusText=(n||N)+"",c?h.resolveWith(f,[y,N,C]):h.rejectWith(f,[C,N,v]),C.statusCode(m),m=t,l&&d.trigger(c?"ajaxSuccess":"ajaxError",[C,p,c?y:v]),g.fireWith(f,[C,N]),l&&(d.trigger("ajaxComplete",[C,p]),--x.active||x.event.trigger("ajaxStop")))}return C},getJSON:function(e,t,n){return x.get(e,t,n,"json")},getScript:function(e,n){return x.get(e,t,n,"script")}}),x.each(["get","post"],function(e,n){x[n]=function(e,r,i,o){return x.isFunction(r)&&(o=o||i,i=r,r=t),x.ajax({url:e,type:n,dataType:o,data:r,success:i})}});function Mn(e,n,r){var i,o,a,s,l=e.contents,u=e.dataTypes;while("*"===u[0])u.shift(),o===t&&(o=e.mimeType||n.getResponseHeader("Content-Type"));if(o)for(s in l)if(l[s]&&l[s].test(o)){u.unshift(s);break}if(u[0]in r)a=u[0];else{for(s in r){if(!u[0]||e.converters[s+" "+u[0]]){a=s;break}i||(i=s)}a=a||i}return a?(a!==u[0]&&u.unshift(a),r[a]):t}function On(e,t,n,r){var i,o,a,s,l,u={},c=e.dataTypes.slice();if(c[1])for(a in e.converters)u[a.toLowerCase()]=e.converters[a];o=c.shift();while(o)if(e.responseFields[o]&&(n[e.responseFields[o]]=t),!l&&r&&e.dataFilter&&(t=e.dataFilter(t,e.dataType)),l=o,o=c.shift())if("*"===o)o=l;else if("*"!==l&&l!==o){if(a=u[l+" "+o]||u["* "+o],!a)for(i in u)if(s=i.split(" "),s[1]===o&&(a=u[l+" "+s[0]]||u["* "+s[0]])){a===!0?a=u[i]:u[i]!==!0&&(o=s[0],c.unshift(s[1]));break}if(a!==!0)if(a&&e["throws"])t=a(t);else try{t=a(t)}catch(p){return{state:"parsererror",error:a?p:"No conversion from "+l+" to "+o}}}return{state:"success",data:t}}x.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(e){return x.globalEval(e),e}}}),x.ajaxPrefilter("script",function(e){e.cache===t&&(e.cache=!1),e.crossDomain&&(e.type="GET",e.global=!1)}),x.ajaxTransport("script",function(e){if(e.crossDomain){var n,r=a.head||x("head")[0]||a.documentElement;return{send:function(t,i){n=a.createElement("script"),n.async=!0,e.scriptCharset&&(n.charset=e.scriptCharset),n.src=e.url,n.onload=n.onreadystatechange=function(e,t){(t||!n.readyState||/loaded|complete/.test(n.readyState))&&(n.onload=n.onreadystatechange=null,n.parentNode&&n.parentNode.removeChild(n),n=null,t||i(200,"success"))},r.insertBefore(n,r.firstChild)},abort:function(){n&&n.onload(t,!0)}}}});var Fn=[],Bn=/(=)\?(?=&|$)|\?\?/;x.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=Fn.pop()||x.expando+"_"+vn++;return this[e]=!0,e}}),x.ajaxPrefilter("json jsonp",function(n,r,i){var o,a,s,l=n.jsonp!==!1&&(Bn.test(n.url)?"url":"string"==typeof n.data&&!(n.contentType||"").indexOf("application/x-www-form-urlencoded")&&Bn.test(n.data)&&"data");return l||"jsonp"===n.dataTypes[0]?(o=n.jsonpCallback=x.isFunction(n.jsonpCallback)?n.jsonpCallback():n.jsonpCallback,l?n[l]=n[l].replace(Bn,"$1"+o):n.jsonp!==!1&&(n.url+=(bn.test(n.url)?"&":"?")+n.jsonp+"="+o),n.converters["script json"]=function(){return s||x.error(o+" was not called"),s[0]},n.dataTypes[0]="json",a=e[o],e[o]=function(){s=arguments},i.always(function(){e[o]=a,n[o]&&(n.jsonpCallback=r.jsonpCallback,Fn.push(o)),s&&x.isFunction(a)&&a(s[0]),s=a=t}),"script"):t});var Pn,Rn,Wn=0,$n=e.ActiveXObject&&function(){var e;for(e in Pn)Pn[e](t,!0)};function In(){try{return new e.XMLHttpRequest}catch(t){}}function zn(){try{return new e.ActiveXObject("Microsoft.XMLHTTP")}catch(t){}}x.ajaxSettings.xhr=e.ActiveXObject?function(){return!this.isLocal&&In()||zn()}:In,Rn=x.ajaxSettings.xhr(),x.support.cors=!!Rn&&"withCredentials"in Rn,Rn=x.support.ajax=!!Rn,Rn&&x.ajaxTransport(function(n){if(!n.crossDomain||x.support.cors){var r;return{send:function(i,o){var a,s,l=n.xhr();if(n.username?l.open(n.type,n.url,n.async,n.username,n.password):l.open(n.type,n.url,n.async),n.xhrFields)for(s in n.xhrFields)l[s]=n.xhrFields[s];n.mimeType&&l.overrideMimeType&&l.overrideMimeType(n.mimeType),n.crossDomain||i["X-Requested-With"]||(i["X-Requested-With"]="XMLHttpRequest");try{for(s in i)l.setRequestHeader(s,i[s])}catch(u){}l.send(n.hasContent&&n.data||null),r=function(e,i){var s,u,c,p;try{if(r&&(i||4===l.readyState))if(r=t,a&&(l.onreadystatechange=x.noop,$n&&delete Pn[a]),i)4!==l.readyState&&l.abort();else{p={},s=l.status,u=l.getAllResponseHeaders(),"string"==typeof l.responseText&&(p.text=l.responseText);try{c=l.statusText}catch(f){c=""}s||!n.isLocal||n.crossDomain?1223===s&&(s=204):s=p.text?200:404}}catch(d){i||o(-1,d)}p&&o(s,c,p,u)},n.async?4===l.readyState?setTimeout(r):(a=++Wn,$n&&(Pn||(Pn={},x(e).unload($n)),Pn[a]=r),l.onreadystatechange=r):r()},abort:function(){r&&r(t,!0)}}}});var Xn,Un,Vn=/^(?:toggle|show|hide)$/,Yn=RegExp("^(?:([+-])=|)("+w+")([a-z%]*)$","i"),Jn=/queueHooks$/,Gn=[nr],Qn={"*":[function(e,t){var n=this.createTween(e,t),r=n.cur(),i=Yn.exec(t),o=i&&i[3]||(x.cssNumber[e]?"":"px"),a=(x.cssNumber[e]||"px"!==o&&+r)&&Yn.exec(x.css(n.elem,e)),s=1,l=20;if(a&&a[3]!==o){o=o||a[3],i=i||[],a=+r||1;do s=s||".5",a/=s,x.style(n.elem,e,a+o);while(s!==(s=n.cur()/r)&&1!==s&&--l)}return i&&(a=n.start=+a||+r||0,n.unit=o,n.end=i[1]?a+(i[1]+1)*i[2]:+i[2]),n}]};function Kn(){return setTimeout(function(){Xn=t}),Xn=x.now()}function Zn(e,t,n){var r,i=(Qn[t]||[]).concat(Qn["*"]),o=0,a=i.length;for(;a>o;o++)if(r=i[o].call(n,t,e))return r}function er(e,t,n){var r,i,o=0,a=Gn.length,s=x.Deferred().always(function(){delete l.elem}),l=function(){if(i)return!1;var t=Xn||Kn(),n=Math.max(0,u.startTime+u.duration-t),r=n/u.duration||0,o=1-r,a=0,l=u.tweens.length;for(;l>a;a++)u.tweens[a].run(o);return s.notifyWith(e,[u,o,n]),1>o&&l?n:(s.resolveWith(e,[u]),!1)},u=s.promise({elem:e,props:x.extend({},t),opts:x.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:Xn||Kn(),duration:n.duration,tweens:[],createTween:function(t,n){var r=x.Tween(e,u.opts,t,n,u.opts.specialEasing[t]||u.opts.easing);return u.tweens.push(r),r},stop:function(t){var n=0,r=t?u.tweens.length:0;if(i)return this;for(i=!0;r>n;n++)u.tweens[n].run(1);return t?s.resolveWith(e,[u,t]):s.rejectWith(e,[u,t]),this}}),c=u.props;for(tr(c,u.opts.specialEasing);a>o;o++)if(r=Gn[o].call(u,e,c,u.opts))return r;return x.map(c,Zn,u),x.isFunction(u.opts.start)&&u.opts.start.call(e,u),x.fx.timer(x.extend(l,{elem:e,anim:u,queue:u.opts.queue})),u.progress(u.opts.progress).done(u.opts.done,u.opts.complete).fail(u.opts.fail).always(u.opts.always)}function tr(e,t){var n,r,i,o,a;for(n in e)if(r=x.camelCase(n),i=t[r],o=e[n],x.isArray(o)&&(i=o[1],o=e[n]=o[0]),n!==r&&(e[r]=o,delete e[n]),a=x.cssHooks[r],a&&"expand"in a){o=a.expand(o),delete e[r];for(n in o)n in e||(e[n]=o[n],t[n]=i)}else t[r]=i}x.Animation=x.extend(er,{tweener:function(e,t){x.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;i>r;r++)n=e[r],Qn[n]=Qn[n]||[],Qn[n].unshift(t)},prefilter:function(e,t){t?Gn.unshift(e):Gn.push(e)}});function nr(e,t,n){var r,i,o,a,s,l,u=this,c={},p=e.style,f=e.nodeType&&nn(e),d=x._data(e,"fxshow");n.queue||(s=x._queueHooks(e,"fx"),null==s.unqueued&&(s.unqueued=0,l=s.empty.fire,s.empty.fire=function(){s.unqueued||l()}),s.unqueued++,u.always(function(){u.always(function(){s.unqueued--,x.queue(e,"fx").length||s.empty.fire()})})),1===e.nodeType&&("height"in t||"width"in t)&&(n.overflow=[p.overflow,p.overflowX,p.overflowY],"inline"===x.css(e,"display")&&"none"===x.css(e,"float")&&(x.support.inlineBlockNeedsLayout&&"inline"!==ln(e.nodeName)?p.zoom=1:p.display="inline-block")),n.overflow&&(p.overflow="hidden",x.support.shrinkWrapBlocks||u.always(function(){p.overflow=n.overflow[0],p.overflowX=n.overflow[1],p.overflowY=n.overflow[2]}));for(r in t)if(i=t[r],Vn.exec(i)){if(delete t[r],o=o||"toggle"===i,i===(f?"hide":"show"))continue;c[r]=d&&d[r]||x.style(e,r)}if(!x.isEmptyObject(c)){d?"hidden"in d&&(f=d.hidden):d=x._data(e,"fxshow",{}),o&&(d.hidden=!f),f?x(e).show():u.done(function(){x(e).hide()}),u.done(function(){var t;x._removeData(e,"fxshow");for(t in c)x.style(e,t,c[t])});for(r in c)a=Zn(f?d[r]:0,r,u),r in d||(d[r]=a.start,f&&(a.end=a.start,a.start="width"===r||"height"===r?1:0))}}function rr(e,t,n,r,i){return new rr.prototype.init(e,t,n,r,i)}x.Tween=rr,rr.prototype={constructor:rr,init:function(e,t,n,r,i,o){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=o||(x.cssNumber[n]?"":"px")},cur:function(){var e=rr.propHooks[this.prop];return e&&e.get?e.get(this):rr.propHooks._default.get(this)},run:function(e){var t,n=rr.propHooks[this.prop];return this.pos=t=this.options.duration?x.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):rr.propHooks._default.set(this),this}},rr.prototype.init.prototype=rr.prototype,rr.propHooks={_default:{get:function(e){var t;return null==e.elem[e.prop]||e.elem.style&&null!=e.elem.style[e.prop]?(t=x.css(e.elem,e.prop,""),t&&"auto"!==t?t:0):e.elem[e.prop]},set:function(e){x.fx.step[e.prop]?x.fx.step[e.prop](e):e.elem.style&&(null!=e.elem.style[x.cssProps[e.prop]]||x.cssHooks[e.prop])?x.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},rr.propHooks.scrollTop=rr.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},x.each(["toggle","show","hide"],function(e,t){var n=x.fn[t];x.fn[t]=function(e,r,i){return null==e||"boolean"==typeof e?n.apply(this,arguments):this.animate(ir(t,!0),e,r,i)}}),x.fn.extend({fadeTo:function(e,t,n,r){return this.filter(nn).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=x.isEmptyObject(e),o=x.speed(t,n,r),a=function(){var t=er(this,x.extend({},e),o);(i||x._data(this,"finish"))&&t.stop(!0)};return a.finish=a,i||o.queue===!1?this.each(a):this.queue(o.queue,a)},stop:function(e,n,r){var i=function(e){var t=e.stop;delete e.stop,t(r)};return"string"!=typeof e&&(r=n,n=e,e=t),n&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,n=null!=e&&e+"queueHooks",o=x.timers,a=x._data(this);if(n)a[n]&&a[n].stop&&i(a[n]);else for(n in a)a[n]&&a[n].stop&&Jn.test(n)&&i(a[n]);for(n=o.length;n--;)o[n].elem!==this||null!=e&&o[n].queue!==e||(o[n].anim.stop(r),t=!1,o.splice(n,1));(t||!r)&&x.dequeue(this,e)})},finish:function(e){return e!==!1&&(e=e||"fx"),this.each(function(){var t,n=x._data(this),r=n[e+"queue"],i=n[e+"queueHooks"],o=x.timers,a=r?r.length:0;for(n.finish=!0,x.queue(this,e,[]),i&&i.stop&&i.stop.call(this,!0),t=o.length;t--;)o[t].elem===this&&o[t].queue===e&&(o[t].anim.stop(!0),o.splice(t,1));for(t=0;a>t;t++)r[t]&&r[t].finish&&r[t].finish.call(this);delete n.finish})}});function ir(e,t){var n,r={height:e},i=0;for(t=t?1:0;4>i;i+=2-t)n=Zt[i],r["margin"+n]=r["padding"+n]=e;return t&&(r.opacity=r.width=e),r}x.each({slideDown:ir("show"),slideUp:ir("hide"),slideToggle:ir("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){x.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),x.speed=function(e,t,n){var r=e&&"object"==typeof e?x.extend({},e):{complete:n||!n&&t||x.isFunction(e)&&e,duration:e,easing:n&&t||t&&!x.isFunction(t)&&t};return r.duration=x.fx.off?0:"number"==typeof r.duration?r.duration:r.duration in x.fx.speeds?x.fx.speeds[r.duration]:x.fx.speeds._default,(null==r.queue||r.queue===!0)&&(r.queue="fx"),r.old=r.complete,r.complete=function(){x.isFunction(r.old)&&r.old.call(this),r.queue&&x.dequeue(this,r.queue)},r},x.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},x.timers=[],x.fx=rr.prototype.init,x.fx.tick=function(){var e,n=x.timers,r=0;for(Xn=x.now();n.length>r;r++)e=n[r],e()||n[r]!==e||n.splice(r--,1);n.length||x.fx.stop(),Xn=t},x.fx.timer=function(e){e()&&x.timers.push(e)&&x.fx.start()},x.fx.interval=13,x.fx.start=function(){Un||(Un=setInterval(x.fx.tick,x.fx.interval))},x.fx.stop=function(){clearInterval(Un),Un=null},x.fx.speeds={slow:600,fast:200,_default:400},x.fx.step={},x.expr&&x.expr.filters&&(x.expr.filters.animated=function(e){return x.grep(x.timers,function(t){return e===t.elem}).length}),x.fn.offset=function(e){if(arguments.length)return e===t?this:this.each(function(t){x.offset.setOffset(this,e,t)});var n,r,o={top:0,left:0},a=this[0],s=a&&a.ownerDocument;if(s)return n=s.documentElement,x.contains(n,a)?(typeof a.getBoundingClientRect!==i&&(o=a.getBoundingClientRect()),r=or(s),{top:o.top+(r.pageYOffset||n.scrollTop)-(n.clientTop||0),left:o.left+(r.pageXOffset||n.scrollLeft)-(n.clientLeft||0)}):o},x.offset={setOffset:function(e,t,n){var r=x.css(e,"position");"static"===r&&(e.style.position="relative");var i=x(e),o=i.offset(),a=x.css(e,"top"),s=x.css(e,"left"),l=("absolute"===r||"fixed"===r)&&x.inArray("auto",[a,s])>-1,u={},c={},p,f;l?(c=i.position(),p=c.top,f=c.left):(p=parseFloat(a)||0,f=parseFloat(s)||0),x.isFunction(t)&&(t=t.call(e,n,o)),null!=t.top&&(u.top=t.top-o.top+p),null!=t.left&&(u.left=t.left-o.left+f),"using"in t?t.using.call(e,u):i.css(u)}},x.fn.extend({position:function(){if(this[0]){var e,t,n={top:0,left:0},r=this[0];return"fixed"===x.css(r,"position")?t=r.getBoundingClientRect():(e=this.offsetParent(),t=this.offset(),x.nodeName(e[0],"html")||(n=e.offset()),n.top+=x.css(e[0],"borderTopWidth",!0),n.left+=x.css(e[0],"borderLeftWidth",!0)),{top:t.top-n.top-x.css(r,"marginTop",!0),left:t.left-n.left-x.css(r,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||s;while(e&&!x.nodeName(e,"html")&&"static"===x.css(e,"position"))e=e.offsetParent;return e||s})}}),x.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,n){var r=/Y/.test(n);x.fn[e]=function(i){return x.access(this,function(e,i,o){var a=or(e);return o===t?a?n in a?a[n]:a.document.documentElement[i]:e[i]:(a?a.scrollTo(r?x(a).scrollLeft():o,r?o:x(a).scrollTop()):e[i]=o,t)},e,i,arguments.length,null)}});function or(e){return x.isWindow(e)?e:9===e.nodeType?e.defaultView||e.parentWindow:!1}x.each({Height:"height",Width:"width"},function(e,n){x.each({padding:"inner"+e,content:n,"":"outer"+e},function(r,i){x.fn[i]=function(i,o){var a=arguments.length&&(r||"boolean"!=typeof i),s=r||(i===!0||o===!0?"margin":"border");return x.access(this,function(n,r,i){var o;return x.isWindow(n)?n.document.documentElement["client"+e]:9===n.nodeType?(o=n.documentElement,Math.max(n.body["scroll"+e],o["scroll"+e],n.body["offset"+e],o["offset"+e],o["client"+e])):i===t?x.css(n,r,s):x.style(n,r,i,s)},n,a?i:t,a,null)}})}),x.fn.size=function(){return this.length},x.fn.andSelf=x.fn.addBack,"object"==typeof module&&module&&"object"==typeof module.exports?module.exports=x:(e.jQuery=e.$=x,"function"==typeof define&&define.amd&&define("jquery",[],function(){return x}))})(window);

/* jquery.dropotron.js v1.4.2 | (c) n33 | n33.co | MIT licensed */
(function(e){var t="openerActiveClass",n="left",r="doCollapseAll",i="position",s="trigger",o="disableSelection_dropotron",u="addClass",a="doCollapse",f=!1,l="outerWidth",c="removeClass",h="preventDefault",p="dropotron",d="clearTimeout",v="length",m="right",g="speed",y=!0,b="parent",w="none",E="stopPropagation",S=":visible",x="absolute",T="click",N="doExpand",C="css",k="center",L="toggle",A="baseZIndex",O="offsetX",M="alignment",_="children",D="submenuClassPrefix",P="doToggle",H="hover",B="ul",j="relative",F="opacity",I="z-index",q="opener",R="find",U="px",z=null,W="fadeTo",X="offset";e.fn[o]=function(){return e(this)[C]("user-select",w)[C]("-khtml-user-select",w)[C]("-moz-user-select",w)[C]("-o-user-select",w)[C]("-webkit-user-select",w)},e.fn[p]=function(t){var n;if(this[v]>1)for(n=0;n<this[v];n++)e(this[n])[p](t);return e[p](e.extend({selectorParent:e(this)},t))},e[p]=function(w){var et=e.extend({selectorParent:z,baseZIndex:1e3,menuClass:p,expandMode:H,hoverDelay:150,hideDelay:250,openerClass:q,openerActiveClass:"active",submenuClassPrefix:"level-",mode:"fade",speed:"fast",easing:"swing",alignment:n,offsetX:0,offsetY:0,globalOffsetY:0,IEOffsetX:0,IEOffsetY:0,noOpenerFade:y,detach:y,cloneOnDetach:y},w),tt=et.selectorParent,nt=tt[R](B),rt=e("body"),it=e(window),st=f,ot=z,ut=z;tt.on(r,function(){nt[s](a)}),nt.each(function(){var r=e(this),p=r[b]();et.hideDelay>0&&r.add(p).on("mouseleave",function(){window[d](ut),ut=window.setTimeout(function(){r[s](a)},et.hideDelay)}),r[o]().hide()[u](et.menuClass)[C](i,x).on("mouseenter",function(){window[d](ut)}).on(N,function(){var o,h,v,w,E,T,N,_,D,P,H;if(r.is(S))return f;window[d](ut),nt.each(function(){var t=e(this);e.contains(t.get(0),p.get(0))||t[s](a)}),o=p[X](),h=p[i](),v=p[b]()[i](),w=p[l](),E=r[l](),T=r[C](I)==et[A];if(T){et.detach?N=o:N=h,P=N.top+p.outerHeight()+et.globalOffsetY,_=et[M],r[c](n)[c](m)[c](k);switch(et[M]){case m:D=N[n]-E+w,D<0&&(D=N[n],_=n);break;case k:D=N[n]-Math.floor((E-w)/2),D<0?(D=N[n],_=n):D+E>it.width()&&(D=N[n]-E+w,_=m);break;case n:default:D=N[n],D+E>it.width()&&(D=N[n]-E+w,_=m)}r[u](_)}else{p[C](i)==j||p[C](i)==x?(P=et.offsetY,D=-1*h[n]):(P=h.top+et.offsetY,D=0);switch(et[M]){case m:D+=-1*p[b]()[l]()+et[O];break;case k:case n:default:D+=p[b]()[l]()+et[O]}}navigator.userAgent.match(/MSIE ([0-9]+)\./)&&RegExp.$1<8&&(D+=et.IEOffsetX,P+=et.IEOffsetY),r[C](n,D+U)[C]("top",P+U),r[C](F,"0.01").show(),H=f,p[C](i)==j||p[C](i)==x?D=-1*h[n]:D=0,r[X]()[n]<0?(D+=p[b]()[l]()-et[O],H=y):r[X]()[n]+E>it.width()&&(D+=-1*p[b]()[l]()-et[O],H=y),H&&r[C](n,D+U),r.hide()[C](F,"1");switch(et.mode){case"zoom":st=y,p[u](et[t]),r.animate({width:L,height:L},et[g],et.easing,function(){st=f});break;case"slide":st=y,p[u](et[t]),r.animate({height:L},et[g],et.easing,function(){st=f});break;case"fade":st=y,T&&!et.noOpenerFade?(et[g]=="slow"?H=80:et[g]=="fast"?H=40:H=Math.floor(et[g]/2),p[W](H,.01,function(){p[u](et[t]),p[W](et[g],1),r.fadeIn(et[g],function(){st=f})})):(p[u](et[t]),p[W](et[g],1),r.fadeIn(et[g],function(){st=f}));break;case"instant":default:p[u](et[t]),r.show()}return f}).on(a,function(){return r.is(S)?(r.hide(),p[c](et[t]),r[R]("."+et[t])[c](et[t]),r[R](B).hide(),f):f}).on(P,function(){return r.is(S)?r[s](a):r[s](N),f}),p[o]()[u](q)[C]("cursor","pointer").on(T,function(e){if(st)return;e[h](),e[E](),r[s](P)}),et.expandMode==H&&p[H](function(){if(st)return;ot=window.setTimeout(function(){r[s](N)},et.hoverDelay)},function(){window[d](ot)})}),nt[R]("a")[C]("display","block").on(T,function(t){if(st)return;e(this).attr("href")[v]<1&&t[h]()}),tt[R]("li")[C]("white-space","nowrap").each(function(){var t=e(this),n=t[_]("a"),i=t[_](B);n.on(T,function(t){e(this).attr("href")[v]<1?t[h]():t[E]()}),n[v]>0&&i[v]==0&&t.on(T,function(e){if(st)return;tt[s](r),e[E]()})}),tt[_]("li").each(function(){var t,n,r,i,s=e(this),o=s[_](B);if(o[v]>0){et.detach&&(et.cloneOnDetach&&(t=o.clone(),t.attr("class","").hide().appendTo(o[b]())),o.detach().appendTo(rt));for(n=et[A],r=1,i=o;i[v]>0;r++)i[C](I,n++),et[D]&&i[u](et[D]+(n-1-et[A])),i=i[R]("> li > ul")}}),it.on("scroll",function(){tt[s](r)}).on("keypress",function(e){!st&&e.keyCode==27&&(e[h](),tt[s](r))}),rt.on(T,function(){st||tt[s](r)})}})(jQuery);
/* skel.js v1.0 | (c) n33 | n33.co | MIT licensed */
var skel=function(){var e="breakpoints",t="config",n="iterate",r="stateId",i="elements",s="getElementsByClassName",o="stateElements",u=!1,a="getElementsByTagName",f="length",l="parentNode",c=null,h="insertBefore",p="push",d="getCachedElement",v="className",m="newInline",g="config_breakpoint",y="orientationChange",b="locations",w="createElement",E="match",S="deviceType",x="newElement",T="substring",N="object",C=!0,k="viewport",L="cache",A="cacheElement",O="_skel_isReversed",M="head",_="!important",D="indexOf",P="vars",H="containers",B="replace",j="matchesMedia",F="extend",I="events",q="}",R=" 0 0 ",U="onorientationchange",z="isArray",W="DOMReady",X="skel-placeholder-breakpoint",V="addEventListener",$="getComputedStyle",J="^head",K="{display:none!important}",Q="parseMeasurement",G="hasOwnProperty",Y="padding-top:0!important",Z="registerLocation",et="defaults",tt="IEVersion",nt="documentElement",rt="attachElements",it="attachElement",st="change",ot="DOMContentLoaded",ut="text/css",at="initial-scale=1",ft="_skel_attach",lt="firstChild",ct="states",ht="placeholder",pt="removeEventListener",dt="applyRowTransforms",vt="resize",mt="(min-width: ",gt="attached",yt="padding-top:",bt=".row",wt="media",Et="forceDefaultState",St="_skel_placeholder",xt="collapse",Tt="html",Nt="nextSibling",Ct="querySelectorAll",kt="min-height",Lt="max-height",At="gutters",Ot="max-width",Mt="innerHTML",_t="min-width",Dt="prototype",Pt="padding:",Ht="domready",Bt="isStatic",jt=".\\3$1 ",Ft="href",It="readyState",qt="priority",Rt="android",Ut="onresize",zt={breakpoints:[],breakpointList:[],cache:{elements:{},states:{},stateElements:{}},config:{breakpoints:{"skel-placeholder-breakpoint":{href:u,media:""}},containers:960,defaultState:c,events:{},grid:{collapse:u,gutters:40},pollOnce:u,preload:u,reset:u,RTL:u,viewport:{width:"device-width"}},css:{bm:"*,*:before,*:after{-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}",n:'article,aside,details,figcaption,figure,footer,header,hgroup,main,nav,section,summary{display:block}audio,canvas,video{display:inline-block}audio:not([controls]){display:none;height:0}[hidden],template{display:none}html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}a{background:transparent}a:focus{outline:thin dotted}a:active,a:hover{outline:0}h1{font-size:2em;margin:.67em 0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:bold}dfn{font-style:italic}hr{-moz-box-sizing:content-box;box-sizing:content-box;height:0}mark{background:#ff0;color:#000}code,kbd,pre,samp{font-family:monospace,serif;font-size:1em}pre{white-space:pre-wrap}q{quotes:"C" "D" "8" "9"}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-0.5em}sub{bottom:-0.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:0}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0;padding:0}button,input,select,textarea{font-family:inherit;font-size:100%;margin:0}button,input{line-height:normal}button,select{text-transform:none}button,html input[type="button"],input[type="reset"],input[type="submit"]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}input[type="checkbox"],input[type="radio"]{box-sizing:border-box;padding:0}input[type="search"]{-webkit-appearance:textfield;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;box-sizing:content-box}input[type="search"]::-webkit-search-cancel-button,input[type="search"]::-webkit-search-decoration{-webkit-appearance:none}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}textarea{overflow:auto;vertical-align:top}table{border-collapse:collapse;border-spacing:0}',r:"html,body,div,span,applet,object,iframe,h1,h2,h3,h4,h5,h6,p,blockquote,pre,a,abbr,acronym,address,big,cite,code,del,dfn,em,img,ins,kbd,q,s,samp,small,strike,strong,sub,sup,tt,var,b,u,i,center,dl,dt,dd,ol,ul,li,fieldset,form,label,legend,table,caption,tbody,tfoot,thead,tr,th,td,article,aside,canvas,details,embed,figure,figcaption,footer,header,hgroup,menu,nav,output,ruby,section,summary,time,mark,audio,video{margin:0;padding:0;border:0;font-size:100%;font:inherit;vertical-align:baseline}article,aside,details,figcaption,figure,footer,header,hgroup,menu,nav,section{display:block}body{line-height:1}ol,ul{list-style:none}blockquote,q{quotes:none}blockquote:before,blockquote:after,q:before,q:after{content:'';content:none}table{border-collapse:collapse;border-spacing:0}body{-webkit-text-size-adjust:none}"},defaults:{breakpoint:{config:c,elements:c,test:c},config_breakpoint:{containers:"100%",grid:{},href:u,media:"",viewport:{}}},events:[],forceDefaultState:u,isInit:u,isStatic:u,locations:{body:c,head:c,html:c},me:c,plugins:{},sd:"/",stateId:"",vars:{},DOMReady:c,getElementsByClassName:c,indexOf:c,isArray:c,iterate:c,matchesMedia:c,extend:function(e,t){var r;zt[n](t,function(n){zt[z](t[n])?(zt[z](e[n])||(e[n]=[]),zt[F](e[n],t[n])):typeof t[n]==N?(typeof e[n]!=N&&(e[n]={}),zt[F](e[n],t[n])):e[n]=t[n]})},getArray:function(e){return zt[z](e)?e:[e]},getLevel:function(e){return typeof e=="boolean"?e?100:0:parseInt(e)},parseMeasurement:function(e){var t,n;if(typeof e!="string")t=[e,"px"];else if(e=="fluid")t=[100,"%"];else{var n;n=e[E](/([0-9\.]+)([^\s]*)/),n[f]<3||!n[2]?t=[parseFloat(e),"px"]:t=[parseFloat(n[1]),n[2]]}return t},canUse:function(t){return zt[e][t]&&zt[e][t].test()},hasActive:function(e){var t=u;return zt[n](e,function(n){t=t||zt.isActive(e[n])}),t},isActive:function(e){return zt[D](zt[r],zt.sd+e)!==-1},useActive:function(e){if(typeof e!==N)return e;var t=c;return zt[n](e,function(n){if(t!==c)return;zt.isActive(n)&&(t=e[n])}),t},wasActive:function(e){return zt[D](zt[P].lastStateId,zt.sd+e)!==-1},applyRowTransforms:function(e){var r,i,o,a=zt.getLevel(e[t].grid[xt]);zt[t].RTL&&(zt.unreverseRows(),a>0&&zt.reverseRows(a)),i="_skel_cell_important_placeholder",r=zt[s]("skel-cell-important"),r&&r[f]>0&&zt[n](r,function(e){if(e===f)return;var n=r[e],s,o=n[l],c;if(!o)return;o[v][E](/no-collapse/)?c=101:o[v][E](/collapse-at-([0-9])/)?c=parseInt(RegExp.$1):c=0;if(a>0&&c<=a){if(n[G](i)&&n[i]!==u)return;s=zt[t].RTL?Nt:"previousSibling",o=n[s];while(o&&o.nodeName=="#text")o=o[s];if(!o)return;n[l][h](n,n[l][lt]),n[i]=o}else n[G](i)||(n[i]=u),o=n[i],o!==u&&(n[l][h](n,o[Nt]),n[i]=u)})},reverseRows:function(e){var t=zt[s]("row");zt[n](t,function(n){if(n===f)return;var r=t[n];if(r[O]||e>0&&r[v][E](/\bcollapse-at-([0-9])\b/)&&parseInt(RegExp.$1)>=e)return;var i=r.children,s;for(s=1;s<i[f];s++)r[h](i[s],i[0]);r[O]=C})},unreverseRows:function(){var e=zt[s]("row");zt[n](e,function(t){if(t===f)return;var n=e[t];if(!n[O])return;var r=n.children,i;for(i=1;i<r[f];i++)n[h](r[i],r[0]);n[O]=u})},bind:function(e,t){zt[I][e]||(zt[I][e]=[]),zt[I][e][p](t),e==st&&zt.isInit&&t()},change:function(e){zt.bind(st,e)},trigger:function(e){if(!zt[I][e]||zt[I][e][f]==0)return;var t;zt[n](zt[I][e],function(t){zt[I][e][t]()})},registerLocation:function(e,t){e==M?t[ft]=function(e,t){t?this[h](e,this[lt]):this===zt.me[l]?this[h](e,zt.me):this.appendChild(e)}:t[ft]=function(e,t){t?this[h](e,this[lt]):this.appendChild(e)},zt[b][e]=t},addCachedElementToBreakpoint:function(t,n){zt[e][t]&&zt[e][t][i][p](n)},addCachedElementToState:function(e,t){zt[L][o][e]?zt[L][o][e][p](t):zt[L][o][e]=[t]},attachElement:function(e){var t,n=e.location,r=u;return e[gt]?C:(n[0]=="^"&&(n=n[T](1),r=C),n in zt[b]?(t=zt[b][n],t[ft](e[N],r),e[gt]=C,e.onAttach&&e.onAttach(),C):u)},attachElements:function(e){var t=[],r=[],i,s,o;zt[n](e,function(n){t[e[n][qt]]||(t[e[n][qt]]=[]),t[e[n][qt]][p](e[n])}),zt[n](t,function(e){if(t[e][f]==0)return;zt[n](t[e],function(n){zt[it](t[e][n])||r[p](t[e][n])})}),r[f]>0&&zt[W](function(){zt[n](r,function(e){zt[it](r[e])})})},cacheElement:function(e,t,n,r){return t[l]&&t[l].removeChild(t),zt[L][i][e]=zt[x](e,t,n,r)},detachAllElements:function(e){var t,r,s={};zt[n](e,function(t){s[e[t].id]=C}),zt[n](zt[L][i],function(e){if(e in s)return;zt.detachElement(e)})},detachElement:function(e){var t=zt[L][i][e],n;if(!t[gt])return;n=t[N];if(!n[l]||n[l]&&!n[l].tagName)return;n[l].removeChild(n),t[gt]=u,t.onDetach&&t.onDetach()},getCachedElement:function(e){return zt[L][i][e]?zt[L][i][e]:c},newElement:function(e,t,n,r){return{id:e,object:t,location:n,priority:r,attached:u}},changeState:function(s){var a,l,c,h,v,y,b,w;zt[P].lastStateId=zt[r],zt[r]=s;if(!zt[L][ct][zt[r]]){zt[L][ct][zt[r]]={config:{},elements:[],values:{}},c=zt[L][ct][zt[r]],zt[r]===zt.sd?a=[]:a=zt[r][T](1).split(zt.sd),zt[F](c[t],zt[et][g]),zt[n](a,function(n){zt[F](c[t],zt[e][a[n]][t])}),h=[],y="mV"+zt[r],c[t][k].content?b=c[t][k].content:(c[t][k].scalable===u?h[p]("user-scalable=no"):h[p]("user-scalable=yes"),c[t][k].width?h[p]("width="+c[t][k].width):h[p](at),b=h.join(",")),(v=zt[d](y))||(v=zt[A](y,zt.newMeta(k,b),J,4)),c[i][p](v);var E,S;h=zt[Q](c[t][H]),E=h[0],S=h[1],c.values[H]=E+S,y="iC"+c.values[H];if(!(v=zt[d](y))){var x,N,C;x=E*.75+S,N=E+S,C=E*1.25+S,v=zt[A](y,zt[m]("body{min-width:"+N+q+".container{margin-left:auto;margin-right:auto;width:"+N+q+".container.small{width:"+x+q+".container.big{width:100%;max-width:"+C+";min-width:"+N+q),M,3)}c[i][p](v),y="iGG"+c[t].grid[At];if(!(v=zt[d](y))){var O,j,I,U,z,X,V;h=zt[Q](c[t].grid[At]),O=h[0],j=h[1],I=O+j,U=O/2+j,z=O/4+j,X=O*1.5+j,V=O*2+j,v=zt[A]("iGG"+c[t].grid[At],zt[m](".row>*{padding-left:"+I+q+".row+.row>*{padding:"+I+R+I+q+".row{margin-left:-"+I+q+".row.flush>*{padding-left:0}"+".row+.row.flush>*{padding:0}"+".row.flush{margin-left:0}"+".row.half>*{padding-left:"+U+q+".row+.row.half>*{padding:"+U+R+U+q+".row.half{margin-left:-"+U+q+".row.quarter>*{padding-left:"+z+q+".row+.row.quarter>*{padding:"+z+R+z+q+".row.quarter{margin-left:-"+z+q+".row.oneandhalf>*{padding-left:"+X+q+".row+.row.oneandhalf>*{padding:"+X+R+X+q+".row.oneandhalf{margin-left:-"+X+q+".row.double>*{padding-left:"+V+q+".row+.row.double>*{padding:"+V+R+V+q+".row.double{margin-left:-"+V+q),M,3)}c[i][p](v);if(c[t].grid[xt]){var $=zt.getLevel(c[t].grid[xt]);y="iGC"+$+"-"+c.values[H];if(!(v=zt[d](y))){b=":not(.no-collapse)";switch($){case 4:break;case 3:b+=":not(.collapse-at-4)";break;case 2:b+=":not(.collapse-at-4):not(.collapse-at-3)";break;case 1:b+=":not(.collapse-at-4):not(.collapse-at-3):not(.collapse-at-2)"}h=zt[Q](c[t].grid[At]),w=h[0]+h[1],v=zt[A](y,zt[m](".row>*{padding-left:"+w+_+q+".row>*:first-child{"+Y+q+".row+.row>*{"+Pt+w+R+w+_+q+".row{"+"margin-left:-"+w+_+q+bt+b+">*{"+"float:none!important;"+"width:100%!important;"+"margin-left:0!important"+q+".row:not(.flush)"+b+":first-child>*{"+yt+w+_+q+bt+b+":first-child>:first-child {"+Y+q+bt+b+">*{"+yt+w+q+bt+b+">*:first-child{"+"padding-top:0"+q+".row+.row"+b+">*{"+Pt+w+R+w+q+".row.flush>*{"+"padding:0!important"+q+".row.flush{"+"margin-left:0px!important"+q+".container{"+"max-width:none!important;"+"min-width:0!important;"+"width:"+c[t][H]+_+q),M,3)}c[i][p](v)}y="iCd"+zt[r];if(!(v=zt[d](y))){b=[],w=[],zt[n](zt[e],function(e){zt[D](a,e)!==-1?b[p](".not-"+e):w[p](".only-"+e)});var G=(b[f]>0?b.join(",")+K:"")+(w[f]>0?w.join(",")+K:"");v=zt[A](y,zt[m](G[B](/\.([0-9])/,jt)),M,3),c[i][p](v)}zt[n](a,function(r){zt[e][a[r]][t][Ft]&&(y="ss"+a[r],(v=zt[d](y))||(v=zt[A](y,zt.newStyleSheet(zt[e][a[r]][t][Ft]),M,5)),c[i][p](v)),zt[e][a[r]][i][f]>0&&zt[n](zt[e][a[r]][i],function(t){c[i][p](zt[e][a[r]][i][t])})}),zt[L][o][zt[r]]&&(zt[n](zt[L][o][zt[r]],function(e){c[i][p](zt[L][o][zt[r]][e])}),zt[L][o][zt[r]]=[])}else c=zt[L][ct][zt[r]];zt.detachAllElements(c[i]),zt[rt](c[i]),zt[W](function(){zt[dt](c)}),zt[P].state=zt[L][ct][zt[r]],zt[P][r]=zt[r],zt.trigger(st)},getStateId:function(){if(zt[Et]&&zt[t].defaultState)return zt[t].defaultState;var r="";return zt[n](zt[e],function(t){zt[e][t].test()&&(r+=zt.sd+t)}),r},poll:function(){var e="";e=zt.getStateId(),e===""&&(e=zt.sd),e!==zt[r]&&(zt[Bt]?zt.changeState(e):(zt[b][Tt][v]=zt[b][Tt][v][B](zt[r][T](1)[B](new RegExp(zt.sd,"g")," "),""),zt.changeState(e),zt[b][Tt][v]=zt[b][Tt][v]+" "+zt[r][T](1)[B](new RegExp(zt.sd,"g")," "),zt[b][Tt][v].charAt(0)==" "&&(zt[b][Tt][v]=zt[b][Tt][v][T](1))))},updateState:function(){var t,s,u,a,l=[];if(zt[r]==zt.sd)return;t=zt[r][T](1).split(zt.sd),zt[n](t,function(o){s=zt[e][t[o]];if(s[i][f]==0)return;zt[n](s[i],function(e){zt[L][ct][zt[r]][i][p](s[i][e]),l[p](s[i][e])})}),zt[L][o][zt[r]]&&(zt[n](zt[L][o][zt[r]],function(e){zt[L][ct][zt[r]][i][p](zt[L][o][zt[r]][e]),l[p](zt[L][o][zt[r]][e])}),zt[L][o][zt[r]]=[]),l[f]>0&&zt[rt](l)},newDiv:function(e){var t=document[w]("div");return t[Mt]=e,t},newInline:function(e){var t;return t=document[w]("style"),t.type=ut,t[Mt]=e,t},newMeta:function(e,t){var n=document[w]("meta");return n.name=e,n.content=t,n},newStyleSheet:function(e){var t=document[w]("link");return t.rel="stylesheet",t.type=ut,t[Ft]=e,t},initPlugin:function(e,n){typeof n==N&&zt[F](e[t],n),e.init&&e.init()},registerPlugin:function(e,t){if(!t)return u;zt.plugins[e]=t,t._=this,t.register&&t.register()},init:function(e,t){zt.initConfig(e),zt.initElements(),zt.initEvents(),zt.poll(),zt[n](zt.plugins,function(e){zt.initPlugin(zt.plugins[e],typeof t==N&&e in t?t[e]:c)}),zt.isInit=C},initAPI:function(){var e,t,r=navigator.userAgent;zt[P][tt]=99,e="other",r[E](/Firefox/)?e="firefox":r[E](/Chrome/)?e="chrome":r[E](/Safari/)&&!r[E](/Chrome/)?e="safari":r[E](/(OPR|Opera)/)?e="opera":r[E](/MSIE ([0-9]+)/)?(e="ie",zt[P][tt]=RegExp.$1):r[E](/Trident\/.+rv:([0-9]+)/)&&(e="ie",zt[P][tt]=RegExp.$1),zt[P].browser=e,zt[P][S]="other",t={ios:"(iPad|iPhone|iPod)",android:"Android",mac:"Macintosh",wp:"Windows Phone",windows:"Windows NT"},zt[n](t,function(e){r[E](new RegExp(t[e],"g"))&&(zt[P][S]=e)});switch(zt[P][S]){case"ios":r[E](/([0-9_]+) like Mac OS X/),e=parseFloat(RegExp.$1[B]("_",".")[B]("_",""));break;case Rt:r[E](/Android ([0-9\.]+)/),e=parseFloat(RegExp.$1);break;case"mac":r[E](/Mac OS X ([0-9_]+)/),e=parseFloat(RegExp.$1[B]("_",".")[B]("_",""));break;case"wp":r[E](/IEMobile\/([0-9\.]+)/),e=parseFloat(RegExp.$1);break;case"windows":r[E](/Windows NT ([0-9\.]+)/),e=parseFloat(RegExp.$1);break;default:e=99}zt[P].deviceVersion=e,zt[P].isTouch=zt[P][S]=="wp"?navigator.msMaxTouchPoints>0:"ontouchstart"in window,zt[P].isMobile=zt[P][S]=="wp"||zt[P][S]==Rt||zt[P][S]=="ios"},initConfig:function(r){var s=[],o=[];typeof r==N&&(r[e]&&(zt[t][e]={}),zt[F](zt[t],r)),zt[F](zt[et][g].grid,zt[t].grid),zt[et][g][H]=zt[t][H],zt[n](zt[t][e],function(n){var r,s={},u,a;zt[F](s,zt[t][e][n]),Ft in s||(s[Ft]=zt[et][g][Ft]),wt in s||(s[wt]=zt[et][g][wt]),"range"in s&&(u=s.range,u=="*"?a="":u.charAt(0)=="-"?a="(max-width: "+parseInt(u[T](1))+"px)":u.charAt(u[f]-1)=="-"?a=mt+parseInt(u[T](0,u[f]-1))+"px)":zt[D](u,"-")!=-1&&(u=u.split("-"),a=mt+parseInt(u[0])+"px) and (max-width: "+parseInt(u[1])+"px)"),s[wt]=a),zt[t][e][n]=s,r={},zt[F](r,zt[et].breakpoint),r[t]=zt[t][e][n],r.test=function(){return zt[j](s[wt])},r[i]=[],zt[t].preload&&r[t][Ft]&&o[p](r[t][Ft]),zt[e][n]=r,zt.breakpointList[p](n)}),X in zt[t][e]&&(zt[Bt]=C,zt[t][e][X][k]=zt[t][k]),zt[n](zt[t][I],function(e){zt.bind(e,zt[t][I][e])}),o[f]>0&&window.location.protocol!="file:"&&zt[W](function(){var e,t=document[a](M)[0],r=new XMLHttpRequest;zt[n](o,function(e){r.open("GET",o[e],u),r.send("")})})},initElements:function(){var e=[];e[p](zt[x]("mV",zt.newMeta(k,at),J,1));switch(zt[t].reset){case"full":e[p](zt[x]("iR",zt[m](zt.css.r),J,2));break;case"normalize":e[p](zt[x]("iN",zt[m](zt.css.n),J,2))}e[p](zt[x]("iBM",zt[m](zt.css.bm),J,1)),e[p](zt[x]("iG",zt[m](".\\31 2u{width:100%}.\\31 1u{width:91.6666666667%}.\\31 0u{width:83.3333333333%}.\\39 u{width:75%}.\\38 u{width:66.6666666667%}.\\37 u{width:58.3333333333%}.\\36 u{width:50%}.\\35 u{width:41.6666666667%}.\\34 u{width:33.3333333333%}.\\33 u{width:25%}.\\32 u{width:16.6666666667%}.\\31 u{width:8.3333333333%}.\\-11u{margin-left:91.6666666667%}.\\-10u{margin-left:83.3333333333%}.\\-9u{margin-left:75%}.\\-8u{margin-left:66.6666666667%}.\\-7u{margin-left:58.3333333333%}.\\-6u{margin-left:50%}.\\-5u{margin-left:41.6666666667%}.\\-4u{margin-left:33.3333333333%}.\\-3u{margin-left:25%}.\\-2u{margin-left:16.6666666667%}.\\-1u{margin-left:8.3333333333%}"),M,3)),e[p](zt[x]("iGR",zt[m](".row>*{float:left}.row:after{content:'';display:block;clear:both;height:0}.row:first-child>*{padding-top:0!important}"),M,3)),zt[rt](e)},initEvents:function(){var e;!zt[t].pollOnce&&!zt[Bt]&&(zt.bind(vt,function(){zt.poll()}),zt.bind(y,function(){zt.poll()})),zt[P][S]=="ios"&&zt[W](function(){zt.bind(y,function(){var e=document[a]("input");zt[n](e,function(t){e[t][St]=e[t][ht],e[t][ht]=""}),window.setTimeout(function(){zt[n](e,function(t){e[t][ht]=e[t][St]})},100)})}),window[Ut]&&zt.bind(vt,window[Ut]),window[Ut]=function(){zt.trigger(vt)},window[U]&&zt.bind(y,window[U]),window[U]=function(){zt.trigger(y)}},initUtilityMethods:function(){document[V]?!function(e,t){zt[W]=t()}(Ht,function(){function e(e){s=1;while(e=t.shift())e()}var t=[],n,r=document,i=ot,s=/^loaded|^c/.test(r[It]);return r[V](i,n=function(){r[pt](i,n),e()}),function(e){s?e():t[p](e)}}):!function(e,t){zt[W]=t()}(Ht,function(e){function t(e){d=1;while(e=n.shift())e()}var n=[],r,i=!1,s=document,o=s[nt],u=o.doScroll,a=ot,f=V,l="onreadystatechange",c=It,h=u?/^loaded|^c/:/^loaded|c/,d=h.test(s[c]);return s[f]&&s[f](a,r=function(){s[pt](a,r,i),t()},i),u&&s.attachEvent(l,r=function(){/^c/.test(s[c])&&(s.detachEvent(l,r),t())}),e=u?function(t){self!=top?d?t():n[p](t):function(){try{o.doScroll("left")}catch(n){return setTimeout(function(){e(t)},50)}t()}()}:function(e){d?e():n[p](e)}}),document[s]?zt[s]=function(e){return document[s](e)}:zt[s]=function(e){var t=document;return t[Ct]?t[Ct](("."+e[B](" "," ."))[B](/\.([0-9])/,jt)):[]},Array[Dt][D]?zt[D]=function(e,t){return e[D](t)}:zt[D]=function(e,t){if(typeof e=="string")return e[D](t);var n,r=t?t:0,i;if(!this)throw new TypeError;i=this[f];if(i===0||r>=i)return-1;r<0&&(r=i-Math.abs(r));for(n=r;n<i;n++)if(this[n]===e)return n;return-1},Array[z]?zt[z]=function(e){return Array[z](e)}:zt[z]=function(e){return Object[Dt].toString.call(e)==="[object Array]"},Object.keys?zt[n]=function(e,t){if(!e)return[];var n,r=Object.keys(e);for(n=0;r[n];n++)t(r[n])}:zt[n]=function(e,t){if(!e)return[];var n;for(n in e)Object[Dt][G].call(e,n)&&t(n)},window.matchMedia?zt[j]=function(e){return e==""?C:window.matchMedia(e).matches}:window.styleMedia||window[wt]?zt[j]=function(e){if(e=="")return C;var t=window.styleMedia||window[wt];return t.matchMedium(e||"all")}:window[$]?zt[j]=function(e){if(e=="")return C;var t=document[w]("style"),n=document[a]("script")[0],r=c;t.type=ut,t.id="matchmediajs-test",n[l][h](t,n),r=$ in window&&window[$](t,c)||t.currentStyle;var i="@media "+e+"{ #matchmediajs-test { width: 1px; } }";return t.styleSheet?t.styleSheet.cssText=i:t.textContent=i,r.width==="1px"}:(zt[Et]=C,zt[j]=function(e){if(e=="")return C;var t,n,r,i,s={"min-width":c,"max-width":c},o=u;n=e.split(/\s+and\s+/);for(i in n)t=n[i],t.charAt(0)=="("&&(t=t[T](1,t[f]-1),r=t.split(/:\s+/),r[f]==2&&(s[r[0][B](/^\s+|\s+$/g,"")]=parseInt(r[1]),o=C));if(!o)return u;var a=document[nt].clientWidth,l=document[nt].clientHeight;return s[_t]!==c&&a<s[_t]||s[Ot]!==c&&a>s[Ot]||s[kt]!==c&&l<s[kt]||s[Lt]!==c&&l>s[Lt]?u:C})},preInit:function(){var e=document[a]("script");zt.me=e[e[f]-1],zt.initUtilityMethods(),zt.initAPI(),zt[Z](Tt,document[a](Tt)[0]),zt[Z](M,document[a](M)[0]),zt[W](function(){zt[Z]("body",document[a]("body")[0])}),zt[P][tt]>=10&&zt[it](zt[x]("msie-viewport-fix",zt[m]("@-ms-viewport{width:device-width;}"),J,1))}};return zt.preInit(),zt[P][tt]<9&&(zt[dt]=function(e){},zt[m]=function(e){var t;return t=document[w]("span"),t[Mt]='&nbsp;<style type="text/css">'+e+"</style>",t}),zt}();
/* skel-layers.js v1.0 | (c) n33 | n33.co | MIT licensed */
skel.registerPlugin("layers",function(e){function dn(e,r,i){var o,u;this.id=e,this.index=i,this[n]={breakpoints:T,states:T,position:T,side:T,animation:bt,orientation:bt,width:0,height:0,zIndex:this.index,html:"",hidden:H,exclusive:Ht,resetScroll:Ht,resetForms:Ht,swipeToClose:Ht,clickToClose:H},t._.extend(this[n],r),this[W]=t._.newDiv(this[n][It]),this[W].id=e,this[W]._layer=this,this[s]=T,this[tt]=T,this[St]=T,this[Qt]=H,u=t._.cacheElement(this.id,this[W],nt,1),u.onAttach=function(){var e=this.object._layer;e[ut]()||e.init(),e.resume()},u.onDetach=function(){var e=this.object._layer;e.suspend()},this[n].states&&this[n].states!=t._.sd?(o=t._[cn](this[n].states),t._[Wt](o,function(e){t._.addCachedElementToState(o[e],u)})):(this[n].breakpoints?o=t._[cn](this[n].breakpoints):o=t._.breakpointList,t._[Wt](o,function(e){t._.addCachedElementToBreakpoint(o[e],u)}))}var t,n="config",r="_skel_layers_translateOrigin",i="cache",s="$element",o="_skel_layers_translate",u="_skel_layers_resetForms",f="_skel_layers_resume",l="exclusiveLayer",c="activeWrapper",h="_skel_layers_promote",p="moveToInactiveWrapper",d="_skel_layers_demote",v="moveToActiveWrapper",m="setTimeout",g="right",y="bottom",b="useActive",w="deactivate",E="width",S="css",x="scrollTop",T=null,N="center",C="_skel_layers_suspend",k="position",L="prototype",A="left",O="wrapper",M="skel-layers-layer-z-index",_="_skel_layers_init",D="children",P="skel-layers-moved",H=!1,B="inactiveWrapper",j="transform",F=".skel-layers-fixed:not(.skel-layers-moved)",I="length",q="height",R="top",U="deviceType",z="touchstart.lock click.lock scroll.lock",W="element",X="stopPropagation",V='<div id="skel-layers-placeholder-',$="resetForms",J="preventDefault",K="overflow-x",Q="window",G="-webkit-",Y="recalcW",Z="padding-bottom",et="skel-layers-exclusiveActive",tt="touchPosX",nt="skel_layers_inactiveWrapper",rt="originalEvent",it="hidden",st="-webkit-tap-highlight-color",ot="animation",ut="isInitialized",at="skel-layers-layer-index",ft="skel-layers-layer-position",lt="z-index",ct="unlockView",ht="animations",pt="#skel-layers-placeholder-",dt="_skel_layers_initializeCell",vt="registerLocation",mt="resize.lock scroll.lock",gt="undefined",yt="orientationchange.lock",bt="none",wt="activate",Et="find",St="touchPosY",xt="speed",Tt="positions",Nt="-moz-",Ct="_skel_layers_expandCell",kt="_skel_layers_hasParent",Lt="attr",At="layers",Ot="append",Mt="DOMReady",_t="isTouch",Dt="lockView",Pt="-ms-",Ht=!0,Bt="addClass",jt="_skel_layers_scrollPos",Ft="auto",It="html",qt="transformBreakpoints",Rt="visible",Ut="_skel_layers_xcss",zt="-o-",Wt="iterate",Xt="removeClass",Vt="rgba(0,0,0,0)",$t="cell-size",Jt="appendTo",Kt="vars",Qt="active",Gt="px",Yt="body",Zt="-",en="click",tn="isVisible",nn="side",rn="recalcH",sn="touches",on="overflow-",un="relative",an="#",fn="transformTest",ln="*",cn="getArray",hn="htmlbody",pn="android";return typeof e==gt?H:(e.fn[d]=function(){var t,n;if(this[I]>1){for(t=0;t<this[I];t++)e(this[t])[d]();return e(this)}return n=e(this),n[S](lt,n.data(M)).data(M,""),n},e.fn[Ct]=function(){var t=e(this),n=t.parent(),r=12;n[D]().each(function(){var t=e(this),n=t[Lt]("class");n&&n.match(/(\s+|^)([0-9]+)u(\s+|$)/)&&(r-=parseInt(RegExp.$2))}),r>0&&(t[dt](),t[S](E,(t.data($t)+r)/12*100+"%"))},e.fn[kt]=function(){return e(this).parents()[I]>0},e.fn[dt]=function(){var t=e(this);t[Lt]("class").match(/(\s+|^)([0-9]+)u(\s+|$)/)&&t.data($t,parseInt(RegExp.$2))},e.fn[h]=function(r){var i,s,o;if(this[I]>1){for(i=0;i<this[I];i++)e(this[i])[h](r);return e(this)}return s=e(this),isNaN(o=parseInt(s.data(at)))&&(o=0),s.data(M,s[S](lt))[S](lt,t[n].baseZIndex+o+(r?r:1)),s},e.fn[u]=function(){var t=e(this);return e(this)[Et]("form").each(function(){this.reset()}),t},e.fn[Ut]=function(t,n){return e(this)[S](t,n)[S](Nt+t,Nt+n)[S](G+t,G+n)[S](zt+t,zt+n)[S](Pt+t,Pt+n)},e.fn._skel_layers_xcssProperty=function(t,n){return e(this)[S](t,n)[S](Nt+t,n)[S](G+t,n)[S](zt+t,n)[S](Pt+t,n)},e.fn._skel_layers_xcssValue=function(t,n){return e(this)[S](t,n)[S](t,Nt+n)[S](t,G+n)[S](t,zt+n)[S](t,Pt+n)},dn[L][ht]={none:{activate:function(e){var t=e[n],r=e[s];r[x](0)[h](t.zIndex).show(),t[$]&&r[u](),e[v]()},deactivate:function(e){var t=e[n],r=e[s];r.hide()[d](),e[p]()}},overlayX:{activate:function(e){var r=e[n],i=e[s];i[x](0)[h](r.zIndex)[S](r[nn],Zt+t[Y](t._[b](r[E]))+Gt).show(),r[$]&&i[u](),t[Dt]("x"),e[v](),window[m](function(){i[o]((r[nn]==g?Zt:"")+t[Y](t._[b](r[E])),0)},50)},deactivate:function(e){var i=e[n],o=e[s];o[Et](ln).blur(),o[r](),window[m](function(){t[ct]("x"),e[p](),o[d]().hide()},t[n][xt]+50)}},overlayY:{activate:function(e){var r=e[n],i=e[s];i[x](0)[h](r.zIndex)[S](r[nn],Zt+t[Y](t._[b](r[q]))+Gt).show(),r[$]&&i[u](),t[Dt]("y"),e[v](),window[m](function(){i[o](0,(r[nn]==y?Zt:"")+t[Y](t._[b](r[q])))},50)},deactivate:function(e){var i=e[n],o=e[s];o[Et](ln).blur(),o[r](),window[m](function(){t[ct]("y"),e[p](),o[d]().hide()},t[n][xt]+50)}},pushX:{activate:function(e){var r=e[n],a=e[s],f=t[i][O].add(t[i][c][D]());a[x](0)[S](r[nn],Zt+t[Y](t._[b](r[E]))+Gt).show(),r[$]&&a[u](),f[h](),t[Dt]("x"),e[v](),window[m](function(){a.add(f)[o]((r[nn]==g?Zt:"")+t[Y](t._[b](r[E])),0)},50)},deactivate:function(e){var o=e[n],u=e[s],a=t[i][O].add(t[i][c][D]());u[Et](ln).blur(),u.add(a)[r](),window[m](function(){t[ct]("x"),u.hide(),e[p](),a[d]()},t[n][xt]+50)}},pushY:{activate:function(e){var r=e[n],a=e[s],f=t[i][O].add(t[i][c][D]());a[x](0)[S](r[nn],Zt+t[rn](t._[b](r[q]))+Gt).show(),r[$]&&a[u](),t[Dt]("y"),e[v](),window[m](function(){a.add(f)[o](0,(r[nn]==y?Zt:"")+t[rn](t._[b](r[q])))},50)},deactivate:function(e){var o=e[n],u=e[s],a=t[i][O].add(t[i][c][D]());u[Et](ln).blur(),u.add(a)[r](),window[m](function(){t[ct]("y"),u.hide(),e[p]()},t[n][xt]+50)}},revealX:{activate:function(e){var r=e[n],a=e[s],f=t[i][O].add(t[i][c][D]());a[x](0).show(),r[$]&&a[u](),f[h](),t[Dt]("x"),e[v](),window[m](function(){f[o]((r[nn]==g?Zt:"")+t[Y](t._[b](r[E])),0)},50)},deactivate:function(e){var o=e[n],u=e[s],a=t[i][O].add(t[i][c][D]());u[Et](ln).blur(),a[r](),window[m](function(){t[ct]("x"),u.hide(),a[d](),e[p]()},t[n][xt]+50)}}},dn[L][Tt]={"top-left":{v:R,h:A,side:A},"top-right":{v:R,h:g,side:g},top:{v:R,h:N,side:R},"top-center":{v:R,h:N,side:R},"bottom-left":{v:y,h:A,side:A},"bottom-right":{v:y,h:g,side:g},bottom:{v:y,h:N,side:y},"bottom-center":{v:y,h:N,side:y},left:{v:N,h:A,side:A},"center-left":{v:N,h:A,side:A},right:{v:N,h:g,side:g},"center-right":{v:N,h:g,side:g}},dn[L][wt]=function(){var e,r,o,u;if(this[Qt]){t[i][c][Ot](this[W]);return}e=this[n],r=t._[b](e[ot]),o=this[s],o[S](E,t._[b](e[E]))[S](q,t._[b](e[q])),t._[Kt][U]=="ios"&&e[q]=="100%"&&!e[it]&&o[S](q,"-webkit-calc("+t._[b](e[q])+" + 70px)"),u=this[Tt][e[k]],o[Bt]("skel-layer-"+e[k]).data(ft,e[k]);switch(u.v){case R:o[S](R,0);break;case y:o[S](y,0);break;case N:o[S](R,"50%")[S]("margin-top",Zt+t.getHalf(e[q]))}switch(u.h){case A:o[S](A,0);break;case g:o[S](g,0);break;case N:o[S](A,"50%")[S]("margin-left",Zt+t.getHalf(e[E]))}this[ht][r][wt](this),e[it]&&e.exclusive&&(t[i][Yt][Bt](et),t[i][l]=this),this[Qt]=Ht},dn[L][w]=function(){var e,r;if(!this[Qt]){t[i][B][Ot](this[W]);return}e=this[n],r=t._[b](e[ot]),r in this[ht]||(r=bt),this[ht][r][w](this),e[it]&&e.exclusive&&t[i][l]===this&&(t[i][Yt][Xt](et),t[i][l]=T),this[Qt]=H},dn[L].init=function(){var r=this[n],o=e(this[W]),u=this;o[_](),o[Et](ln).each(function(){t.parseInit(e(this))}),o[Bt]("skel-layer").data(at,this.index)[S](lt,t[n].baseZIndex)[S](k,"fixed")[S]("-ms-overflow-style","-ms-autohiding-scrollbar")[S]("-webkit-overflow-scrolling","touch").hide();switch(r.orientation){case"vertical":o[S]("overflow-y",Ft);break;case"horizontal":o[S](K,Ft);break;case bt:default:}if(!r[k]||!(r[k]in this[Tt]))r[k]="top-left";r[nn]||(r[nn]=this[Tt][r[k]][nn]);if(!r[ot]||typeof r[ot]!="object"&&!(r[ot]in this[ht]))r[ot]=bt;r.clickToClose&&o[Et]("a")[S](st,Vt).on("click.skel-layers",function(r){var i,s,o=e(this);if(o.hasClass("skel-layers-ignore"))return;r[J](),r[X](),u[w]();if(o.hasClass("skel-layers-ignoreHref"))return;i=o[Lt]("href"),s=o[Lt]("target"),typeof i!==gt&&i!=""&&window[m](function(){s=="_blank"&&t._[Kt][U]!="wp"?window.open(i):window.location.href=i},t[n][xt]+10)}),t._[Kt][U]=="ios"&&o[Et]("input,select,textarea").on("focus",function(n){var r=e(this);n[J](),n[X](),window[m](function(){var e=t[i][Q][jt],n=t[i][Q][x]()-e;t[i][Q][x](e),o[x](o[x]()+n),r.hide(),window[m](function(){r.show()},0)},100)}),t._[Kt][_t]&&o.on("touchstart",function(e){u[tt]=e[rt][sn][0].pageX,u[St]=e[rt][sn][0].pageY}).on("touchmove",function(e){var t,n,i,s,a,f,l;if(u[tt]===T||u[St]===T)return;t=u[tt]-e[rt][sn][0].pageX,n=u[St]-e[rt][sn][0].pageY,i=o.outerHeight(),s=o.get(0).scrollHeight-o[x]();if(r[it]&&r.swipeToClose){a=H,f=20,l=50;switch(r[nn]){case A:a=n<f&&n>-1*f&&t>l;break;case g:a=n<f&&n>-1*f&&t<-1*l;break;case R:a=t<f&&t>-1*f&&n>l;break;case y:a=t<f&&t>-1*f&&n<-1*l}if(a)return u[tt]=T,u[St]=T,u[w](),H}if(o[x]()==0&&n<0||s>i-2&&s<i+2&&n>0)return H}),this[s]=o},dn[L][ut]=function(){return this[s]!==T},dn[L][tn]=function(){return this[s].is(":visible")},dn[L][v]=function(){t[i][c][Ot](this[s])},dn[L][p]=function(){if(!this[s][kt]())return;t[i][B][Ot](this[s])},dn[L].resume=function(r){if(!this[ut]())return;this[s][Et](ln).each(function(){t.parseResume(e(this))}),this[n][it]||this[wt](r)},dn[L].suspend=function(){if(!this[ut]())return;this[s][r](),this[s][Et](ln).each(function(){t.parseSuspend(e(this))}),this[Qt]&&this[w]()},t={cache:{activeWrapper:T,body:T,exclusiveLayer:T,html:T,htmlbody:T,inactiveWrapper:T,layers:{},window:T,wrapper:T},config:{baseZIndex:1e4,layers:{},speed:250,transform:Ht,transformBreakpoints:T,transformTest:T},eventType:en,activate:function(e){t._[Mt](function(){t[i][At][e][wt]()})},deactivate:function(e){t._[Mt](function(){t[i][At][e][w]()})},toggle:function(e){t._[Mt](function(){var n=t[i][At][e];n[tn]()?n[w]():n[wt]()})},getBaseFontSize:function(){return t._[Kt].IEVersion<9?16.5:parseFloat(getComputedStyle(t[i][Yt].get(0)).fontSize)},getHalf:function(e){var t=parseInt(e);return typeof e=="string"&&e.charAt(e[I]-1)=="%"?Math.floor(t/2)+"%":Math.floor(t/2)+Gt},lockView:function(e){t[i][Q][jt]=t[i][Q][x](),t._[Kt][_t]&&t[i][hn][S](on+e,it),t[i][O].on(z,function(e){e[J](),e[X](),t[i][l]&&t[i][l][w]()}),t[i][Q].on(yt,function(e){t[i][l]&&t[i][l][w]()}),t._[Kt][_t]||t[i][Q].on(mt,function(e){t[i][l]&&t[i][l][w]()})},parseInit:function(n){var r,s,o=n.get(0),u=n[Lt]("data-action"),a=n[Lt]("data-args"),c,h;u&&a&&(a=a.split(","));switch(u){case"toggleLayer":case"layerToggle":n[S](st,Vt)[S]("cursor","pointer"),r=function(n){n[J](),n[X]();if(t[i][l])return t[i][l][w](),H;var r=e(this),s=t[i][At][a[0]];s[tn]()?s[w]():s[wt]()},t._[Kt][U]==pn||t._[Kt][U]=="wp"?n.on(en,r):n.on(t.eventType,r);break;case"navList":c=e(an+a[0]),r=c[Et]("a"),s=[],r.each(function(){var t=e(this),n,r;n=Math.max(0,t.parents("li")[I]-1),r=t[Lt]("href"),s.push('<a class="link depth-'+n+'"'+(typeof r!==gt&&r!=""?' href="'+r+'"':"")+'><span class="indent-'+n+'"></span>'+t.text()+"</a>")}),s[I]>0&&n[It]("<nav>"+s.join("")+"</nav>");break;case"copyText":c=e(an+a[0]),n[It](c.text());break;case"copyHTML":c=e(an+a[0]),n[It](c[It]());break;case"moveElementContents":c=e(an+a[0]),o[f]=function(){c[D]().each(function(){var t=e(this);n[Ot](t),t[Bt](P)})},o[C]=function(){n[D]().each(function(){var n=e(this);c[Ot](n),n[Xt](P),t.refresh(n)})},o[f]();break;case"moveElement":c=e(an+a[0]),o[f]=function(){e(V+c[Lt]("id")+'" />').insertBefore(c),n[Ot](c),c[Bt](P)},o[C]=function(){e(pt+c[Lt]("id")).replaceWith(c),c[Xt](P),t.refresh(c)},o[f]();break;case"moveCell":c=e(an+a[0]),h=e(an+a[1]),o[f]=function(){e(V+c[Lt]("id")+'" />').insertBefore(c),n[Ot](c),c[S](E,Ft),h&&h[Ct]()},o[C]=function(){e(pt+c[Lt]("id")).replaceWith(c),c[S](E,""),h&&h[S](E,"")},o[f]();break;default:}},parseResume:function(e){var t=e.get(0);t[f]&&t[f]()},parseSuspend:function(e){var t=e.get(0);t[C]&&t[C]()},recalc:function(e,n){var r=t._.parseMeasurement(e),i;switch(r[1]){case"%":i=Math.floor(n*(r[0]/100));break;case"em":i=t.getBaseFontSize()*r[0];break;default:case Gt:i=r[0]}return i},recalcH:function(n){return t.recalc(n,e(window)[q]())},recalcW:function(n){return t.recalc(n,e(window)[E]())},refresh:function(r){var s;t[n][j]&&(r?s=r.filter(F):s=e(F),s[_]()[Jt](t[i][c]))},unlockView:function(e){t._[Kt][_t]&&t[i][hn][S](on+e,Rt),t[i][O].off(z),t[i][Q].off(yt),t._[Kt][_t]||t[i][Q].off(mt)},init:function(){t[n][fn]&&(t[n][j]=t[n][fn]());if(t[n][j]){if(t._[Kt][U]==pn&&t._[Kt].deviceVersion<4||t._[Kt][U]=="wp")t[n][j]=H;t._[Kt].IEVersion<10&&(t[n][j]=H),t[n][qt]&&!t._.hasActive(t._[cn](t[n][qt]))&&(t[n][j]=H)}t.eventType=t._[Kt][_t]?"touchend":en,t.initObjects(),t.initTransforms(),t._[Mt](function(){t.initLayers(),t.initIncludes(),t._.updateState(),t.refresh()})},initIncludes:function(){e(".skel-layers-include").each(function(){t.parseInit(e(this))})},initLayers:function(){var r,s,o,u=1;t._[Wt](t[n][At],function(r){var s;if(!t[n][At][r][It]&&(s=e(an+r))[I]==0)return;o=new dn(r,t[n][At][r],u++),t[i][At][r]=o,s&&(s[D]()[Jt](o[W]),s.remove())})},initObjects:function(){t[i][Q]=e(window),t._[Mt](function(){t[i][It]=e(It),t[i][Yt]=e(Yt),t[i][hn]=e("html,body"),t[i][Yt].wrapInner('<div id="skel-layers-wrapper" />'),t[i][O]=e("#skel-layers-wrapper"),t[i][O][S](k,un)[S](A,"0")[S](g,"0")[S](R,"0")[_](),t[i][B]=e('<div id="skel-layers-inactiveWrapper" />')[Jt](t[i][Yt]),t[i][B][S](q,"100%"),t[i][c]=e('<div id="skel-layers-activeWrapper" />')[Jt](t[i][Yt]),t[i][c][S](k,un),t._[vt](nt,t[i][B][0]),t._[vt]("skel_layers_activeWrapper",t[i][c][0]),t._[vt]("skel_layers_wrapper",t[i][O][0]),e("[autofocus]").focus()})},initTransforms:function(){if(t[n][j])e.fn[r]=function(){return e(this)[o](0,0)},e.fn[o]=function(t,n){return e(this)[S](j,"translate("+t+"px, "+n+"px)")},e.fn[_]=function(){return e(this)[S]("backface-visibility",it)[S]("perspective","500")[Ut]("transition","transform "+t[n][xt]/1e3+"s ease-in-out")};else{var s,u=[];t[i][Q].resize(function(){if(t[n][xt]!=0){var e=t[n][xt];t[n][xt]=0,window[m](function(){t[n][xt]=e,u=[]},e)}}),e.fn[r]=function(){for(var r=0;r<this[I];r++){var s=this[r],o=e(s);u[s.id]&&o.animate(u[s.id],t[n][xt],"swing",function(){t._[Wt](u[s.id],function(e){o[S](e,u[s.id][e])}),t[i][Yt][S](K,Rt),t[i][O][S](E,Ft)[S](Z,0)})}return e(this)},e.fn[o]=function(r,s){var o,f,l,c;r=parseInt(r),s=parseInt(s),r!=0?(t[i][Yt][S](K,it),t[i][O][S](E,t[i][Q][E]())):l=function(){t[i][Yt][S](K,Rt),t[i][O][S](E,Ft)},s<0?t[i][O][S](Z,Math.abs(s)):c=function(){t[i][O][S](Z,0)};for(o=0;o<this[I];o++){var h=this[o],p=e(h),d;if(!u[h.id])if(d=dn[L][Tt][p.data(ft)]){u[h.id]={};switch(d.v){case N:case R:u[h.id][R]=parseInt(p[S](R));break;case y:u[h.id][y]=parseInt(p[S](y))}switch(d.h){case N:case A:u[h.id][A]=parseInt(p[S](A));break;case g:u[h.id][g]=parseInt(p[S](g))}}else d=p[k](),u[h.id]={top:d[R],left:d[A]};a={},t._[Wt](u[h.id],function(e){var n;switch(e){case R:n=t[rn](u[h.id][e])+s;break;case y:n=t[rn](u[h.id][e])-s;break;case A:n=t[Y](u[h.id][e])+r;break;case g:n=t[Y](u[h.id][e])-r}a[e]=n}),p.animate(a,t[n][xt],"swing",function(){l&&l(),c&&c()})}return e(this)},e.fn[_]=function(){return e(this)[S](k,"absolute")}}}},t)}(jQuery));
/*
	Arcana by Pixelarity
	pixelarity.com @pixelarity
	License: pixelarity.com/license
*/

(function($) {

	skel.init({
		reset: 'full',
		breakpoints: {
			global:		{ range: '*', href: '/static/css/style.css', containers: 1400, grid: { gutters: 50 } },
			wide:		{ range: '-1680', href: '/static/css/style-wide.css', containers: 1200, grid: { gutters: 40 } },
			normal:		{ range: '-1280', href: '/static/css/style-normal.css', containers: 960, grid: { gutters: 30 }, viewport: { scalable: false } },
			narrow:		{ range: '-980', href: '/static/css/style-narrow.css', containers: '95%', grid: { gutters: 20 } },
			narrower:	{ range: '-840', href: '/static/css/style-narrower.css', grid: { collapse: 1 } },
			mobile:		{ range: '-640', href: '/static/css/style-mobile.css', containers: '90%', grid: { gutters: 15 } },
			mobilep:	{ range: '-480', href: '/static/css/style-mobilep.css', grid: { collapse: 2 }, containers: '100%' }
		}
	}, {
		layers: {
			layers: {
				navPanel: {
					animation: 'revealX',
					breakpoints: 'narrower',
					clickToClose: true,
					height: '100%',
					hidden: true,
					html: '<div data-action="navList" data-args="nav"></div>',
					orientation: 'vertical',
					position: 'top-left',
					side: 'left',
					width: 275
				},
				titleBar: {
					breakpoints: 'narrower',
					height: 44,
					html: '<span class="toggle" data-action="toggleLayer" data-args="navPanel"></span><span class="title" data-action="copyHTML" data-args="logo"></span>',
					position: 'top-left',
					side: 'top',
					width: '100%'
				}
			}
		}
	});

	$(function() {

		var	$window = $(window),
			$body = $('body');

		// Disable animations/transitions until the page has loaded.
			$body.addClass('is-loading');
			
			$window.on('load', function() {
				$body.removeClass('is-loading');
			});
			
		// Forms (IE<10).
			var $form = $('form');
			if ($form.length > 0) {
				
				$form.find('.form-button-submit')
					.on('click', function() {
						$(this).parents('form').submit();
						return false;
					});
		
				if (skel.vars.IEVersion < 10) {
					$.fn.n33_formerize=function(){var _fakes=new Array(),_form = $(this);_form.find('input[type=text],textarea').each(function() { var e = $(this); if (e.val() == '' || e.val() == e.attr('placeholder')) { e.addClass('formerize-placeholder'); e.val(e.attr('placeholder')); } }).blur(function() { var e = $(this); if (e.attr('name').match(/_fakeformerizefield$/)) return; if (e.val() == '') { e.addClass('formerize-placeholder'); e.val(e.attr('placeholder')); } }).focus(function() { var e = $(this); if (e.attr('name').match(/_fakeformerizefield$/)) return; if (e.val() == e.attr('placeholder')) { e.removeClass('formerize-placeholder'); e.val(''); } }); _form.find('input[type=password]').each(function() { var e = $(this); var x = $($('<div>').append(e.clone()).remove().html().replace(/type="password"/i, 'type="text"').replace(/type=password/i, 'type=text')); if (e.attr('id') != '') x.attr('id', e.attr('id') + '_fakeformerizefield'); if (e.attr('name') != '') x.attr('name', e.attr('name') + '_fakeformerizefield'); x.addClass('formerize-placeholder').val(x.attr('placeholder')).insertAfter(e); if (e.val() == '') e.hide(); else x.hide(); e.blur(function(event) { event.preventDefault(); var e = $(this); var x = e.parent().find('input[name=' + e.attr('name') + '_fakeformerizefield]'); if (e.val() == '') { e.hide(); x.show(); } }); x.focus(function(event) { event.preventDefault(); var x = $(this); var e = x.parent().find('input[name=' + x.attr('name').replace('_fakeformerizefield', '') + ']'); x.hide(); e.show().focus(); }); x.keypress(function(event) { event.preventDefault(); x.val(''); }); });  _form.submit(function() { $(this).find('input[type=text],input[type=password],textarea').each(function(event) { var e = $(this); if (e.attr('name').match(/_fakeformerizefield$/)) e.attr('name', ''); if (e.val() == e.attr('placeholder')) { e.removeClass('formerize-placeholder'); e.val(''); } }); }).bind("reset", function(event) { event.preventDefault(); $(this).find('select').val($('option:first').val()); $(this).find('input,textarea').each(function() { var e = $(this); var x; e.removeClass('formerize-placeholder'); switch (this.type) { case 'submit': case 'reset': break; case 'password': e.val(e.attr('defaultValue')); x = e.parent().find('input[name=' + e.attr('name') + '_fakeformerizefield]'); if (e.val() == '') { e.hide(); x.show(); } else { e.show(); x.hide(); } break; case 'checkbox': case 'radio': e.attr('checked', e.attr('defaultValue')); break; case 'text': case 'textarea': e.val(e.attr('defaultValue')); if (e.val() == '') { e.addClass('formerize-placeholder'); e.val(e.attr('placeholder')); } break; default: e.val(e.attr('defaultValue')); break; } }); window.setTimeout(function() { for (x in _fakes) _fakes[x].trigger('formerize_sync'); }, 10); }); return _form; };
					$form.n33_formerize();
				}

			}

		// Dropdowns.
			$('#nav > ul').dropotron({
				offsetY: -15,
				hoverDelay: 0,
				alignment: 'center'
			});

	});

})(jQuery);