# info cc 404 — خطوات التشغيل

1. **Supabase → SQL Editor**: الصق كامل `supabase.sql` (الكود، مش اسم الملف) واضغط Run.
2. **app.js**: بدّل `PUT_YOUR_PROJECT_URL_HERE` و`PUT_YOUR_ANON_KEY_HERE` بقيمك من Project Settings ← API (مفتاح anon برك).
3. **GitHub**: ارفع الملفات كاملة في جذر الريبو (index.html, style.css, app.js, sw.js, manifest.webmanifest, icon.svg, icon-192.png, icon-512.png). امسح ملفات قالب AI Studio (src, public, package.json...).
4. **Settings → Pages**: Deploy from a branch ← main ← / (root).
5. **Supabase → Authentication → URL Configuration**: حط رابط الموقع في Site URL وRedirect URLs.
6. سجّل حساب في الموقع، ثم في SQL Editor:
   `insert into public.admins (user_id) select id from auth.users where email = 'YOUR_EMAIL' on conflict do nothing;`
7. Ctrl+F5.
