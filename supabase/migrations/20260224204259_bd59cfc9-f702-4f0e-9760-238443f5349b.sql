-- Create the trigger on auth.users to auto-create profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also insert the missing profile for the recently created user
INSERT INTO public.profiles (id, name, email)
SELECT id, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;