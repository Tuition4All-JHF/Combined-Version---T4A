"""
Tuition4All - Main URL Routing Configuration

This file serves as the top-level URL dispatcher for the Tuition4All platform.
It delegates routing to the respective application modules:

Web Applications:
- /admin/         -> Django built-in admin portal
- /               -> core (Homepage, role-based dashboards, site navigation)
- /accounts/      -> accounts (User registration, login, logout, profile handling)
- /courses/       -> courses (Course management, live classes, assignments, recordings)
- /chat/          -> chat (1-to-1 direct messaging, AI chat assistant sessions)

REST API Endpoints (Mobile Application & Integrations):
- /api/auth/      -> accounts.api_urls (JWT token auth, registration, parent-student link)
- /api/           -> tutorsapp.urls (Tutor profiles, student bookings, course APIs, AI TuitionBot)
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Built-in Django Admin Interface
    path('admin/', admin.site.urls),

    # Core Web Application (Dashboards, Public Pages, Analytics)
    path('', include('core.urls')),

    # User Authentication & Web Profiles
    path('accounts/', include('accounts.urls')),

    # Course Catalog, Live Sessions & Study Content
    path('courses/', include('courses.urls')),

    # Real-Time & AI Chat Interfaces
    path('chat/', include('chat.urls')),
    
    # --- Mobile App / REST API Endpoints ---
    path('api/auth/', include('accounts.api_urls')),
    path('api/', include('tutorsapp.urls')),
]

# Serve user-uploaded media files in development mode
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
