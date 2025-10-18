from django.db import migrations, models
import django.db.models.deletion


def migrate_marcas_unidades(apps, schema_editor):
    Articulo = apps.get_model("almacen", "Articulo")
    Marca = apps.get_model("almacen", "Marca")
    UnidadMedida = apps.get_model("almacen", "UnidadMedida")

    for articulo in Articulo.objects.all():
        if hasattr(articulo, "marca") and isinstance(articulo.marca, str):
            nombre_marca = (articulo.marca or "").strip()
        else:
            nombre_marca = ""
        marca_obj = None
        if nombre_marca:
            marca_obj, _ = Marca.objects.get_or_create(nombre=nombre_marca)
        articulo.marca_rel = marca_obj

        if hasattr(articulo, "unidad_de_medida") and isinstance(
            articulo.unidad_de_medida, str
        ):
            nombre_unidad = (articulo.unidad_de_medida or "").strip()
        else:
            nombre_unidad = ""
        unidad_obj = None
        if nombre_unidad:
            unidad_obj, _ = UnidadMedida.objects.get_or_create(nombre=nombre_unidad)
        articulo.unidad_de_medida_rel = unidad_obj
        articulo.save(update_fields=["marca_rel", "unidad_de_medida_rel"])


def revert_marcas_unidades(apps, schema_editor):
    Articulo = apps.get_model("almacen", "Articulo")

    for articulo in Articulo.objects.all():
        if hasattr(articulo, "marca_rel"):
            articulo.marca = articulo.marca_rel.nombre if articulo.marca_rel else ""
        if hasattr(articulo, "unidad_de_medida_rel"):
            articulo.unidad_de_medida = (
                articulo.unidad_de_medida_rel.nombre
                if articulo.unidad_de_medida_rel
                else ""
            )
        articulo.save(
            update_fields=[
                field
                for field in ["marca", "unidad_de_medida"]
                if field in articulo.__dict__
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("almacen", "0005_alter_articulo_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="Marca",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("nombre", models.CharField(max_length=255, unique=True)),
            ],
            options={
                "verbose_name": "Marca",
                "verbose_name_plural": "Marcas",
                "ordering": ("nombre",),
            },
        ),
        migrations.CreateModel(
            name="UnidadMedida",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("nombre", models.CharField(max_length=255, unique=True)),
            ],
            options={
                "verbose_name": "Unidad de medida",
                "verbose_name_plural": "Unidades de medida",
                "ordering": ("nombre",),
            },
        ),
        migrations.AddField(
            model_name="articulo",
            name="marca_rel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="articulos_temporales",
                to="almacen.marca",
            ),
        ),
        migrations.AddField(
            model_name="articulo",
            name="unidad_de_medida_rel",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="articulos_temporales",
                to="almacen.unidadmedida",
            ),
        ),
        migrations.RunPython(migrate_marcas_unidades, reverse_code=revert_marcas_unidades),
        migrations.RemoveField(
            model_name="articulo",
            name="marca",
        ),
        migrations.RemoveField(
            model_name="articulo",
            name="unidad_de_medida",
        ),
        migrations.RenameField(
            model_name="articulo",
            old_name="marca_rel",
            new_name="marca",
        ),
        migrations.RenameField(
            model_name="articulo",
            old_name="unidad_de_medida_rel",
            new_name="unidad_de_medida",
        ),
        migrations.AlterField(
            model_name="articulo",
            name="marca",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="articulos",
                to="almacen.marca",
            ),
        ),
        migrations.AlterField(
            model_name="articulo",
            name="unidad_de_medida",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="articulos",
                to="almacen.unidadmedida",
            ),
        ),
    ]
