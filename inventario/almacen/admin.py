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
    )
    list_filter = ("tipo", "bodega")
    search_fields = ("nombre", "nomenclatura", "numero__exact", "bodega__nombre")
    autocomplete_fields = ("padre", "bodega")
    readonly_fields = ("numero", "nivel", "creado_en", "actualizado_en")


@admin.register(models.Marca)
class MarcaAdmin(admin.ModelAdmin):
    search_fields = ("nombre",)
    list_display = ("nombre",)


@admin.register(models.UnidadMedida)
class UnidadMedidaAdmin(admin.ModelAdmin):
    search_fields = ("nombre",)
    list_display = ("nombre",)


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
