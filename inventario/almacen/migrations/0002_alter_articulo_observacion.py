# Generated by Django 4.2 on 2024-12-12 22:03

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('almacen', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='articulo',
            name='observacion',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
