from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("almacen", "0005_alter_articulo_code"),
    ]

    operations = [
        migrations.RenameField(
            model_name="ubicacion",
            old_name="padre_id",
            new_name="padre",
        ),
        migrations.AlterField(
            model_name="ubicacion",
            name="nombre",
            field=models.CharField(max_length=60),
        ),
        migrations.AlterField(
            model_name="ubicacion",
            name="nivel",
            field=models.PositiveSmallIntegerField(default=1, editable=False),
        ),
        migrations.AlterField(
            model_name="ubicacion",
            name="nomenclatura",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterField(
            model_name="ubicacion",
            name="padre",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.CASCADE,
                related_name="hijos",
                to="almacen.ubicacion",
            ),
        ),
        migrations.AlterField(
            model_name="ubicacion",
            name="bodega",
            field=models.ForeignKey(
                on_delete=models.CASCADE,
                related_name="ubicaciones",
                to="almacen.bodega",
            ),
        ),
        migrations.AddField(
            model_name="ubicacion",
            name="creado_en",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name="ubicacion",
            name="actualizado_en",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="ubicacion",
            name="descripcion",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="ubicacion",
            name="numero",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="ubicacion",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("ESTANTE", "Estante"),
                    ("PANEL", "Panel"),
                    ("DIVISION", "Division"),
                    ("CONTENEDOR", "Contenedor"),
                ],
                default="ESTANTE",
                max_length=15,
            ),
        ),
        migrations.AlterModelOptions(
            name="ubicacion",
            options={
                "ordering": ("bodega__nombre", "nivel", "nombre"),
                "verbose_name": "Ubicacion",
                "verbose_name_plural": "Ubicaciones",
            },
        ),
        migrations.AddConstraint(
            model_name="ubicacion",
            constraint=models.UniqueConstraint(
                fields=("bodega", "nombre", "padre"),
                name="ubicacion_unique_nombre_por_padre",
            ),
        ),
        migrations.RunPython(
            code=lambda apps, schema_editor: _ajustar_tipos(apps),
            reverse_code=migrations.RunPython.noop,
        ),
    ]


def _ajustar_tipos(apps):
    Ubicacion = apps.get_model("almacen", "Ubicacion")

    nivel_a_tipo = {
        1: "ESTANTE",
        2: "PANEL",
        3: "DIVISION",
    }

    for ubicacion in Ubicacion.objects.all():
        tipo = nivel_a_tipo.get(ubicacion.nivel, "CONTENEDOR")
        if ubicacion.padre_id is None and tipo != "ESTANTE":
            tipo = "ESTANTE"
        Ubicacion.objects.filter(pk=ubicacion.pk).update(
            tipo=tipo,
            nivel={
                "ESTANTE": 1,
                "PANEL": 2,
                "DIVISION": 3,
                "CONTENEDOR": 4,
            }.get(tipo, 1),
        )

    def numerar_contenedores(padre_instancia, prefijo):
        contenedores = Ubicacion.objects.filter(
            padre_id=padre_instancia.id, tipo="CONTENEDOR"
        ).order_by("id")
        for indice, contenedor in enumerate(contenedores, start=1):
            contenedor.numero = indice
            contenedor.nomenclatura = (
                f"{prefijo}_{indice}" if prefijo else str(indice)
            )
            contenedor.save(update_fields=["numero", "nomenclatura"])

    def numerar_divisiones(panel_instancia):
        panel_prefijo = panel_instancia.nomenclatura or str(panel_instancia.numero or "")
        divisiones = Ubicacion.objects.filter(
            padre_id=panel_instancia.id, tipo="DIVISION"
        ).order_by("id")

        if divisiones.exists():
            for indice, division in enumerate(divisiones, start=1):
                division.numero = indice
                division.nomenclatura = (
                    f"{panel_prefijo}_{indice}" if panel_prefijo else str(indice)
                )
                division.save(update_fields=["numero", "nomenclatura"])
                numerar_contenedores(division, division.nomenclatura)
        else:
            numerar_contenedores(panel_instancia, panel_prefijo)

    def numerar_paneles(estante_instancia):
        estante_prefijo = estante_instancia.nomenclatura or str(estante_instancia.numero or "")
        paneles = Ubicacion.objects.filter(
            padre_id=estante_instancia.id, tipo="PANEL"
        ).order_by("id")

        for indice, panel in enumerate(paneles, start=1):
            panel.numero = indice
            panel.nomenclatura = (
                f"{estante_prefijo}_{indice}" if estante_prefijo else str(indice)
            )
            panel.save(update_fields=["numero", "nomenclatura"])
            numerar_divisiones(panel)

    bodegas_ids = (
        Ubicacion.objects.filter(tipo="ESTANTE")
        .values_list("bodega_id", flat=True)
        .distinct()
    )

    for bodega_id in bodegas_ids:
        estantes = Ubicacion.objects.filter(
            bodega_id=bodega_id, tipo="ESTANTE"
        ).order_by("id")
        for offset, estante in enumerate(estantes):
            estante.numero = 100 + offset
            estante.nomenclatura = str(estante.numero)
            estante.save(update_fields=["numero", "nomenclatura"])
            numerar_paneles(estante)

    contenedores_sin_padre = Ubicacion.objects.filter(
        tipo="CONTENEDOR", padre__isnull=True
    ).order_by("id")
    for indice, contenedor in enumerate(contenedores_sin_padre, start=1):
        contenedor.numero = indice
        contenedor.nomenclatura = str(indice)
        contenedor.save(update_fields=["numero", "nomenclatura"])
