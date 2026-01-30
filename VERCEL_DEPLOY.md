# Deploy to Vercel - SISFERIAS

Este documento descreve como preparar e subir o projeto **SISFERIAS** na Vercel.

## 1. Configuração de Variáveis de Ambiente

Ao criar o projeto na Vercel, você precisará configurar as seguintes variáveis de ambiente (Environment Variables) nas configurações do projeto:

| Variável | Descrição |
| :--- | :--- |
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (anon key) do seu projeto Supabase. |
| `GEMINI_API_KEY` | Sua chave de API do Google Gemini. |

> [!IMPORTANT]
> Certifique-se de que as variáveis começam com `VITE_` para que o Vite consiga expô-las no código do cliente, exceto se elas forem processadas apenas no build ou via `define` (como a `GEMINI_API_KEY` está configurada no `vite.config.ts`).

## 2. Configurações de Build

Na Vercel, as configurações padrão para Vite geralmente funcionam:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

## 3. Roteamento (SPA)

O arquivo `vercel.json` já foi incluído na raiz do projeto para garantir que todas as rotas sejam redirecionadas para o `index.html`, permitindo que o roteamento do React funcione corretamente após o deploy.

---

Para mais informações sobre deploy de projetos Vite na Vercel, consulte a [documentação oficial da Vercel](https://vercel.com/docs/frameworks/vite).
