from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from django.db.models.functions import Coalesce
from rest_framework import serializers

from . import models


class InventarioSerializer(serializers.ModelSerializer):
    ubicacion = serializers.SerializerMethodField()

    class Meta:
        model = models.Inventario
        fields = ["id", "cantidad", "ubicacion"]
        read_only_fields = fields

    def get_ubicacion(self, obj):
        ubicacion = getattr(obj, "Ubicacion", None)
        if not ubicacion:
            return None
        bodega = getattr(ubicacion, "bodega", None)
        return {
            "id": ubicacion.id,
            "nombre": ubicacion.nombre,
            "nomenclatura": ubicacion.nomenclatura,
            "numero": ubicacion.numero,
            "nivel": ubicacion.nivel,
            "tipo": ubicacion.tipo,
            "tipo_display": ubicacion.get_tipo_display()
            if hasattr(ubicacion, "get_tipo_display")
            else ubicacion.tipo,
            "ruta": ubicacion.ruta if hasattr(ubicacion, "ruta") else ubicacion.nombre,
            "bodega": bodega.nombre if bodega else None,
        }


class ArticuloSerializer(serializers.ModelSerializer):
    existencias = serializers.SerializerMethodField()
    fotos = serializers.SerializerMethodField()
    inventario = InventarioSerializer(source="articulo", many=True, read_only=True)

    class Meta:
        model = models.Articulo
        fields = [
            "code",
            "descripcion",
            "observacion",
            "marca",
            "unidad_de_medida",
            "existencias",
            "fotos",
            "inventario",
        ]
        extra_kwargs = {
            "observacion": {"required": False},
            "marca": {"required": False},
            "unidad_de_medida": {"required": False},
        }
        read_only_fields = ["existencias", "fotos", "inventario"]

    def get_existencias(self, obj):
        if hasattr(obj, "existencias_total"):
            return obj.existencias_total
        return (
            obj.articulo.aggregate(
                total=Coalesce(Sum("cantidad"), 0)
            ).get("total")
            or 0
        )

    def get_fotos(self, obj):
        request = self.context.get("request")
        fotos_queryset = getattr(obj, "articuloFoto", None)
        if not hasattr(fotos_queryset, "all"):
            return []
        urls = []
        for foto in fotos_queryset.all():
            if not foto.foto:
                continue
            url = foto.foto.url
            if request:
                url = request.build_absolute_uri(url)
            urls.append(url)
        return urls


class FotosArticulosSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.FotosArticulos
        fields = ["id", "articulo", "foto"]
        read_only_fields = ["id", "articulo", "foto"]


class UbicacionTreeSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    ruta = serializers.CharField(read_only=True)
    bodega_nombre = serializers.CharField(source="bodega.nombre", read_only=True)
    hijos = serializers.SerializerMethodField()

    class Meta:
        model = models.Ubicacion
        fields = [
            "id",
            "nombre",
            "numero",
            "tipo",
            "tipo_display",
            "nivel",
            "ruta",
            "nomenclatura",
            "descripcion",
            "bodega",
            "bodega_nombre",
            "padre",
            "hijos",
        ]
        read_only_fields = fields

    def get_hijos(self, obj):
        hijos_qs = getattr(obj, "_prefetched_hijos", None)
        if hijos_qs is None:
            hijos_qs = obj.hijos.all().order_by("nivel", "nombre")
        return UbicacionTreeSerializer(
            hijos_qs,
            many=True,
            context=self.context,
        ).data if hijos_qs else []


class UbicacionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Ubicacion
        fields = [
            "id",
            "nombre",
            "tipo",
            "padre",
            "bodega",
            "nomenclatura",
            "descripcion",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        instancia = models.Ubicacion(
            **{**attrs, "id": getattr(self.instance, "id", None)}
        )
        try:
            instancia.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

    def create(self, validated_data):
        return models.Ubicacion.objects.create(**validated_data)
