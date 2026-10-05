from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import ValidationError

from .models import Articulo, Bodega, Inventario, TrasladoArticulo, Ubicacion


@transaction.atomic
def trasladar_articulo(articulo_id, origen_id, destino_id, cantidad, usuario=None):
    if origen_id == destino_id:
        raise ValidationError({"destino": "El destino debe ser distinto del origen."})
    if isinstance(cantidad, bool) or not isinstance(cantidad, int) or cantidad <= 0:
        raise ValidationError({"cantidad": "Indica una cantidad entera positiva."})
    # Mismo orden de bloqueos que los traslados de cajas: bodega antes de articulo.
    list(Bodega.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
    articulo = Articulo.objects.select_for_update().get(pk=articulo_id)
    ubicaciones = {item.pk: item for item in Ubicacion.objects.select_for_update().select_related("bodega").filter(pk__in=[origen_id, destino_id]).order_by("pk")}
    if len(ubicaciones) != 2:
        raise ValidationError({"destino": "El origen o el destino ya no existe."})
    origen, destino = ubicaciones[origen_id], ubicaciones[destino_id]
    registros = list(Inventario.objects.select_for_update().filter(articulos=articulo, Ubicacion_id__in=[origen_id, destino_id]).order_by("id"))
    if any(item.cantidad < 0 for item in registros):
        raise ValidationError({"cantidad": "El inventario de origen o destino tiene cantidades negativas y requiere revision."})
    disponibles = [item for item in registros if item.Ubicacion_id == origen_id]
    saldo = sum(item.cantidad for item in disponibles)
    if cantidad > saldo:
        raise ValidationError({"cantidad": f"Solo hay {saldo} unidades disponibles en el origen."})
    pendiente = cantidad
    for item in disponibles:
        retirar = min(item.cantidad, pendiente)
        if retirar:
            item.cantidad -= retirar
            item.save(update_fields=["cantidad"])
            pendiente -= retirar
        if pendiente == 0:
            break
    inventario_destino = next((item for item in registros if item.Ubicacion_id == destino_id), None)
    if inventario_destino:
        Inventario.objects.filter(pk=inventario_destino.pk).update(cantidad=F("cantidad") + cantidad)
        inventario_destino.refresh_from_db(fields=["cantidad"])
    else:
        inventario_destino = Inventario.objects.create(articulos=articulo, Ubicacion=destino, cantidad=cantidad)
    traslado = TrasladoArticulo.objects.create(
        articulo=articulo, origen=origen, destino=destino, cantidad=cantidad,
        bodega_origen=origen.bodega, bodega_destino=destino.bodega,
        usuario=usuario if usuario and usuario.is_authenticated else None,
        descripcion_articulo=articulo.descripcion,
        nombre_bodega_origen=origen.bodega.nombre, nombre_bodega_destino=destino.bodega.nombre,
        ruta_origen=origen.ruta, ruta_destino=destino.ruta,
        codigo_origen=origen.codigo_contenedor or origen.nomenclatura or str(origen.pk),
        codigo_destino=destino.codigo_contenedor or destino.nomenclatura or str(destino.pk),
    )
    return traslado, inventario_destino, saldo - cantidad


@transaction.atomic
def trasladar_lote(movimientos, usuario=None):
    # Un fallo en cualquier fila revierte el lote completo.
    list(Bodega.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
    ids = sorted({fila["articulo"].pk for fila in movimientos})
    list(Articulo.objects.select_for_update().filter(pk__in=ids).order_by("pk").values_list("pk", flat=True))
    resultados = []
    for indice, fila in enumerate(movimientos, start=1):
        try:
            resultados.append(trasladar_articulo(fila["articulo"].pk, fila["origen"].pk, fila["destino"].pk, fila["cantidad"], usuario))
        except ValidationError as error:
            raise ValidationError({"fila": indice, "detalle": error.detail}) from error
    return resultados
