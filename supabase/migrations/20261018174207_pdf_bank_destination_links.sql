-- Link reviewed PDFs to the content item they belong to.
alter table public.document_bank
  add column if not exists news_article_id uuid references public.news_articles(id) on delete set null,
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

create index if not exists document_bank_news_article_idx
  on public.document_bank (news_article_id, destination, status)
  where news_article_id is not null;
create index if not exists document_bank_opportunity_idx
  on public.document_bank (opportunity_id, destination, status)
  where opportunity_id is not null;

alter table public.document_bank
  drop constraint if exists document_bank_destination_link_check;
alter table public.document_bank
  add constraint document_bank_destination_link_check
  check (
    (destination <> 'news_attachments' or news_article_id is not null)
    and (destination <> 'scholarships' or opportunity_id is not null)
    and (destination not in ('admission_guides', 'school_resources') or institution_id is not null)
  );

comment on column public.document_bank.news_article_id is
  'News article this PDF attaches to when destination is news_attachments.';
comment on column public.document_bank.opportunity_id is
  'Opportunity this PDF supports when destination is scholarships.';
