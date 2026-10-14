# Cobrafy (web)

Aplicación web de Cobrafy: entrar al negocio, elegir sucursal, ver y armar fichas de clientes, y (si eres dueño) invitar al equipo.

## Cómo se guarda la sesión

El token **no** va a `localStorage`. Vive en **`sessionStorage`** (`cobrafy.session`).

- No basta la memoria: en el celular un refresco a mitad de un alta no puede pedir el correo otra vez.
- No usamos `localStorage`: el token no debe quedar en el disco después de cerrar la pestaña.

Nunca se escribe correo, cédula, contraseña ni token en `console.*` (solo método, ruta y código de error).

## API

El cliente habla con `cobrafy-backend` (commit de referencia `4ddab7d`) con `Authorization: Bearer` y `X-Business-Id` en cada pedido del negocio activo.

Rutas usadas:

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/auth/login` | Correo y contraseña |
| POST | `/auth/logout` | Salir |
| GET | `/auth/me` | Sesión actual |
| POST | `/auth/pin` | Configurar clave rápida |
| POST | `/auth/pin/unlock` | Abrir con clave rápida |
| POST | `/clients/search` | Lista y búsqueda (el documento **no** va en la URL) |
| POST | `/clients` | Alta |
| GET/PATCH | `/clients/{id}` | Ficha |
| POST | `/clients/{id}/block` | Bloquear con motivo |
| POST | `/clients/{id}/unblock` | Desbloquear (dueño) |
| GET | `/clients/{id}/history` | Historial (`next_cursor`) |
| GET | `/members` | Equipo y cobradores |
| GET/POST/DELETE | `/members/invitations` | Invitaciones |
| GET/POST | `/invitations/{token}` · `/invitations/{token}/accept` | Aceptar invitación |

Errores: **422** y **409** se pintan en el campo; **403** se avisa sin romper la pantalla; **401** manda al login.

## Desarrollo

```bash
pnpm install
cp .env.example .env   # VITE_API_BASE_URL vacío usa el proxy de Vite
pnpm dev
```

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
