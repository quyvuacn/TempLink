# TempLink

Ứng dụng Next.js tạo link tải tài liệu có khung thời gian và mật khẩu, sử dụng Supabase PostgreSQL + private Storage và triển khai trên Vercel.

## Chạy local

1. Sao chép `.env.example` thành `.env.local` và điền Supabase URL, publishable key, secret key, mật khẩu quản trị và `APP_SECRET`.
2. Chạy migration `supabase/migrations/202609250001_initial_schema.sql` trong Supabase SQL Editor.
3. Cài dependency và chạy app:

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. Khi chưa có Supabase key, trang quản trị tự hiển thị dữ liệu mẫu và không ghi dữ liệu thật.

## Biến môi trường trên Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (hoặc `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY` (hoặc legacy `SUPABASE_SERVICE_ROLE_KEY`)
- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_PASSWORD`
- `APP_SECRET`

Không bật `DEMO_MODE` trên production.
