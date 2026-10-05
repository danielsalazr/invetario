from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Articulo, Bodega, Entradas, Inventario, MovimientoContenedor, Salidas, TrasladoArticulo, Ubicacion
from .services import mover_contenedor


class TrasladosArticulosTests(TestCase):
    def setUp(self):
        self.bodega = Bodega.objects.create(nombre="Origen")
        self.otra_bodega = Bodega.objects.create(nombre="Destino")
        self.estante = Ubicacion.objects.create(nombre="Estante", tipo="ESTANTE", bodega=self.bodega)
        self.caja = Ubicacion.objects.create(nombre="Caja", tipo="CONTENEDOR", bodega=self.bodega, padre=self.estante)
        self.destino = Ubicacion.objects.create(nombre="Destino", tipo="CONTENEDOR", bodega=self.otra_bodega)
        self.articulo = Articulo.objects.create(descripcion="Producto trasladable")
        self.stock = Inventario.objects.create(articulos=self.articulo, Ubicacion=self.caja, cantidad=8)
        self.url = reverse("articulo_traslado", args=[self.articulo.pk])

    def operar(self, cantidad=3, origen=None, destino=None):
        return self.client.post(self.url, {"origen": (origen or self.caja).pk, "destino": (destino or self.destino).pk, "cantidad": cantidad}, content_type="application/json")

    def total(self):
        return sum(Inventario.objects.filter(articulos=self.articulo).values_list("cantidad", flat=True))

    def test_entre_bodegas_conserva_total_y_registra_una_operacion(self):
        response = self.operar()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.total(), 8)
        self.assertEqual(response.json()["cantidad_disponible_origen"], 5)
        traslado = TrasladoArticulo.objects.get()
        self.assertEqual(traslado.bodega_origen_id, self.bodega.pk)
        self.assertEqual(traslado.bodega_destino_id, self.otra_bodega.pk)
        self.assertEqual(traslado.codigo_origen, self.caja.codigo_contenedor)
        self.assertFalse(Entradas.objects.exists())
        self.assertFalse(Salidas.objects.exists())
        self.assertIsNone(traslado.usuario)

    def test_caja_a_ubicacion_y_ubicacion_a_caja(self):
        self.assertEqual(self.operar(4, destino=self.estante).status_code, 201)
        self.assertEqual(self.operar(2, origen=self.estante, destino=self.caja).status_code, 201)
        self.assertEqual(self.total(), 8)
        self.assertEqual(Inventario.objects.get(articulos=self.articulo, Ubicacion=self.estante).cantidad, 2)

    def test_cantidades_invalidas_mismo_destino_y_saldo_insuficiente(self):
        for cantidad in (0, -1, 1.5, 9, True):
            self.assertEqual(self.operar(cantidad).status_code, 400)
        self.assertEqual(self.operar(destino=self.caja).status_code, 400)
        self.assertEqual(self.operar(origen=self.estante).status_code, 400)
        self.assertFalse(TrasladoArticulo.objects.exists())
        self.assertEqual(self.total(), 8)

    def test_duplicados_en_origen_y_destino(self):
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.caja, cantidad=2)
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.destino, cantidad=4)
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.destino, cantidad=2)
        self.assertEqual(self.operar(9).status_code, 201)
        self.assertEqual(self.total(), 16)
        self.assertEqual(sum(Inventario.objects.filter(Ubicacion=self.destino).values_list("cantidad", flat=True)), 15)
        self.assertEqual(sum(Inventario.objects.filter(Ubicacion=self.caja).values_list("cantidad", flat=True)), 1)

    def test_cantidades_negativas_rechazadas_sin_alterar_inventario(self):
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.destino, cantidad=-1)
        self.assertEqual(self.operar().status_code, 400)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, 8)

    def test_fallo_de_registro_revierte_los_dos_saldos(self):
        from unittest.mock import patch
        with patch("almacen.traslados.TrasladoArticulo.objects.create", side_effect=RuntimeError("Fallo de registro")):
            with self.assertRaises(RuntimeError):
                self.operar()
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, 8)
        self.assertFalse(Inventario.objects.filter(Ubicacion=self.destino).exists())
        self.assertFalse(TrasladoArticulo.objects.exists())

    def test_historico_muestra_un_traslado_y_filtra_ambas_bodegas(self):
        usuario = get_user_model().objects.create_user("operador", password="clave-de-prueba")
        self.client.force_login(usuario)
        self.assertEqual(self.operar().status_code, 201)
        self.assertEqual(TrasladoArticulo.objects.get().usuario_id, usuario.pk)
        mover_contenedor(self.destino, destino_id=None, bodega_id=self.bodega.pk)
        for bodega in (self.bodega, self.otra_bodega):
            response = self.client.get(reverse("historial_movimientos"), {"bodega": bodega.pk, "tipo": "TRASLADO"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.context["pagina"].paginator.count, 1)
            self.assertEqual(response.context["resumen"]["TRASLADO"]["unidades"], 3)
            registro = list(response.context["pagina"])[0]
            self.assertEqual(registro["h_nombre_bodega_destino"], "Destino")
            self.assertContains(response, "T-" + str(TrasladoArticulo.objects.get().pk))

    def test_pagina_menu_y_redireccion_del_historial_antiguo(self):
        response = self.client.get(reverse("traslados"))
        self.assertContains(response, 'id="buscarDestinoStock"')
        self.assertContains(response, "Histórico de movimientos")
        response = self.client.get(reverse("historial_articulos"), {"articulo": self.articulo.pk})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("historial_movimientos") + "?articulo=" + str(self.articulo.pk))

    def lote(self, movimientos):
        return self.client.post(reverse("traslados_lote"), {"movimientos": movimientos}, content_type="application/json")

    def fila(self, cantidad=3, origen=None, destino=None, articulo=None):
        return {"articulo": (articulo or self.articulo).pk, "origen": (origen or self.caja).pk, "destino": (destino or self.destino).pk, "cantidad": cantidad}

    def test_lote_varios_articulos_conserva_totales(self):
        otro = Articulo.objects.create(descripcion="Segundo producto")
        Inventario.objects.create(articulos=otro, Ubicacion=self.estante, cantidad=5)
        response = self.lote([self.fila(), self.fila(2, origen=self.estante, articulo=otro)])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["registrados"], 2)
        self.assertEqual(TrasladoArticulo.objects.count(), 2)
        self.assertEqual(self.total(), 8)
        self.assertEqual(sum(Inventario.objects.filter(articulos=otro).values_list("cantidad", flat=True)), 5)

    def test_lote_saldo_acumulado_insuficiente_revierte_todas_las_filas(self):
        response = self.lote([self.fila(3), self.fila(6)])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(int(response.json()["fila"]), 2)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.cantidad, 8)
        self.assertFalse(TrasladoArticulo.objects.exists())
        self.assertFalse(Inventario.objects.filter(Ubicacion=self.destino).exists())

    def test_lote_ejecuta_encadenados_en_orden(self):
        response = self.lote([self.fila(3), self.fila(2, origen=self.destino, destino=self.estante)])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.total(), 8)
        self.assertEqual(Inventario.objects.get(Ubicacion=self.destino, articulos=self.articulo).cantidad, 1)
        self.assertEqual(Inventario.objects.get(Ubicacion=self.estante, articulos=self.articulo).cantidad, 2)

    def test_lote_rechaza_vacio_excesivo_y_fila_invalida_sin_efectos(self):
        for filas in ([], [self.fila(1)] * 101, [self.fila(), self.fila(destino=self.caja)]):
            self.assertEqual(self.lote(filas).status_code, 400)
            self.assertFalse(TrasladoArticulo.objects.exists())
            self.assertEqual(self.total(), 8)

    def test_nombre_nuevo_y_url_anterior_compatibles(self):
        response = self.client.get(reverse("trasladar"))
        self.assertRedirects(response, reverse("traslados"))
        response = self.client.get(reverse("traslados"))
        self.assertContains(response, "Bodega de destino")
        self.assertContains(response, 'id="tablaLoteTraslados"')
        self.assertNotContains(response, 'id="bodegaDestinoStock"')


