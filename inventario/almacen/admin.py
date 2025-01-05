from django.contrib import admin
from django.utils.html import mark_safe


from . import models
from rich.console import Console
console=Console()

# Register your models here.
# admin.site.register(Estado)
# admin.site.register(Inventario)
admin.site.register(models.FotosArticulos)

class FotosInline(admin.StackedInline):
    model = models.FotosArticulos
    extra = 0
    readonly_fields = ['cover_preview']

    def cover_preview(self, obj):
        # console.log("activadp")
        # console.log(obj)
        # console.log(obj.foto)
        if obj:
            return mark_safe(f'<img src="http://localhost:8000/media/{obj.foto}" style="width: 200px; height: auto;" />')
        return "No image available"

    cover_preview.short_description = "Cover Preview"

@admin.register(models.Articulo)
class InventarioAdmin(admin.ModelAdmin):
    inlines = [FotosInline]

    list_display = (
        # 'id',
        'code',
        'descripcion',
        'observacion',
        'cover_preview',
        # 'foto',
        # 'marca',
    )

    list_display_links = (
        # 'id',
        'code',
        # 'enableCopy',
    )

    # fields = [
    #   ('articulo', 'codigo'),
    #   ('observacion', ),
    #   ('estado', 'marca'),
    # ]

    # search_fields = ['articulo', 'codigo']

    def cover_preview(self, obj):
        # Verifica si el artículo tiene imágenes asociadas
        console.log(obj.articuloFoto.all())
        try:
            fotos = obj.articuloFoto.all() #first()  # Obtén la primera foto relacionada
            # console.log(fotos.foto)
            if len(fotos) > 0:  # Verifica si existe una foto
                # return mark_safe(f'<img src="http://localhost:8000/media/{fotos.foto}" style="width: 100px; height: auto;" />')
                imagenes_html = ''.join([
                    f'<img src="http://localhost:8000/media/{foto.foto}" style="width: 100px; height: auto; margin-right: 5px;" />'
                    for foto in fotos
                ])
                console.log(imagenes_html)
                return mark_safe(imagenes_html)
            return "No image available"
        except:
            pass
        # 

# @admin.register(models.FotosArticulos)
# class Estadodmin(admin.ModelAdmin):
#     list_display = (
#         'id',
#         'nombre',
#     )

#     list_display_links = (
#         'id',
#         'nombre',
#         # 'enableCopy',
#     )


# @admin.register(Marca)
# class MarcaAdmin(admin.ModelAdmin):
#     list_display = (
#         'id',
#         'nombre',
#     )

#     list_display_links = (
#         'id',
#         'nombre',
#         # 'enableCopy',
#     )

