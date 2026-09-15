export type CbtQuestion = {
  id: string;
  subject: string;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
};

export const cbtDurationSeconds = 20 * 60;

export const cbtQuestions: CbtQuestion[] = [
  { id: 'q1', subject: 'English', question: 'Choose the word nearest in meaning to "rapid".', options: ['Slow', 'Fast', 'Late', 'Weak'], answer: 1, explanation: 'Rapid means fast or quick.' },
  { id: 'q2', subject: 'Mathematics', question: 'What is 15% of 200?', options: ['20', '25', '30', '35'], answer: 2 },
  { id: 'q3', subject: 'Physics', question: 'Which quantity is measured in newtons?', options: ['Power', 'Force', 'Energy', 'Pressure'], answer: 1 },
  { id: 'q4', subject: 'Chemistry', question: 'What is the chemical symbol for sodium?', options: ['S', 'So', 'Na', 'Sn'], answer: 2 },
  { id: 'q5', subject: 'English', question: 'Choose the correctly spelled word.', options: ['Accomodate', 'Acommodate', 'Accommodate', 'Accomoddate'], answer: 2 },
  { id: 'q6', subject: 'Mathematics', question: 'Solve: 3x = 21.', options: ['5', '6', '7', '8'], answer: 2 },
  { id: 'q7', subject: 'Biology', question: 'Which organelle is commonly called the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi body'], answer: 2 },
  { id: 'q8', subject: 'Physics', question: 'What is the SI unit of electric current?', options: ['Volt', 'Ohm', 'Ampere', 'Watt'], answer: 2 },
  { id: 'q9', subject: 'Mathematics', question: 'What is the next prime number after 11?', options: ['12', '13', '14', '15'], answer: 1 },
  { id: 'q10', subject: 'General Studies', question: 'Nigeria is located on which continent?', options: ['Asia', 'Africa', 'Europe', 'South America'], answer: 1 },
  { id: 'q11', subject: 'English', question: 'The opposite of "ancient" is:', options: ['Old', 'Modern', 'Historic', 'Past'], answer: 1 },
  { id: 'q12', subject: 'Chemistry', question: 'A solution with pH 7 is generally:', options: ['Acidic', 'Basic', 'Neutral', 'Salty'], answer: 2 },
  { id: 'q13', subject: 'Physics', question: 'Which device is used to measure temperature?', options: ['Barometer', 'Thermometer', 'Ammeter', 'Voltmeter'], answer: 1 },
  { id: 'q14', subject: 'Mathematics', question: 'What is the perimeter of a square with side 5 cm?', options: ['10 cm', '15 cm', '20 cm', '25 cm'], answer: 2 },
  { id: 'q15', subject: 'General Studies', question: 'Which branch of government interprets laws?', options: ['Executive', 'Legislative', 'Judiciary', 'Electoral'], answer: 2 },
];
