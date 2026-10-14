# Cobrafy (web)

Aplicación web de Cobrafy: entrar al negocio, elegir sucursal, ver y armar fichas de clientes, y (si eres dueño) invitar al equipo.

## Cómo se guarda la sesión

El token **no** va a `localStorage`. Vive en **`sessionStorage`** (`cobrafy.session`).

- No basta la memoria: en el celular un refresco a mitad de un alta no puede pedir el correo otra vez.
- No usamos `localStorage`: el token no debe quedar en el disco después de cerrar la pestaña.

Nunca se escribe correo, cédula, contraseña ni token en `console.*` (solo método, ruta y código de error). Las rutas `/invitar/:token` se redactan.

## Cabeceras al publicar

El HTML de producción lleva `Referrer-Policy: no-referrer` y un meta CSP estricto. **`frame-ancestors` solo funciona como cabecera HTTP del hosting; el meta del HTML no la aplica.** El resto de directivas sí van en el meta, y el hosting debe repetirlas como cabeceras:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <origen-del-api-si-es-absoluto>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Referrer-Policy: no-referrer
```

Si `VITE_API_BASE_URL` es una URL absoluta, el origen entra en `connect-src`. `upgrade-insecure-requests` solo se emite en el build de producción cuando el API no es `http://` (si el API es HTTP, esa directiva bloquearía las llamadas).

## API

El cliente habla con `cobrafy-backend` (commit de referencia `4ddab7d`) con `Authorization: Bearer`. El negocio activo va en el JWT después de `POST /auth/login` (un solo negocio) o `POST /auth/select-business`. No se manda `X-Business-Id`.

Rutas usadas:

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/auth/login` | Correo y contraseña. Un negocio entra directo; varios responden `needs_business_selection`. |
| POST | `/auth/select-business` | Elige el negocio y recibe un JWT nuevo. |
| POST | `/auth/logout` | Salir |
| GET | `/auth/me` | Usuario, negocio activo, rol y membresías |
| POST | `/auth/pin` | Configurar o borrar PIN (`password` + `pin`). No sustituye el primer login. |
| POST | `/auth/pin/unlock` | Abrir una sesión ya autenticada con PIN |
| GET | `/clients` | Lista (`status`, `collector_membership_id`, `page`, `page_size`) |
| POST | `/clients/search` | Búsqueda (`q`, `document`, `name`, `phone`, `page`, `page_size`). El documento **no** va en la URL. |
| POST | `/clients/check` | ¿Existe este `doc_type` + `document`? |
| POST | `/clients` | Alta (`name`, `doc_type`, `document`, `phone`, `address`, `notes`, `collector_membership_id`). Sin `status`. |
| GET/PATCH | `/clients/{id}` | Ficha. El PATCH tampoco acepta `status`. |
| POST | `/clients/{id}/block` | Bloquear con `reason` |
| POST | `/clients/{id}/unblock` | Desbloquear con `reason` (solo dueño) |
| GET | `/clients/{id}/history` | Historial (`limit`, `before`, `events`, `next_cursor`) |
| POST/GET | `/clients/{id}/contacts` | Referencias (`referencia`) y garantes (`garante`) |
| PATCH/DELETE | `/clients/{id}/contacts/{contact_id}` | Editar o desactivar un contacto (dueño y cajero) |
| GET/POST | `/users` | Equipo e invitaciones por email (solo dueño) |
| PATCH | `/users/{id}` | Cambiar rol o `is_active` de una membresía (`id` de membresía) |
| GET | `/invitations` | Invitaciones pendientes |
| POST | `/invitations/accept` | Aceptar (`token`, `name`, `password`). No devuelve sesión. |
| POST | `/invitations/{id}/revoke` | Revocar |

Errores: **422** (`detail` string o lista `loc`/`msg`, sin `input`) y **409** (`ya existe un cliente con este documento`, `el cliente ya está bloqueado`, `el cliente no está bloqueado`) se pintan en el campo cuando aplica; **403** se avisa sin romper la pantalla; **401** `no autenticado` manda al login y `selecciona un negocio` al selector.

## Desarrollo

```bash
pnpm install
cp .env.example .env   # VITE_API_BASE_URL vacío usa el proxy de Vite
pnpm dev               # solo localhost; VITE_DEV_HOST=1 para 0.0.0.0
```

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
