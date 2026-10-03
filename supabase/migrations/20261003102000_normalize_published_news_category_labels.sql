-- Keep the public news display label canonical for the controlled scholarships slug.
update public.news_articles
set category = 'Scholarships & Funding',
    updated_at = now()
where published_at is not null
  and category_slug = 'scholarships'
  and category <> 'Scholarships & Funding';
