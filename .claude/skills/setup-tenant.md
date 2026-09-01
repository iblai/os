# Skill: setup-tenant

**User-invocable**: yes
**Trigger**: `/setup` — when the user wants to configure their ibl.ai tenant for local development.

## Steps

1. **Check for existing `.env.local`**

   - If `.env.local` already exists, read it and show the user their current `NEXT_PUBLIC_TENANT` value.
   - Ask if they want to update it or keep it.

2. **Direct the user to find their tenant key**

   - Tell them:
     > Visit **https://login.iblai.app/me** in your browser.
     > You'll see your account info and a list of organizations you belong to.
     > Each org shows a **key** (e.g. `main`, `my-company`, or a UUID like `3b42a400a2fc4ec9...`).
     > Copy the key for the tenant you want to develop against and paste it here.
   - Use `AskUserQuestion` to collect the tenant key.

3. **Create or update `.env.local`**

   - If `.env.local` doesn't exist, copy `.env.example` to `.env.local`.
   - Replace the `NEXT_PUBLIC_TENANT=...` line with the tenant key the user provided.
   - Do NOT modify any other values — the defaults in `.env.example` point at the production ibl.ai stack and work out of the box.

4. **Confirm setup**
   - Show the user the tenant key that was set.
   - Tell them to run `pnpm dev` and open http://localhost:3000.

## Important

- Never commit `.env.local` — it is already in `.gitignore`.
- The `main` tenant is the default shared tenant. Most developers will want their own org's tenant key instead.
- If the user doesn't have an ibl.ai account yet, direct them to https://login.iblai.app to sign up first.
