CREATE DATABASE IF NOT EXISTS alhaja_joyeria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE alhaja_joyeria;

CREATE TABLE IF NOT EXISTS categorias (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NULL,
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  telefono      VARCHAR(20) NULL,
  rol           ENUM('cliente','admin') NOT NULL DEFAULT 'cliente',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Un producto es el diseño (anillo solitario); las variantes son sus tallas/largos con precio y stock propios.
CREATE TABLE IF NOT EXISTS productos (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT UNSIGNED NOT NULL,
  nombre       VARCHAR(150) NOT NULL,
  slug         VARCHAR(180) NOT NULL UNIQUE,
  descripcion  TEXT NULL,
  material     VARCHAR(60) NOT NULL,          -- Oro 14k, Plata .925, ...
  piedra       VARCHAR(80) NULL,              -- Diamante, Zafiro, Perla...
  destacado    BOOLEAN NOT NULL DEFAULT FALSE,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_productos_categoria (categoria_id),
  INDEX idx_productos_material (material),
  INDEX idx_productos_activo (activo, destacado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS producto_imagenes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,          -- URL pública en S3
  s3_key      VARCHAR(255) NULL,
  orden       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_imagenes_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  INDEX idx_imagenes_producto (producto_id, orden)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS variantes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  sku         VARCHAR(40) NOT NULL UNIQUE,
  talla       VARCHAR(30) NULL,               -- "Talla 6", "45 cm", NULL si es única
  precio      DECIMAL(10,2) NOT NULL,
  stock       INT UNSIGNED NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_variantes_precio CHECK (precio >= 0),
  CONSTRAINT fk_variantes_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  INDEX idx_variantes_producto (producto_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ordenes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED NOT NULL,
  codigo          VARCHAR(24) NOT NULL UNIQUE,
  subtotal        DECIMAL(10,2) NOT NULL,
  impuestos       DECIMAL(10,2) NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  estado          ENUM('pendiente','pagada','enviada','entregada','cancelada') NOT NULL DEFAULT 'pendiente',
  envio_nombre    VARCHAR(150) NOT NULL,
  envio_telefono  VARCHAR(20)  NOT NULL,
  envio_direccion VARCHAR(255) NOT NULL,
  envio_ciudad    VARCHAR(100) NOT NULL,
  envio_cp        VARCHAR(10)  NOT NULL,
  notas           TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_ordenes_total CHECK (total >= 0),
  CONSTRAINT fk_ordenes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  INDEX idx_ordenes_usuario (usuario_id),
  INDEX idx_ordenes_estado (estado, created_at)
) ENGINE=InnoDB;

-- Guarda copia del nombre/SKU/talla: el historial no cambia si luego se edita el producto.
CREATE TABLE IF NOT EXISTS orden_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  orden_id        INT UNSIGNED NOT NULL,
  variante_id     INT UNSIGNED NOT NULL,
  producto_nombre VARCHAR(150) NOT NULL,
  talla           VARCHAR(30) NULL,
  sku             VARCHAR(40) NOT NULL,
  cantidad        INT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  CONSTRAINT chk_items_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_items_orden FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_variante FOREIGN KEY (variante_id) REFERENCES variantes(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_orden_variante (orden_id, variante_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variante_id      INT UNSIGNED NOT NULL,
  tipo             ENUM('entrada','venta','cancelacion','ajuste') NOT NULL,
  cantidad         INT NOT NULL,
  stock_resultante INT UNSIGNED NOT NULL,
  orden_id         INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_variante FOREIGN KEY (variante_id) REFERENCES variantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_mov_orden FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE SET NULL,
  INDEX idx_mov_variante (variante_id, created_at)
) ENGINE=InnoDB;

-- Usuario de aplicación con permisos mínimos (no uses el admin de RDS en la app):
-- CREATE USER 'alhaja_app'@'%' IDENTIFIED BY 'CambiaEstaClave!';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON alhaja_joyeria.* TO 'alhaja_app'@'%';
