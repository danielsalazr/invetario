from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum, F
from django.db.models.functions import Coalesce
from rest_framework import serializers

from . import models
from .models import Ubicacion


class MarcaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Marca
        fields = ["id", "nombre"]
        read_only_fields = fields


class UnidadMedidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.UnidadMedida
        fields = ["id", "nombre"]
        read_only_fields = fields


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
    marca = serializers.PrimaryKeyRelatedField(
        queryset=models.Marca.objects.all(),
        allow_null=True,
        required=False,
    )
    unidad_de_medida = serializers.PrimaryKeyRelatedField(
        queryset=models.UnidadMedida.objects.all(),
        allow_null=True,
        required=False,
    )
    marca_detalle = MarcaSerializer(source="marca", read_only=True)
    unidad_medida_detalle = UnidadMedidaSerializer(
        source="unidad_de_medida",
        read_only=True,
    )
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
            "marca_detalle",
            "unidad_de_medida",
            "unidad_medida_detalle",
            "existencias",
            "fotos",
            "inventario",
        ]
        extra_kwargs = {
            "observacion": {"required": False},
        }
        read_only_fields = [
            "existencias",
            "fotos",
            "inventario",
            "marca_detalle",
            "unidad_medida_detalle",
        ]

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


class InventarioEntradaSerializer(serializers.Serializer):
    ubicacion = serializers.PrimaryKeyRelatedField(
        queryset=models.Ubicacion.objects.all(),
    )
    cantidad = serializers.IntegerField(min_value=1)

    default_error_messages = {
        "ubicacion_invalida": "Selecciona una ubicacion final valida.",
    }

    def validate(self, attrs):
        ubicacion = attrs["ubicacion"]
        if not ubicacion:
            self.fail("ubicacion_invalida")
        # Permitir registrar inventario directamente en cualquier nodo.
        # Si en el futuro se requieren restricciones de tipo, este es el punto para aplicarlas.
        return attrs

    def save(self, **kwargs):
        articulo = self.context["articulo"]
        ubicacion = self.validated_data["ubicacion"]
        cantidad = self.validated_data["cantidad"]

        with transaction.atomic():
            inventario_qs = models.Inventario.objects.select_for_update().filter(
                articulos=articulo,
                Ubicacion=ubicacion,
            )

            inventario = inventario_qs.first()
            if inventario:
                inventario_qs.update(cantidad=F("cantidad") + cantidad)
                inventario.refresh_from_db(fields=["cantidad"])
                created = False
            else:
                inventario = models.Inventario.objects.create(
                    articulos=articulo,
                    Ubicacion=ubicacion,
                    cantidad=cantidad,
                )
                created = True

            models.Entradas.objects.create(
                articulo=articulo,
                cantidad=cantidad,
            )

        self.instance = inventario
        self.created = created
        return inventario


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


class EstantesLoteSerializer(serializers.Serializer):
    bodega = serializers.PrimaryKeyRelatedField(
        queryset=models.Bodega.objects.all(),
    )
    nombre_base = serializers.CharField(max_length=Ubicacion._meta.get_field("nombre").max_length)
    descripcion = serializers.CharField(
        max_length=Ubicacion._meta.get_field("descripcion").max_length,
        allow_blank=True,
        required=False,
    )
    cantidad_estantes = serializers.IntegerField(min_value=1, max_value=200)
    paneles_por_estante = serializers.IntegerField(min_value=0, max_value=50)
    divisiones_por_panel = serializers.IntegerField(min_value=0, max_value=50)

    def validate(self, attrs):
        base = attrs.get("nombre_base", "").strip()
        if not base:
            raise serializers.ValidationError(
                {"nombre_base": "Ingresa un nombre base para los estantes."},
            )

        descripcion = attrs.get("descripcion", "")
        if descripcion:
            attrs["descripcion"] = descripcion.strip()

        attrs["nombre_base"] = base

        paneles = attrs.get("paneles_por_estante") or 0
        divisiones = attrs.get("divisiones_por_panel") or 0
        if paneles == 0 and divisiones > 0:
            raise serializers.ValidationError(
                {
                    "divisiones_por_panel": (
                        "Debes crear al menos un panel por estante para agregar divisiones."
                    )
                },
            )

        max_nombre = Ubicacion._meta.get_field("nombre").max_length
        cantidad = attrs.get("cantidad_estantes") or 1
        padding = 3 if cantidad >= 100 else 2 if cantidad >= 10 else 1
        reserva = padding + 1  # espacio + consecutivo
        if len(base) > max_nombre - reserva:
            raise serializers.ValidationError(
                {
                    "nombre_base": (
                        "Reduce el nombre base para permitir agregar el consecutivo automatico."
                    )
                },
            )

        return attrs


class DistribucionUbicacionSerializer(serializers.ModelSerializer):
    ubicacion_nombre = serializers.CharField(source="ubicacion.nombre", read_only=True)
    ubicacion_tipo = serializers.CharField(source="ubicacion.tipo", read_only=True)
    ubicacion_nomenclatura = serializers.CharField(source="ubicacion.nomenclatura", read_only=True)
    es_pasillo = serializers.BooleanField(read_only=True)
    nombre_pasillo = serializers.CharField(read_only=True)

    class Meta:
        model = models.DistribucionUbicacion
        fields = [
            "id",
            "ubicacion",
            "ubicacion_nombre",
            "ubicacion_tipo",
            "ubicacion_nomenclatura",
            "fila",
            "columna",
            "ancho",
            "alto",
            "es_pasillo",
            "nombre_pasillo",
            "actualizado_en",
        ]
        read_only_fields = ["id", "ubicacion_nombre", "ubicacion_tipo", "ubicacion_nomenclatura", "actualizado_en"]


class PlanoDistribucionSerializer(serializers.ModelSerializer):
    distribuciones = DistribucionUbicacionSerializer(many=True, read_only=True)

    class Meta:
        model = models.PlanoDistribucion
        fields = ["id", "bodega", "filas", "columnas", "tamano_celda", "distribuciones"]
        read_only_fields = ["id", "bodega", "distribuciones"]
