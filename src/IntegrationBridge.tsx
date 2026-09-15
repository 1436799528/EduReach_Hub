import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { cbtQuestions } from './data/cbtQuestions';

const RESULT_KEY = 'edurecah-cbt-result';
const PERSISTED_KEY = 'edureach-cbt-persisted-attempt';

export default function IntegrationBridge() {
  useEffect(() => {
    let cancelled = false;

    async function persistLatestResult() {
      if (cancelled) return;
      const raw = localStorage.getItem(RESULT_KEY);
      if (!raw || localStorage.getItem(PERSISTED_KEY)) return;

      let result: { score?: number; total?: number; answers?: Record<string, number> };
      try {
        result = JSON.parse(raw);
      } catch {
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: exam } = await supabase
        .from('cbt_exams')
        .select('id')
        .eq('title', 'EduReach General Practice Demo')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!exam) return;

      const { data: questions } = await supabase
        .from('exam_questions')
        .select('id,position,correct_option')
        .eq('exam_id', exam.id)
        .order('position', { ascending: true });
      if (!questions?.length) return;

      const answers = result.answers || {};
      const answeredRows = questions
        .map((question, index) => {
          const source = cbtQuestions[index];
          const selectedIndex = source ? answers[source.id] : undefined;
          if (selectedIndex === undefined) return null;
          const selectedOption = String.fromCharCode(65 + Number(selectedIndex));
          return {
            question_id: question.id,
            selected_option: selectedOption,
            is_correct: selectedOption === question.correct_option,
          };
        })
        .filter(Boolean) as Array<{ question_id: string; selected_option: string; is_correct: boolean }>;

      const correctAnswers = answeredRows.filter((answer) => answer.is_correct).length;
      const totalQuestions = questions.length;
      const score = totalQuestions ? Number(((correctAnswers / totalQuestions) * 100).toFixed(2)) : 0;

      const { data: attempt, error: attemptError } = await supabase
        .from('cbt_attempts')
        .insert({
          user_id: auth.user.id,
          exam_id: exam.id,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          score,
          correct_answers: correctAnswers,
          total_questions: totalQuestions,
        })
        .select('id')
        .single();

      if (attemptError || !attempt) return;

      if (answeredRows.length) {
        const { error } = await supabase.from('cbt_answers').insert(
          answeredRows.map((answer) => ({ attempt_id: attempt.id, ...answer })),
        );
        if (error) return;
      }

      if (!cancelled) localStorage.setItem(PERSISTED_KEY, attempt.id);
    }

    void persistLatestResult();
    const interval = window.setInterval(() => void persistLatestResult(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
