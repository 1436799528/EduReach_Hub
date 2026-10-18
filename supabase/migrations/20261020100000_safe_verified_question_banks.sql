-- Safe verified question-bank import — arena 122Q banks, deduplicated
-- Reconciliation: preserve legacy comprehensive banks/history but deactivate them; activate the preferred Practice Bank catalogue.
-- Source inspected: arena/2630b947-edureach-hub @ 5549783 (58 migrations; current seed contains 214 original-practice items: JAMB 122, WAEC 37, NECO 31, Post-UTME 24)
-- Verification:
--   * Arena banks are original clones (no official past-question claim), style-matched to exam blueprints
--   * Source metadata: original_practice, needs_review, format_verified=false (not claimed official)
--   * No official source URL — presence does not prove official provenance (per 18120000 comment)
--   * Production may already contain active '* Comprehensive Practice Bank' rows; those are deactivated after the preferred Practice Bank rows are created, preserving their history.
--   * Deduplication: exact normalized question_text match (lower(trim())) is skipped; position guard also preserved
--   * Legacy exam/question rows and all attempt/answer history are preserved; old comprehensive exams are deactivated, never deleted.
--   * Demo bank deactivated (is_active=false) but row kept for history — preserves student data
--   * Near-duplicate (similarity) analysis NOT used for deletion — requires manual review (see duplicate audit note)
-- This migration is idempotent for question inserts and preserves existing student attempts/answers.

-- Real JAMB/WAEC/NECO-style question banks — authentic exam feel
-- Deactivates the generic demo bank and seeds curated, subject-aware banks that
-- mirror the actual exam blueprint: JAMB UTME (Use of English compulsory, 60 + 40 caps),
-- WAEC/NECO SSCE (9-subject spread), and Post-UTME. Every question is original,
-- written to the same difficulty and instruction style as the live exams, with
-- plausible distractors and teaching explanations. The seed is idempotent.

-- Deactivate the 10-question generic prototype — keep its row for history but remove
-- it from the active catalogue so students only see the authentic banks.
update public.cbt_exams
set is_active = false, updated_at = now()
where title = 'EduReach General Practice Demo' and is_active = true;

-- Helper: exams ---------------------------------------------------------------

insert into public.cbt_exams (title, exam_body, subject, description, duration_minutes, is_active)
select 'JAMB UTME Practice Bank', 'JAMB', 'Multiple subjects',
       'Authentic JAMB UTME-style bank. Use of English is compulsory; every other subject is capped at 40 as in the real UTME. Timed mock uses 120 minutes.', 120, true
where not exists (select 1 from public.cbt_exams where title = 'JAMB UTME Practice Bank');

insert into public.cbt_exams (title, exam_body, subject, description, duration_minutes, is_active)
select 'WAEC SSCE Practice Bank', 'WAEC', 'Multiple subjects',
       'WAEC SSCE objective-style bank with 9-subject spread. Practice with any subject combination or run a full 90-minute mock.', 90, true
where not exists (select 1 from public.cbt_exams where title = 'WAEC SSCE Practice Bank');

insert into public.cbt_exams (title, exam_body, subject, description, duration_minutes, is_active)
select 'NECO SSCE Practice Bank', 'NECO', 'Multiple subjects',
       'NECO SSCE objective bank mirroring SSCE structure. Subjects are independent; choose what you sit for.', 90, true
where not exists (select 1 from public.cbt_exams where title = 'NECO SSCE Practice Bank');

insert into public.cbt_exams (title, exam_body, subject, description, duration_minutes, is_active)
select 'Post-UTME Practice Bank', 'Post-UTME', 'Multiple subjects',
       'Post-UTME screening practice — Use of English, Mathematics and General Knowledge as most schools set it. Timed 60 minutes.', 60, true
where not exists (select 1 from public.cbt_exams where title = 'Post-UTME Practice Bank');

-- Reconcile the legacy catalogue to the preferred Practice Bank records.
-- Keep the old comprehensive rows and their questions for historical attempts,
-- but retire them from the active catalogue. Do not delete or re-parent anything:
-- cbt_attempts/cbt_answers may still reference the old exam/question IDs.
update public.cbt_exams
set is_active = false, updated_at = now()
where is_active = true
  and title in (
    'JAMB UTME Comprehensive Practice Bank',
    'WAEC SSCE Comprehensive Practice Bank',
    'NECO SSCE Comprehensive Practice Bank',
    'Post-UTME Comprehensive Practice Bank'
  );

-- Fail the migration if the intended four banks are not the only active
-- records for these four exam bodies. This guards against duplicate catalogue
-- entries if a legacy title differs from the known production pattern.
do $reconcile$
declare
  active_jamb integer;
  active_waec integer;
  active_neco integer;
  active_post_utme integer;
begin
  select count(*) into active_jamb from public.cbt_exams
    where is_active = true and exam_body = 'JAMB';
  select count(*) into active_waec from public.cbt_exams
    where is_active = true and exam_body = 'WAEC';
  select count(*) into active_neco from public.cbt_exams
    where is_active = true and exam_body = 'NECO';
  select count(*) into active_post_utme from public.cbt_exams
    where is_active = true and exam_body = 'Post-UTME';

  if active_jamb <> 1 or active_waec <> 1 or active_neco <> 1 or active_post_utme <> 1 then
    raise exception 'Question bank reconciliation failed: active counts JAMB %, WAEC %, NECO %, Post-UTME %',
      active_jamb, active_waec, active_neco, active_post_utme;
  end if;
end $reconcile$;

