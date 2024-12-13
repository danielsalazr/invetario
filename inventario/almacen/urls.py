from django.urls import path
from . import views

urlpatterns = [
    
    path('articulo/', views.articulo, name="articulo"),
    path('articulos/', views.Articulos.as_view(), name="articulos"),
    # path('getRowInvoices/<str:databaseSelect>', views.getRowInvoices, name="getRowInvoices"),
    # path('getRowInvoicesList/<str:databaseSelect>', views.getRowInvoicesList, name="getRowInvoicesList"),
    
]