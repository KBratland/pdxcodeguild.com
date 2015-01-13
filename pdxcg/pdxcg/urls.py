from django.conf.urls import patterns, include, url
from django.conf import settings
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from .sitemaps import StaticViewSitemap

admin.autodiscover()

sitemaps = {
    'static': StaticViewSitemap,
}


urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    (r'^accounts/logout/$', 'django.contrib.auth.views.logout', {'next_page': '/'}),
    (r'^accounts/', include('allauth.urls')),
    url(r'^$|^index.html?$', 'pdxcodeguild.views.index', name='mainpage'),
    url(r'^about/$', 'pdxcodeguild.views.about', name='about'),
    url(r'^apply/$', 'pdxcodeguild.views.apply', name='apply'),
    url(r'^student_apply/$', 'pdxcodeguild.views.student_apply', name='student_apply'),
    url(r'^studentinfo/$', 'pdxcodeguild.views.intake', name='student_intake'),
    url(r'^student_comment/$', 'pdxcodeguild.views.student_comment', name='student_comment'),
    url(r'^thanks/$', 'pdxcodeguild.views.thanks', name='thanks'),
    url(r'^contact/$', 'pdxcodeguild.views.contact', name='contact'),
    url(r'^faq/$', 'pdxcodeguild.views.faq', name='faq'),
    url(r'^gettechnical/$', 'pdxcodeguild.views.gettechnical', name='gettechnical'),
    url(r'^individualized/$', 'pdxcodeguild.views.individualized', name='individualized'),
    url(r'^devbootcamp/$', 'pdxcodeguild.views.jrdevbootcamp', name='devbootcamp'),
    url(r'^evening_bootcamp/$', 'pdxcodeguild.views.evening_bootcamp', name='evening_bootcamp'),
    url(r'^partner/$', 'pdxcodeguild.views.partner', name='partner'),
    url(r'^program/$', 'pdxcodeguild.views.program', name='program'),
    url(r'^sponsor/$', 'pdxcodeguild.views.sponsor', name='sponsor'),
    url(r'^team/$', 'pdxcodeguild.views.team', name='team'),
    url(r'^students/$', 'pdxcodeguild.views.student', name='students'),
    url(r'^advisors/$', 'pdxcodeguild.views.advisors', name='advisors'),
    url(r'^value/$', 'pdxcodeguild.views.value', name='value'),
    url(r'^ppm/$', 'pdxcodeguild.views.ppm', name='ppm'),
    url(r'^pythonquiz/$', 'pdxcodeguild.views.pythonquiz', name='pythonquiz'),
    url(r'^forum/', include('pybb.urls', namespace='pybb')),
    #url(r'^markitup/', include('markitup.urls')),
    url(r'^blog/', include('zinnia.urls', namespace='zinnia'), name='blog'),
    #(r'^comments/', include('django_comments.urls')),
    url(r'^sitemap\.xml$', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),

)

if settings.DEBUG:
    urlpatterns += patterns(
    'django.views.static',
    (r'media/(?P<path>.*)',
    'serve',
    {'document_root': settings.MEDIA_ROOT}),)