-- JAMB UTME — Use of English 1-24 (passage, lexis, antonyms, grammar, idioms) --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (1, 'Use of English', 'Passage: Digital learning has transformed how Nigerian students access education. While the flexibility of online platforms allows a student in Sokoto to join a lecture hosted in Lagos, poor connectivity and the cost of data still exclude many. Recent studies suggest the most effective model is blended — where technology supports, but does not replace, the classroom. Question: What is the main idea of the passage?', 'Online learning has failed in Nigeria', 'Blended learning offers the most effective balance', 'Only Lagos students benefit from technology', 'Data cost is irrelevant', 'B', 'The passage argues that blended (tech + classroom) is most effective after acknowledging both access gains and connectivity barriers.'),
  (2, 'Use of English', 'According to the passage, which factor most directly excludes students from online learning?', 'Lack of interest', 'Poor connectivity and high data cost', 'Too many lecturers', 'Excessive holidays', 'B', 'The passage explicitly links exclusion to connectivity and data cost.'),
  (3, 'Use of English', 'Choose the word nearest in meaning to the underlined word in: “poor connectivity still EXCLUDE many.”', 'Include', 'Prevent from participating', 'Celebrate', 'Improve', 'B', 'Exclude here means prevent from taking part.'),
  (4, 'Use of English', 'What can be inferred about the author’s attitude to digital learning?', 'Wholly condemning', 'Cautiously optimistic about blended adoption', 'Indifferent', 'Hostile to classrooms', 'B', 'Author acknowledges gains and limits, endorsing blended — cautious optimism.'),
  (5, 'Use of English', 'Which title best fits the passage?', 'The failure of Nigerian universities', 'Blended learning as a practical path', 'How to buy cheap data', 'Life in Sokoto and Lagos', 'B', 'Passage focuses on blended model as practical path.'),
  (6, 'Use of English', 'Choose the option nearest in meaning to the underlined word: The principal was PRAGMATIC in his approach to the crisis.', 'Idealistic and unrealistic', 'Practical and result-oriented', 'Slow and careless', 'Strict and harsh', 'B', 'Pragmatic means practical, focused on results.'),
  (7, 'Use of English', 'Choose the option nearest in meaning to the underlined word: The government’s decision was ARBITRARY.', 'Based on personal whim rather than reason', 'Widely celebrated', 'Backed by research', 'Delayed by law', 'A', 'Arbitrary means not grounded in principle or system.'),
  (8, 'Use of English', 'Choose the option nearest in meaning to the underlined word: Her explanation was COHERENT.', 'Confusing and scattered', 'Logical and well-connected', 'Brief and rude', 'Angry and loud', 'B', 'Coherent means logical and consistent.'),
  (9, 'Use of English', 'Choose the option opposite in meaning to the underlined word: The witness was CANDID about what he saw.', 'Truthful', 'Secretive and evasive', 'Confused', 'Loud', 'B', 'Candid means frank; opposite is evasive/secretive.'),
  (10, 'Use of English', 'Choose the option opposite in meaning to the underlined word: The lecturer’s remarks were CONCISE.', 'Brief and clear', 'Wordy and drawn out', 'Polite and kind', 'Accurate', 'B', 'Concise means short; opposite is verbose.'),
  (11, 'Use of English', 'Choose the option opposite in meaning to the underlined word: The exam was RIGOROUS.', 'Demanding and thorough', 'Lax and undemanding', 'Expensive', 'Long', 'B', 'Rigorous means thorough/demanding; opposite is lax.'),
  (12, 'Use of English', 'Choose the option that best completes the gap: If the students ___ earlier, they would have met the registration deadline.', 'have come', 'had come', 'will come', 'come', 'B', 'Past unreal condition requires had + past participle.'),
  (13, 'Use of English', 'Choose the option that best completes the gap: Neither the principal ___ the teachers ___ in support of the proposal.', 'nor / was', 'or / were', 'nor / were', 'or / was', 'C', 'Neither ... nor takes plural verb closer to subject (teachers were).'),
  (14, 'Use of English', 'By the end of the session, the committee ___ its report.', 'will have submitted', 'will submit', 'has submitted', 'had been submitted', 'A', 'The future perfect describes an action completed by a specified future time.'),
  (15, 'Use of English', 'From the words lettered A–D, choose the one that has the same vowel sound as the underlined word: beat.', 'Bit', 'Seat', 'Bet', 'But', 'B', 'beat (/iː/) matches seat (/iː/).'),
  (16, 'Use of English', 'Choose the option that best explains the idiom: “The team decided to CUT CORNERS during the project.”', 'To take shortcuts, often at the expense of quality', 'To work extra hard', 'To celebrate openly', 'To divide money fairly', 'A', 'Cut corners = take shortcuts, compromising standards.'),
  (17, 'Use of English', 'Choose the option that best explains the idiom: “After the announcement, she was ON CLOUD NINE.”', 'Extremely happy', 'Very confused', 'Deeply asleep', 'Under arrest', 'A', 'On cloud nine = elated.'),
  (18, 'Use of English', 'Choose the option that best completes the sentence: The students insisted ___ the library after hours.', 'on using', 'to use', 'in using', 'at using', 'A', 'Insist on + gerund is idiomatic.'),
  (19, 'Use of English', 'Which word has primary stress on its second syllable?', 'photograph', 'photographer', 'photographic', 'photo', 'B', 'Photographer has primary stress on the second syllable; photographic is stressed later, so the original “stressed differently” wording was ambiguous.'),
  (20, 'Use of English', 'Register: In an academic essay, which sentence is most appropriate?', 'You guys should check the results ASAP.', 'Candidates are advised to verify their results promptly.', 'Make una go check una result.', 'See the result now now.', 'B', 'Academic register requires formal, complete diction.'),
  (21, 'Use of English', 'Choose the option nearest in meaning to: “The policy was implemented to the LETTER.”', 'Exactly as written, without deviation', 'In a friendly manner', 'After a long delay', 'With public approval', 'A', 'To the letter = exactly as specified.'),
  (22, 'Use of English', 'Synonym of FALLACIOUS in “The fallacious argument misled many students.”', 'Incorrect and misleading', 'Interesting and complex', 'Brief and clear', 'Traditional', 'A', 'Fallacious = based on false reasoning.'),
  (23, 'Use of English', 'Choose the option that best completes the gap: Hardly ___ the hall when the power was restored.', 'they had entered', 'had they entered', 'they have entered', 'have they entered', 'B', 'Inversion after Hardly → Had they entered.'),
  (24, 'Use of English', 'Interpretation: “We have turned the corner on this crisis,” the minister said. What does it imply?', 'The worst is past and things are improving', 'A new crisis has begun', 'The road is blocked', 'No progress has been made', 'A', 'Turn the corner = pass the critical point toward improvement.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- JAMB UTME — Mathematics 25-44 --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (25, 'Mathematics', 'Simplify: (0.0001)^(-1/2)', '0.01', '10', '100', '1000', 'C', '0.0001 = 10^-4; (10^-4)^(-1/2) = 10^2 = 100.'),
  (26, 'Mathematics', 'If 3^(x) = 81, find x.', '2', '3', '4', '6', 'C', '81 = 3^4 ⇒ x = 4.'),
  (27, 'Mathematics', 'The 6th term of an AP with a=2, d=3 is:', '14', '15', '17', '20', 'C', 'a_n = a+(n-1)d = 2+5*3 =17.'),
  (28, 'Mathematics', 'Find the mean of 4, 6, 8, 10, 12.', '6', '8', '10', '12', 'B', 'Sum=40, n=5, mean=8.'),
  (29, 'Mathematics', 'If log10 2 =0.3010, find log10 20.', '0.6990', '1.3010', '1.6990', '2.3010', 'B', 'log20=log(2*10)=log2+1=1.3010.'),
  (30, 'Mathematics', 'Solve: 2x - 5 = 9.', '5', '7', '9', '12', 'B', '2x=14 ⇒ x=7.'),
  (31, 'Mathematics', 'A bag contains 3 red and 4 blue balls. Probability of picking a red at random is:', '3/7', '3/4', '4/7', '1/2', 'A', 'Total 7, favourable 3 ⇒3/7.'),
  (32, 'Mathematics', 'Area of a circle radius 7 cm (take π=22/7) is:', '154 cm²', '44 cm²', '308 cm²', '616 cm²', 'A', 'Area=π r² =22/7*49=154.'),
  (33, 'Mathematics', 'Find the gradient of the line joining (1,2) and (3,6).', '1', '2', '3', '4', 'B', 'm = (6-2)/(3-1)=4/2=2.'),
  (34, 'Mathematics', 'Simplify: (2a²)³', '2a⁶', '6a⁶', '8a⁶', '8a⁵', 'C', '(2)³=8, (a²)³=a⁶ ⇒8a⁶.'),
  (35, 'Mathematics', 'The interior angle sum of a hexagon is:', '360°', '540°', '720°', '1080°', 'C', '(n-2)*180 =4*180=720°.'),
  (36, 'Mathematics', 'If 15% of N is 30, N =', '150', '180', '200', '250', 'C', '0.15N=30⇒N=30/0.15=200.'),
  (37, 'Mathematics', 'Solve for x: x² -5x+6=0', 'x=2 or 3', 'x=-2 or -3', 'x=1 or 6', 'x=0 or 5', 'A', 'Factors (x-2)(x-3)=0.'),
  (38, 'Mathematics', 'The mode of 2,3,3,4,5,5,5,6 is:', '3', '4', '5', '6', 'C', '5 occurs most (3 times).'),
  (39, 'Mathematics', 'Increase 400 by 12.5% gives:', '412.5', '450', '480', '500', 'B', '400*1.125=450.'),
  (40, 'Mathematics', 'Find |2a - b| if a=(3,4), b=(1,2): magnitude of 2a−b.', '5', '√29', '√61', '√37', 'C', '2a−b=(6,8)−(1,2)=(5,6); magnitude = √(5²+6²)=√61.'),
  (41, 'Mathematics', 'A trader allows 10% discount and still makes 20% profit. If cost is ₦900, marked price is:', '₦1080', '₦1100', '₦1200', '₦1320', 'C', 'SP=1.2*900=1080=0.9MP ⇒MP=1200.'),
  (42, 'Mathematics', 'Evaluate: sin30° + cos60°', '0', '0.5', '1', '1.5', 'C', 'sin30=0.5, cos60=0.5, sum=1.'),
  (43, 'Mathematics', 'Find the median of 7, 3, 9, 5, 2.', '2', '5', '7', '9', 'B', 'Ordered 2,3,5,7,9 median 5.'),
  (44, 'Mathematics', 'Convert 1011₂ to base 10.', '9', '11', '13', '15', 'B', '1*8+0*4+1*2+1=11.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- JAMB UTME — Physics 45-62 --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (45, 'Physics', 'A body of mass 2 kg moving at 5 m/s has momentum:', '2 kg m/s', '5 kg m/s', '10 kg m/s', '20 kg m/s', 'C', 'p=mv=2*5=10 kg m/s.'),
  (46, 'Physics', 'The SI unit of pressure is:', 'Newton', 'Pascal', 'Joule', 'Watt', 'B', 'Pressure = force/area, unit Pascal (Pa).'),
  (47, 'Physics', 'An object 20 cm from a concave mirror of focal length 10 cm forms an image at:', 'At infinity', '20 cm in front', '10 cm behind', '40 cm in front', 'B', '1/f=1/u+1/v ⇒1/10=1/20+1/v ⇒v=20 cm real in front.'),
  (48, 'Physics', 'Which wave requires no medium?', 'Sound', 'Water wave', 'Light wave', 'Seismic wave', 'C', 'Electromagnetic waves need no medium.'),
  (49, 'Physics', 'A 2000 W heater runs for 30 s. Energy dissipated is:', '60 kJ', '30 kJ', '6000 J', '120 kJ', 'A', 'Energy = power × time = 2000 × 30 = 60000 J = 60 kJ.'),
  (50, 'Physics', 'The acceleration due to gravity on Earth is approx.:', '0 m/s²', '9.8 m/s²', '98 m/s²', '980 m/s²', 'B', 'Standard g≈9.8 m/s².'),
  (51, 'Physics', 'Ohm’s law states V ∝ I provided:', 'Temperature remains constant', 'Pressure remains constant', 'Volume remains constant', 'Mass remains constant', 'A', 'Metallic conductor at constant temperature.'),
  (52, 'Physics', 'A satellite in orbit experiences weightlessness because:', 'No gravity acts', 'It is in free fall around Earth', 'It is far from Earth', 'Air resistance balances weight', 'B', 'Orbit is continuous free fall; gravity provides centripetal force.'),
  (53, 'Physics', 'Frequency 50 Hz, wavelength 2 m. Wave speed is:', '25 m/s', '50 m/s', '100 m/s', '200 m/s', 'C', 'v=fλ=50*2=100 m/s.'),
  (54, 'Physics', 'Work done carrying a load on level ground at constant height is:', 'Positive and large', 'Zero (no vertical displacement in force direction)', 'Negative', 'Infinite', 'B', 'Force vertical, displacement horizontal ⇒ no work.'),
  (55, 'Physics', 'Half-life of a substance is 5 years. Fraction remaining after 15 years:', '1/2', '1/4', '1/8', '1/16', 'C', '15/5=3 half-lives ⇒(1/2)³=1/8.'),
  (56, 'Physics', 'Specific heat capacity is:', 'Heat required to raise 1 kg by 1 K', 'Heat required to melt 1 kg', 'Heat per unit volume', 'Heat per unit charge', 'A', 'Definition of specific heat capacity.'),
  (57, 'Physics', 'In a series circuit, total resistance is:', 'Sum of individual resistances', 'Reciprocal sum', 'Average', 'Difference', 'A', 'R_total = R1+R2+... in series.'),
  (58, 'Physics', 'Image formed by a plane mirror is:', 'Real, inverted', 'Virtual, erect, same size', 'Virtual, magnified', 'Real, magnified', 'B', 'Plane mirror gives virtual erect same-size image.'),
  (59, 'Physics', 'The colour with longest wavelength in visible spectrum is:', 'Violet', 'Green', 'Yellow', 'Red', 'D', 'Red ≈700 nm longest visible.'),
  (60, 'Physics', 'A transformer steps up voltage from 20 V to 100 V. If primary has 100 turns, secondary has:', '20 turns', '100 turns', '500 turns', '2000 turns', 'C', 'Vs/Vp=Ns/Np ⇒100/20=Ns/100 ⇒Ns=500.'),
  (61, 'Physics', 'Escape velocity from Earth is about:', '1 km/s', '5 km/s', '11.2 km/s', '42 km/s', 'C', '≈11.2 km/s.'),
  (62, 'Physics', 'Which instrument measures atmospheric pressure?', 'Barometer', 'Thermometer', 'Ammeter', 'Hydrometer', 'A', 'Barometer measures air pressure.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- JAMB UTME — Chemistry 63-78 --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (63, 'Chemistry', 'Which gas turns lime water milky?', 'Oxygen', 'Hydrogen', 'Carbon(IV) oxide', 'Nitrogen', 'C', 'CO2 forms CaCO3 precipitate with lime water.'),
  (64, 'Chemistry', 'The oxidation number of S in H2SO4 is:', '+2', '+4', '+6', '-2', 'C', '2*1 + S +4*(-2)=0 ⇒ S=+6.'),
  (65, 'Chemistry', 'Example of an alkene is:', 'Ethane (C2H6)', 'Ethene (C2H4)', 'Ethyne (C2H2)', 'Methanol', 'B', 'Alkene has C=C; ethene C2H4.'),
  (66, 'Chemistry', 'Atomic number 11 (Na) electronic configuration:', '1s2 2s2 2p6 3s1', '1s2 2s2 2p6 3s2', '1s2 2s2 2p6', '1s2 2s2 2p6 3p1', 'A', '11 electrons: 2,8,1 ⇒1s2 2s2 2p6 3s1.'),
  (67, 'Chemistry', 'Which separation method isolates salt from seawater?', 'Filtration', 'Evaporation', 'Sublimation', 'Distillation', 'B', 'Evaporation leaves residue.'),
  (68, 'Chemistry', 'pH of a neutral solution at 25°C is:', '0', '7', '10', '14', 'B', 'Neutral pH ≈7.'),
  (69, 'Chemistry', 'Catalyst that speeds reaction without being consumed:', 'Reactant', 'Product', 'Catalyst', 'Inhibitor', 'C', 'Definition of catalyst.'),
  (70, 'Chemistry', 'Which is a noble gas?', 'Oxygen', 'Nitrogen', 'Argon', 'Chlorine', 'C', 'Group 18: He, Ne, Ar, etc.'),
  (71, 'Chemistry', 'Number of neutrons in ^23_11 Na is:', '11', '12', '23', '34', 'B', 'neutrons = mass - protons =23-11=12.'),
  (72, 'Chemistry', 'When iron rusts, the process is:', 'Physical change', 'Chemical change (oxidation)', 'Sublimation', 'Condensation', 'B', 'Rusting is oxidation Fe→Fe2O3.'),
  (73, 'Chemistry', 'Empirical formula of a compound with 40% C, 6.7% H, 53.3% O is:', 'CH2O', 'C2H4O2', 'C6H12O6', 'CHO2', 'A', 'Mole ratios 3.33:6.7:3.33 ≈1:2:1 ⇒CH2O.'),
  (74, 'Chemistry', 'Which acid is present in vinegar?', 'Citric acid', 'Ethanoic (acetic) acid', 'Sulphuric acid', 'Nitric acid', 'B', 'Vinegar ~5% ethanoic acid.'),
  (75, 'Chemistry', 'Ionic bond forms between:', 'Two metals', 'Metal and non-metal', 'Two non-metals', 'Two noble gases', 'B', 'Metal donates, non-metal accepts electrons.'),
  (76, 'Chemistry', 'Which indicator is best for strong acid vs strong base titration?', 'Methyl orange only', 'Phenolphthalein only', 'Either methyl orange or phenolphthalein', 'Litmus only', 'C', 'Sharp pH 7 jump allows either for strong-strong.'),
  (77, 'Chemistry', 'Molar mass of CaCO3 (Ca=40, C=12, O=16) is:', '50 g/mol', '68 g/mol', '100 g/mol', '120 g/mol', 'C', '40+12+48=100.'),
  (78, 'Chemistry', 'Process of converting vapour directly to solid without liquid is:', 'Evaporation', 'Sublimation', 'Condensation', 'Deposition (reverse sublimation)', 'D', 'Gas→solid is deposition. Sublimation solid→gas.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- JAMB UTME — Biology 79-94 --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (79, 'Biology', 'Which organelle is commonly called the powerhouse of the cell?', 'Nucleus', 'Mitochondrion', 'Chloroplast', 'Ribosome', 'B', 'Mitochondrion generates ATP via respiration.'),
  (80, 'Biology', 'The causative agent of malaria is:', 'Bacterium', 'Virus', 'Plasmodium (protozoan)', 'Fungus', 'C', 'Plasmodium falciparum etc. transmitted by Anopheles.'),
  (81, 'Biology', 'Blood group O is regarded as universal donor because:', 'It has no antigens, can give to all ABO groups (with Rh caveat)', 'It has all antigens', 'It has no antibodies', 'It is rare', 'A', 'O has no A/B antigens, historically universal donor for red cells.'),
  (82, 'Biology', 'Photosynthesis occurs mainly in:', 'Mitochondria', 'Chloroplasts', 'Nucleus', 'Golgi body', 'B', 'Chlorophyll in chloroplasts captures light.'),
  (83, 'Biology', 'Which process describes movement of water from high to low water potential through a semi-permeable membrane?', 'Diffusion', 'Osmosis', 'Active transport', 'Translocation', 'B', 'Osmosis is water-specific diffusion via membrane.'),
  (84, 'Biology', 'In humans, fertilization normally occurs in the:', 'Uterus', 'Ovary', 'Fallopian tube (oviduct)', 'Cervix', 'C', 'Oviduct is usual site before implantation in uterus.'),
  (85, 'Biology', 'An example of a vestigial structure in humans is:', 'Appendix (vermiform)', 'Heart', 'Liver', 'Kidney', 'A', 'Vestigial appendix has minimal function now.'),
  (86, 'Biology', 'DNA is double-stranded polymer of:', 'Amino acids', 'Nucleotides', 'Glucose', 'Fatty acids', 'B', 'Nucleotide units (A,T,C,G).'),
  (87, 'Biology', 'Which kingdom contains prokaryotes without membrane-bound nucleus?', 'Protista', 'Monera (Prokaryota)', 'Fungi', 'Plantae', 'B', 'Monera = bacteria, prokaryotic.'),
  (88, 'Biology', 'Sickle cell anaemia is an example of:', 'Sex-linked trait', 'Co-dominance / point mutation in haemoglobin', 'Incomplete dominance only', 'Environmental variation', 'B', 'Glu→Val substitution in beta-globin, co-dominant expression.'),
  (89, 'Biology', 'The functional unit of the kidney is:', 'Nephron', 'Alveolus', 'Villus', 'Neuron', 'A', 'Nephron filters blood and forms urine.'),
  (90, 'Biology', 'Which plant tissue transports water from roots to leaves?', 'Phloem', 'Xylem', 'Cambium', 'Epidermis', 'B', 'Xylem carries water; phloem carries nutrients.'),
  (91, 'Biology', 'During mitosis, chromosome number:', 'Halves', 'Remains the same (diploid → diploid)', 'Doubles', 'Is lost', 'B', 'Mitosis maintains diploid count; meiosis halves.'),
  (92, 'Biology', 'Tadpole to frog is an example of:', 'Growth only', 'Metamorphosis', 'Germination', 'Budding', 'B', 'Complete transformation = metamorphosis.'),
  (93, 'Biology', 'Which vitamin deficiency causes night blindness?', 'Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D', 'A', 'Vit A → rhodopsin for low-light vision.'),
  (94, 'Biology', 'Ecological niche refers to:', 'Place where organism lives', 'Functional role + habitat + interactions of organism', 'Number of organisms', 'Food chain only', 'B', 'Niche = role + position in ecosystem.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- JAMB UTME — Economics 95-108 --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (95, 'Economics', 'The demand curve for a normal good slopes downward primarily because of:', 'Law of diminishing marginal utility + income/substitution effects', 'Government decree', 'Increase in supply', 'Constant cost', 'A', 'Higher price lowers quantity demanded via utility and budget effects.'),
  (96, 'Economics', 'A sustained general rise in prices is called:', 'Deflation', 'Inflation', 'Stagflation', 'Devaluation', 'B', 'Inflation = general price level rise.'),
  (97, 'Economics', 'The primary function of a commercial bank is:', 'Printing currency', 'Accepting deposits and granting loans', 'Controlling monetary policy', 'Collecting taxes', 'B', 'Banks intermediate savings→loans; CBN controls policy.'),
  (98, 'Economics', 'Opportunity cost is best defined as:', 'Total money spent', 'Value of the next best alternative foregone', 'Fixed cost', 'Marginal cost', 'B', 'Opportunity cost = what you give up.'),
  (99, 'Economics', 'If total revenue is TR=50Q -2Q², marginal revenue at Q=5 is:', '10', '30', '40', '50', 'B', 'MR = dTR/dQ =50 -4Q =50-20=30.'),
  (100, 'Economics', 'Unemployment of graduates actively searching but not yet placed is:', 'Frictional', 'Structural', 'Cyclical', 'Seasonal', 'A', 'Frictional = between jobs, search time.'),
  (101, 'Economics', 'Balance of payments deficit means:', 'Exports > imports', 'Imports > exports + net capital outflows', 'Currency appreciated', 'No trade', 'B', 'Deficit when payments abroad exceed receipts.'),
  (102, 'Economics', 'Which tax takes a larger percentage from low-income earners?', 'Progressive tax', 'Regressive tax', 'Proportional tax', 'Direct tax', 'B', 'Regressive burdens low incomes more (e.g., flat sales tax).'),
  (103, 'Economics', 'National income at market price minus net indirect taxes gives:', 'GDP at factor cost', 'GNP at market price', 'Net national income', 'Disposable income', 'A', 'Market→factor by removing indirect taxes/subsidies.'),
  (104, 'Economics', 'The main objective of privatization is to:', 'Increase government control', 'Improve efficiency via private sector', 'Reduce exports', 'Increase money supply', 'B', 'Privatization shifts enterprise to private efficiency.'),
  (105, 'Economics', 'A shift in supply curve to the right is caused by:', 'Increase in production cost', 'Improvement in technology', 'Increase in tax', 'Bad weather', 'B', 'Tech improvement raises supply at same price.'),
  (106, 'Economics', 'Money that must be accepted by law is:', 'Legal tender', 'Near money', 'Commodity money', 'Token money', 'A', 'Legal tender has statutory acceptance.'),
  (107, 'Economics', 'Budget where expenditure exceeds revenue is:', 'Balanced budget', 'Surplus budget', 'Deficit budget', 'National budget', 'C', 'Deficit = spending > revenue.'),
  (108, 'Economics', 'The Lorenz curve measures:', 'Price level', 'Income inequality', 'Employment', 'Population growth', 'B', 'Lorenz curve shows income distribution inequality.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- JAMB UTME — Government 109-122 --
with exam as (select id from public.cbt_exams where title = 'JAMB UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (109, 'Government', 'The 1999 Constitution of Nigeria provides for:', 'Parliamentary system', 'Presidential system with federal structure', 'Monarchical system', 'Confederal system', 'B', '1999 Constitution: presidential, federal.'),
  (110, 'Government', 'The principle of separation of powers was popularized by:', 'Montesquieu', 'Karl Marx', 'John Locke alone', 'Aristotle', 'A', 'Montesquieu in The Spirit of the Laws (1748).'),
  (111, 'Government', 'The first military coup in Nigeria occurred in:', '1960', '1966 (January)', '1970', '1983', 'B', 'First coup 15 Jan 1966.'),
  (112, 'Government', 'ECOWAS was established primarily to promote:', 'Military conquest', 'Economic integration of West Africa', 'Religious unity', 'Linguistic unity only', 'B', 'Economic Community of West African States (1975).'),
  (113, 'Government', 'In a federal system, residual powers are held by:', 'Central government only', 'Constituent units (states) except where constitution assigns otherwise', 'Local government only', 'Traditional rulers', 'B', 'Residual = not enumerated, typically state-level.'),
  (114, 'Government', 'The policy of apartheid was practised in:', 'South Africa', 'Egypt', 'Kenya', 'Ghana', 'A', 'Institutionalized racial segregation until 1994.'),
  (115, 'Government', 'A bill becomes an Act after:', 'First reading', 'Assent by the executive (President/Governor)', 'Committee stage only', 'Public hearing only', 'B', 'Assent completes enactment.'),
  (116, 'Government', 'Which organ interprets the constitution?', 'Executive', 'Legislature', 'Judiciary', 'Electorate', 'C', 'Judiciary interprets law.'),
  (117, 'Government', 'Universal Adult Suffrage means:', 'Only men vote', 'All eligible adults have right to vote without discrimination', 'Only property owners vote', 'Only graduates vote', 'B', 'One person one vote at adulthood.'),
  (118, 'Government', 'The headquarters of the United Nations is in:', 'New York, USA', 'Geneva, Switzerland', 'London, UK', 'Nairobi, Kenya', 'A', 'UN HQ Manhattan, New York.'),
  (119, 'Government', 'The party system that allows many parties to contest is:', 'One-party', 'Two-party', 'Multi-party', 'Zero-party', 'C', 'Multi-party democracy.'),
  (120, 'Government', 'The doctrine of rule of law was expounded by:', 'A.V. Dicey', 'Thomas Hobbes', 'Niccolò Machiavelli', 'Max Weber', 'A', 'Dicey: supremacy of law, equality before law.'),
  (121, 'Government', 'Decentralization primarily aims to:', 'Concentrate power at centre', 'Bring governance closer to people', 'Abolish local government', 'Create military rule', 'B', 'Devolution for participation and efficiency.'),
  (122, 'Government', 'The Independent National Electoral Commission (INEC) is responsible for:', 'Conducting elections and managing voter registration', 'Printing currency', 'Controlling army', 'Making laws', 'A', 'INEC mandate under Constitution/Electoral Act.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- WAEC bank — 37 original-practice questions across six subjects (not official past-paper reproductions) --
with exam as (select id from public.cbt_exams where title = 'WAEC SSCE Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (1, 'Use of English', 'Choose the option that best completes the sentence: The new library ___ commissioned last Monday.', 'is', 'was', 'has', 'were', 'B', 'Past event “last Monday” → past tense was commissioned.'),
  (2, 'Use of English', 'Choose the word nearest in meaning to VIVID in “She gave a vivid account of the incident.”', 'Dull', 'Clear and detailed', 'Brief', 'Secret', 'B', 'Vivid = strikingly clear/detailed.'),
  (3, 'Use of English', 'From the words A–D, choose the one that rhymes with “bought”:', 'Boot', 'Court', 'But', 'Bet', 'B', 'bought /bɔːt/ rhymes with court.'),
  (4, 'Use of English', 'Identify the correctly punctuated sentence:', 'Its a rainy day', 'It’s a rainy day.', 'Its a rainy day.', 'It''s a rainy day', 'B', 'Option B uses the contraction correctly and ends the sentence with a full stop; D lacks final punctuation.'),
  (5, 'Use of English', 'After the announcement, the hall was filled with loud APPLAUSE. Choose nearest meaning:', 'Silence', 'Clapping approval', 'Anger', 'Criticism', 'B', 'Applause = clapping.'),
  (6, 'Use of English', 'Choose the option opposite in meaning to OBSCURE in “obscure instructions”:', 'Clear and distinct', 'Dark and hidden', 'Expensive', 'Loud', 'A', 'Obscure = not clear; opposite clear.'),
  (7, 'Mathematics', 'Factorize: x² - 9', '(x-3)(x+3)', '(x-9)(x+1)', '(x-3)²', '(x+9)(x-3)', 'A', 'Difference of squares a²-b²=(a-b)(a+b).'),
  (8, 'Mathematics', 'Find the simple interest on ₦5000 at 8% per annum for 3 years.', '₦400', '₦800', '₦1200', '₦1500', 'C', 'I=PRT/100=5000*8*3/100=1200.'),
  (9, 'Mathematics', 'If 2^(x+1)=32, x =', '3', '4', '5', '6', 'B', '32=2⁵ ⇒x+1=5⇒x=4.'),
  (10, 'Mathematics', 'Locus of points equidistant from a fixed point is a:', 'Circle', 'Square', 'Triangle', 'Parabola', 'A', 'Definition of circle.'),
  (11, 'Mathematics', 'Find the distance between (0,0) and (3,4).', '3', '4', '5', '6', 'C', 'Distance √(3²+4²)=5.'),
  (12, 'Mathematics', 'Find median of 20,30,40,50,60.', '30', '40', '50', '60', 'B', 'Middle of ordered set is 40.'),
  (13, 'Physics', 'A car accelerates from 0 to 20 m/s in 5 s. Average acceleration is:', '2 m/s²', '4 m/s²', '10 m/s²', '100 m/s²', 'B', 'a=Δv/Δt=20/5=4 m/s².'),
  (14, 'Physics', 'Which lens corrects myopia (short-sight)?', 'Bi-convex', 'Concave (diverging)', 'Plano-convex', 'Cylindrical only', 'B', 'Myopia: concave diverges light to retina.'),
  (15, 'Physics', 'Energy stored in a capacitor C=2F at V=5V is:', '5 J', '10 J', '25 J', '50 J', 'C', 'E=½CV²=0.5*2*25=25 J.'),
  (16, 'Physics', 'Potential difference is measured in:', 'Amperes', 'Volts', 'Ohms', 'Watts', 'B', 'Voltage unit volt.'),
  (17, 'Physics', 'The SI unit of pressure is:', 'Newton', 'Pascal', 'Joule', 'Watt', 'B', 'Pressure = force/area, Pascal.'),
  (18, 'Physics', 'Which wave requires no medium?', 'Sound', 'Water wave', 'Light wave', 'Seismic wave', 'C', 'Electromagnetic waves need no medium.'),
  (19, 'Chemistry', 'Rust consists mainly of:', 'FeO', 'Fe2O3·xH2O (hydrated iron(III) oxide)', 'FeCl3', 'FeSO4', 'B', 'Rust is hydrated Fe2O3.'),
  (20, 'Chemistry', 'Which halogen is liquid at room temperature?', 'Fluorine', 'Chlorine', 'Bromine', 'Iodine', 'C', 'Br2 liquid; others gas/solid at room temp.'),
  (21, 'Chemistry', 'Balance: H2 + O2 → H2O. Coefficients:', '1,1,1', '2,1,2', '1,2,2', '2,2,2', 'B', '2H2+O2→2H2O.'),
  (22, 'Chemistry', 'Organic compound with -OH group is called:', 'Alkane', 'Alcohol', 'Alkene', 'Alkyne', 'B', 'Alcohol functional group -OH.'),
  (23, 'Chemistry', 'Isotope differs in:', 'Number of neutrons', 'Number of protons', 'Electrons only', 'Atomic number', 'A', 'Same protons, different neutrons.'),
  (24, 'Chemistry', 'Which acid is present in vinegar?', 'Citric acid', 'Ethanoic (acetic) acid', 'Sulphuric acid', 'Nitric acid', 'B', 'Vinegar ~5% ethanoic acid.'),
  (25, 'Biology', 'Which structure controls cell activities?', 'Cell wall', 'Nucleus', 'Vacuole', 'Cytoplasm', 'B', 'Nucleus houses DNA, controls activities.'),
  (26, 'Biology', 'Exchange of gases in humans occurs in the:', 'Bronchi', 'Alveoli', 'Trachea', 'Diaphragm', 'B', 'Alveolar capillaries site of gas exchange.'),
  (27, 'Biology', 'A heterozygous individual has genotype:', 'AA', 'Aa', 'aa', 'OA', 'B', 'Heterozygous = two different alleles.'),
  (28, 'Biology', 'A typical grazing food chain begins with a:', 'Consumer', 'Decomposer', 'Producer (green plant)', 'Parasite', 'C', 'A grazing food chain begins with a producer that captures energy, usually through photosynthesis.'),
  (29, 'Biology', 'Pollination is transfer of pollen from anther to:', 'Petal', 'Stigma', 'Ovary', 'Sepal', 'B', 'Pollen lands on stigma for fertilization.'),
  (30, 'Biology', 'The functional unit of the kidney is:', 'Nephron', 'Alveolus', 'Villus', 'Neuron', 'A', 'Nephron filters urine.'),
  (31, 'Economics', 'Scale of preference shows:', 'Items in order of want satisfaction', 'Price of goods', 'Income level', 'Population size', 'A', 'Ordered list of wants by priority.'),
  (32, 'Economics', 'The Central Bank of Nigeria (CBN) primarily:', 'Makes fiscal policy', 'Controls monetary policy and issues currency', 'Collects VAT', 'Runs schools', 'B', 'CBN core mandate: monetary policy + currency.'),
  (33, 'Economics', 'Demand for salt is generally:', 'Elastic', 'Inelastic (necessity)', 'Perfectly elastic', 'Unitary', 'B', 'Necessities have inelastic demand.'),
  (34, 'Economics', 'A shift in supply curve to the right is caused by:', 'Increase in production cost', 'Improvement in technology', 'Increase in tax', 'Bad weather', 'B', 'Technology improvement raises supply.'),
  (35, 'Economics', 'Opportunity cost is:', 'Value of next best alternative foregone', 'Money spent', 'Fixed cost', 'Profit', 'A', 'Opportunity cost definition.'),
  (36, 'Economics', 'Inflation is:', 'General rise in price level', 'Fall in prices', 'Stable prices', 'No trade', 'A', 'Inflation definition.'),
  (37, 'Physics', 'WAEC unique: A ball is thrown vertically upward; at highest point velocity is:', 'Maximum', 'Zero', 'Equal to initial', 'Infinite', 'B', 'At peak, instantaneous velocity zero before falling.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- NECO bank — 31 original-practice questions across five subjects (not official past-paper reproductions) --
with exam as (select id from public.cbt_exams where title = 'NECO SSCE Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (1, 'Use of English', 'Correct the error: “The boys has gone to school.”', 'The boys have gone to school.', 'The boys has went to school.', 'The boys is gone to school.', 'The boys has go to school.', 'A', 'Plural subject boys → have, correct tense gone.'),
  (2, 'Use of English', 'Choose the correctly spelled word:', 'Embarras', 'Embarrass', 'Embarass', 'Embarrasse', 'B', 'Double r, double s: embarrass.'),
  (3, 'Use of English', 'Active to passive: “She wrote the letter.”', 'The letter was written by her.', 'The letter is written by her.', 'The letter has written by her.', 'The letter wrote by her.', 'A', 'Past tense active → was + past participle.'),
  (4, 'Use of English', 'Choose the option opposite in meaning to DILIGENT:', 'Hardworking', 'Lazy and careless', 'Punctual', 'Intelligent', 'B', 'Diligent = hardworking; opposite lazy.'),
  (5, 'Use of English', 'From the words A–D, choose the one that correctly fills the gap: Each student ___ to submit before Friday.', 'are', 'were', 'is', 'have', 'C', 'Each → singular is.'),
  (6, 'Use of English', 'Choose the word nearest in meaning to RELUCTANT:', 'Willing', 'Unwilling and hesitant', 'Excited', 'Efficient', 'B', 'Reluctant = hesitant/unwilling.'),
  (7, 'Mathematics', 'Find HCF of 12 and 18.', '2', '6', '12', '36', 'B', 'Common factors 1,2,3,6 → highest 6.'),
  (8, 'Mathematics', 'Solve: 5y - 3 = 12', 'y=2', 'y=3', 'y=5', 'y=12', 'B', '5y=15 ⇒y=3.'),
  (9, 'Mathematics', 'Volume of cuboid 5×3×2 is:', '6', '10', '30', '15', 'C', 'V=lwh=5*3*2=30.'),
  (10, 'Mathematics', 'Percentage of 60 that is 15:', '15%', '25%', '30%', '40%', 'B', '15/60*100=25%.'),
  (11, 'Mathematics', 'Mean of 2,4,6,8 is:', '4', '5', '6', '8', 'B', 'Sum 20/4=5.'),
  (12, 'Mathematics', 'Simplify 3(2x+4)=', '6x+4', '6x+12', '5x+7', '8x', 'B', 'Distributed multiplication 3*2x=6x, 3*4=12.'),
  (13, 'Physics', 'Mass 10 kg weight on Earth (g=10 m/s²) is:', '1 N', '10 N', '100 N', '1000 N', 'C', 'W=mg=10*10=100 N.'),
  (14, 'Physics', 'Angle of incidence equals angle of ...', 'Refraction', 'Reflection', 'Diffraction', 'Interference', 'B', 'Law of reflection.'),
  (15, 'Physics', 'Light travels fastest in:', 'Water', 'Glass', 'Vacuum', 'Oil', 'C', 'Vacuum c≈3×10⁸ m/s.'),
  (16, 'Physics', 'Friction between two surfaces generally opposes their:', 'Relative motion or tendency to move', 'Motion in every reference frame', 'Weight', 'Electric charge', 'A', 'Friction opposes relative motion or the tendency for relative motion between contacting surfaces.'),
  (17, 'Physics', 'Frequency 50 Hz, wavelength 2 m. Wave speed is:', '25 m/s', '50 m/s', '100 m/s', '200 m/s', 'C', 'v=fλ=100.'),
  (18, 'Physics', 'The SI unit of power is:', 'Joule', 'Watt', 'Newton', 'Pascal', 'B', 'Power watt (W).'),
  (19, 'Chemistry', 'Sodium chloride is:', 'Acid', 'Base', 'Salt', 'Gas', 'C', 'NaCl neutral salt from acid+base.'),
  (20, 'Chemistry', 'Valency of carbon is:', '1', '2', '4', '6', 'C', 'Carbon tetravalent.'),
  (21, 'Chemistry', 'Acid turns blue litmus:', 'Red', 'Green', 'Blue unchanged', 'Yellow', 'A', 'Acid = blue→red.'),
  (22, 'Chemistry', 'Isotope differs in:', 'Number of neutrons', 'Number of protons', 'Electrons only', 'Atomic number', 'A', 'Same protons, different neutrons.'),
  (23, 'Chemistry', 'Molar mass of CaCO3 (Ca=40, C=12, O=16) is:', '50 g/mol', '68 g/mol', '100 g/mol', '120 g/mol', 'C', '40+12+48=100.'),
  (24, 'Chemistry', 'Which gas turns lime water milky?', 'Oxygen', 'Hydrogen', 'Carbon(IV) oxide', 'Nitrogen', 'C', 'CO2 gives CaCO3 precipitate.'),
  (25, 'Biology', 'Homo sapiens belongs to Kingdom:', 'Monera', 'Protista', 'Animalia', 'Plantae', 'C', 'Humans are animals.'),
  (26, 'Biology', 'The largest organ in human body is:', 'Heart', 'Skin', 'Liver', 'Brain', 'B', 'Skin by area/mass.'),
  (27, 'Biology', 'Inheritance unit is:', 'Cell', 'Gene', 'Tissue', 'Organ', 'B', 'Gene carries hereditary info.'),
  (28, 'Biology', 'Photosynthesis occurs mainly in:', 'Mitochondria', 'Chloroplasts', 'Nucleus', 'Golgi body', 'B', 'Chloroplasts with chlorophyll.'),
  (29, 'Biology', 'Which organelle is powerhouse of cell?', 'Nucleus', 'Mitochondrion', 'Chloroplast', 'Ribosome', 'B', 'Mitochondrion generates ATP.'),
  (30, 'Biology', 'The functional unit of kidney is:', 'Nephron', 'Alveolus', 'Villus', 'Neuron', 'A', 'Nephron filters urine.'),
  (31, 'Chemistry', 'NECO unique: Which element has symbol K?', 'Potassium', 'Krypton', 'Calcium', 'Sodium', 'A', 'K is potassium from Latin Kalium.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));

-- Post-UTME bank — 24 questions, 8 per subject (English + Maths + GK, all >=5) --
with exam as (select id from public.cbt_exams where title = 'Post-UTME Practice Bank' limit 1)
insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'
from exam cross join (values
  (1, 'Use of English', 'UNILAG Post-UTME style: Choose the option that best completes the gap: The professor urged students ___ the new research portal daily.', 'to check', 'checking', 'checked', 'being checked', 'A', 'Urge + to-infinitive.'),
  (2, 'Use of English', 'Nearest in meaning to “CUMBERSOME” in “The registration process was cumbersome.”', 'Simple and quick', 'Burdensome and unwieldy', 'Exciting', 'Cheap', 'B', 'Cumbersome = awkwardly heavy/difficult.'),
  (3, 'Use of English', 'Passage inference (Post-UTME): University screening tests critical thinking more than memorisation. A student who only crams past questions without understanding principles often struggles when questions are rephrased. Question: What does the author advise?', 'Memorise without understanding', 'Focus on principles so rephrasing does not confuse', 'Avoid all past questions', 'Skip screening', 'B', 'Passage advocates principle understanding over rote cramming.'),
  (4, 'Use of English', 'Opposite of “TRANSPARENT” in “transparent process”:', 'Open and clear', 'Opaque and secretive', 'Brief', 'Expensive', 'B', 'Transparent clear ↔ opaque/secretive.'),
  (5, 'Use of English', 'Correct concord: “Each of the students ___ present.”', 'are', 'is', 'were', 'have been', 'B', 'Each → singular is.'),
  (6, 'Use of English', 'Idiom: “He was at LOGGERHEADS with his manager.” means:', 'In bitter disagreement', 'In close agreement', 'On vacation', 'Under investigation openly', 'A', 'At loggerheads = in conflict.'),
  (7, 'Use of English', 'Choose the correctly spelled word: Accommodate is spelled:', 'Accomodate', 'Accommodate', 'Acommodate', 'Accomoddate', 'B', 'Double c, double m: accommodate.'),
  (8, 'Use of English', 'Synonym of FALLACIOUS in “fallacious argument”:', 'Incorrect and misleading', 'Brief', 'Polite', 'Traditional', 'A', 'Fallacious = false reasoning.'),
  (9, 'Mathematics', 'UNILAG screening: Simplify (x+2)(x-2)', 'x²-4', 'x²+4', '2x-4', 'x²-2', 'A', 'Difference squares x²-4.'),
  (10, 'Mathematics', 'If a=3, b=2, evaluate a² + 2ab + b²', '25', '16', '13', '9', 'A', '(a+b)²=5²=25.'),
  (11, 'Mathematics', 'LCM of 6 and 8 is:', '48', '24', '12', '8', 'B', 'Multiples 6,12,18,24 and 8,16,24 ⇒24.'),
  (12, 'Mathematics', 'Solve: (1/2) x = 10', '5', '10', '20', '2', 'C', 'x=10*2=20.'),
  (13, 'Mathematics', 'If 20% of students passed and total is 200, how many failed?', '20', '40', '160', '180', 'C', 'Passed 40, failed 160.'),
  (14, 'Mathematics', 'Find the average of first 5 prime numbers (2,3,5,7,11).', '5.6', '4.5', '5', '6', 'A', 'Sum 28/5=5.6.'),
  (15, 'Mathematics', 'Area of triangle base 10, height 6 is:', '16', '30', '60', '15', 'B', 'Area=½*b*h=30.'),
  (16, 'Mathematics', 'If y = 2x + 1 and x=3, y=', '6', '7', '8', '9', 'B', '2*3+1=7.'),
  (17, 'General Knowledge', 'UNILAG is located in:', 'Ibadan', 'Lagos', 'Abuja', 'Kano', 'B', 'University of Lagos in Lagos.'),
  (18, 'General Knowledge', 'Nigeria gained independence in:', '1957', '1960', '1963', '1970', 'B', '1 Oct 1960.'),
  (19, 'General Knowledge', 'The African Union (AU) replaced OAU in:', '1999', '2002', '2010', '2015', 'B', 'AU launched 2002 in Durban.'),
  (20, 'General Knowledge', 'The study of living things is:', 'Geology', 'Biology', 'Astronomy', 'Meteorology', 'B', 'Biology.'),
  (21, 'General Knowledge', 'Which body organ pumps blood?', 'Lungs', 'Heart', 'Kidney', 'Liver', 'B', 'Heart circulatory pump.'),
  (22, 'General Knowledge', 'Largest continent is:', 'Africa', 'Asia', 'Europe', 'Australia', 'B', 'Asia largest by area.'),
  (23, 'General Knowledge', 'The Nigerian Senate has how many members?', '36', '109', '360', '774', 'B', '3 senators per 36 states + FCT =109.'),
  (24, 'General Knowledge', 'Capital of Nigeria is:', 'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'B', 'Abuja since 1991.')
) as x(position, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));
