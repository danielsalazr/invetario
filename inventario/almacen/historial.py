from datetime import date, datetime, time, timedelta

from django.db.models import CharField, Count, F, Q, Sum, Value
from django.utils import timezone

from .models import Entradas, Salidas, TrasladoArticulo


def limite_fecha(fecha):
    value = datetime.combine(fecha, time.min)
    return timezone.make_aware(value) if timezone.is_aware(timezone.now()) else value


def consultar_historial(filtros):
    consultas = []
    resumen = {}
    for modelo, articulo_field, tipo in ((Entradas, "articulo", "ENTRADA"), (Salidas, "Articulo", "SALIDA"), (TrasladoArticulo, "articulo", "TRASLADO")):
        query = modelo.objects.all()
        if filtros.get("tipo") and filtros["tipo"] != tipo:
            query = query.none()
        texto = filtros.get("articulo", "")
        if texto:
            if (filtros.get("modo") or "id") == "id":
                query = query.filter(**{f"{articulo_field}_id": int(texto)})
            else:
                query = query.filter(Q(descripcion_articulo__icontains=texto) | Q(**{f"{articulo_field}__descripcion__icontains": texto}))
        bodega = filtros.get("bodega")
        if bodega:
            if tipo == "TRASLADO":
                query = query.filter(Q(bodega_origen=bodega) | Q(bodega_destino=bodega))
            else:
                query = query.filter(Q(bodega_movimiento=bodega) | Q(bodega_movimiento__isnull=True, ubicacion__bodega=bodega))
        if filtros.get("desde"):
            query = query.filter(fecha__gte=limite_fecha(filtros["desde"]))
        if filtros.get("hasta") and filtros["hasta"] < date.max:
            query = query.filter(fecha__lt=limite_fecha(filtros["hasta"] + timedelta(days=1)))
        resumen[tipo] = query.aggregate(registros=Count("id"), unidades=Sum("cantidad"))
        campos = {
            "id": F("id"), "fecha": F("fecha"), "cantidad": F("cantidad"),
            "tipo": Value(tipo, output_field=CharField()),
            "articulo_id_historial": F(f"{articulo_field}_id"),
            "descripcion_actual": F(f"{articulo_field}__descripcion"),
            "descripcion_articulo": F("descripcion_articulo"),
            "ubicacion_id": F("origen_id" if tipo == "TRASLADO" else "ubicacion_id"),
            "bodega_movimiento_id": F("bodega_origen_id" if tipo == "TRASLADO" else "bodega_movimiento_id"),
            "nombre_bodega": F("nombre_bodega_origen" if tipo == "TRASLADO" else "nombre_bodega"),
            "ruta_ubicacion": F("ruta_origen" if tipo == "TRASLADO" else "ruta_ubicacion"),
            "codigo_ubicacion": F("codigo_origen" if tipo == "TRASLADO" else "codigo_ubicacion"),
            "bodega_actual": F("bodega_origen__nombre" if tipo == "TRASLADO" else "ubicacion__bodega__nombre"),
            "ubicacion_actual": F("origen__nombre" if tipo == "TRASLADO" else "ubicacion__nombre"),
            "codigo_actual": F("origen__codigo_contenedor" if tipo == "TRASLADO" else "ubicacion__codigo_contenedor"),
            "nombre_bodega_destino": F("nombre_bodega_destino") if tipo == "TRASLADO" else Value("", output_field=CharField()),
            "ruta_destino": F("ruta_destino") if tipo == "TRASLADO" else Value("", output_field=CharField()),
            "codigo_destino": F("codigo_destino") if tipo == "TRASLADO" else Value("", output_field=CharField()),
        }
        # Anotar todas las columnas mantiene su orden SQL entre modelos diferentes.
        columnas = {f"h_{nombre}": valor for nombre, valor in campos.items()}
        consultas.append(query.order_by().annotate(**columnas).values(*columnas))
    return consultas[0].union(*consultas[1:], all=True).order_by("-h_fecha", "-h_tipo", "-h_id"), resumen