class HistorialArticulosTests(TestCase):
    def setUp(self):
        self.bodega = Bodega.objects.create(nombre="Origen")
        self.destino = Bodega.objects.create(nombre="Destino")
        self.caja = Ubicacion.objects.create(nombre="Caja historica", tipo="CONTENEDOR", bodega=self.bodega)
        self.articulo = Articulo.objects.create(descripcion="Tornillo historico")
        self.otro = Articulo.objects.create(descripcion="Otro producto")
        self.entrada = Entradas.objects.create(articulo=self.articulo, cantidad=7, ubicacion=self.caja)
        self.salida = Salidas.objects.create(Articulo=self.articulo, cantidad=2, ubicacion=self.caja)
        self.url = reverse("historial_movimientos")

    def consultar(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, 200)
        return response

    def test_union_totales_y_enlace_por_articulo(self):
        response = self.consultar(articulo=self.articulo.pk, modo="id")
        self.assertEqual(response.context["pagina"].paginator.count, 2)
        self.assertEqual(response.context["resumen"]["ENTRADA"]["unidades"], 7)
        self.assertEqual(response.context["resumen"]["SALIDA"]["unidades"], 2)
        self.assertContains(response, "E-" + str(self.entrada.pk))
        self.assertContains(response, "S-" + str(self.salida.pk))
        self.assertContains(self.client.get(reverse("gestion_articulos")), 'id="historialArticuloLink"')

    def test_filtros_descripcion_tipo_y_id(self):
        Entradas.objects.create(articulo=self.otro, cantidad=10)
        response = self.consultar(modo="descripcion", articulo="Tornillo", tipo="SALIDA")
        self.assertEqual(response.context["pagina"].paginator.count, 1)
        self.assertEqual(list(response.context["pagina"])[0]["h_tipo"], "SALIDA")
        self.assertEqual(self.consultar(modo="id", articulo=self.otro.pk).context["pagina"].paginator.count, 1)

    def test_fechas_incluyen_dia_completo(self):
        from datetime import datetime
        Entradas.objects.filter(pk=self.entrada.pk).update(fecha=datetime(2026, 1, 2, 23, 59, 59))
        Salidas.objects.filter(pk=self.salida.pk).update(fecha=datetime(2026, 1, 3, 0, 0, 0))
        response = self.consultar(desde="2026-01-02", hasta="2026-01-02")
        self.assertEqual(response.context["pagina"].paginator.count, 1)
        self.assertEqual(list(response.context["pagina"])[0]["h_tipo"], "ENTRADA")

    def test_filtros_invalidos_no_muestran_historial_completo(self):
        for params in ({"modo": "id", "articulo": "abc"}, {"modo": "descripcion", "articulo": "ab"}, {"bodega": "99999"}, {"desde": "2026-02-03", "hasta": "2026-02-02"}):
            response = self.consultar(**params)
            self.assertFalse(response.context["form"].is_valid())
            self.assertEqual(response.context["pagina"].paginator.count, 0)

    def test_contexto_original_resiste_traslado_y_renombrado(self):
        ruta = self.entrada.ruta_ubicacion
        mover_contenedor(self.caja, destino_id=None, bodega_id=self.destino.pk)
        self.articulo.descripcion = "Nombre actualizado"
        self.articulo.save()
        self.bodega.nombre = "Origen renombrado"
        self.bodega.save()
        self.entrada.refresh_from_db()
        self.assertEqual(self.entrada.nombre_bodega, "Origen")
        self.assertEqual(self.entrada.ruta_ubicacion, ruta)
        self.assertEqual(self.entrada.descripcion_articulo, "Tornillo historico")
        self.assertEqual(self.consultar(bodega=self.bodega.pk).context["pagina"].paginator.count, 2)
        self.assertEqual(self.consultar(bodega=self.destino.pk).context["pagina"].paginator.count, 0)

    def test_legacy_sin_ubicacion_y_sin_snapshot_se_distingue(self):
        Entradas.objects.filter(pk=self.entrada.pk).update(bodega_movimiento=None, nombre_bodega="", ruta_ubicacion="", codigo_ubicacion="", descripcion_articulo="")
        Entradas.objects.create(articulo=self.otro, cantidad=3)
        response = self.consultar()
        self.assertContains(response, "Bodega actual; sin dato histórico")
        self.assertContains(response, "No registrada")
        self.assertEqual(self.consultar(bodega=self.bodega.pk).context["pagina"].paginator.count, 2)

    def test_paginacion_conserva_filtros_y_no_pierde_registros(self):
        Entradas.objects.bulk_create([Entradas(articulo=self.articulo, cantidad=1) for _ in range(51)])
        response = self.consultar(articulo=self.articulo.pk, tipo="ENTRADA", page=2)
        self.assertEqual(response.context["pagina"].paginator.count, 52)
        self.assertEqual(len(response.context["pagina"]), 2)
        self.assertIn("tipo=ENTRADA", response.context["parametros"])


