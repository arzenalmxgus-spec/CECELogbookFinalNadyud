INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, 'Administrator' FROM auth.users WHERE email = 'admin@cece.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'admin@cece.com'
ON CONFLICT DO NOTHING;