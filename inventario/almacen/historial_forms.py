from django import forms

from .models import Bodega


class HistorialArticulosForm(forms.Form):
    modo = forms.ChoiceField(label="Buscar artículo por", choices=(("id", "ID"), ("descripcion", "Descripción")), required=False, initial="id")
    articulo = forms.CharField(label="Artículo", required=False, max_length=200, widget=forms.TextInput(attrs={"placeholder": "ID o descripción del artículo"}))
    bodega = forms.ModelChoiceField(label="Bodega", queryset=Bodega.objects.order_by("nombre"), required=False, empty_label="Todas las bodegas")
    tipo = forms.ChoiceField(label="Movimiento", choices=(("", "Todos los movimientos"), ("ENTRADA", "Entradas"), ("SALIDA", "Salidas"), ("TRASLADO", "Traslados")), required=False)
    desde = forms.DateField(label="Desde", required=False, widget=forms.DateInput(attrs={"type": "date"}))
    hasta = forms.DateField(label="Hasta", required=False, widget=forms.DateInput(attrs={"type": "date"}))

    def clean(self):
        data = super().clean()
        texto = data.get("articulo", "").strip()
        if texto:
            if (data.get("modo") or "id") == "id":
                if not texto.isascii() or not texto.isdigit() or int(texto) <= 0 or int(texto) > 2147483647:
                    self.add_error("articulo", "Indica un ID entero positivo válido.")
            elif len(texto) < 3:
                self.add_error("articulo", "Escribe al menos 3 caracteres de la descripción.")
        if data.get("desde") and data.get("hasta") and data["desde"] > data["hasta"]:
            self.add_error("hasta", "La fecha final debe ser igual o posterior a la inicial.")
        return data
