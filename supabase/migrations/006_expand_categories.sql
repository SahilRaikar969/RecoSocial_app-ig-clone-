insert into public.categories (name, slug)
values
  ('Animals', 'animals'),
  ('Religion & Spirituality', 'religion-spirituality'),
  ('Memes & Brainrot', 'memes-brainrot'),
  ('Science', 'science'),
  ('Finance', 'finance'),
  ('Cars & Bikes', 'cars-bikes'),
  ('Fashion', 'fashion'),
  ('Food', 'food'),
  ('Travel', 'travel'),
  ('Health & Fitness', 'health-fitness'),
  ('Music', 'music'),
  ('Movies & Series', 'movies-series'),
  ('Sports', 'sports'),
  ('Art & Design', 'art-design'),
  ('Photography', 'photography'),
  ('Lifestyle', 'lifestyle')
on conflict (slug) do update
set name = excluded.name;