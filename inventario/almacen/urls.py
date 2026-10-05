from django.urls import path
from django.views.generic import RedirectView, TemplateView
from . import views

urlpatterns = [
    path("ayuda/nomenclatura/", TemplateView.as_view(template_name="inventario/ayuda_nomenclatura.html"), name="ayuda_nomenclatura"),
    path("articulo/", views.articulo, name="articulo"),
    path("articulos/gestion/", views.gestion_articulos, name="gestion_articulos"),
    path("almacenar/", views.almacenar, name="almacenar"),
    path("picking/", views.picking, name="picking"),
    path("traslados/", views.trasladar, name="traslados"),
    path("trasladar/", RedirectView.as_view(pattern_name="traslados"), name="trasladar"),
    path("traslados/lote/", views.LoteTrasladosView.as_view(), name="traslados_lote"),
    path("movimientos/historial/", views.historial_movimientos, name="historial_movimientos"),
    path("articulos/historial/", RedirectView.as_view(pattern_name="historial_movimientos", query_string=True), name="historial_articulos"),
    path("articulos/<int:articulo_id>/traslados/", views.ArticuloTrasladoView.as_view(), name="articulo_traslado"),
    path("articulos/", views.Articulos.as_view(), name="articulos"),
    path(
        "articulos/<int:articulo_id>/inventario/",
        views.ArticuloInventarioView.as_view(),
        name="articulo_inventario",
    ),
    path("marcas/api/", views.MarcasView.as_view(), name="marcas_api"),
    path("articulos/<int:articulo_id>/salidas/", views.ArticuloSalidaView.as_view(), name="articulo_salida"),
    path(
        "unidades-medida/api/",
        views.UnidadesMedidaView.as_view(),
        name="unidades_medida_api",
    ),
    path("bodegas/api/", views.BodegasView.as_view(), name="bodegas_api"),
    path("ubicaciones/", views.ubicaciones, name="ubicaciones"),
    path("ubicaciones/nueva/", views.ubicaciones, {"modo_creacion": "ubicacion"}, name="nueva_ubicacion"),
    path("ubicaciones/contenedores/nuevo/", views.ubicaciones, {"modo_creacion": "contenedor"}, name="nuevo_contenedor"),
    path("ubicaciones/fijas/api/", views.UbicacionesView.as_view(), {"modo_creacion": "ubicacion"}, name="crear_ubicacion_fija"),
    path("ubicaciones/contenedores/api/", views.UbicacionesView.as_view(), {"modo_creacion": "contenedor"}, name="crear_contenedor"),
    path("ubicaciones/mapa/", views.mapa_ubicaciones, name="ubicaciones_mapa"),
    path(
        "ubicaciones/distribucion/",
        views.distribucion_ubicaciones,
        name="ubicaciones_distribucion",
    ),
    path(
        "ubicaciones/estantes/lote/",
        views.estantes_lote,
        name="ubicaciones_estantes_lote",
    ),
    path("ubicaciones/api/", views.UbicacionesView.as_view(), name="ubicaciones_api"),
    path("ubicaciones/<int:ubicacion_id>/mover/", views.MoverContenedorView.as_view(), name="mover_contenedor"),
    path("ubicaciones/<int:ubicacion_id>/movimientos/", views.MovimientosContenedorView.as_view(), name="movimientos_contenedor"),
    path(
        "ubicaciones/estantes/lote/api/",
        views.CrearEstantesLoteView.as_view(),
        name="ubicaciones_estantes_lote_api",
    ),
    path(
        "ubicaciones/distribucion/api/",
        views.PlanoDistribucionView.as_view(),
        name="ubicaciones_distribucion_api",
    ),
    path(
        "ubicaciones/<int:ubicacion_id>/inventario/detalle/",
        views.UbicacionInventarioDetalleView.as_view(),
        name="ubicacion_inventario_detalle",
    ),
]
