"""Movimientos del arbol sin alterar las referencias del inventario."""
from collections import defaultdict

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Bodega, MovimientoContenedor, Ubicacion


@transaction.atomic
def mover_contenedor(contenedor, destino_id, bodega_id=None, usuario=None):
    # Serializar cambios de jerarquia, tambien los realizados desde Django Admin.
    list(Bodega.objects.select_for_update().order_by("pk").values_list("pk", flat=True))
    anterior = Ubicacion.objects.select_for_update().get(pk=contenedor.pk)
    if not anterior.es_movil or not contenedor.es_movil:
        raise ValidationError({"contenedor": "Solo los contenedores son moviles."})

    destino = None
    if destino_id is not None:
        try:
            destino = Ubicacion.objects.get(pk=destino_id)
        except Ubicacion.DoesNotExist as exc:
            raise ValidationError({"destino": "El destino no existe."}) from exc
        if bodega_id is not None and bodega_id != destino.bodega_id:
            raise ValidationError({"bodega": "La bodega debe coincidir con la del destino."})
        bodega_id = destino.bodega_id
    elif bodega_id is None:
        raise ValidationError({"bodega": "Selecciona una bodega cuando el contenedor queda sin padre."})

    try:
        bodega = Bodega.objects.get(pk=bodega_id)
    except Bodega.DoesNotExist as exc:
        raise ValidationError({"bodega": "La bodega no existe."}) from exc

    hijos = defaultdict(list)
    for pk, padre_id in Ubicacion.objects.values_list("pk", "padre_id"):
        hijos[padre_id].append(pk)
    subtree = set()
    pendientes = [anterior.pk]
    while pendientes:
        pk = pendientes.pop()
        if pk in subtree:
            raise ValidationError({"destino": "La jerarquia actual contiene un ciclo."})
        subtree.add(pk)
        pendientes.extend(hijos[pk])
    if destino_id in subtree:
        raise ValidationError({"destino": "No puedes mover un contenedor a si mismo ni a uno de sus descendientes."})
    if anterior.padre_id == destino_id and anterior.bodega_id == bodega.pk:
        return anterior

    descendientes = subtree - {anterior.pk}
    if Ubicacion.objects.filter(pk__in=descendientes).exclude(tipo=Ubicacion.Tipo.CONTENEDOR).exists():
        raise ValidationError({"contenedor": "Un contenedor solo puede contener otros contenedores o articulos."})

    anteriores = [anterior, *Ubicacion.objects.filter(pk__in=descendientes)]
    origenes = {
        nodo.pk: (nodo.padre_id, nodo.bodega_id, nodo.ruta)
        for nodo in anteriores
    }

    contenedor.padre = destino
    contenedor.bodega = bodega
    contenedor._movimiento_interno = True
    try:
        # Validar antes de escribir; codigo y tipo no pueden cambiar en un traslado.
        contenedor.full_clean()
        Ubicacion.objects.filter(pk__in=descendientes).update(bodega=bodega)
        contenedor.save()
        for hijo in Ubicacion.objects.filter(pk__in=descendientes):
            hijo.full_clean()
    finally:
        contenedor._movimiento_interno = False

    for nodo in Ubicacion.objects.filter(pk__in=subtree):
        padre_origen, bodega_origen, ruta_origen = origenes[nodo.pk]
        MovimientoContenedor.objects.create(
            contenedor=nodo,
            contenedor_principal=contenedor,
            origen_id=padre_origen,
            destino_id=nodo.padre_id,
            bodega_origen_id=bodega_origen,
            bodega_destino=bodega,
            ruta_origen=ruta_origen,
            ruta_destino=nodo.ruta,
            usuario=usuario if usuario is not None and usuario.is_authenticated else None,
        )
    return contenedor
