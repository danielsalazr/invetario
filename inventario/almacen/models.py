from django.db import models, transaction
from django.utils import timezone
from PIL import Image
from rich.console import Console
console = Console()
# Create your models here.

class Bodega(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=30)

    def __str__(self):
        return self.nombre


class Ubicacion(models.Model):
    class Tipo(models.TextChoices):
        ESTANTE = "ESTANTE", "Estante"
        ESTIBA = "ESTIBA", "Estiba"
        PANEL = "PANEL", "Panel"
        DIVISION = "DIVISION", "Division"
        CONTENEDOR = "CONTENEDOR", "Contenedor"

    NIVEL_MAP = {
        Tipo.ESTANTE: 1,
        Tipo.ESTIBA: 1,
        Tipo.PANEL: 2,
        Tipo.DIVISION: 3,
        Tipo.CONTENEDOR: 4,
    }

    PADRES_VALIDOS = {
        Tipo.ESTANTE: {None},
        Tipo.ESTIBA: {None},
        Tipo.PANEL: {Tipo.ESTANTE},
        Tipo.DIVISION: {Tipo.PANEL},
        Tipo.CONTENEDOR: {None, Tipo.ESTANTE, Tipo.ESTIBA, Tipo.PANEL, Tipo.DIVISION},
    }

    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=60)
    tipo = models.CharField(max_length=15, choices=Tipo.choices, default=Tipo.ESTANTE)
    nivel = models.PositiveSmallIntegerField(editable=False, default=1)
    padre = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="hijos",
        null=True,
        blank=True,
    )
    numero = models.PositiveIntegerField(default=0)
    nomenclatura = models.CharField(max_length=50, blank=True)
    bodega = models.ForeignKey(Bodega, on_delete=models.CASCADE, related_name="ubicaciones")
    descripcion = models.CharField(max_length=120, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        verbose_name = "Ubicacion"
        verbose_name_plural = "Ubicaciones"
        ordering = ("bodega__nombre", "nivel", "numero", "nombre")
        constraints = [
            models.UniqueConstraint(
                fields=["bodega", "nombre", "padre"],
                name="ubicacion_unique_nombre_por_padre",
            )
        ]

    def __str__(self):
        return self.ruta

    @property
    def ruta(self):
        partes = [self.nombre]
        padre = self.padre
        while padre:
            partes.append(padre.nombre)
            padre = padre.padre
        return " / ".join(reversed(partes))

    def clean(self):
        from django.core.exceptions import ValidationError

        tipo = self.tipo or self.Tipo.ESTANTE
        padre = self.padre
        nivel_calculado = self.NIVEL_MAP.get(tipo)

        if padre and padre.pk == self.pk:
            raise ValidationError({"padre": "La ubicacion no puede ser su propio padre."})

        tipos_validos = self.PADRES_VALIDOS.get(tipo, {None})
        padre_tipo = padre.tipo if padre else None
        if padre_tipo not in tipos_validos:
            mensajes = {
                self.Tipo.ESTANTE: "Un estante no puede tener padre.",
                self.Tipo.ESTIBA: "Una estiba no puede tener padre.",
                self.Tipo.PANEL: "Un panel debe pertenecer a un estante.",
                self.Tipo.DIVISION: "Una division debe pertenecer a un panel.",
                self.Tipo.CONTENEDOR: (
                    "Un contenedor debe pertenecer a un estante, estiba, panel o division, o quedar sin padre."
                ),
            }
            raise ValidationError({"padre": mensajes.get(tipo, "Padre invalido para este tipo.")})

        if padre and padre.bodega_id != self.bodega_id:
            raise ValidationError({"padre": "La ubicacion padre debe pertenecer a la misma bodega."})

        self.nivel = nivel_calculado or 1

    def calcular_nomenclatura(self):
        numeros = []
        nodo = self
        while nodo:
            if nodo.numero:
                numeros.append(str(nodo.numero))
            nodo = nodo.padre
        return "_".join(reversed(numeros))

    def refrescar_nomenclatura(self, cascade=False):
        nueva = self.calcular_nomenclatura()
        if self.nomenclatura != nueva:
            type(self).objects.filter(pk=self.pk).update(nomenclatura=nueva)
            self.nomenclatura = nueva
        if cascade:
            for hijo in type(self).objects.filter(padre=self):
                hijo.refrescar_nomenclatura(cascade=True)

    @classmethod
    def scope_queryset(cls, tipo, padre_id=None, bodega_id=None):
        qs = cls.objects.filter(tipo=tipo)
        if tipo in (cls.Tipo.ESTANTE, cls.Tipo.ESTIBA):
            qs = qs.filter(bodega_id=bodega_id)
        elif tipo in (cls.Tipo.PANEL, cls.Tipo.DIVISION):
            qs = qs.filter(padre_id=padre_id)
        elif tipo == cls.Tipo.CONTENEDOR:
            if padre_id:
                qs = qs.filter(padre_id=padre_id)
            else:
                qs = qs.filter(padre__isnull=True, bodega_id=bodega_id)
        return qs.order_by("creado_en", "id")

    @classmethod
    def _scope_inicio(cls, tipo):
        return 100 if tipo in (cls.Tipo.ESTANTE, cls.Tipo.ESTIBA) else 1

    @classmethod
    def recalcular_scope(cls, tipo, padre_id=None, bodega_id=None):
        with transaction.atomic():
            items = list(
                cls.scope_queryset(tipo, padre_id=padre_id, bodega_id=bodega_id).select_related("padre")
            )
            if not items:
                return

            inicio = cls._scope_inicio(tipo)
            actualizaciones = []
            for offset, item in enumerate(items):
                nuevo_numero = inicio + offset
                if item.numero != nuevo_numero:
                    item.numero = nuevo_numero
                    actualizaciones.append(item)
                else:
                    item.numero = nuevo_numero  # mantener valor actualizado en memoria

            if actualizaciones:
                cls.objects.bulk_update(actualizaciones, ["numero"])

            for item in items:
                item.refrescar_nomenclatura(cascade=True)

    def reasignar_contenedores_de_panel(self):
        panel = self.padre
        if not panel:
            return
        contenedores = type(self).objects.filter(padre=panel, tipo=self.Tipo.CONTENEDOR)
        if not contenedores.exists():
            return
        contenedores.update(padre=self)
        type(self).recalcular_scope(self.Tipo.CONTENEDOR, panel.id, panel.bodega_id)
        type(self).recalcular_scope(self.Tipo.CONTENEDOR, self.id, self.bodega_id)

    def save(self, *args, **kwargs):
        self.full_clean()
        is_new = self._state.adding

        prev_padre_id = prev_bodega_id = prev_tipo = None
        if not is_new and self.pk:
            previo = type(self).objects.get(pk=self.pk)
            prev_padre_id = previo.padre_id
            prev_bodega_id = previo.bodega_id
            prev_tipo = previo.tipo

        asignar_contenedores = False
        if is_new and self.tipo == self.Tipo.DIVISION and self.padre_id:
            asignar_contenedores = not type(self).objects.filter(
                padre_id=self.padre_id, tipo=self.Tipo.DIVISION
            ).exists()

        super().save(*args, **kwargs)

        if is_new and self.tipo == self.Tipo.DIVISION and asignar_contenedores:
            self.reasignar_contenedores_de_panel()

        type(self).recalcular_scope(self.tipo, self.padre_id, self.bodega_id)

        if (
            prev_tipo
            and (
                prev_tipo != self.tipo
                or prev_padre_id != self.padre_id
                or prev_bodega_id != self.bodega_id
            )
        ):
            type(self).recalcular_scope(prev_tipo, prev_padre_id, prev_bodega_id)

        if self.tipo == self.Tipo.DIVISION:
            type(self).recalcular_scope(self.Tipo.CONTENEDOR, self.id, self.bodega_id)

        self.refresh_from_db(fields=["numero", "nomenclatura"])



class PlanoDistribucion(models.Model):
    bodega = models.OneToOneField(
        Bodega,
        on_delete=models.CASCADE,
        related_name="plano_distribucion",
    )
    filas = models.PositiveIntegerField(default=6)
    columnas = models.PositiveIntegerField(default=8)
    tamano_celda = models.PositiveIntegerField(default=120)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Plano de distribucion"
        verbose_name_plural = "Planos de distribucion"

    def ajustar_dimensiones_si_necesario(self, cantidad_elementos):
        if self.columnas < 1:
            self.columnas = 1
        filas_necesarias = max(1, (cantidad_elementos + self.columnas - 1) // self.columnas)
        if self.filas < filas_necesarias:
            self.filas = filas_necesarias

    def save(self, *args, **kwargs):
        self.filas = max(1, self.filas or 1)
        self.columnas = max(1, self.columnas or 1)
        self.tamano_celda = max(64, self.tamano_celda or 64)
        super().save(*args, **kwargs)


class DistribucionUbicacion(models.Model):
    plano = models.ForeignKey(
        PlanoDistribucion,
        on_delete=models.CASCADE,
        related_name="distribuciones",
    )
    ubicacion = models.OneToOneField(
        Ubicacion,
        on_delete=models.CASCADE,
        related_name="plano_distribucion",
        null=True,
        blank=True,
    )
    fila = models.PositiveIntegerField(default=1)
    columna = models.PositiveIntegerField(default=1)
    ancho = models.PositiveSmallIntegerField(default=1)
    alto = models.PositiveSmallIntegerField(default=1)
    actualizado_en = models.DateTimeField(auto_now=True)
    es_pasillo = models.BooleanField(default=False)
    nombre_pasillo = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = "Distribucion de ubicacion"
        verbose_name_plural = "Distribuciones de ubicaciones"
        ordering = ("fila", "columna")

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.es_pasillo:
            if not self.nombre_pasillo:
                raise ValidationError({"nombre_pasillo": "Asigna un nombre o codigo para el pasillo."})
        else:
            if not self.ubicacion:
                raise ValidationError({"ubicacion": "Selecciona la ubicacion vinculada al plano."})
            if self.ubicacion.nivel != 1:
                raise ValidationError(
                    {"ubicacion": "Solo se pueden distribuir ubicaciones de nivel 1 (estantes y estibas)."}
                )
            if self.ubicacion.bodega_id != self.plano.bodega_id:
                raise ValidationError(
                    {"ubicacion": "La ubicacion debe pertenecer a la misma bodega del plano."}
                )
        if self.fila < 1 or self.columna < 1:
            raise ValidationError({"fila": "Fila y columna deben ser mayores a 0."})
        if self.ancho < 1 or self.alto < 1:
            raise ValidationError({"ancho": "El ancho y alto deben ser al menos 1."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)



class Marca(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name = "Marca"
        verbose_name_plural = "Marcas"
        ordering = ("nombre",)

    def __str__(self):
        return self.nombre


class UnidadMedida(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255, unique=True)

    class Meta:
        verbose_name = "Unidad de medida"
        verbose_name_plural = "Unidades de medida"
        ordering = ("nombre",)

    def __str__(self):
        return self.nombre


class Articulo(models.Model):
    # id = models.IntegerField(default= self.objects.count + 1)
    code = models.AutoField(primary_key=True)
    # code = models.CharField(primary_key=True, max_length=30, unique=True)
    descripcion = models.CharField(max_length=255)
    observacion = models.CharField(max_length=255, null=True, blank=True)
    marca = models.ForeignKey(
        Marca,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="articulos",
    )
    unidad_de_medida = models.ForeignKey(
        UnidadMedida,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="articulos",
    )


    class Meta:
        managed = True
        verbose_name = "Articulo"
        verbose_name_plural = "Articulos"
    

    def __str__(self):
        return f"{self.descripcion}"


    

class FotosArticulos(models.Model):
    id = models.AutoField(primary_key=True)
    articulo = models.ForeignKey(Articulo, on_delete=models.DO_NOTHING, related_name="articuloFoto",)
    foto = models.ImageField(upload_to='fotos_articulos/')


    class Meta:
        managed = True
        verbose_name = "Fotos de Articulos"
        verbose_name_plural = "Fotos de Articulos"
    
    def __str__(self):
        return f"{self.articulo}"

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


# class Movimientos(models.Model):
