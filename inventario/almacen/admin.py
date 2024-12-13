from django.contrib import admin
from . import models

# Register your models here.
# admin.site.register(Estado)
# admin.site.register(Inventario)
# admin.site.register(Marca)

@admin.register(models.Articulo)
class InventarioAdmin(admin.ModelAdmin):
    list_display = (
        # 'id',
        'code',
        'descripcion',
        'observacion',
        'foto',
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

# @admin.register(Estado)
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

