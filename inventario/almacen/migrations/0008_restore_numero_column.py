from django.db import migrations, models


def ensure_numero_column(apps, schema_editor):
    """Add the numero column if it was removed manually."""
    connection = schema_editor.connection
    ubicacion_model = apps.get_model("almacen", "Ubicacion")
    table_name = ubicacion_model._meta.db_table

    with connection.cursor() as cursor:
        columns = [
            info.name
            for info in connection.introspection.get_table_description(
                cursor, table_name
            )
        ]

    if "numero" in columns:
        return

    field = models.PositiveIntegerField(default=0)
    field.set_attributes_from_name("numero")
    schema_editor.add_field(ubicacion_model, field)


def populate_numero_data(apps, schema_editor):
    """Rebuild numeration and nomenclature for Ubicacion records."""
    Ubicacion = apps.get_model("almacen", "Ubicacion")

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
        panel_prefijo = panel_instancia.nomenclatura or str(
            panel_instancia.numero or ""
        )
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
        estante_prefijo = estante_instancia.nomenclatura or str(
            estante_instancia.numero or ""
        )
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


class Migration(migrations.Migration):

    dependencies = [
        ("almacen", "0007_alter_ubicacion_options"),
    ]

    atomic = False

    operations = [
        migrations.RunPython(
            code=ensure_numero_column,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.RunPython(
            code=populate_numero_data,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
