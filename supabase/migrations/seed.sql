insert into public.profiles (id, username, display_name, bio, avatar_url)
values
  ('dev_sahil', 'sahil', 'Sahil', 'Testing and building the recommendation-first prototype.', null),
  ('dev_riya', 'riya', 'Riya', 'Exploring content, trends, and category-based discovery.', null),
  ('dev_aman', 'aman', 'Aman', 'Testing engagement loops and interaction flows.', null)
on conflict (id) do update
set
  username = excluded.username,
  display_name = excluded.display_name,
  bio = excluded.bio,
  avatar_url = excluded.avatar_url;