class ContenedoresMovilesTests(TestCase):
    def setUp(self):
        self.bodega = Bodega.objects.create(nombre="Origen")
        self.otra_bodega = Bodega.objects.create(nombre="Destino")
        self.estante = self.crear("Estante", Ubicacion.Tipo.ESTANTE)
        self.panel = self.crear("Panel", Ubicacion.Tipo.PANEL, self.estante)
        self.destino = self.crear("Otro estante", Ubicacion.Tipo.ESTANTE, bodega=self.otra_bodega)
        self.caja = self.crear("Caja herramientas", Ubicacion.Tipo.CONTENEDOR, self.panel)
        self.interna = self.crear("Caja tornillos", Ubicacion.Tipo.CONTENEDOR, self.caja)
        self.pequena = self.crear("Caja conectores", Ubicacion.Tipo.CONTENEDOR, self.interna)
        self.articulo = Articulo.objects.create(descripcion="Tornillo")
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.caja, cantidad=7)
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.pequena, cantidad=4)

    def crear(self, nombre, tipo, padre=None, bodega=None):
        return Ubicacion.objects.create(nombre=nombre, tipo=tipo, padre=padre, bodega=bodega or (padre.bodega if padre else self.bodega))

    def mover_api(self, nodo, payload):
        return self.client.post(reverse("mover_contenedor", args=[nodo.pk]), payload, content_type="application/json")

    def test_traslado_entre_bodegas_conserva_inventario_codigos_y_jerarquia(self):
        inventario = list(Inventario.objects.values_list("pk", "articulos_id", "Ubicacion_id", "cantidad"))
        codigos = {n.pk: n.codigo_contenedor for n in (self.caja, self.interna, self.pequena)}
        usuario = get_user_model().objects.create_user(username="operador")
        self.client.force_login(usuario)
        response = self.mover_api(self.caja, {"destino": self.destino.pk})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(list(Inventario.objects.values_list("pk", "articulos_id", "Ubicacion_id", "cantidad")), inventario)
        for nodo in (self.caja, self.interna, self.pequena):
            nodo.refresh_from_db()
            self.assertEqual(nodo.codigo_contenedor, codigos[nodo.pk])
            self.assertEqual(nodo.bodega_id, self.otra_bodega.pk)
            self.assertTrue(nodo.ruta.startswith(self.destino.nombre))
            movimiento = nodo.movimientos.get()
            self.assertEqual(movimiento.contenedor_principal_id, self.caja.pk)
            self.assertEqual(movimiento.usuario_id, usuario.pk)
            self.assertEqual(movimiento.bodega_origen_id, self.bodega.pk)
        self.assertEqual(self.caja.padre_id, self.destino.pk)
        self.assertEqual(self.interna.padre_id, self.caja.pk)
        self.assertEqual(self.pequena.padre_id, self.interna.pk)
        self.assertFalse(Entradas.objects.exists())
        detalle = self.client.get(reverse("ubicacion_inventario_detalle", args=[self.destino.pk])).json()
        self.assertEqual(detalle["totales"]["cantidad_total"], 11)
        historial = self.client.get(reverse("movimientos_contenedor", args=[self.pequena.pk])).json()
        self.assertEqual(historial[0]["codigo_contenedor_principal"], self.caja.codigo_contenedor)

    def test_rechaza_ciclos_sin_modificar_datos(self):
        for destino in (self.caja, self.interna, self.pequena):
            response = self.mover_api(self.caja, {"destino": destino.pk})
            self.assertEqual(response.status_code, 400)
            self.caja.refresh_from_db()
            self.assertEqual(self.caja.padre_id, self.panel.pk)
        self.assertFalse(MovimientoContenedor.objects.exists())


    def test_no_mueve_ubicaciones_fijas(self):
        response = self.mover_api(self.estante, {"destino": self.destino.pk})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MovimientoContenedor.objects.exists())

    def test_rechaza_bodega_inconsistente_o_destino_inexistente(self):
        for payload in ({"destino": self.destino.pk, "bodega": self.bodega.pk}, {"destino": 99999}, {"destino": None}):
            self.assertEqual(self.mover_api(self.caja, payload).status_code, 400)
        self.assertFalse(MovimientoContenedor.objects.exists())

    def test_conflicto_de_nombre_revierte_todo_el_traslado(self):
        self.crear(self.caja.nombre, Ubicacion.Tipo.CONTENEDOR, self.destino)
        response = self.mover_api(self.caja, {"destino": self.destino.pk})
        self.assertEqual(response.status_code, 400)
        for nodo in (self.caja, self.interna, self.pequena):
            nodo.refresh_from_db()
            self.assertEqual(nodo.bodega_id, self.bodega.pk)
        self.assertFalse(MovimientoContenedor.objects.exists())

    def test_movimiento_a_raiz_y_a_otro_contenedor(self):
        codigo = self.caja.codigo_contenedor
        self.assertEqual(self.mover_api(self.caja, {"destino": None, "bodega": self.otra_bodega.pk}).status_code, 200)
        self.caja.refresh_from_db()
        self.assertIsNone(self.caja.padre_id)
        externa = self.crear("Caja grande", Ubicacion.Tipo.CONTENEDOR, self.destino)
        self.assertEqual(self.mover_api(self.caja, {"destino": externa.pk}).status_code, 200)
        self.caja.refresh_from_db()
        self.assertEqual(self.caja.padre_id, externa.pk)
        self.assertEqual(self.caja.codigo_contenedor, codigo)
        self.assertEqual(self.pequena.movimientos.count(), 2)

    def test_guardado_directo_tambien_conserva_descendientes_y_registra_historial(self):
        self.caja.padre = self.destino
        self.caja.bodega = self.otra_bodega
        self.caja.save()
        self.pequena.refresh_from_db()
        self.assertEqual(self.pequena.bodega_id, self.otra_bodega.pk)
        self.assertEqual(self.pequena.movimientos.count(), 1)

    def test_codigo_permanente_y_distincion_de_tipo(self):
        self.assertIsNone(self.estante.codigo_contenedor)
        self.assertEqual(self.caja.codigo_contenedor, f"C{self.caja.pk}")
        self.assertEqual(self.caja.nomenclatura, f"{self.panel.nomenclatura}_C{self.caja.pk}")
        self.assertIn(f"_C{self.caja.pk}_C{self.interna.pk}", self.interna.nomenclatura)
        self.caja.codigo_contenedor = "OTRO"
        with self.assertRaises(ValidationError):
            self.caja.save()
        self.caja.refresh_from_db()
        self.caja.tipo = Ubicacion.Tipo.ESTANTE
        with self.assertRaises(ValidationError):
            self.caja.save()

    def test_crear_division_no_reubica_cajas(self):
        self.crear("Division", Ubicacion.Tipo.DIVISION, self.panel)
        self.caja.refresh_from_db()
        self.assertEqual(self.caja.padre_id, self.panel.pk)
        self.assertFalse(MovimientoContenedor.objects.exists())

    def test_mismo_destino_no_genera_historial(self):
        mover_contenedor(self.caja, self.panel.pk)
        self.assertFalse(MovimientoContenedor.objects.exists())

    def test_crear_caja_anidada_por_api(self):
        response = self.client.post(reverse("ubicaciones_api"), {
            "nombre": "Caja nueva", "tipo": "CONTENEDOR", "padre": self.pequena.pk,
            "bodega": self.bodega.pk,
        }, content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()["es_movil"])
        self.assertEqual(response.json()["codigo_contenedor"], f"C{response.json()['id']}")
        self.assertEqual(response.json()["nomenclatura"], f"{self.pequena.nomenclatura}_C{response.json()['id']}")

    def test_ruta_interna_demasiado_larga_revierte_el_movimiento(self):
        destino = self.destino
        indice = 0
        while len(destino.nomenclatura) < 42:
            destino = self.crear(f"Caja profunda {indice}", Ubicacion.Tipo.CONTENEDOR, destino)
            indice += 1
        response = self.mover_api(self.caja, {"destino": destino.pk})
        self.assertEqual(response.status_code, 400, response.content)
        for nodo in (self.caja, self.interna, self.pequena):
            nodo.refresh_from_db()
            self.assertEqual(nodo.bodega_id, self.bodega.pk)
        self.assertEqual(self.caja.padre_id, self.panel.pk)
        self.assertFalse(MovimientoContenedor.objects.exists())


