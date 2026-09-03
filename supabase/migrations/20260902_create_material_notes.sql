CREATE TABLE IF NOT EXISTS public.edureach_material_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL,
  course_code TEXT NOT NULL,
  material_title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_notes_user_material ON public.edureach_material_notes (user_id, material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_notes_user_created ON public.edureach_material_notes (user_id, created_at DESC);
