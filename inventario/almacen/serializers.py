from rest_framework import serializers
from . import models
# from .models import (
#     ImpresionTickets,
#     ImpresionTicketsItems,
# )

from rich.console import Console
console = Console()

from django.forms.models import model_to_dict



class ArticuloSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Articulo
        fields = [
            'code', 
            'descripcion',
            'observacion',
            'foto',
        ]

        extra_kwargs = {
            'observacion': {'required': False},
        }


# class PedidoSerializer(serializers.ModelSerializer):
#     # Anidar el serializer de DetallePedido
#     items = DetallePedidoSerializer(many=True,)  # many=True para múltiples items

#     class Meta:
#         model = ImpresionTickets
#         fields = [
#             'ordenDeCompra',
#             'comentario',
#             'items',
#             'company',
#             'id',
#             'fechaCreacion',
#             'ususarioCreador',
#         ]

#         extra_kwargs = {
#             'items': {'required': False},
#             'id': {'required': False},
#             'fechaCreacion': {'required': False},
#         }

#     # Sobrescribir el método create para manejar la creación de items
#     def create(self, validated_data):

#         console.log(validated_data)
#         items_data = validated_data.pop('items')  # Remover detalles
#         console.log(items_data)
#         console.log(validated_data)
#         pedido = ImpresionTickets.objects.create(**validated_data)  # Crear el pedido
#         for item_data in items_data:
#            # ImpresionTicketsItems.objects.create(id=pedido, **item_data)  # Crear cada detalle
#            ImpresionTicketsItems.objects.create(id_ticket=pedido, **item_data)  # Crear cada detalle
#         console.log(vars(pedido))
        
#         return pedido

    # def to_representation(self, instance):
    #     # Llamar al método de la clase base para obtener la representación inicial
    #     representation = super().to_representation(instance)
    #     # Agregar los items relacionados
    #     representation['items'] = DetallePedidoSerializer(
    #         ImpresionTicketsItems.objects.filter(id_ticket=instance), many=True
    #     ).data
    #     return representation