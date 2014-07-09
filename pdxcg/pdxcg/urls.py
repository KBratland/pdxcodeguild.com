from django.conf.urls import patterns, include, url
from django.conf import settings
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'pdxcg.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),

    url(r'^admin/', include(admin.site.urls)),
    (r'^accounts/', include('allauth.urls')),
    url(r'^$', 'pdxcodeguild.views.index', name='mainpage'),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^about/$', 'pdxcodeguild.views.about', name='about'),
    url(r'^apply/$', 'pdxcodeguild.views.apply', name='apply'),
    url(r'^thanks/$', 'pdxcodeguild.views.thanks', name='thanks'),
    url(r'^contact/$', 'pdxcodeguild.views.contact', name='contact'),
    url(r'^faq/$', 'pdxcodeguild.views.faq', name='faq'),
    url(r'^gettechnical/$', 'pdxcodeguild.views.gettechnical', name='gettechnical'),
    url(r'^individualized/$', 'pdxcodeguild.views.individualized', name='individualized'),
    url(r'^jrdevbootcamp/$', 'pdxcodeguild.views.jrdevbootcamp', name='jrdevbootcamp'),
    url(r'^evening_bootcamp/$', 'pdxcodeguild.views.evening_bootcamp', name='evening_bootcamp'),
    url(r'^partner/$', 'pdxcodeguild.views.partner', name='partner'),
    url(r'^program/$', 'pdxcodeguild.views.program', name='program'),
    url(r'^sponsor/$', 'pdxcodeguild.views.sponsor', name='sponsor'),
    url(r'^team/$', 'pdxcodeguild.views.team', name='team'),
    url(r'^advisors/$', 'pdxcodeguild.views.advisors', name='advisors'),
    url(r'^value/$', 'pdxcodeguild.views.value', name='value'),
    (r'^forum/', include('pybb.urls', namespace='pybb')),
    url(r'^blog/', include('pdx_blog.urls')),
    url(r'^blog/comments/', include('fluent_comments.urls')),
    url(r'^articles/comments/', include('django.contrib.comments.urls')),

)

if settings.DEBUG:
    urlpatterns += patterns(
    'django.views.static',
    (r'media/(?P<path>.*)',
    'serve',
    {'document_root': settings.MEDIA_ROOT}),)