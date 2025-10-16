from django.urls import path
from . import views

urlpatterns = [
    path("articulo/", views.articulo, name="articulo"),
    path("articulos/", views.Articulos.as_view(), name="articulos"),
    path("ubicaciones/", views.ubicaciones, name="ubicaciones"),
    path("ubicaciones/mapa/", views.mapa_ubicaciones, name="ubicaciones_mapa"),
    path("ubicaciones/api/", views.UbicacionesView.as_view(), name="ubicaciones_api"),
]
