# NestJS Auth API (Supabase)

Production-ready Sign-In API built with NestJS, Supabase, JWT, and bcrypt.

## Stack

- NestJS + TypeScript
- Supabase (`@supabase/supabase-js`)
- JWT (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`)
- Validation (`class-validator`, `class-transformer`)
- Config (`@nestjs/config`)
- Password hashing (`bcrypt`)

## Project Structure

```
src/
  app.module.ts
  main.ts
  config/
    supabase.client.ts
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    dto/
      signin.dto.ts
    strategies/
      jwt.strategy.ts
    guards/
      jwt-auth.guard.ts
  common/
    response.interceptor.ts
```

## Environment Variables

Create a `.env` file from `.env.example`:

- `PORT` (optional, default: `3000`)
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `JWT_SECRET`
- `DATABASE_URL`

## Install and Run

```bash
npm install
npm run start:dev
```

Build for production:

```bash
npm run build
npm run start:prod
```

## Endpoint

### `POST /auth/signin`

Body:

```json
{
  "email": "user@example.com",
  "mot_de_passe": "your_password"
}
```

Success response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "<JWT>",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "admin",
      "cin_passport": "AA123456"
    }
  }
}
```

Error responses:

- `404 Not Found`: user not found
- `401 Unauthorized`: invalid credentials
- `400 Bad Request`: invalid request body

## Authentication Flow

1. Validate request body using DTO + global `ValidationPipe`.
2. Read user from Supabase table `user` by `email`.
3. Throw `NotFoundException` if no user.
4. Compare `mot_de_passe` with `bcrypt.compare`.
5. Throw `UnauthorizedException` if mismatch.
6. Sign JWT payload with `{ sub, email, role }` and `expiresIn: 7d`.
7. Return standardized API response via global interceptor.
