from django.db import models
from django.utils import timezone
from PIL import Image
from rich.console import Console
console = Console()
# Create your models here.


class Ubicacion(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=30)
    nivel = models.IntegerField(default=0)
    padre_id = models.ForeignKey('self', on_delete=models.DO_NOTHING, related_name="padre", null=True, blank=True)
    nomenclatura = models.CharField(max_length=25)



class Articulo(models.Model):
    # id = models.IntegerField(default= self.objects.count + 1)
    code = models.CharField(primary_key=True, max_length=30, unique=True)
    descripcion = models.CharField(max_length=255)
    observacion = models.CharField(max_length=255, null=True, blank=True)
    foto = models.ImageField(upload_to='fotos_articulos/')


    def save(self, *args, **kwargs):
        # Llama al método original `save` para guardar temporalmente la imagen
        super().save(*args, **kwargs)

        # Abre la imagen con Pillow
        if self.foto:
            img_path = self.foto.path  # Ruta de la imagen en el sistema de archivos
            img = Image.open(img_path)

            console.log(img.height)
            console.log(img.width)

            # Verifica si la imagen necesita ser redimensionada
            if img.height > 800 or img.width > 800:  # Ejemplo: limitar dimensiones máximas
                # Calcula las proporciones manteniendo el aspecto
                # max_size = (2000, 1500)
                max_size = (img.height / 1.4, img.width / 1.4)
                img.thumbnail(max_size)

                console.log(img.height)
                console.log(img.width)

                # Sobrescribe la imagen existente con la versión redimensionada
                img.save(img_path, optimize=True, quality=20)


# esto debe ser de acuerdo a la cantidad de empaques que tenga el articulo,
# una entrada por paquete
# se actualiza de acuerdo a las entradas y salidas 
# las entradas son el historico de lo que entro
# las salidas el historico de lo contrario
class Inventario(models.Model):
    id = models.AutoField(primary_key=True)
    articulos = models.ForeignKey(Articulo, on_delete=models.DO_NOTHING, related_name="articulo",)
    cantidad = models.IntegerField(default=1)
    Ubicacion = models.ForeignKey(Ubicacion, on_delete=models.DO_NOTHING, related_name="ubicacion",)



class Entradas(models.Model):
    id = models.AutoField(primary_key=True)
    articulo = models.ForeignKey(Articulo, on_delete=models.DO_NOTHING, related_name="articuloe",)
    cantidad = models.IntegerField(default=1)
    fecha = models.DateTimeField(auto_now=timezone.now)



class Salidas(models.Model):
    id = models.AutoField(primary_key=True)
    Articulo = models.ForeignKey(Articulo, on_delete=models.DO_NOTHING, related_name="articulos",)
    cantidad = models.IntegerField(default=1)
    fecha = models.DateTimeField(auto_now=timezone.now)
