import markdown
# import re
from django import template
from django.template.defaultfilters import stringfilter
from django.utils.encoding import force_unicode
from django.utils.safestring import mark_safe
# from django.core.urlresolvers import reverse, NoReverseMatch

register = template.Library()


@register.filter(is_safe=True)
@stringfilter
def custom_markdown(value):
    extensions = ["nl2br", ]

    return mark_safe(markdown.markdown(force_unicode(value),
                                       extensions,
                                       safe_mode=True,
                                       enable_attributes=False))


# @register.simple_tag(takes_context=True)
# def active(context, pattern_or_urlname):
#     try:
#         pattern = '^' + reverse(pattern_or_urlname)
#     except NoReverseMatch:
#         pattern = pattern_or_urlname
#     path = context['request'].path
#     if re.search(pattern, path):
#         return 'current'
#     return ''