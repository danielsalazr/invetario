from django.db import migrations, transaction


def actualizar(apps, schema_editor, corto):
    Ubicacion = apps.get_model("almacen", "Ubicacion")
    alias = schema_editor.connection.alias
    with transaction.atomic(using=alias):
        nodos = {n.pk: n for n in Ubicacion.objects.using(alias).select_for_update().all()}
        for nodo in nodos.values():
            partes, vistos = [], set()
            actual = nodo
            while actual:
                if actual.pk in vistos:
                    raise ValueError("Se encontro un ciclo en el arbol de ubicaciones.")
                vistos.add(actual.pk)
                if corto and actual.tipo == "CONTENEDOR":
                    partes.append(f"C{actual.pk}")
                elif actual.numero:
                    partes.append(str(actual.numero))
                actual = nodos.get(actual.padre_id)
            nodo.nomenclatura = "_".join(reversed(partes))
            if len(nodo.nomenclatura) > 50:
                raise ValueError(f"La nomenclatura de la ubicacion {nodo.pk} supera 50 caracteres.")
            if nodo.tipo == "CONTENEDOR":
                nodo.codigo_contenedor = f"C{nodo.pk}" if corto else f"CONT-{nodo.pk:06d}"
        if nodos:
            Ubicacion.objects.using(alias).bulk_update(list(nodos.values()), ["codigo_contenedor", "nomenclatura"])


def forwards(apps, schema_editor):
    actualizar(apps, schema_editor, True)


def backwards(apps, schema_editor):
    actualizar(apps, schema_editor, False)


class Migration(migrations.Migration):
    dependencies = [("almacen", "0017_traslados_articulos")]
    operations = [migrations.RunPython(forwards, backwards)]
