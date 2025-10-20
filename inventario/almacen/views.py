from collections import defaultdict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.shortcuts import render, get_object_or_404

from rest_framework import status
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Articulo,
    Bodega,
    FotosArticulos,
    Inventario,
    Marca,
    UnidadMedida,
    Ubicacion,
    PlanoDistribucion,
    DistribucionUbicacion,
)
from .serializers import (
    ArticuloSerializer,
    InventarioEntradaSerializer,
    InventarioSerializer,
    MarcaSerializer,
    UnidadMedidaSerializer,
    UbicacionCreateSerializer,
    UbicacionTreeSerializer,
    EstantesLoteSerializer,
)


def articulo(request):
    return render(request, "inventario/index.html", {})


def distribucion_ubicaciones(request):
    bodegas = Bodega.objects.order_by("nombre")
    return render(
        request,
        "inventario/distribucion.html",
        {"bodegas": bodegas},
    )


class Articulos(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        articulos_queryset = (
            Articulo.objects.all()
            .select_related("marca", "unidad_de_medida")
            .prefetch_related(
                "articuloFoto",
                "articulo__Ubicacion__bodega",
            )
            .annotate(
                existencias_total=Coalesce(Sum("articulo__cantidad"), 0),
            )
            .order_by("descripcion")
        )

        serializer = ArticuloSerializer(
            articulos_queryset,
            many=True,
            context={"request": request},
        )

        resumen = {
            "articulos": articulos_queryset.count(),
            "existencias": (
                Inventario.objects.aggregate(
                    total=Coalesce(Sum("cantidad"), 0),
                ).get("total")
                or 0
            ),
            "ubicaciones": Ubicacion.objects.count(),
            "fotos": FotosArticulos.objects.count(),
        }

        return Response(
            {"articulos": serializer.data, "resumen": resumen},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        data = request.data.copy()
        data.pop("foto", None)

        serializer = ArticuloSerializer(
            data=data,
            context={"request": request},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            articulo = serializer.save()

            archivos = request.FILES.getlist("foto")
            for archivo in archivos:
                if not archivo:
                    continue
                FotosArticulos.objects.create(articulo=articulo, foto=archivo)

        respuesta = ArticuloSerializer(
            articulo,
            context={"request": request},
        ).data

        return Response(respuesta, status=status.HTTP_201_CREATED)


class MarcasView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        marcas = Marca.objects.order_by("nombre")
        serializer = MarcaSerializer(marcas, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UnidadesMedidaView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        unidades = UnidadMedida.objects.order_by("nombre")
        serializer = UnidadMedidaSerializer(unidades, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BodegasView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        bodegas = list(
            Bodega.objects.order_by("nombre").values("id", "nombre"),
        )
        return Response(bodegas, status=status.HTTP_200_OK)


class ArticuloInventarioView(APIView):
    renderer_classes = [JSONRenderer]
    def post(self, request, articulo_id):
        articulo = get_object_or_404(Articulo, pk=articulo_id)

        serializer = InventarioEntradaSerializer(
            data=request.data,
            context={"articulo": articulo},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        inventario = serializer.save()

        respuesta = InventarioSerializer(
            inventario,
            context={"request": request},
        ).data

        codigo = status.HTTP_201_CREATED if getattr(serializer, "created", False) else status.HTTP_200_OK
        return Response(respuesta, status=codigo)


def ubicaciones(request):
    return render(request, "inventario/ubicaciones.html", {})


def mapa_ubicaciones(request):
    return render(request, "inventario/mapa_fisico.html", {})


def estantes_lote(request):
    bodegas = list(
        Bodega.objects.order_by("nombre").values("id", "nombre"),
    )
    return render(
        request,
        "inventario/estantes_lote.html",
        {"bodegas": bodegas},
    )


class UbicacionesView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        bodega_id = request.GET.get("bodega")
        ubicaciones_qs = (
            Ubicacion.objects.select_related("bodega", "padre")
            .prefetch_related("hijos")
            .order_by("bodega__nombre", "nivel", "numero", "nombre")
        )
        if bodega_id:
            ubicaciones_qs = ubicaciones_qs.filter(bodega_id=bodega_id)

        ubicaciones_lista = list(ubicaciones_qs)
        hijos_map = {}
        for ubicacion in ubicaciones_lista:
            hijos_map.setdefault(ubicacion.padre_id, []).append(ubicacion)

        for ubicacion in ubicaciones_lista:
            hijos = hijos_map.get(ubicacion.id, [])
            hijos.sort(key=lambda item: (item.nivel, item.nombre.lower()))
            ubicacion._prefetched_hijos = hijos  # noqa: SLF001

        raices = hijos_map.get(None, [])
        raices.sort(key=lambda item: (item.nivel, item.nombre.lower()))

        serializer = UbicacionTreeSerializer(
            raices,
            many=True,
            context={"request": request},
        )

        bodegas_data = [
            {"id": bodega.id, "nombre": bodega.nombre}
            for bodega in Bodega.objects.order_by("nombre")
        ]

        tipos_data = [
            {
                "value": valor,
                "label": etiqueta,
                "nivel": Ubicacion.NIVEL_MAP.get(valor),
                "padres_validos": [
                    padre for padre in (Ubicacion.PADRES_VALIDOS.get(valor) or [])
                    if padre is not None
                ],
                "permite_raiz": None in (Ubicacion.PADRES_VALIDOS.get(valor) or []),
            }
            for valor, etiqueta in Ubicacion.Tipo.choices
        ]

        return Response(
            {
                "ubicaciones": serializer.data,
                "bodegas": bodegas_data,
                "tipos": tipos_data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        data = request.data.copy()
        if data.get("padre") in ("", "null", None):
            data["padre"] = None

        serializer = UbicacionCreateSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ubicacion = serializer.save()
        ubicacion.refresh_from_db()
        nodo = UbicacionTreeSerializer(
            ubicacion,
            context={"request": request},
        ).data

        return Response(nodo, status=status.HTTP_201_CREATED)


class CrearEstantesLoteView(APIView):
    renderer_classes = [JSONRenderer]
    def post(self, request):
        serializer = EstantesLoteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        bodega = data["bodega"]
        nombre_base = data["nombre_base"]
        descripcion = data.get("descripcion") or ""
        cantidad = data["cantidad_estantes"]
        paneles = data["paneles_por_estante"]
        divisiones = data["divisiones_por_panel"]

        estantes_creados = []
        padding_estante = 3 if cantidad >= 100 else 2 if cantidad >= 10 else 1
        padding_panel = 3 if paneles >= 100 else 2 if paneles >= 10 else 1
        padding_division = (
            3 if divisiones >= 100 else 2 if divisiones >= 10 else 1
        )

        nombre_max = Ubicacion._meta.get_field("nombre").max_length

        existentes = set(
            Ubicacion.objects.filter(
                bodega=bodega,
                padre__isnull=True,
                tipo=Ubicacion.Tipo.ESTANTE,
            ).values_list("nombre", flat=True)
        )

        def generar_nombre_estante(indice):
            sufijo = str(indice).zfill(padding_estante) if padding_estante > 1 else str(indice)
            base_nombre = f"{nombre_base} {sufijo}".strip()
            nombre = base_nombre
            contador = 2
            while nombre in existentes:
                nombre = f"{base_nombre} ({contador})"
                contador += 1
            if len(nombre) > nombre_max:
                raise ValueError(
                    "El nombre generado supera el maximo permitido. Ajusta el nombre base.",
                )
            existentes.add(nombre)
            return nombre

        total_paneles = 0
        total_divisiones = 0

        try:
            with transaction.atomic():
                for indice in range(1, cantidad + 1):
                    nombre_estante = generar_nombre_estante(indice)
                    estante = Ubicacion.objects.create(
                        nombre=nombre_estante,
                        tipo=Ubicacion.Tipo.ESTANTE,
                        bodega=bodega,
                        descripcion=descripcion,
                    )

                    if paneles > 0:
                        for panel_idx in range(1, paneles + 1):
                            sufijo_panel = (
                                str(panel_idx).zfill(padding_panel)
                                if padding_panel > 1
                                else str(panel_idx)
                            )
                            panel = Ubicacion.objects.create(
                                nombre=f"Panel {sufijo_panel}",
                                tipo=Ubicacion.Tipo.PANEL,
                                padre=estante,
                                bodega=bodega,
                            )

                            if divisiones > 0:
                                for div_idx in range(1, divisiones + 1):
                                    sufijo_div = (
                                        str(div_idx).zfill(padding_division)
                                        if padding_division > 1
                                        else str(div_idx)
                                    )
                                    Ubicacion.objects.create(
                                        nombre=f"Division {sufijo_div}",
                                        tipo=Ubicacion.Tipo.DIVISION,
                                        padre=panel,
                                        bodega=bodega,
                                    )
                                total_divisiones += divisiones
                        total_paneles += paneles

                    estantes_creados.append(
                        {
                            "id": estante.id,
                            "nombre": estante.nombre,
                            "nomenclatura": estante.nomenclatura,
                            "paneles": paneles,
                            "divisiones": divisiones,
                        },
                    )
        except ValueError as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DjangoValidationError as error:
            return Response(
                error.message_dict if hasattr(error, "message_dict") else {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        resumen = {
            "estantes": len(estantes_creados),
            "paneles": total_paneles,
            "divisiones": total_divisiones,
        }

        return Response(
            {
                "bodega": {"id": bodega.id, "nombre": bodega.nombre},
                "resumen": resumen,
                "estantes": estantes_creados,
            },
            status=status.HTTP_201_CREATED,
        )


class PlanoDistribucionView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request):
        bodega_id = request.GET.get("bodega")
        if not bodega_id:
            return Response(
                {"detail": "Debes seleccionar una bodega."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bodega = get_object_or_404(Bodega, pk=bodega_id)

        plano, _ = PlanoDistribucion.objects.get_or_create(bodega=bodega)

        ubicaciones_qs = (
            Ubicacion.objects.filter(bodega=bodega, nivel=1)
            .order_by("numero", "nombre")
            .only("id", "nombre", "tipo", "nomenclatura")
        )

        distribuciones = list(
            plano.distribuciones.select_related("ubicacion").order_by("fila", "columna")
        )

        mapa_existentes = {
            dist.ubicacion_id: dist
            for dist in distribuciones
            if not dist.es_pasillo and dist.ubicacion_id
        }

        items = []

        # Agregar pasillos existentes
        for distribucion in distribuciones:
            if distribucion.es_pasillo:
                items.append(
                    {
                        "id": distribucion.id,
                        "nombre": distribucion.nombre_pasillo or "Pasillo",
                        "tipo": "PASILLO",
                        "es_pasillo": True,
                        "fila": distribucion.fila,
                        "columna": distribucion.columna,
                        "ancho": distribucion.ancho,
                        "alto": distribucion.alto,
                    }
                )

        # Agregar ubicaciones
        for indice, ubicacion in enumerate(ubicaciones_qs):
            distribucion = mapa_existentes.get(ubicacion.id)
            if distribucion:
                fila = distribucion.fila
                columna = distribucion.columna
                ancho = distribucion.ancho
                alto = distribucion.alto
            else:
                fila = (indice // plano.columnas) + 1
                columna = (indice % plano.columnas) + 1
                ancho = 1
                alto = 1
            items.append(
                {
                    "id": ubicacion.id,
                    "nombre": ubicacion.nombre,
                    "tipo": ubicacion.tipo,
                    "nomenclatura": ubicacion.nomenclatura,
                    "fila": fila,
                    "columna": columna,
                    "ancho": ancho,
                    "alto": alto,
                    "es_pasillo": False,
                },
            )

        plano.ajustar_dimensiones_si_necesario(len(items))
        plano.save(update_fields=["filas", "columnas", "tamano_celda", "actualizado_en"])

        items.sort(key=lambda item: (item["fila"], item["columna"]))

        return Response(
            {
                "bodega": {"id": bodega.id, "nombre": bodega.nombre},
                "canvas": {
                    "rows": plano.filas,
                    "cols": plano.columnas,
                    "cell_size": plano.tamano_celda,
                },
                "items": items,
                "plano_id": plano.id,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        data = request.data
        bodega_id = data.get("bodega")
        if not bodega_id:
            return Response(
                {"detail": "Es necesario indicar la bodega."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bodega = get_object_or_404(Bodega, pk=bodega_id)
        plano, _ = PlanoDistribucion.objects.get_or_create(bodega=bodega)

        canvas = data.get("canvas") or {}
        filas = int(canvas.get("rows") or plano.filas or 1)
        columnas = int(canvas.get("cols") or plano.columnas or 1)
        tamano_celda = int(canvas.get("cell_size") or plano.tamano_celda or 120)

        items = data.get("items") or []
        if not isinstance(items, list):
            return Response(
                {"detail": "El formato de elementos es invalido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ubicaciones_validas = set(
            Ubicacion.objects.filter(bodega=bodega, nivel=1).values_list("id", flat=True)
        )

        if not ubicaciones_validas:
            return Response(
                {"detail": "La bodega seleccionada no tiene ubicaciones de nivel 1."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        registros_ubicaciones = []
        registros_pasillos = []
        max_fila = filas
        max_columna = columnas
        vistos = set()
        pasillos_ids = set()

        for indice, item in enumerate(items):
            fila = item.get("fila")
            columna = item.get("columna")

            if fila is None or columna is None:
                fila = (indice // columnas) + 1
                columna = (indice % columnas) + 1

            try:
                fila = int(fila)
                columna = int(columna)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Las filas y columnas deben ser numeros enteros."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            max_fila = max(max_fila, fila)
            max_columna = max(max_columna, columna)

            if item.get("es_pasillo"):
                pasillos_ids.add(item.get("id"))
                registros_pasillos.append(
                    {
                        "id": item.get("id"),
                        "nombre": item.get("nombre") or "Pasillo",
                        "fila": fila,
                        "columna": columna,
                        "ancho": int(item.get("ancho") or 1),
                        "alto": int(item.get("alto") or 1),
                    }
                )
                continue

            ubicacion_id = item.get("id") or item.get("ubicacion")
            if ubicacion_id is None:
                return Response(
                    {"detail": f"El elemento en la posicion {indice + 1} no tiene una ubicacion asociada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                ubicacion_id = int(ubicacion_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": f"La ubicacion indicada en la posicion {indice + 1} es invalida."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ubicacion_id not in ubicaciones_validas:
                return Response(
                    {"detail": f"La ubicacion {ubicacion_id} no pertenece a la bodega seleccionada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ubicacion_id in vistos:
                return Response(
                    {"detail": "Hay ubicaciones duplicadas en la distribucion."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            vistos.add(ubicacion_id)

            registros_ubicaciones.append(
                {
                    "ubicacion_id": ubicacion_id,
                    "fila": fila,
                    "columna": columna,
                    "ancho": int(item.get("ancho") or 1),
                    "alto": int(item.get("alto") or 1),
                }
            )

        filas = max(filas, max_fila)
        columnas = max(columnas, max_columna)

        with transaction.atomic():
            plano.filas = max(1, filas)
            plano.columnas = max(1, columnas)
            plano.tamano_celda = max(64, tamano_celda)
            plano.save()

            distribuciones = list(plano.distribuciones.select_for_update())
            existentes = {
                distribucion.ubicacion_id: distribucion
                for distribucion in distribuciones
                if not distribucion.es_pasillo and distribucion.ubicacion_id
            }
            pasillos_existentes = {
                distribucion.id: distribucion
                for distribucion in distribuciones
                if distribucion.es_pasillo
            }

            ids_actuales = set()
            for registro in registros_ubicaciones:
                distribucion = existentes.get(registro["ubicacion_id"])
                if distribucion:
                    distribucion.fila = registro["fila"]
                    distribucion.columna = registro["columna"]
                    distribucion.ancho = max(1, registro["ancho"])
                    distribucion.alto = max(1, registro["alto"])
                    distribucion.save()
                else:
                    DistribucionUbicacion.objects.create(
                        plano=plano,
                        ubicacion_id=registro["ubicacion_id"],
                        fila=registro["fila"],
                        columna=registro["columna"],
                        ancho=max(1, registro["ancho"]),
                        alto=max(1, registro["alto"]),
                    )
                ids_actuales.add(registro["ubicacion_id"])

            eliminar = [
                distribucion_id
                for distribucion_id in existentes.keys()
                if distribucion_id not in ids_actuales
            ]
            if eliminar:
                DistribucionUbicacion.objects.filter(
                    plano=plano, ubicacion_id__in=eliminar
                ).delete()

            pasillos_ids_guardados = set()
            for registro in registros_pasillos:
                registro_id = registro.get("id")
                distribucion = pasillos_existentes.get(int(registro_id)) if isinstance(registro_id, int) else None
                if distribucion:
                    distribucion.nombre_pasillo = registro["nombre"]
                    distribucion.fila = registro["fila"]
                    distribucion.columna = registro["columna"]
                    distribucion.ancho = max(1, registro["ancho"])
                    distribucion.alto = max(1, registro["alto"])
                    distribucion.save(
                        update_fields=["nombre_pasillo", "fila", "columna", "ancho", "alto", "actualizado_en"]
                    )
                    pasillos_ids_guardados.add(distribucion.id)
                else:
                    nuevo = DistribucionUbicacion.objects.create(
                        plano=plano,
                        es_pasillo=True,
                        nombre_pasillo=registro["nombre"],
                        fila=registro["fila"],
                        columna=registro["columna"],
                        ancho=max(1, registro["ancho"]),
                        alto=max(1, registro["alto"]),
                    )
                    pasillos_ids_guardados.add(nuevo.id)

            eliminar_pasillos = [
                distribucion_id
                for distribucion_id in pasillos_existentes.keys()
                if distribucion_id not in pasillos_ids_guardados
            ]
            if eliminar_pasillos:
                DistribucionUbicacion.objects.filter(
                    plano=plano, pk__in=eliminar_pasillos
                ).delete()

        return Response(
            {"detail": "Distribucion guardada correctamente."},
            status=status.HTTP_200_OK,
        )


class UbicacionInventarioDetalleView(APIView):
    renderer_classes = [JSONRenderer]
    def get(self, request, ubicacion_id):
        ubicacion = get_object_or_404(
            Ubicacion.objects.select_related("bodega"),
            pk=ubicacion_id,
        )

        ubicaciones_data = list(
            Ubicacion.objects.filter(bodega=ubicacion.bodega).values(
                "id",
                "padre_id",
                "nombre",
                "nomenclatura",
                "tipo",
            )
        )
        info_map = {row["id"]: row for row in ubicaciones_data}
        if ubicacion.id not in info_map:
            info_map[ubicacion.id] = {
                "id": ubicacion.id,
                "padre_id": ubicacion.padre_id,
                "nombre": ubicacion.nombre,
                "nomenclatura": ubicacion.nomenclatura,
                "tipo": ubicacion.tipo,
            }

        children_map = defaultdict(list)
        for row in ubicaciones_data:
            children_map[row["padre_id"]].append(row["id"])

        def construir_ruta_local(ubicacion_obj):
            if not ubicacion_obj:
                return ""
            actual_id = ubicacion_obj.id
            partes = []
            while actual_id is not None:
                data = info_map.get(actual_id)
                if not data:
                    break
                nombre = data.get("nombre") or ""
                if nombre:
                    partes.append(nombre)
                actual_id = data.get("padre_id")
            return " / ".join(reversed(partes))

        ids = []
        stack = [ubicacion.id]
        vistos = set()
        while stack:
            current = stack.pop()
            if current in vistos:
                continue
            vistos.add(current)
            ids.append(current)
            for child_id in children_map.get(current, []):
                if child_id not in vistos:
                    stack.append(child_id)

        inventario_qs = (
            Inventario.objects.filter(Ubicacion_id__in=ids)
            .select_related(
                "Ubicacion",
                "articulos__unidad_de_medida",
                "articulos__marca",
            )
            .order_by(
                "Ubicacion__nomenclatura",
                "Ubicacion__nombre",
                "articulos__descripcion",
            )
        )

        items = []
        totales_unidades = defaultdict(int)
        total_cantidad = 0

        for registro in inventario_qs:
            articulo = registro.articulos
            ubicacion_item = registro.Ubicacion
            unidad_nombre = (
                articulo.unidad_de_medida.nombre
                if articulo and articulo.unidad_de_medida
                else "Sin unidad"
            )
            cantidad = registro.cantidad or 0
            totales_unidades[unidad_nombre] += cantidad
            total_cantidad += cantidad
            items.append(
                {
                    "inventario_id": registro.id,
                    "cantidad": cantidad,
                    "unidad": unidad_nombre,
                    "articulo": {
                        "id": articulo.code if articulo else None,
                        "descripcion": articulo.descripcion if articulo else "",
                        "marca": (
                            articulo.marca.nombre if articulo and articulo.marca else ""
                        ),
                    },
                    "ubicacion": {
                        "id": ubicacion_item.id if ubicacion_item else None,
                        "nombre": ubicacion_item.nombre if ubicacion_item else "",
                    "nomenclatura": (
                        ubicacion_item.nomenclatura if ubicacion_item else ""
                    ),
                    "tipo": ubicacion_item.tipo if ubicacion_item else "",
                    "tipo_display": (
                        ubicacion_item.get_tipo_display() if ubicacion_item else ""
                    ),
                    "ruta": construir_ruta_local(ubicacion_item),
                },
            }
        )

        totales_por_unidad = [
            {"unidad": unidad, "cantidad": cantidad}
            for unidad, cantidad in totales_unidades.items()
        ]
        totales_por_unidad.sort(key=lambda item: item["unidad"])

        ubicaciones_incluidas = []
        for ubicacion_in_id in ids:
            data = info_map.get(ubicacion_in_id)
            if data:
                ubicaciones_incluidas.append(
                    {
                        "id": ubicacion_in_id,
                        "nombre": data.get("nombre") or "",
                        "nomenclatura": data.get("nomenclatura") or "",
                        "tipo": data.get("tipo") or "",
                    }
                )

        respuesta = {
            "ubicacion": {
                "id": ubicacion.id,
                "nombre": ubicacion.nombre,
                "nomenclatura": ubicacion.nomenclatura,
                "tipo": ubicacion.tipo,
                "ruta": construir_ruta_local(ubicacion),
                "bodega": {
                    "id": ubicacion.bodega_id,
                    "nombre": ubicacion.bodega.nombre if ubicacion.bodega else "",
                },
            },
            "alcance": {
                "ubicaciones": len(ids),
                "descendientes": max(len(ids) - 1, 0),
            },
            "totales": {
                "registros": len(items),
                "cantidad_total": total_cantidad,
                "por_unidad": totales_por_unidad,
            },
            "items": items,
            "ubicaciones_incluidas": ubicaciones_incluidas,
        }

        return Response(respuesta, status=status.HTTP_200_OK)
