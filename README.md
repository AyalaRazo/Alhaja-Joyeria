# Alhaja · Tienda de joyería

Frontend **React + Vite**, backend **Node.js + Express 5**, base de datos **MySQL (Amazon RDS)**, imágenes en **Amazon S3**, despliegue en **EC2 + Nginx**. Autenticación con **JWT + bcrypt**.

```
database/schema.sql      Esquema MySQL (8 tablas, FKs, CHECK, índices)
backend/                 API REST (Express) + scripts/seed.js
frontend/                SPA React (Vite) con modo demo
deploy/                  Nginx, políticas IAM y S3, PM2
```

**Contenido**
1. [Arquitectura](#1-arquitectura)
2. [Modelo de base de datos](#2-modelo-de-base-de-datos)
3. [Probar solo el frontend (modo demo)](#3-probar-solo-el-frontend-modo-demo)
4. [Desarrollo local completo](#4-desarrollo-local-completo)
5. [Despliegue en AWS paso a paso](#5-despliegue-en-aws-paso-a-paso)
6. [Problemas comunes](#6-problemas-comunes)
7. [Costos y cómo apagar todo](#7-costos-y-cómo-apagar-todo)
8. [API](#8-api)

---

## 1. Arquitectura

![Arquitectura en AWS](docs/arquitectura-aws.png)

| Pieza | Servicio | Qué hace |
|---|---|---|
| Servidor | **EC2** (Ubuntu 24.04) | Nginx sirve el frontend compilado y reenvía `/api/*` a Node (PM2, puerto 3000) |
| Base de datos | **RDS MySQL 8.4** | Datos de la tienda. Sin IP pública: solo la EC2 puede conectarse (puerto 3306) |
| Imágenes | **S3** | El backend sube las fotos de producto y guarda la URL en la base de datos |
| Permisos | **IAM Role** en la EC2 | Permite escribir en el bucket sin guardar llaves de AWS en el código |
| Red | **Security Groups** | `sg-ec2` abre 22/80/443; `sg-rds` acepta 3306 **solo** desde `sg-ec2` |

Flujo: el navegador pide la página y `/api/*` a la EC2 (1), carga las imágenes directo de S3 (2); Node consulta RDS (3) y sube imágenes a S3 con el rol IAM (4).

> **Versión de MySQL:** crea la instancia con **MySQL 8.4 (LTS)**. MySQL 8.0 dejó de tener soporte estándar en RDS el 31 de julio de 2026 y, si creas una instancia 8.0, AWS la inscribe automáticamente en *Extended Support*, que se cobra aparte.

---

## 2. Modelo de base de datos

**Relaciones**

| Relación | Significado |
|---|---|
| `categorias` 1:N `productos` | Cada joya pertenece a una categoría (anillos, collares…) |
| `productos` 1:N `variantes` | Un diseño tiene varias tallas o largos, cada uno con **su precio y su stock** |
| `productos` 1:N `producto_imagenes` | Varias fotos por producto; guardan la URL de S3 y su `s3_key` |
| `usuarios` 1:N `ordenes` | Un cliente tiene muchos pedidos |
| `ordenes` 1:N `orden_items` y `variantes` 1:N `orden_items` | Los ítems conectan pedidos con variantes (relación N:M resuelta) |
| `variantes` 1:N `movimientos_stock` | Auditoría de cada cambio de inventario (entrada, venta, cancelación, ajuste) |

**Reglas de integridad:** llaves primarias autoincrementales; llaves foráneas con `ON DELETE RESTRICT` donde borrar rompería el historial; `CHECK` de precio ≥ 0 y cantidad > 0; `UNIQUE` en email, SKU, slug y código de orden; `orden_items` guarda copia del nombre, SKU, talla y precio al comprar, así que editar un producto no altera pedidos antiguos.

**Por qué variantes:** en joyería el precio y el stock dependen de la talla (anillo talla 6 vs 8) o del largo (cadena de 45 cm vs 50 cm), no del diseño.

---

## 3. Probar solo el frontend (modo demo)

```bash
cd frontend && npm install && npm run dev:demo      # http://localhost:5173
```
Un API simulado en memoria (`frontend/src/mock.js`) responde todas las peticiones, así que no hay errores de red. Cuentas de prueba: **admin@alhaja.mx / Admin12345!** y **ana@demo.mx / demo12345**. Los datos se reinician al recargar. `npm run build:demo` genera una versión estática. El build de producción (`npm run build`) no incluye el mock.

## 4. Desarrollo local completo

```bash
# 1. Base de datos
mysql -u root -p < database/schema.sql
mysql -u root -p -e "CREATE USER 'alhaja_app'@'localhost' IDENTIFIED BY 'cambia_esto'; GRANT ALL ON alhaja_joyeria.* TO 'alhaja_app'@'localhost';"

# 2. Backend
cd backend && cp .env.example .env     # edita DB_* y JWT_SECRET
npm install && npm run seed && npm run dev      # http://localhost:3000

# 3. Frontend (otra terminal)
cd frontend && npm install && npm run dev       # http://localhost:5173
```
El seed crea categorías, 12 piezas de ejemplo y un admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`). Cambia la contraseña **antes** de correr el seed. Sin `S3_BUCKET`, las imágenes se guardan en `backend/uploads/` solo para desarrollo.

---

## 5. Despliegue en AWS paso a paso

| Dato | Dónde lo obtienes | Lo usas en |
|---|---|---|
| Endpoint de RDS | Paso 5.2 | `.env` (`DB_HOST`) |
| Usuario y contraseña maestros de RDS | Paso 5.2 | Cargar el esquema |
| Contraseña de `alhaja_app` | Paso 5.8 | `.env` (`DB_PASS`) |
| Nombre del bucket | Paso 5.3 | `.env` (`S3_BUCKET`) y políticas |
| Archivo `.pem` de la EC2 | Paso 5.5 | SSH |
| IP elástica de la EC2 | Paso 5.5 | Navegador y `CORS_ORIGIN` |

### 5.1 Security Groups (el firewall)

Crea **primero** el de la EC2 porque el de RDS lo referencia. **EC2 → Security Groups → Create security group**.

**`alhaja-sg-ec2`** (VPC por defecto)

| Tipo | Puerto | Origen | Para qué |
|---|---|---|---|
| SSH | 22 | **My IP** | Entrar a administrar el servidor |
| HTTP | 80 | Anywhere-IPv4 (`0.0.0.0/0`) | Visitantes |
| HTTPS | 443 | Anywhere-IPv4 (`0.0.0.0/0`) | Visitantes (cuando pongas certificado) |

Dejas *Outbound* como está (todo permitido).

**`alhaja-sg-rds`** (misma VPC)

| Tipo | Puerto | Origen | Para qué |
|---|---|---|---|
| MySQL/Aurora | 3306 | **Custom → selecciona `alhaja-sg-ec2`** | Solo la EC2 puede hablar con la base de datos |

Esa referencia a otro Security Group (no una IP) es lo que demuestra "conexión segura" en la rúbrica: nadie más puede llegar al 3306, ni siquiera desde tu casa.

### 5.2 Base de datos en RDS

**RDS → Create database**

1. **Standard create** → motor **MySQL**.
2. **Engine version:** la **8.4.x** más reciente que aparezca (no 8.0, ver nota en la sección 1).
3. **Templates:** *Free tier* o *Sandbox* si aparece. Si no, **Dev/Test**, nunca Production.
4. **Availability:** **Single-DB instance / Single-AZ** (Multi-AZ duplica el costo).
5. **Settings:**
   - DB instance identifier: `alhaja-db`
   - Master username: `admin`
   - Credentials: *Self managed* y una contraseña larga. Anótala.
6. **Instance configuration:** `db.t3.micro` o `db.t4g.micro` (burstable classes).
7. **Storage:** 20 GiB, sin *autoscaling* para no gastar de más.
8. **Connectivity:**
   - *Don't connect to an EC2 compute resource* (lo conectamos nosotros con los grupos).
   - VPC: la misma de la EC2 (default).
   - **Public access: No.** Esto hace que la base no tenga IP pública, es decir, es privada aunque esté en la subred por defecto.
   - VPC security group: **elige `alhaja-sg-rds`** y quita `default`.
9. **Additional configuration:**
   - Initial database name: `alhaja_joyeria`
   - Backup retention: 7 días (o el máximo que te permita tu plan).
   - Desactiva *Enhanced monitoring* y *Performance Insights* (generan costo).
   - *Deletion protection*: apagado mientras sea proyecto escolar, para poder borrarla al final.
10. **Create database.** Tarda de 5 a 15 minutos.

Cuando el estado sea **Available**, entra a la instancia y copia el **Endpoint** (algo como `alhaja-db.abc123xyz.us-west-2.rds.amazonaws.com`). Ese es tu `DB_HOST`.

### 5.3 Bucket de imágenes en S3

**S3 → Create bucket**

1. Nombre: único en todo el mundo, por ejemplo `alhaja-imagenes-tunombre-2026`. Anótalo.
2. Región: la misma que RDS y EC2.
3. **Object Ownership:** *ACLs disabled*.
4. **Block Public Access:** quita la palomita de **Block all public access** y confirma el aviso. (Las fotos del catálogo deben verse en el navegador de cualquier visitante. Lo que se publica es solo la carpeta `productos/`, ver política abajo.)
5. Versioning: desactivado. Encryption: la predeterminada (SSE-S3).
6. **Create bucket.**

Ahora la política de lectura pública: **bucket → Permissions → Bucket policy → Edit** y pega el contenido de `deploy/s3-bucket-policy.json`, cambiando `NOMBRE-DE-TU-BUCKET` por el tuyo:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "LecturaPublicaDeImagenes",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::NOMBRE-DE-TU-BUCKET/productos/*"
  }]
}
```
Guarda. Si S3 se queja de "Block Public Access", vuelve al paso 4: tiene que estar desactivado el bloqueo de políticas públicas.

### 5.4 Permisos de la EC2 (IAM Role)

Así la aplicación sube imágenes **sin** guardar llaves de AWS en ningún archivo.

1. **IAM → Policies → Create policy → pestaña JSON** y pega `deploy/iam-policy-ec2-s3.json` (cambia el nombre del bucket). Nómbrala `alhaja-s3-imagenes`.
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::NOMBRE-DE-TU-BUCKET/productos/*"
     }]
   }
   ```
2. **IAM → Roles → Create role** → *AWS service* → caso de uso **EC2** → adjunta la política `alhaja-s3-imagenes` → nombre `alhaja-ec2-role` → Create.

La política solo permite escribir y borrar dentro de `productos/`; no puede leer ni tocar otros buckets.

### 5.5 Servidor EC2

**EC2 → Launch instance**

1. Name: `alhaja-server`
2. **AMI:** Ubuntu Server **24.04 LTS** (64-bit x86).
3. **Instance type:** `t3.micro` (el que muestre la etiqueta *Free tier eligible*).
4. **Key pair → Create new key pair:** nombre `alhaja-key`, tipo RSA, formato `.pem`. Se descarga **una sola vez**; guárdalo bien.
5. **Network settings → Edit:** VPC por defecto, *Auto-assign public IP: Enable*, *Select existing security group* → `alhaja-sg-ec2`.
6. **Storage:** 20 GiB gp3.
7. **Advanced details → IAM instance profile:** `alhaja-ec2-role`.
8. **Launch instance.**

**IP elástica** (para que la IP no cambie si reinicias):
**EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**, luego **Actions → Associate Elastic IP address** → tu instancia. Anota esa IP. AWS cobra por las direcciones IPv4 públicas y una IP elástica sin asociar también; revisa en tu plan cuánto cubre y libérala al terminar (sección 7).

### 5.6 Conectarte por SSH

En tu computadora (macOS, Linux o PowerShell de Windows 10+):

```bash
chmod 400 alhaja-key.pem          # en Windows PowerShell no hace falta
ssh -i alhaja-key.pem ubuntu@TU_IP_ELASTICA
```
La primera vez responde `yes`. Si se queda colgado, tu IP cambió: edita la regla SSH de `alhaja-sg-ec2` y vuelve a elegir **My IP**.

### 5.7 Instalar el software en la EC2

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git unzip mysql-client
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v && nginx -v && mysql --version        # comprueba que los tres respondan
```

**Sube el código.** Elige una opción:

*A. Desde GitHub (recomendada):* sube el proyecto a un repositorio y
```bash
sudo git clone https://github.com/AyalaRazo/Alhaja-Joyeria /opt/alhaja
sudo chown -R ubuntu:ubuntu /opt/alhaja
```

*B. Con el ZIP*, desde tu computadora:
```bash
scp -i alhaja-key.pem alhaja-joyeria.zip ubuntu@TU_IP_ELASTICA:~
```
y en la EC2:
```bash
sudo mkdir -p /opt && cd /opt && sudo unzip ~/alhaja-joyeria.zip && sudo chown -R ubuntu:ubuntu /opt/alhaja
```

### 5.8 Cargar la base de datos en RDS

Desde la EC2 (es la única que puede llegar al 3306):

```bash
mysql -h ENDPOINT_DE_RDS -u admin -p
```
Si entra, escribe `exit` y carga el esquema:
```bash
mysql -h ENDPOINT_DE_RDS -u admin -p < /opt/alhaja/database/schema.sql
```
Ahora crea el **usuario de la aplicación** (no uses `admin` en el código):
```bash
mysql -h ENDPOINT_DE_RDS -u admin -p
```
```sql
CREATE USER 'alhaja_app'@'%' IDENTIFIED BY 'admin12345';
GRANT SELECT, INSERT, UPDATE, DELETE ON alhaja_joyeria.* TO 'alhaja_app'@'%';
FLUSH PRIVILEGES;
USE alhaja_joyeria; SHOW TABLES;     -- deben aparecer 8 tablas
```
El `%` es aceptable porque el Security Group ya limita quién llega al puerto.

### 5.9 Configurar y arrancar el backend

```bash
cd /opt/alhaja/backend
npm ci --omit=dev
cp .env.example .env
nano .env
```
Valores a cambiar en `.env`:

```env
NODE_ENV=production
CORS_ORIGIN=http://TU_IP_ELASTICA          # o https://tu-dominio.com
DB_HOST=ENDPOINT_DE_RDS
DB_USER=alhaja_app
DB_PASS=UnaClaveLargaYDistinta1!
DB_NAME=alhaja_joyeria
DB_SSL=true
JWT_SECRET=<salida de: openssl rand -hex 48>
S3_BUCKET=NOMBRE-DE-TU-BUCKET
AWS_REGION=us-east-2                        # la región del bucket
ADMIN_EMAIL=tu-correo@ejemplo.com
ADMIN_PASSWORD=<una contraseña fuerte>
```
No agregues `AWS_ACCESS_KEY_ID` ni claves: el SDK toma las credenciales del rol IAM de la instancia automáticamente.

Protege el archivo, siembra los datos (**una sola vez**) y arranca con PM2:
```bash
chmod 600 .env
npm run seed                                     # crea categorías, 12 piezas y el admin
pm2 start /opt/alhaja/deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd        # copia y ejecuta la línea con 'sudo' que imprime
curl http://localhost:3000/api/health            # debe responder {"ok":true}
```
Si algo falla: `pm2 logs alhaja-api --lines 50`.

> `DB_SSL=true` cifra la conexión a RDS. El código acepta el certificado sin validarlo (`rejectUnauthorized: false`), suficiente para un proyecto escolar. En producción descarga el *RDS CA bundle* de AWS y valídalo.

### 5.10 Compilar el frontend y configurar Nginx

La `t3.micro` tiene 1 GB de RAM; si `vite build` se queda sin memoria, agrega espacio de intercambio:
```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

```bash
cd /opt/alhaja/frontend
npm ci && npm run build
sudo mkdir -p /var/www/alhaja && sudo cp -r dist/* /var/www/alhaja/
sudo cp /opt/alhaja/deploy/nginx.conf /etc/nginx/conf.d/alhaja.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
`VITE_API_URL` debe quedar **vacío**: Nginx sirve la página y el API en el mismo dominio, así que el navegador llama a `/api/...` y no necesita CORS.

Abre `http://TU_IP_ELASTICA` en el navegador: debe cargar la tienda con las 12 piezas.

Para actualizar después de un cambio de código: `git pull`, `npm run build`, copia `dist/*` a `/var/www/alhaja/` y `pm2 restart alhaja-api`.

### 5.11 Dominio y HTTPS (opcional, recomendado)

Sin HTTPS, las contraseñas viajan sin cifrar. Para activarlo necesitas un nombre de dominio:

1. Crea un registro **A** en tu proveedor de dominio (o en Route 53) que apunte a la IP elástica.
2. Edita `/etc/nginx/conf.d/alhaja.conf` y cambia `server_name _;` por `server_name tu-dominio.com;`.
3. Instala el certificado gratuito de Let's Encrypt:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d tu-dominio.com
   ```
4. Actualiza `CORS_ORIGIN=https://tu-dominio.com` en `.env` y ejecuta `pm2 restart alhaja-api`.

Si no tienes dominio, puedes usar servicios gratuitos de terceros que resuelven un nombre a tu IP (por ejemplo `TU-IP-CON-GUIONES.sslip.io`) para obtener el certificado. Es un atajo para pruebas, no para una tienda real.

## 6. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ssh` se queda en espera (timeout) | Tu IP cambió o la regla 22 no está | En `alhaja-sg-ec2` edita SSH → **My IP** |
| `Permission denied (publickey)` | Usuario o llave incorrectos | Usa `ubuntu@` y `-i alhaja-key.pem`; `chmod 400` en el `.pem` |
| `mysql`: `Can't connect ... (110)` o timeout | Falta la regla 3306 o RDS tiene otro Security Group | Revisa que `alhaja-sg-rds` esté en la instancia y su origen sea `alhaja-sg-ec2` |
| `Access denied for user` | Contraseña o usuario incorrectos | Usa `admin` para el esquema y `alhaja_app` en el `.env` |
| `ER_NOT_SUPPORTED_AUTH_MODE` | Cliente MySQL muy antiguo | Usa `mysql2` (ya incluido) o `mysql-client` 8.x |
| `curl localhost:3000/api/health` da 500 | Backend sin acceso a RDS | `pm2 logs alhaja-api`; revisa `DB_HOST`, `DB_USER`, `DB_PASS` y `DB_SSL` |
| Web carga pero las rutas dan 404 al recargar | Falta `try_files` en Nginx | Usa el `deploy/nginx.conf` incluido |
| `502 Bad Gateway` | El backend no está corriendo | `pm2 status` y `pm2 restart alhaja-api` |
| Subir imagen da `AccessDenied` | Rol no asignado, política con otro bucket o región distinta | EC2 → Instancia → **Actions → Security → Modify IAM role**; revisa nombre de bucket y `AWS_REGION` |
| Las imágenes suben pero no se ven (403) | Bloqueo de acceso público o falta política | S3: desactiva *Block public access* y revisa la bucket policy |
| `vite build` termina con `Killed` | Poca RAM en `t3.micro` | Agrega swap (5.10) o compila en tu computadora y sube `dist/` con `scp` |
| Tras reiniciar la EC2 no responde el API | PM2 no se registró al arranque | `pm2 startup systemd`, ejecuta la línea que imprime y luego `pm2 save` |
| `Too many requests` al iniciar sesión | Límite anti fuerza bruta (30 intentos / 15 min) | Espera unos minutos |

---

## 7. Costos y cómo apagar todo

Lo que genera cargo si lo dejas encendido: **instancia RDS**, **instancia EC2**, **IP elástica/IPv4 pública**, **almacenamiento** (EBS, RDS, S3) y copias de seguridad. Revisa **Billing → Bills** cada pocos días mientras esté activo.

Al terminar el proyecto (en este orden):

1. **EC2 → Instances → Terminate** (esto borra el disco). *Stop* no basta: el disco y la IP siguen cobrando.
2. **EC2 → Elastic IPs → Release**.
3. **RDS → Databases → Delete**, sin snapshot final (o con él si quieres conservar los datos) y desmarcando conservar backups automáticos.
4. **S3:** vacía el bucket (*Empty*) y luego bórralo (*Delete*).
5. **EC2 → Security Groups:** borra `alhaja-sg-rds` y luego `alhaja-sg-ec2`.
6. **IAM:** borra el rol `alhaja-ec2-role` y la política `alhaja-s3-imagenes`.

Nota: si apagas (*Stop*) una instancia RDS temporalmente, AWS la vuelve a encender sola a los 7 días.

---

## 8. API

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/categorias`, `/api/materiales`, `/api/productos`, `/api/productos/:slug` | público |
| POST | `/api/auth/register`, `/api/auth/login` · GET `/api/auth/me` | público / token |
| POST | `/api/ordenes` (checkout transaccional) · GET `/api/ordenes` | cliente |
| GET/POST/PUT/DELETE | `/api/admin/productos` (+ `/imagenes`) | admin |
| GET / PATCH | `/api/admin/ordenes`, `/api/admin/ordenes/:id/estado` | admin |
| GET | `/api/admin/resumen` | admin |

Reglas clave: el checkout bloquea las filas de variantes (`FOR UPDATE`), valida stock, crea orden e ítems y descuenta inventario en **una sola transacción**; cancelar un pedido devuelve el stock. El precio siempre se toma de la base de datos, nunca del navegador.