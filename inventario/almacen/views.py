from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.shortcuts import render

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
    UbicacionCreateSerializer,
    UbicacionTreeSerializer,
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


def ubicaciones(request):
    return render(request, "inventario/ubicaciones.html", {})


def mapa_ubicaciones(request):
    return render(request, "inventario/mapa_fisico.html", {})


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
