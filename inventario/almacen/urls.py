from django.urls import path
from . import views

urlpatterns = [
    path("articulo/", views.articulo, name="articulo"),
    path("articulos/", views.Articulos.as_view(), name="articulos"),
    path(
        "articulos/<int:articulo_id>/inventario/",
        views.ArticuloInventarioView.as_view(),
        name="articulo_inventario",
    ),
    path("marcas/api/", views.MarcasView.as_view(), name="marcas_api"),
    path(
        "unidades-medida/api/",
        views.UnidadesMedidaView.as_view(),
        name="unidades_medida_api",
    ),
    path("bodegas/api/", views.BodegasView.as_view(), name="bodegas_api"),
    path("ubicaciones/", views.ubicaciones, name="ubicaciones"),
    path("ubicaciones/mapa/", views.mapa_ubicaciones, name="ubicaciones_mapa"),
    path(
        "ubicaciones/estantes/lote/",
        views.estantes_lote,
        name="ubicaciones_estantes_lote",
    ),
    path("ubicaciones/api/", views.UbicacionesView.as_view(), name="ubicaciones_api"),
    path(
        "ubicaciones/estantes/lote/api/",
        views.CrearEstantesLoteView.as_view(),
        name="ubicaciones_estantes_lote_api",
    ),
]
