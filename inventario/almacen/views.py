from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.shortcuts import render, get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Articulo,
    Bodega,
    FotosArticulos,
    Inventario,
    Ubicacion,
)
from .serializers import (
    ArticuloSerializer,
    InventarioEntradaSerializer,
    InventarioSerializer,
    UbicacionCreateSerializer,
    UbicacionTreeSerializer,
    EstantesLoteSerializer,
)


def articulo(request):
    return render(request, "inventario/index.html", {})


class Articulos(APIView):
    def get(self, request):
        articulos_queryset = (
            Articulo.objects.all()
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


class BodegasView(APIView):
    def get(self, request):
        bodegas = list(
            Bodega.objects.order_by("nombre").values("id", "nombre"),
        )
        return Response(bodegas, status=status.HTTP_200_OK)


class ArticuloInventarioView(APIView):
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
