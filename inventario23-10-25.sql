-- MariaDB dump 10.19  Distrib 10.4.20-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: inventario
-- ------------------------------------------------------
-- Server version	10.4.20-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `almacen_articulo`
--

DROP TABLE IF EXISTS `almacen_articulo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_articulo` (
  `code` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(255) NOT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `marca_id` int(11) DEFAULT NULL,
  `unidad_de_medida_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`code`),
  KEY `almacen_articulo_marca_id_9606f595_fk_almacen_marca_id` (`marca_id`),
  KEY `almacen_articulo_unidad_de_medida_id_d7e70a1f_fk_almacen_u` (`unidad_de_medida_id`),
  CONSTRAINT `almacen_articulo_marca_id_9606f595_fk_almacen_marca_id` FOREIGN KEY (`marca_id`) REFERENCES `almacen_marca` (`id`),
  CONSTRAINT `almacen_articulo_unidad_de_medida_id_d7e70a1f_fk_almacen_u` FOREIGN KEY (`unidad_de_medida_id`) REFERENCES `almacen_unidadmedida` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_articulo`
--

LOCK TABLES `almacen_articulo` WRITE;
/*!40000 ALTER TABLE `almacen_articulo` DISABLE KEYS */;
INSERT INTO `almacen_articulo` VALUES (1,'Telfono','none',NULL,NULL),(2,'fvder','evervde',NULL,NULL),(3,'ya que ya','nonas',1,1),(4,'dos lucas','dos lucas',NULL,NULL),(5,'borrador','sdfs',NULL,NULL),(6,'fbdfs','fd',2,2),(7,'Relay de estado solido','',3,2),(8,'Rele de estado re solido','Rele de estado re solido',NULL,NULL),(9,'relay 24V','Reles de proyectos',3,NULL),(10,'Agenda Bahia principe','',1,2),(11,'Cable duplex 18','',5,3),(12,'Cafe','',2,2),(13,'Telefono Iphone','',2,2),(14,'Audifonos','',2,2);
/*!40000 ALTER TABLE `almacen_articulo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_bodega`
--

DROP TABLE IF EXISTS `almacen_bodega`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_bodega` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(30) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_bodega`
--

LOCK TABLES `almacen_bodega` WRITE;
/*!40000 ALTER TABLE `almacen_bodega` DISABLE KEYS */;
INSERT INTO `almacen_bodega` VALUES (1,'baticueva'),(2,'80'),(3,'Produccion');
/*!40000 ALTER TABLE `almacen_bodega` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_distribucionubicacion`
--

DROP TABLE IF EXISTS `almacen_distribucionubicacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_distribucionubicacion` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `fila` int(10) unsigned NOT NULL CHECK (`fila` >= 0),
  `columna` int(10) unsigned NOT NULL CHECK (`columna` >= 0),
  `ancho` smallint(5) unsigned NOT NULL CHECK (`ancho` >= 0),
  `alto` smallint(5) unsigned NOT NULL CHECK (`alto` >= 0),
  `actualizado_en` datetime(6) NOT NULL,
  `plano_id` bigint(20) NOT NULL,
  `ubicacion_id` int(11) DEFAULT NULL,
  `es_pasillo` tinyint(1) NOT NULL,
  `nombre_pasillo` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ubicacion_id` (`ubicacion_id`),
  KEY `almacen_distribucion_plano_id_c4824578_fk_almacen_p` (`plano_id`),
  CONSTRAINT `almacen_distribucion_plano_id_c4824578_fk_almacen_p` FOREIGN KEY (`plano_id`) REFERENCES `almacen_planodistribucion` (`id`),
  CONSTRAINT `almacen_distribucion_ubicacion_id_e9369e99_fk_almacen_u` FOREIGN KEY (`ubicacion_id`) REFERENCES `almacen_ubicacion` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_distribucionubicacion`
--

LOCK TABLES `almacen_distribucionubicacion` WRITE;
/*!40000 ALTER TABLE `almacen_distribucionubicacion` DISABLE KEYS */;
INSERT INTO `almacen_distribucionubicacion` VALUES (1,1,1,1,1,'2025-10-21 16:15:13.247019',3,1,0,''),(2,1,3,1,1,'2025-10-21 16:15:13.255470',3,76,0,''),(3,4,3,1,1,'2025-10-21 16:15:13.322378',3,6,0,''),(4,2,3,1,1,'2025-10-21 16:15:13.274231',3,84,0,''),(5,3,3,1,1,'2025-10-21 16:15:13.300865',3,7,0,''),(6,2,1,1,1,'2025-10-21 16:15:13.264593',3,52,0,''),(7,3,1,1,1,'2025-10-21 16:15:13.288180',3,60,0,''),(8,4,1,1,1,'2025-10-21 16:15:13.311971',3,68,0,''),(9,1,2,1,6,'2025-10-21 16:15:13.325968',3,NULL,1,'Pasillo 1'),(10,1,1,1,1,'2025-10-20 10:35:41.646099',1,11,0,''),(11,1,2,1,1,'2025-10-20 10:35:41.654291',1,12,0,''),(12,5,1,7,1,'2025-10-21 16:15:13.330360',3,NULL,1,'Pasillo 2'),(13,1,1,1,1,'2025-10-21 17:16:28.247946',2,5,0,''),(14,1,3,1,1,'2025-10-21 17:16:28.253295',2,39,0,''),(15,2,1,1,1,'2025-10-21 17:16:28.258285',2,21,0,''),(16,2,3,1,1,'2025-10-21 17:16:28.267916',2,45,0,''),(17,3,1,1,1,'2025-10-21 17:16:28.272409',2,27,0,''),(18,4,1,1,1,'2025-10-21 17:16:28.277999',2,33,0,''),(19,5,1,1,1,'2025-10-21 17:16:28.282298',2,51,0,''),(20,1,2,1,6,'2025-10-21 17:16:28.283798',2,NULL,1,'Pasillo 1');
/*!40000 ALTER TABLE `almacen_distribucionubicacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_entradas`
--

DROP TABLE IF EXISTS `almacen_entradas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_entradas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cantidad` int(11) NOT NULL,
  `fecha` datetime(6) NOT NULL,
  `articulo_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `almacen_entradas_articulo_id_a3bb9638_fk` (`articulo_id`),
  CONSTRAINT `almacen_entradas_articulo_id_a3bb9638_fk` FOREIGN KEY (`articulo_id`) REFERENCES `almacen_articulo` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_entradas`
--

LOCK TABLES `almacen_entradas` WRITE;
/*!40000 ALTER TABLE `almacen_entradas` DISABLE KEYS */;
INSERT INTO `almacen_entradas` VALUES (1,1,'2025-10-17 14:29:44.381484',5),(2,5,'2025-10-17 16:32:07.471694',9),(3,2,'2025-10-18 13:40:14.937697',10),(4,10,'2025-10-18 22:40:38.040936',11),(5,1,'2025-10-20 08:33:07.509738',12),(6,1,'2025-10-23 10:58:22.897134',13),(7,1,'2025-10-23 11:05:17.001241',14),(8,3,'2025-10-23 11:06:49.369122',14);
/*!40000 ALTER TABLE `almacen_entradas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_fotosarticulos`
--

DROP TABLE IF EXISTS `almacen_fotosarticulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_fotosarticulos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `foto` varchar(100) NOT NULL,
  `articulo_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `almacen_fotosarticulos_articulo_id_903c69c5_fk` (`articulo_id`),
  CONSTRAINT `almacen_fotosarticulos_articulo_id_903c69c5_fk` FOREIGN KEY (`articulo_id`) REFERENCES `almacen_articulo` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_fotosarticulos`
--

LOCK TABLES `almacen_fotosarticulos` WRITE;
/*!40000 ALTER TABLE `almacen_fotosarticulos` DISABLE KEYS */;
INSERT INTO `almacen_fotosarticulos` VALUES (1,'fotos_articulos/photo_xnIoryC.jpg',1),(2,'fotos_articulos/photo.jpg',2),(3,'fotos_articulos/borrador.jpg',3),(4,'fotos_articulos/dos_lucas.jpg',4),(5,'fotos_articulos/captura-20251015220122.jpg',5),(6,'fotos_articulos/captura-20251015220124.jpg',5),(7,'fotos_articulos/captura-20251015220126.jpg',5),(8,'fotos_articulos/Y2754073-01.webp',8),(9,'fotos_articulos/Relé_8_pines__2_contactos_24VDC-Siemens.jpg',9),(10,'fotos_articulos/captura-20251018183930.jpg',10),(11,'fotos_articulos/captura-20251018183938.jpg',10),(12,'fotos_articulos/captura-20251019015801.jpg',11),(13,'fotos_articulos/captura-20251019015803.jpg',11),(14,'fotos_articulos/captura-20251019015806.jpg',11),(15,'fotos_articulos/cafejpg.webp',12),(16,'fotos_articulos/captura-20251020133303.jpg',12),(17,'fotos_articulos/captura-20251023155749.jpg',13),(18,'fotos_articulos/captura-20251023155754.jpg',13),(19,'fotos_articulos/captura-20251023155756.jpg',13),(20,'fotos_articulos/captura-20251023160501.jpg',14),(21,'fotos_articulos/captura-20251023160503.jpg',14),(22,'fotos_articulos/captura-20251023160505.jpg',14);
/*!40000 ALTER TABLE `almacen_fotosarticulos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_inventario`
--

DROP TABLE IF EXISTS `almacen_inventario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_inventario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cantidad` int(11) NOT NULL,
  `Ubicacion_id` int(11) NOT NULL,
  `articulos_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `almacen_inventario_Ubicacion_id_bcd75299_fk_almacen_ubicacion_id` (`Ubicacion_id`),
  KEY `almacen_inventario_articulos_id_5fd44590_fk` (`articulos_id`),
  CONSTRAINT `almacen_inventario_Ubicacion_id_bcd75299_fk_almacen_ubicacion_id` FOREIGN KEY (`Ubicacion_id`) REFERENCES `almacen_ubicacion` (`id`),
  CONSTRAINT `almacen_inventario_articulos_id_5fd44590_fk` FOREIGN KEY (`articulos_id`) REFERENCES `almacen_articulo` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_inventario`
--

LOCK TABLES `almacen_inventario` WRITE;
/*!40000 ALTER TABLE `almacen_inventario` DISABLE KEYS */;
INSERT INTO `almacen_inventario` VALUES (1,1,6,5),(2,5,3,9),(3,2,19,10),(4,10,4,11),(5,1,3,12),(6,1,3,13),(7,1,4,14),(8,3,8,14);
/*!40000 ALTER TABLE `almacen_inventario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_marca`
--

DROP TABLE IF EXISTS `almacen_marca`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_marca` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_marca`
--

LOCK TABLES `almacen_marca` WRITE;
/*!40000 ALTER TABLE `almacen_marca` DISABLE KEYS */;
INSERT INTO `almacen_marca` VALUES (5,'Centelsa'),(2,'dfbds'),(1,'rtdt'),(3,'Siemens'),(4,'Xiaomi');
/*!40000 ALTER TABLE `almacen_marca` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_planodistribucion`
--

DROP TABLE IF EXISTS `almacen_planodistribucion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_planodistribucion` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `filas` int(10) unsigned NOT NULL CHECK (`filas` >= 0),
  `columnas` int(10) unsigned NOT NULL CHECK (`columnas` >= 0),
  `tamano_celda` int(10) unsigned NOT NULL CHECK (`tamano_celda` >= 0),
  `actualizado_en` datetime(6) NOT NULL,
  `bodega_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bodega_id` (`bodega_id`),
  CONSTRAINT `almacen_planodistrib_bodega_id_3ffd1fdd_fk_almacen_b` FOREIGN KEY (`bodega_id`) REFERENCES `almacen_bodega` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_planodistribucion`
--

LOCK TABLES `almacen_planodistribucion` WRITE;
/*!40000 ALTER TABLE `almacen_planodistribucion` DISABLE KEYS */;
INSERT INTO `almacen_planodistribucion` VALUES (1,6,8,120,'2025-10-21 17:15:43.645037',3),(2,6,8,120,'2025-10-23 11:28:07.903151',2),(3,10,8,120,'2025-10-23 10:59:51.862022',1);
/*!40000 ALTER TABLE `almacen_planodistribucion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_salidas`
--

DROP TABLE IF EXISTS `almacen_salidas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_salidas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cantidad` int(11) NOT NULL,
  `fecha` datetime(6) NOT NULL,
  `Articulo_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `almacen_salidas_Articulo_id_d6d5287e_fk` (`Articulo_id`),
  CONSTRAINT `almacen_salidas_Articulo_id_d6d5287e_fk` FOREIGN KEY (`Articulo_id`) REFERENCES `almacen_articulo` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_salidas`
--

LOCK TABLES `almacen_salidas` WRITE;
/*!40000 ALTER TABLE `almacen_salidas` DISABLE KEYS */;
/*!40000 ALTER TABLE `almacen_salidas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_ubicacion`
--

DROP TABLE IF EXISTS `almacen_ubicacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_ubicacion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) NOT NULL,
  `nivel` smallint(5) unsigned NOT NULL,
  `nomenclatura` varchar(50) NOT NULL,
  `padre_id` int(11) DEFAULT NULL,
  `bodega_id` int(11) NOT NULL,
  `creado_en` datetime(6) DEFAULT NULL,
  `actualizado_en` datetime(6) DEFAULT NULL,
  `descripcion` varchar(120) NOT NULL,
  `tipo` varchar(15) NOT NULL,
  `numero` int(10) unsigned NOT NULL CHECK (`numero` >= 0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ubicacion_unique_nombre_por_padre` (`bodega_id`,`nombre`,`padre_id`),
  KEY `almacen_ubicacion_padre_id_053422bb_fk_almacen_ubicacion_id` (`padre_id`),
  CONSTRAINT `almacen_ubicacion_bodega_id_d1458c41_fk_almacen_bodega_id` FOREIGN KEY (`bodega_id`) REFERENCES `almacen_bodega` (`id`),
  CONSTRAINT `almacen_ubicacion_padre_id_053422bb_fk_almacen_ubicacion_id` FOREIGN KEY (`padre_id`) REFERENCES `almacen_ubicacion` (`id`),
  CONSTRAINT `almacen_ubicacion_nivel_bbce12ef_check` CHECK (`nivel` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_ubicacion`
--

LOCK TABLES `almacen_ubicacion` WRITE;
/*!40000 ALTER TABLE `almacen_ubicacion` DISABLE KEYS */;
INSERT INTO `almacen_ubicacion` VALUES (1,'Estante Rimax 1',1,'100',NULL,1,'2025-10-15 19:30:03.009123','2025-10-15 19:30:03.009158','Etanteria rimax grande','ESTANTE',100),(2,'piso1',2,'100_1',1,1,'2025-10-15 19:31:41.527940','2025-10-15 19:31:41.527985','','PANEL',1),(3,'Piso 2',2,'100_2',1,1,'2025-10-15 19:32:18.103611','2025-10-15 19:32:18.103681','','PANEL',2),(4,'Canasta de Cable',4,'100_1_1',2,1,'2025-10-15 19:32:59.272176','2025-10-15 19:32:59.272238','','CONTENEDOR',1),(5,'Estante de TI',1,'100',NULL,2,'2025-10-16 09:02:50.605189','2025-10-16 09:02:50.605204','','ESTANTE',100),(6,'Estatante RImax 2',1,'101',NULL,1,'2025-10-16 09:03:20.261951','2025-10-16 09:03:20.261970','','ESTANTE',101),(7,'Estante rimax pequeno',1,'102',NULL,1,'2025-10-16 09:03:51.977091','2025-10-16 09:03:51.977107','','ESTANTE',102),(8,'Panal 1',2,'101_1',6,1,'2025-10-16 09:04:47.235954','2025-10-16 09:04:47.235966','','PANEL',1),(9,'Division 1',3,'101_1_1',8,1,'2025-10-16 09:05:05.787440','2025-10-16 09:05:05.787451','','DIVISION',1),(10,'Cont 1',4,'101_1_1_1',9,1,'2025-10-16 09:06:04.377031','2025-10-16 09:06:04.377048','','CONTENEDOR',1),(11,'Estante 1',1,'100',NULL,3,'2025-10-16 13:34:38.077592','2025-10-16 13:34:38.077611','','ESTANTE',100),(12,'Estante 2',1,'101',NULL,3,'2025-10-16 13:34:50.156359','2025-10-16 13:34:50.156384','','ESTANTE',101),(13,'Panal 1',2,'101_1',12,3,'2025-10-16 13:35:33.559158','2025-10-16 13:35:33.559205','','PANEL',1),(14,'div 1',3,'101_1_1',13,3,'2025-10-16 13:35:50.158429','2025-10-16 13:35:50.158456','','DIVISION',1),(15,'cont1',4,'101_1_1_1',14,3,'2025-10-16 13:36:15.525409','2025-10-16 13:36:15.525436','','CONTENEDOR',1),(16,'Cont 2',4,'101_1_1_2',14,3,'2025-10-16 13:36:25.478885','2025-10-16 13:36:25.478913','','CONTENEDOR',2),(17,'Panal 2',2,'101_2',12,3,'2025-10-16 13:36:51.356334','2025-10-16 13:36:51.356359','','PANEL',2),(18,'panal 3',2,'101_3',12,3,'2025-10-16 13:37:06.459428','2025-10-16 13:37:06.459451','','PANEL',3),(19,'Panal 4',2,'101_4',12,3,'2025-10-16 13:37:18.910892','2025-10-16 13:37:18.910916','','PANEL',4),(20,'Panal 5',2,'101_5',12,3,'2025-10-16 13:37:59.750726','2025-10-16 13:37:59.750757','','PANEL',5),(21,'Estantes MTO 1',1,'101',NULL,2,'2025-10-17 01:53:32.622223','2025-10-17 01:53:32.622252','','ESTANTE',101),(22,'Panel 1',2,'101_1',21,2,'2025-10-17 01:53:32.646057','2025-10-17 01:53:32.646083','','PANEL',1),(23,'Panel 2',2,'101_2',21,2,'2025-10-17 01:53:32.669453','2025-10-17 01:53:32.669495','','PANEL',2),(24,'Panel 3',2,'101_3',21,2,'2025-10-17 01:53:32.702456','2025-10-17 01:53:32.702505','','PANEL',3),(25,'Panel 4',2,'101_4',21,2,'2025-10-17 01:53:32.733193','2025-10-17 01:53:32.733225','','PANEL',4),(26,'Panel 5',2,'101_5',21,2,'2025-10-17 01:53:32.768327','2025-10-17 01:53:32.768381','','PANEL',5),(27,'Estantes MTO 2',1,'102',NULL,2,'2025-10-17 01:53:32.807825','2025-10-17 01:53:32.807863','','ESTANTE',102),(28,'Panel 1',2,'102_1',27,2,'2025-10-17 01:53:32.864045','2025-10-17 01:53:32.864087','','PANEL',1),(29,'Panel 2',2,'102_2',27,2,'2025-10-17 01:53:32.893349','2025-10-17 01:53:32.893384','','PANEL',2),(30,'Panel 3',2,'102_3',27,2,'2025-10-17 01:53:32.924927','2025-10-17 01:53:32.924957','','PANEL',3),(31,'Panel 4',2,'102_4',27,2,'2025-10-17 01:53:32.946891','2025-10-17 01:53:32.946918','','PANEL',4),(32,'Panel 5',2,'102_5',27,2,'2025-10-17 01:53:32.975971','2025-10-17 01:53:32.976004','','PANEL',5),(33,'Estantes MTO 3',1,'103',NULL,2,'2025-10-17 01:53:33.011432','2025-10-17 01:53:33.011466','','ESTANTE',103),(34,'Panel 1',2,'103_1',33,2,'2025-10-17 01:53:33.096747','2025-10-17 01:53:33.096785','','PANEL',1),(35,'Panel 2',2,'103_2',33,2,'2025-10-17 01:53:33.121474','2025-10-17 01:53:33.121509','','PANEL',2),(36,'Panel 3',2,'103_3',33,2,'2025-10-17 01:53:33.147679','2025-10-17 01:53:33.147733','','PANEL',3),(37,'Panel 4',2,'103_4',33,2,'2025-10-17 01:53:33.174986','2025-10-17 01:53:33.175017','','PANEL',4),(38,'Panel 5',2,'103_5',33,2,'2025-10-17 01:53:33.209405','2025-10-17 01:53:33.209447','','PANEL',5),(39,'Estantes MTO 4',1,'104',NULL,2,'2025-10-17 01:53:33.241391','2025-10-17 01:53:33.241424','','ESTANTE',104),(40,'Panel 1',2,'104_1',39,2,'2025-10-17 01:53:33.369196','2025-10-17 01:53:33.369228','','PANEL',1),(41,'Panel 2',2,'104_2',39,2,'2025-10-17 01:53:33.392472','2025-10-17 01:53:33.392504','','PANEL',2),(42,'Panel 3',2,'104_3',39,2,'2025-10-17 01:53:33.420269','2025-10-17 01:53:33.420299','','PANEL',3),(43,'Panel 4',2,'104_4',39,2,'2025-10-17 01:53:33.452146','2025-10-17 01:53:33.452179','','PANEL',4),(44,'Panel 5',2,'104_5',39,2,'2025-10-17 01:53:33.479795','2025-10-17 01:53:33.479829','','PANEL',5),(45,'Estantes MTO 5',1,'105',NULL,2,'2025-10-17 01:53:33.509601','2025-10-17 01:53:33.509632','','ESTANTE',105),(46,'Panel 1',2,'105_1',45,2,'2025-10-17 01:53:33.672491','2025-10-17 01:53:33.672526','','PANEL',1),(47,'Panel 2',2,'105_2',45,2,'2025-10-17 01:53:33.692575','2025-10-17 01:53:33.692604','','PANEL',2),(48,'Panel 3',2,'105_3',45,2,'2025-10-17 01:53:33.717235','2025-10-17 01:53:33.717266','','PANEL',3),(49,'Panel 4',2,'105_4',45,2,'2025-10-17 01:53:33.746661','2025-10-17 01:53:33.746697','','PANEL',4),(50,'Panel 5',2,'105_5',45,2,'2025-10-17 01:53:33.788127','2025-10-17 01:53:33.788182','','PANEL',5),(51,'Estiba 1',1,'100',NULL,2,'2025-10-18 16:32:46.545476','2025-10-18 16:32:46.545514','','ESTIBA',100),(52,'Estado 2 1',1,'103',NULL,1,'2025-10-20 08:35:00.543760','2025-10-20 08:35:00.543780','Estaterias de producto estado 2','ESTANTE',103),(53,'Panel 1',2,'103_1',52,1,'2025-10-20 08:35:00.577308','2025-10-20 08:35:00.577318','','PANEL',1),(54,'Panel 2',2,'103_2',52,1,'2025-10-20 08:35:00.587784','2025-10-20 08:35:00.587793','','PANEL',2),(55,'Panel 3',2,'103_3',52,1,'2025-10-20 08:35:00.599614','2025-10-20 08:35:00.599623','','PANEL',3),(56,'Panel 4',2,'103_4',52,1,'2025-10-20 08:35:00.610243','2025-10-20 08:35:00.610254','','PANEL',4),(57,'Panel 5',2,'103_5',52,1,'2025-10-20 08:35:00.620297','2025-10-20 08:35:00.620306','','PANEL',5),(58,'Panel 6',2,'103_6',52,1,'2025-10-20 08:35:00.633726','2025-10-20 08:35:00.633736','','PANEL',6),(59,'Panel 7',2,'103_7',52,1,'2025-10-20 08:35:00.647640','2025-10-20 08:35:00.647651','','PANEL',7),(60,'Estado 2 2',1,'104',NULL,1,'2025-10-20 08:35:00.659888','2025-10-20 08:35:00.659899','Estaterias de producto estado 2','ESTANTE',104),(61,'Panel 1',2,'104_1',60,1,'2025-10-20 08:35:00.695183','2025-10-20 08:35:00.695195','','PANEL',1),(62,'Panel 2',2,'104_2',60,1,'2025-10-20 08:35:00.700922','2025-10-20 08:35:00.700930','','PANEL',2),(63,'Panel 3',2,'104_3',60,1,'2025-10-20 08:35:00.707840','2025-10-20 08:35:00.707849','','PANEL',3),(64,'Panel 4',2,'104_4',60,1,'2025-10-20 08:35:00.716429','2025-10-20 08:35:00.716438','','PANEL',4),(65,'Panel 5',2,'104_5',60,1,'2025-10-20 08:35:00.727280','2025-10-20 08:35:00.727289','','PANEL',5),(66,'Panel 6',2,'104_6',60,1,'2025-10-20 08:35:00.737294','2025-10-20 08:35:00.737302','','PANEL',6),(67,'Panel 7',2,'104_7',60,1,'2025-10-20 08:35:00.747391','2025-10-20 08:35:00.747400','','PANEL',7),(68,'Estado 2 3',1,'105',NULL,1,'2025-10-20 08:35:00.756389','2025-10-20 08:35:00.756398','Estaterias de producto estado 2','ESTANTE',105),(69,'Panel 1',2,'105_1',68,1,'2025-10-20 08:35:00.799309','2025-10-20 08:35:00.799319','','PANEL',1),(70,'Panel 2',2,'105_2',68,1,'2025-10-20 08:35:00.805219','2025-10-20 08:35:00.805229','','PANEL',2),(71,'Panel 3',2,'105_3',68,1,'2025-10-20 08:35:00.812022','2025-10-20 08:35:00.812032','','PANEL',3),(72,'Panel 4',2,'105_4',68,1,'2025-10-20 08:35:00.820131','2025-10-20 08:35:00.820140','','PANEL',4),(73,'Panel 5',2,'105_5',68,1,'2025-10-20 08:35:00.828501','2025-10-20 08:35:00.828511','','PANEL',5),(74,'Panel 6',2,'105_6',68,1,'2025-10-20 08:35:00.838457','2025-10-20 08:35:00.838466','','PANEL',6),(75,'Panel 7',2,'105_7',68,1,'2025-10-20 08:35:00.849518','2025-10-20 08:35:00.849528','','PANEL',7),(76,'Estado 2 4',1,'106',NULL,1,'2025-10-20 08:35:00.859971','2025-10-20 08:35:00.859982','Estaterias de producto estado 2','ESTANTE',106),(77,'Panel 1',2,'106_1',76,1,'2025-10-20 08:35:00.914992','2025-10-20 08:35:00.915003','','PANEL',1),(78,'Panel 2',2,'106_2',76,1,'2025-10-20 08:35:00.920790','2025-10-20 08:35:00.920800','','PANEL',2),(79,'Panel 3',2,'106_3',76,1,'2025-10-20 08:35:00.929127','2025-10-20 08:35:00.929138','','PANEL',3),(80,'Panel 4',2,'106_4',76,1,'2025-10-20 08:35:00.938322','2025-10-20 08:35:00.938331','','PANEL',4),(81,'Panel 5',2,'106_5',76,1,'2025-10-20 08:35:00.950716','2025-10-20 08:35:00.950727','','PANEL',5),(82,'Panel 6',2,'106_6',76,1,'2025-10-20 08:35:00.963403','2025-10-20 08:35:00.963414','','PANEL',6),(83,'Panel 7',2,'106_7',76,1,'2025-10-20 08:35:00.973959','2025-10-20 08:35:00.973969','','PANEL',7),(84,'Estado 2 5',1,'107',NULL,1,'2025-10-20 08:35:00.983978','2025-10-20 08:35:00.983988','Estaterias de producto estado 2','ESTANTE',107),(85,'Panel 1',2,'107_1',84,1,'2025-10-20 08:35:01.087932','2025-10-20 08:35:01.087943','','PANEL',1),(86,'Panel 2',2,'107_2',84,1,'2025-10-20 08:35:01.097595','2025-10-20 08:35:01.097605','','PANEL',2),(87,'Panel 3',2,'107_3',84,1,'2025-10-20 08:35:01.109431','2025-10-20 08:35:01.109443','','PANEL',3),(88,'Panel 4',2,'107_4',84,1,'2025-10-20 08:35:01.123077','2025-10-20 08:35:01.123086','','PANEL',4),(89,'Panel 5',2,'107_5',84,1,'2025-10-20 08:35:01.140244','2025-10-20 08:35:01.140257','','PANEL',5),(90,'Panel 6',2,'107_6',84,1,'2025-10-20 08:35:01.155320','2025-10-20 08:35:01.155332','','PANEL',6),(91,'Panel 7',2,'107_7',84,1,'2025-10-20 08:35:01.168372','2025-10-20 08:35:01.168382','','PANEL',7),(92,'Estantes mp 1',1,'106',NULL,2,'2025-10-23 11:27:16.715669','2025-10-23 11:27:16.715708','','ESTANTE',106),(93,'Panel 1',2,'106_1',92,2,'2025-10-23 11:27:16.881141','2025-10-23 11:27:16.881170','','PANEL',1),(94,'Panel 2',2,'106_2',92,2,'2025-10-23 11:27:16.898582','2025-10-23 11:27:16.898609','','PANEL',2),(95,'Panel 3',2,'106_3',92,2,'2025-10-23 11:27:16.918735','2025-10-23 11:27:16.918762','','PANEL',3),(96,'Panel 4',2,'106_4',92,2,'2025-10-23 11:27:16.941411','2025-10-23 11:27:16.941468','','PANEL',4),(97,'Panel 5',2,'106_5',92,2,'2025-10-23 11:27:16.980842','2025-10-23 11:27:16.980871','','PANEL',5),(98,'Estantes mp 2',1,'107',NULL,2,'2025-10-23 11:27:17.006617','2025-10-23 11:27:17.006646','','ESTANTE',107),(99,'Panel 1',2,'107_1',98,2,'2025-10-23 11:27:17.181852','2025-10-23 11:27:17.181888','','PANEL',1),(100,'Panel 2',2,'107_2',98,2,'2025-10-23 11:27:17.202603','2025-10-23 11:27:17.202634','','PANEL',2),(101,'Panel 3',2,'107_3',98,2,'2025-10-23 11:27:17.224174','2025-10-23 11:27:17.224205','','PANEL',3),(102,'Panel 4',2,'107_4',98,2,'2025-10-23 11:27:17.248295','2025-10-23 11:27:17.248323','','PANEL',4),(103,'Panel 5',2,'107_5',98,2,'2025-10-23 11:27:17.274283','2025-10-23 11:27:17.274313','','PANEL',5),(104,'Estantes mp 3',1,'108',NULL,2,'2025-10-23 11:27:17.302364','2025-10-23 11:27:17.302391','','ESTANTE',108),(105,'Panel 1',2,'108_1',104,2,'2025-10-23 11:27:17.490204','2025-10-23 11:27:17.490231','','PANEL',1),(106,'Panel 2',2,'108_2',104,2,'2025-10-23 11:27:17.509369','2025-10-23 11:27:17.509404','','PANEL',2),(107,'Panel 3',2,'108_3',104,2,'2025-10-23 11:27:17.529163','2025-10-23 11:27:17.529198','','PANEL',3),(108,'Panel 4',2,'108_4',104,2,'2025-10-23 11:27:17.551962','2025-10-23 11:27:17.551995','','PANEL',4),(109,'Panel 5',2,'108_5',104,2,'2025-10-23 11:27:17.582438','2025-10-23 11:27:17.582501','','PANEL',5);
/*!40000 ALTER TABLE `almacen_ubicacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `almacen_unidadmedida`
--

DROP TABLE IF EXISTS `almacen_unidadmedida`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `almacen_unidadmedida` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `almacen_unidadmedida`
--

LOCK TABLES `almacen_unidadmedida` WRITE;
/*!40000 ALTER TABLE `almacen_unidadmedida` DISABLE KEYS */;
INSERT INTO `almacen_unidadmedida` VALUES (3,'Mts'),(1,'rgxdrrt'),(2,'und');
/*!40000 ALTER TABLE `almacen_unidadmedida` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group`
--

LOCK TABLES `auth_group` WRITE;
/*!40000 ALTER TABLE `auth_group` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_group_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_group_permissions`
--

LOCK TABLES `auth_group_permissions` WRITE;
/*!40000 ALTER TABLE `auth_group_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_group_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`),
  CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_permission`
--

LOCK TABLES `auth_permission` WRITE;
/*!40000 ALTER TABLE `auth_permission` DISABLE KEYS */;
INSERT INTO `auth_permission` VALUES (1,'Can add log entry',1,'add_logentry'),(2,'Can change log entry',1,'change_logentry'),(3,'Can delete log entry',1,'delete_logentry'),(4,'Can view log entry',1,'view_logentry'),(5,'Can add permission',2,'add_permission'),(6,'Can change permission',2,'change_permission'),(7,'Can delete permission',2,'delete_permission'),(8,'Can view permission',2,'view_permission'),(9,'Can add group',3,'add_group'),(10,'Can change group',3,'change_group'),(11,'Can delete group',3,'delete_group'),(12,'Can view group',3,'view_group'),(13,'Can add user',4,'add_user'),(14,'Can change user',4,'change_user'),(15,'Can delete user',4,'delete_user'),(16,'Can view user',4,'view_user'),(17,'Can add content type',5,'add_contenttype'),(18,'Can change content type',5,'change_contenttype'),(19,'Can delete content type',5,'delete_contenttype'),(20,'Can view content type',5,'view_contenttype'),(21,'Can add session',6,'add_session'),(22,'Can change session',6,'change_session'),(23,'Can delete session',6,'delete_session'),(24,'Can view session',6,'view_session'),(25,'Can add Articulo',7,'add_articulo'),(26,'Can change Articulo',7,'change_articulo'),(27,'Can delete Articulo',7,'delete_articulo'),(28,'Can view Articulo',7,'view_articulo'),(29,'Can add ubicacion',8,'add_ubicacion'),(30,'Can change ubicacion',8,'change_ubicacion'),(31,'Can delete ubicacion',8,'delete_ubicacion'),(32,'Can view ubicacion',8,'view_ubicacion'),(33,'Can add salidas',9,'add_salidas'),(34,'Can change salidas',9,'change_salidas'),(35,'Can delete salidas',9,'delete_salidas'),(36,'Can view salidas',9,'view_salidas'),(37,'Can add inventario',10,'add_inventario'),(38,'Can change inventario',10,'change_inventario'),(39,'Can delete inventario',10,'delete_inventario'),(40,'Can view inventario',10,'view_inventario'),(41,'Can add entradas',11,'add_entradas'),(42,'Can change entradas',11,'change_entradas'),(43,'Can delete entradas',11,'delete_entradas'),(44,'Can view entradas',11,'view_entradas'),(45,'Can add bodega',12,'add_bodega'),(46,'Can change bodega',12,'change_bodega'),(47,'Can delete bodega',12,'delete_bodega'),(48,'Can view bodega',12,'view_bodega'),(49,'Can add Fotos de Articulos',13,'add_fotosarticulos'),(50,'Can change Fotos de Articulos',13,'change_fotosarticulos'),(51,'Can delete Fotos de Articulos',13,'delete_fotosarticulos'),(52,'Can view Fotos de Articulos',13,'view_fotosarticulos'),(53,'Can add Marca',14,'add_marca'),(54,'Can change Marca',14,'change_marca'),(55,'Can delete Marca',14,'delete_marca'),(56,'Can view Marca',14,'view_marca'),(57,'Can add Unidad de medida',15,'add_unidadmedida'),(58,'Can change Unidad de medida',15,'change_unidadmedida'),(59,'Can delete Unidad de medida',15,'delete_unidadmedida'),(60,'Can view Unidad de medida',15,'view_unidadmedida'),(61,'Can add Plano de distribucion',16,'add_planodistribucion'),(62,'Can change Plano de distribucion',16,'change_planodistribucion'),(63,'Can delete Plano de distribucion',16,'delete_planodistribucion'),(64,'Can view Plano de distribucion',16,'view_planodistribucion'),(65,'Can add Distribucion de ubicacion',17,'add_distribucionubicacion'),(66,'Can change Distribucion de ubicacion',17,'change_distribucionubicacion'),(67,'Can delete Distribucion de ubicacion',17,'delete_distribucionubicacion'),(68,'Can view Distribucion de ubicacion',17,'view_distribucionubicacion');
/*!40000 ALTER TABLE `auth_permission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user`
--

DROP TABLE IF EXISTS `auth_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(150) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user`
--

LOCK TABLES `auth_user` WRITE;
/*!40000 ALTER TABLE `auth_user` DISABLE KEYS */;
INSERT INTO `auth_user` VALUES (1,'pbkdf2_sha256$600000$wIkKtZWs1z5bY6bikgeVet$80doPXCNvzbiNuY2liGp+Yc2kQ8igRvKAtuqxmyVFYI=','2025-10-17 17:09:03.289773',1,'manager','','','',1,1,'2025-10-15 19:16:57.398049');
/*!40000 ALTER TABLE `auth_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_groups`
--

DROP TABLE IF EXISTS `auth_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_user_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_groups_user_id_group_id_94350c0c_uniq` (`user_id`,`group_id`),
  KEY `auth_user_groups_group_id_97559544_fk_auth_group_id` (`group_id`),
  CONSTRAINT `auth_user_groups_group_id_97559544_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `auth_user_groups_user_id_6a12ed8b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_groups`
--

LOCK TABLES `auth_user_groups` WRITE;
/*!40000 ALTER TABLE `auth_user_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_user_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_user_user_permissions`
--

DROP TABLE IF EXISTS `auth_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_user_user_permissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_user_user_permissions_user_id_permission_id_14a6b632_uniq` (`user_id`,`permission_id`),
  KEY `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` (`permission_id`),
  CONSTRAINT `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  CONSTRAINT `auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_user_user_permissions`
--

LOCK TABLES `auth_user_user_permissions` WRITE;
/*!40000 ALTER TABLE `auth_user_user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_user_user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_admin_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext DEFAULT NULL,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint(5) unsigned NOT NULL CHECK (`action_flag` >= 0),
  `change_message` longtext NOT NULL,
  `content_type_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  KEY `django_admin_log_user_id_c564eba6_fk_auth_user_id` (`user_id`),
  CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  CONSTRAINT `django_admin_log_user_id_c564eba6_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_admin_log`
--

LOCK TABLES `django_admin_log` WRITE;
/*!40000 ALTER TABLE `django_admin_log` DISABLE KEYS */;
INSERT INTO `django_admin_log` VALUES (1,'2025-10-15 19:17:50.577621','1','baticueva',1,'[{\"added\": {}}]',12,1),(2,'2025-10-16 09:02:26.200195','2','80',1,'[{\"added\": {}}]',12,1),(3,'2025-10-16 13:34:14.727358','3','Produccion',1,'[{\"added\": {}}]',12,1),(4,'2025-10-18 20:55:39.629890','3','Mts',1,'[{\"added\": {}}]',15,1),(5,'2025-10-18 20:56:50.845603','4','Xiaomi',1,'[{\"added\": {}}]',14,1),(6,'2025-10-18 20:57:15.710121','5','Centelsa',1,'[{\"added\": {}}]',14,1);
/*!40000 ALTER TABLE `django_admin_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_content_type`
--

LOCK TABLES `django_content_type` WRITE;
/*!40000 ALTER TABLE `django_content_type` DISABLE KEYS */;
INSERT INTO `django_content_type` VALUES (1,'admin','logentry'),(7,'almacen','articulo'),(12,'almacen','bodega'),(17,'almacen','distribucionubicacion'),(11,'almacen','entradas'),(13,'almacen','fotosarticulos'),(10,'almacen','inventario'),(14,'almacen','marca'),(16,'almacen','planodistribucion'),(9,'almacen','salidas'),(8,'almacen','ubicacion'),(15,'almacen','unidadmedida'),(3,'auth','group'),(2,'auth','permission'),(4,'auth','user'),(5,'contenttypes','contenttype'),(6,'sessions','session');
/*!40000 ALTER TABLE `django_content_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_migrations`
--

LOCK TABLES `django_migrations` WRITE;
/*!40000 ALTER TABLE `django_migrations` DISABLE KEYS */;
INSERT INTO `django_migrations` VALUES (1,'contenttypes','0001_initial','2025-10-15 13:45:22.431376'),(2,'auth','0001_initial','2025-10-15 13:45:23.367759'),(3,'admin','0001_initial','2025-10-15 13:45:23.605510'),(4,'admin','0002_logentry_remove_auto_add','2025-10-15 13:45:23.612947'),(5,'admin','0003_logentry_add_action_flag_choices','2025-10-15 13:45:23.622151'),(6,'almacen','0001_initial','2025-10-15 13:45:24.234007'),(7,'almacen','0002_alter_articulo_observacion','2025-10-15 13:45:24.303018'),(8,'almacen','0003_bodega_alter_articulo_options_remove_articulo_foto_and_more','2025-10-15 13:45:24.608047'),(9,'almacen','0004_alter_fotosarticulos_options_and_more','2025-10-15 13:45:24.639279'),(10,'contenttypes','0002_remove_content_type_name','2025-10-15 13:45:24.744307'),(11,'auth','0002_alter_permission_name_max_length','2025-10-15 13:45:24.835948'),(12,'auth','0003_alter_user_email_max_length','2025-10-15 13:45:24.920097'),(13,'auth','0004_alter_user_username_opts','2025-10-15 13:45:24.930925'),(14,'auth','0005_alter_user_last_login_null','2025-10-15 13:45:24.995523'),(15,'auth','0006_require_contenttypes_0002','2025-10-15 13:45:25.000165'),(16,'auth','0007_alter_validators_add_error_messages','2025-10-15 13:45:25.010179'),(17,'auth','0008_alter_user_username_max_length','2025-10-15 13:45:25.040080'),(18,'auth','0009_alter_user_last_name_max_length','2025-10-15 13:45:25.069451'),(19,'auth','0010_alter_group_name_max_length','2025-10-15 13:45:25.158866'),(20,'auth','0011_update_proxy_permissions','2025-10-15 13:45:25.170640'),(21,'auth','0012_alter_user_first_name_max_length','2025-10-15 13:45:25.198751'),(22,'sessions','0001_initial','2025-10-15 13:45:25.261928'),(23,'almacen','0005_alter_articulo_code','2025-10-15 18:03:59.231752'),(24,'almacen','0006_reestructurar_ubicaciones','2025-10-15 19:29:03.205956'),(25,'almacen','0007_alter_ubicacion_options','2025-10-16 08:41:33.470741'),(26,'almacen','0008_restore_numero_column','2025-10-16 09:00:05.845711'),(27,'almacen','0009_marca_unidadmedida','2025-10-17 17:12:25.135331'),(28,'almacen','0010_merge_20251017_1712','2025-10-17 17:12:25.141384'),(29,'almacen','0011_alter_ubicacion_tipo','2025-10-18 17:06:20.365737'),(30,'almacen','0012_planodistribucion_distribucionubicacion','2025-10-18 17:06:20.721970'),(31,'almacen','0013_distribucionubicacion_es_pasillo_and_more','2025-10-18 20:53:22.600223');
/*!40000 ALTER TABLE `django_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_expire_date_a5c62663` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `django_session`
--

LOCK TABLES `django_session` WRITE;
/*!40000 ALTER TABLE `django_session` DISABLE KEYS */;
INSERT INTO `django_session` VALUES ('6j4pd8lq2cdng4bvqvb8gpe6vhk6965b','.eJxVjEEOgjAQRe_StWmmpTCtS_eegcx0BkFNSSisjHdXEha6_e-9_zI9bevYb1WXfhJzNs6cfjem_NCyA7lTuc02z2VdJra7Yg9a7XUWfV4O9-9gpDp-ax8FBGLsQFoUZp-TSzQwBYwaEuvAEFolgKAOfeuzZhwwCnYOYtOY9wfrZDfT:1v9sdD:XJtEC8MX4jxETlRHJoyRe0zkLkg7w5hLmAC_ZSOBYnA','2025-10-31 17:09:03.291871'),('gbqjv9hk0eike119r8vpbwlxs86rjtm3','.eJxVjEEOgjAQRe_StWmmpTCtS_eegcx0BkFNSSisjHdXEha6_e-9_zI9bevYb1WXfhJzNs6cfjem_NCyA7lTuc02z2VdJra7Yg9a7XUWfV4O9-9gpDp-ax8FBGLsQFoUZp-TSzQwBYwaEuvAEFolgKAOfeuzZhwwCnYOYtOY9wfrZDfT:1v9OYc:ihdOf4uvbvFujesBCgejtaEJoF180VuFrNavy6vXzaw','2025-10-30 09:02:18.221824'),('vukwpspekrp484waferq2ij193q8n9pc','.eJxVjEEOgjAQRe_StWmmpTCtS_eegcx0BkFNSSisjHdXEha6_e-9_zI9bevYb1WXfhJzNs6cfjem_NCyA7lTuc02z2VdJra7Yg9a7XUWfV4O9-9gpDp-ax8FBGLsQFoUZp-TSzQwBYwaEuvAEFolgKAOfeuzZhwwCnYOYtOY9wfrZDfT:1v9BgI:IZ8-_990yYNEetabU4MJ1P7V9Mrh50-RgBKVPNuo3rk','2025-10-29 19:17:22.539894');
/*!40000 ALTER TABLE `django_session` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-23 20:33:11