class EntradasPickingTests(TestCase):
    def setUp(self):
        self.bodega = Bodega.objects.create(nombre="Bodega picking")
        self.estante = Ubicacion.objects.create(nombre="Estante", tipo="ESTANTE", bodega=self.bodega)
        self.caja = Ubicacion.objects.create(nombre="Caja", tipo="CONTENEDOR", bodega=self.bodega, padre=self.estante)
        self.articulo = Articulo.objects.create(descripcion="Articulo de prueba")
        self.inventario = Inventario.objects.create(articulos=self.articulo, Ubicacion=self.caja, cantidad=10)

    def operar(self, ruta, cantidad, ubicacion=None):
        return self.client.post(reverse(ruta, args=[self.articulo.pk]), {
            "ubicacion": (ubicacion or self.caja).pk, "cantidad": cantidad,
        }, content_type="application/json")

    def test_entrada_incrementa_y_registra_destino(self):
        response = self.operar("articulo_inventario", 3)
        self.assertEqual(response.status_code, 200)
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 13)
        entrada = Entradas.objects.get()
        self.assertEqual(entrada.ubicacion_id, self.caja.pk)
        self.assertEqual(entrada.cantidad, 3)

    def test_picking_descontando_y_registrando_origen(self):
        response = self.operar("articulo_salida", 6)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["cantidad_disponible"], 4)
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 4)
        salida = Salidas.objects.get()
        self.assertEqual(salida.ubicacion_id, self.caja.pk)
        self.assertEqual(salida.Articulo_id, self.articulo.pk)
        self.assertEqual(salida.cantidad, 6)

    def test_picking_excesivo_no_descuenta_ni_crea_salida(self):
        self.assertEqual(self.operar("articulo_salida", 11).status_code, 400)
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 10)
        self.assertFalse(Salidas.objects.exists())

    def test_operacion_solo_afecta_ubicacion_exacta(self):
        self.assertEqual(self.operar("articulo_salida", 1, self.estante).status_code, 400)
        self.assertEqual(self.operar("articulo_inventario", 2, self.estante).status_code, 201)
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 10)

    def test_cantidades_invalidas(self):
        for ruta in ("articulo_salida", "articulo_inventario"):
            for cantidad in (0, -1, 1.5):
                self.assertEqual(self.operar(ruta, cantidad).status_code, 400)
        self.assertFalse(Entradas.objects.exists())
        self.assertFalse(Salidas.objects.exists())

    def test_agotar_existencias_conserva_fila_en_cero(self):
        self.assertEqual(self.operar("articulo_salida", 10).status_code, 201)
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 0)
        self.assertEqual(self.operar("articulo_salida", 1).status_code, 400)
        self.assertEqual(Salidas.objects.count(), 1)

    def test_filas_duplicadas_no_multiplican_entrada_y_se_consumen_correctamente(self):
        Inventario.objects.create(articulos=self.articulo, Ubicacion=self.caja, cantidad=2)
        self.assertEqual(self.operar("articulo_inventario", 3).status_code, 200)
        self.assertEqual(sum(Inventario.objects.values_list("cantidad", flat=True)), 15)
        response = self.operar("articulo_salida", 14)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["cantidad_disponible"], 1)
        self.assertEqual(sum(Inventario.objects.values_list("cantidad", flat=True)), 1)

    def test_paginas_y_menu(self):
        for nombre in ("almacenar", "picking"):
            response = self.client.get(reverse(nombre))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'id="formMovimientoStock"')
            self.assertContains(response, 'href="' + reverse(nombre) + '"')
