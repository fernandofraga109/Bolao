# Autenticação e Perfis

## Sistema de Auth

- **Supabase Auth** - Autenticação principal
- **Google Sign-In** - Carregado via CDN em `index.html`
- Hook responsável: `useUserSystem`

## Funcionalidades

- Login e logout
- Recuperação de senha (hook `usePasswordRecovery`)
- Gerenciamento de perfil
- Membership em grupos

## Roles

- **ADMIN** - Acesso ao painel administrativo
- **USER** - Usuário padrão
- Roles armazenadas em tabela `user_roles`

## Criar Admin

1. Criar usuário normal pela interface
2. Acessar Supabase SQL Editor
3. Atualizar role:
```sql
UPDATE public.user_roles 
SET role = 'ADMIN' 
WHERE "userId" = 'uuid-do-usuario';
```
