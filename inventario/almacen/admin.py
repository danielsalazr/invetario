from django.contrib import admin
from django.utils.html import mark_safe

from rich.console import Console

from . import models

console = Console()

admin.site.register(models.FotosArticulos)


@admin.register(models.Bodega)
class BodegaAdmin(admin.ModelAdmin):
    search_fields = ("nombre",)
    list_display = ("nombre",)


@admin.register(models.Ubicacion)
class UbicacionAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "numero",
        "tipo",
        "nivel",
        "bodega",
        "padre",
        "nomenclatura",
        "codigo_contenedor",
    )
    list_filter = ("tipo", "bodega")
    search_fields = ("nombre", "codigo_contenedor", "nomenclatura", "numero__exact", "bodega__nombre")
    autocomplete_fields = ("padre", "bodega")
    readonly_fields = ("codigo_contenedor", "numero", "nivel", "creado_en", "actualizado_en")

    def save_model(self, request, obj, form, change):
        if change and obj.es_movil:
            anterior = models.Ubicacion.objects.get(pk=obj.pk)
            if anterior.padre_id != obj.padre_id or anterior.bodega_id != obj.bodega_id:
                from .services import mover_contenedor
                mover_contenedor(obj, obj.padre_id, obj.bodega_id, request.user)
                return
        super().save_model(request, obj, form, change)


@admin.register(models.MovimientoContenedor)
class MovimientoContenedorAdmin(admin.ModelAdmin):
    list_display = ("contenedor", "contenedor_principal", "bodega_origen", "bodega_destino", "fecha")
    list_filter = ("bodega_origen", "bodega_destino")
    search_fields = ("contenedor__codigo_contenedor", "ruta_origen", "ruta_destino")
    readonly_fields = tuple(field.name for field in models.MovimientoContenedor._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(models.Marca)
class MarcaAdmin(admin.ModelAdmin):
    search_fields = ("nombre",)
    list_display = ("nombre",)


@admin.register(models.UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    search_fields = ("nombre",)
    list_display = ("nombre",)


class DistribucionUbicacionInline(admin.TabularInline):
    model = models.DistribucionUbicacion
    extra = 0
    autocomplete_fields = ("ubicacion",)
    readonly_fields = ("actualizado_en",)


@admin.register(models.PlanoDistribucion)
class PlanoDistribucionAdmin(admin.ModelAdmin):
    list_display = ("bodega", "filas", "columnas", "tamano_celda", "actualizado_en")
    search_fields = ("bodega__nombre",)
    autocomplete_fields = ("bodega",)
    inlines = [DistribucionUbicacionInline]


class FotosInline(admin.StackedInline):
    model = models.FotosArticulos
    extra = 0
    readonly_fields = ["cover_preview"]

    def cover_preview(self, obj):
        if obj and obj.foto:
            return mark_safe(
                f'<img src="http://localhost:8000/media/{obj.foto}" '
                f'style="width: 200px; height: auto;" />'
            )
        return "No image available"

    cover_preview.short_description = "Cover Preview"


@admin.register(models.Articulo)
class ArticuloAdmin(admin.ModelAdmin):
    inlines = [FotosInline]
    list_display = (
        "code",
        "descripcion",
        "marca",
        "unidad_de_medida",
        "observacion",
        "cover_preview",
    )
    list_display_links = ("code",)
    search_fields = ("descripcion", "observacion", "marca__nombre")
    autocomplete_fields = ("marca", "unidad_de_medida")

    def cover_preview(self, obj):
        fotos = getattr(obj, "articuloFoto", None)
        if not fotos:
            return "No image available"
        try:
            imagenes = [
                f'<img src="http://localhost:8000/media/{foto.foto}" '
                f'style="width: 100px; height: auto; margin-right: 5px;" />'
                for foto in fotos.all()
                if foto.foto
            ]
            if imagenes:
                html = "".join(imagenes)
                console.log(html)
                return mark_safe(html)
        except Exception:
            pass
        return "No image available"
