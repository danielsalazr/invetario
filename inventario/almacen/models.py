from django.db import models

# Create your models here.


class Ubicacion(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=30)
    nivel = models.IntegerField(default=0)
    padre = models.ForeignKey('self', on_delete=models.DO_NOTHING, related_name="padre", null=True, blank=True)
    nomenclatura = models.CharField(max_length=25)






class Articulos(models.Model):
    id = models.AutoField()
    code = models.CharField(primary_key=True, max_length=30, unique=True)
    descripcion = models.CharField(max_length=255)
    observacion = models.CharField(max_length=255)



class Inventario(models.Model):
    id = models.AutoField(primary_key=True)
    Articulos = models.