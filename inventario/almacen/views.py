
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.utils import timezone
from django.contrib.auth.decorators import login_required


from rest_framework.response import Response
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import JSONRenderer, TemplateHTMLRenderer
from rest_framework.views import APIView
from rest_framework import status


from .serializers import (
    ArticuloSerializer, 
    # PDFFileSerializer,
)


from datetime import datetime

# descarga excel
# from openpyxl import Workbook
# from openpyxl.styles import Alignment, numbers, PatternFill, Color, colors, Font
# import django_excel as excel

import json

# import numpy as np
import time
from io import BytesIO

from PIL import Image
import io
# from pyexcel_xlsx  import save_data

# from asyncio import transports
# from ctypes import alignment
from rich.console import Console
console = Console()

from imagekit import ImageSpec, processors 
from imagekit.processors import Resize


def articulo(request):
    # infoUser = {'username': request.user.first_name}
    # context = {'user':infoUser}
    context ={}
    return render(request, 'inventario/index.html', context)
    


class Articulos(APIView):

    def get(self, request,):

        # #  Traer el estado de cuenta de un cliente
        # if 'cardCode'in request.GET and 'database' in request.GET:
        #     cardCode = request.GET.get('cardCode')
        #     database = request.GET.get('database')

        #     accountStatementInfo, total = getInvoicesDue(cardCode, database)
        #     # console.log(accountStatementInfo)
        #     # console.log(accountStatementInfo[:1])
        #     # AccountstatementInfoSerialized = AccountStatementSerializer(data = accountStatementInfo, many = True)
        #     res = json.dumps(accountStatementInfo)
        #     # console.log(accountStatementInfo)

        #     if len(accountStatementInfo) > 0:
        #         return Response({"res": res, "total": total}, status=status.HTTP_200_OK)
        #     elif len(accountStatementInfo) == 0:
        #         return Response({'response' : 'sin contenido'}, status=status.HTTP_404_NOT_FOUND)
        #     else:
        #         return Response(AccountstatementInfoSerialized.errors, status=status.HTTP_400_BAD_REQUEST)

        # # traer info de clientes
        # if 'database' in request.GET:
        #     print("En la consulta")
        #     database = request.GET.get('database')
        #     customersInfo = getDataCustomer(database, None)

        #     console.log(customersInfo)

        #     return Response(customersInfo, status=status.HTTP_200_OK)

        return Response( {"ok":"200"}, status=status.HTTP_200_OK)


    def post(self, request):

        console.log(request.data)

        data = request.data.copy()

        archivo = request.FILES.get('foto')

        console.log(archivo.name)  # File name
        console.log(archivo.size)
        # console.log(archivo.height)
        # console.log(archivo.width)

        # Abrir la imagen
        # img = Image.open(archivo)

        # # Reducir el tamaño de la imagen
        # img.thumbnail((800, 600))  # Reducir a 800x600 pixels

        # # Guardar la imagen reducida en un BytesIO
        # archivo_reducido = io.BytesIO()
        # img.save(archivo_reducido, format='JPEG', quality=80)

        # # Volver al principio del archivo
        # archivo_reducido.seek(0)

        # # Actualizar el archivo en el request
        # data["foto"] = archivo_reducido

        # data["foto"] = archivo

        # data['ususarioCreador'] = request.session.get('usuario')

        # usuario = request.session['usuario']
        # sapToken = request.session.get('SAPSLTOKEN')

        # console.log(request.data)
        # console.log(usuario)

        serializer = ArticuloSerializer(data=data)
        if serializer.is_valid():

            # console.log(serializer.data)
            console.log("Primer valido")
            serializer.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
        # return Response({"response" : "creado"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        

        # return Response({'response': 'Ejecucion terminada'}, status=status.HTTP_201_CREATED)
