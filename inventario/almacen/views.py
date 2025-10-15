from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.shortcuts import render

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Articulo,
    FotosArticulos,
    Inventario,
    Ubicacion,
)
from .serializers import ArticuloSerializer


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
