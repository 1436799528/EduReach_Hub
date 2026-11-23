import { userFacingError } from '../lib/errors';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, EyeOff, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAdminFaqCategory,
  createAdminFaqQuestion,
  deleteAdminFaqCategory,
  deleteAdminFaqQuestion,
  fetchAdminFaqs,
  reorderAdminFaqCategories,
  reorderAdminFaqQuestions,
  updateAdminFaqCategory,
  updateAdminFaqQuestion,
  type AdminFaqCategory,
  type AdminFaqQuestion,
  type FaqCategoryInput,
  type FaqQuestionInput,
} from '../src/lib/api';
import { AdminEmptyState, AdminPageReport, TableSkeleton } from '../src/components/admin/AdminKit';
import { Can } from '../src/components/admin/Can';

/**
 * FAQ Management: the categories and questions the homepage and the help
 * centre read. The tables are closed to every client role; these calls pass
 * through capability-gated API routes that validate and audit each write.
 *
 * Publishing is explicit. A hidden category hides its questions with it, and an
 * unpublished question never reaches a visitor even when its category is live.
 */

type CategoryEditor = FaqCategoryInput & { id: string | null };
type QuestionEditor = FaqQuestionInput & { id: string | null };

function emptyCategory(order: number): CategoryEditor {
  return { id: null, label: '', description: '', isPublished: true, displayOrder: order };
}

function emptyQuestion(categoryId: string, order: number): QuestionEditor {
  return { id: null, categoryId, question: '', answer: '', isPublished: true, displayOrder: order };
}

export default function AdminFaqPage() {
  const [categories, setCategories] = useState<AdminFaqCategory[]>([]);
  const [items, setItems] = useState<AdminFaqQuestion[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditor | null>(null);
  const [questionEditor, setQuestionEditor] = useState<QuestionEditor | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchAdminFaqs();
      setCategories(payload.categories);
      setItems(payload.items);
      setActiveId((current) =>
        payload.categories.some((category) => category.id === current) ? current : payload.categories[0]?.id || '',
      );
    } catch (value) {
      setError(userFacingError(value, 'Unable to load FAQs.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const active = categories.find((category) => category.id === activeId) || categories[0];
  const activeQuestions = useMemo(
    () => items.filter((item) => item.categoryId === active?.id).sort((a, b) => a.displayOrder - b.displayOrder),
    [items, active?.id],
  );

  async function saveCategory() {
    if (!categoryEditor) return;
    setBusy('category');
    setError('');
    setMessage('');
    try {
      const input: FaqCategoryInput = {
        label: categoryEditor.label,
        description: categoryEditor.description,
        isPublished: categoryEditor.isPublished,
        displayOrder: categoryEditor.displayOrder,
      };
      if (categoryEditor.id) await updateAdminFaqCategory(categoryEditor.id, input);
      else await createAdminFaqCategory(input);
      setMessage(categoryEditor.id ? 'Category updated.' : 'Category created.');
      setCategoryEditor(null);
      await load();
    } catch (value) {
      setError(userFacingError(value, 'Unable to save this category.'));
    } finally {
      setBusy('');
    }
  }

  async function saveQuestion() {
    if (!questionEditor) return;
    setBusy('question');
    setError('');
    setMessage('');
    try {
      const input: FaqQuestionInput = {
        categoryId: questionEditor.categoryId,
        question: questionEditor.question,
        answer: questionEditor.answer,
        isPublished: questionEditor.isPublished,
        displayOrder: questionEditor.displayOrder,
      };
      if (questionEditor.id) await updateAdminFaqQuestion(questionEditor.id, input);
      else await createAdminFaqQuestion(input);
      setMessage(questionEditor.id ? 'Question updated.' : 'Question created.');
      setQuestionEditor(null);
      await load();
    } catch (value) {
      setError(userFacingError(value, 'Unable to save this question.'));
    } finally {
      setBusy('');
    }
  }

  async function toggleCategory(category: AdminFaqCategory) {
    setBusy(category.id);
    setError('');
    try {
      await updateAdminFaqCategory(category.id, {
        label: category.label,
        description: category.description,
        isPublished: !category.isPublished,
        displayOrder: category.displayOrder,
      });
      setMessage(category.isPublished ? 'Category hidden.' : 'Category published.');
      await load();
    } catch (value) {
      setError(userFacingError(value, 'Unable to change this category.'));
    } finally {
      setBusy('');
    }
  }

  async function toggleQuestion(question: AdminFaqQuestion) {
    setBusy(question.id);
    setError('');
    try {
      await updateAdminFaqQuestion(question.id, {
        categoryId: question.categoryId,
        question: question.question,
        answer: question.answer,
        isPublished: !question.isPublished,
        displayOrder: question.displayOrder,
      });
      setMessage(question.isPublished ? 'Question hidden.' : 'Question published.');
      await load();
    } catch (value) {
      setError(userFacingError(value, 'Unable to change this question.'));
    } finally {
      setBusy('');
    }
  }

  async function removeCategory(category: AdminFaqCategory) {
    if (!window.confirm(`Permanently delete “${category.label}”? It must have no questions first.`)) return;
    setBusy(category.id);
    setError('');
    try {
      await deleteAdminFaqCategory(category.id);
      if (categoryEditor?.id === category.id) setCategoryEditor(null);
      setMessage('Category deleted.');
      await load();
    } catch (value) {
      setError(userFacingError(value, 'Unable to delete this category.'));
    } finally {
      setBusy('');
    }
  }

  async function removeQuestion(question: AdminFaqQuestion) {
    if (!window.confirm(`Permanently delete “${question.question}”? This cannot be undone.`)) return;
    setBusy(question.id);
    setError('');
    try {
      await deleteAdminFaqQuestion(question.id);
      if (questionEditor?.id === question.id) setQuestionEditor(null);
      setMessage('Question deleted.');
      await load();
    } catch (value) {
      setError(userFacingError(value, 'Unable to delete this question.'));
    } finally {
      setBusy('');
    }
  }

  async function moveCategory(category: AdminFaqCategory, direction: -1 | 1) {
    const index = categories.findIndex((entry) => entry.id === category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(category.id);
    try {
      await reorderAdminFaqCategories(next.map((entry) => entry.id));
      setCategories(next.map((entry, order) => ({ ...entry, displayOrder: order })));
      setMessage('Category order saved.');
    } catch (value) {
      setError(userFacingError(value, 'Unable to reorder categories.'));
    } finally {
      setBusy('');
    }
  }

  async function moveQuestion(question: AdminFaqQuestion, direction: -1 | 1) {
    const index = activeQuestions.findIndex((entry) => entry.id === question.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeQuestions.length) return;
    const next = [...activeQuestions];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(question.id);
    try {
      await reorderAdminFaqQuestions(next.map((entry) => entry.id));
      setItems((current) =>
        current.map((entry) => {
          const order = next.findIndex((row) => row.id === entry.id);
          return order >= 0 ? { ...entry, displayOrder: order } : entry;
        }),
      );
      setMessage('Question order saved.');
    } catch (value) {
      setError(userFacingError(value, 'Unable to reorder questions.'));
    } finally {
      setBusy('');
    }
  }

  const published = categories.filter((category) => category.isPublished).length;
  const publishedQuestions = items.filter((item) => item.isPublished).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>FAQ Management</h1>
          <p>
            Add, reorder and publish the questions on the homepage and the help centre. A hidden question is absent
            from both.
          </p>
        </div>
        <div className="admin-header-actions">
          <Can capability="site.update">
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setMessage('');
                setCategoryEditor(emptyCategory(categories.length + 1));
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add category
            </button>
            <button
              type="button"
              className="admin-btn secondary-dark"
              disabled={!active}
              onClick={() => {
                setMessage('');
                setQuestionEditor(emptyQuestion(active.id, activeQuestions.length + 1));
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add question
            </button>
          </Can>
          <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="admin-card"
          role="alert"
          style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <span>{error}</span>
          <button type="button" className="admin-btn small" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {message && (
        <div
          className="admin-card"
          role="status"
          style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}
        >
          <span>{message}</span>
        </div>
      )}

      <AdminPageReport
        title="FAQ reporting"
        items={[
          { label: 'Categories', value: categories.length.toLocaleString() },
          { label: 'Published categories', value: published.toLocaleString() },
          { label: 'Questions', value: items.length.toLocaleString() },
          { label: 'Published questions', value: publishedQuestions.toLocaleString() },
        ]}
      />

      {categoryEditor && (
        <section className="admin-card" aria-labelledby="faq-category-editor-title">
          <div className="admin-card-header">
            <h2 id="faq-category-editor-title">{categoryEditor.id ? 'Edit category' : 'New category'}</h2>
            <span>Shown as a category on the homepage</span>
          </div>
          <div style={{ display: 'grid', gap: 14, padding: 16 }}>
            <div className="admin-field-row">
              <label className="admin-field">
                <span>Category name</span>
                <input
                  className="admin-input"
                  value={categoryEditor.label}
                  maxLength={60}
                  placeholder="e.g. Payments and subscriptions"
                  onChange={(event) => setCategoryEditor({ ...categoryEditor, label: event.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Display order</span>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  max={1000}
                  value={categoryEditor.displayOrder}
                  onChange={(event) =>
                    setCategoryEditor({ ...categoryEditor, displayOrder: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label className="admin-field">
              <span>Short description (optional)</span>
              <input
                className="admin-input"
                value={categoryEditor.description}
                maxLength={200}
                onChange={(event) => setCategoryEditor({ ...categoryEditor, description: event.target.value })}
              />
            </label>
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={categoryEditor.isPublished}
                onChange={(event) => setCategoryEditor({ ...categoryEditor, isPublished: event.target.checked })}
              />
              Published
            </label>
            <div className="admin-action-row">
              <button type="button" className="admin-btn" onClick={() => void saveCategory()} disabled={busy === 'category'}>
                <Check size={14} aria-hidden="true" /> {busy === 'category' ? 'Saving…' : 'Save category'}
              </button>
              <button type="button" className="admin-btn secondary" onClick={() => setCategoryEditor(null)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {questionEditor && (
        <section className="admin-card" aria-labelledby="faq-question-editor-title">
          <div className="admin-card-header">
            <h2 id="faq-question-editor-title">{questionEditor.id ? 'Edit question' : 'New question'}</h2>
            <span>{categories.find((category) => category.id === questionEditor.categoryId)?.label}</span>
          </div>
          <div style={{ display: 'grid', gap: 14, padding: 16 }}>
            <div className="admin-field-row">
              <label className="admin-field">
                <span>Category</span>
                <select
                  className="admin-select"
                  value={questionEditor.categoryId}
                  onChange={(event) => setQuestionEditor({ ...questionEditor, categoryId: event.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Display order</span>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  max={10000}
                  value={questionEditor.displayOrder}
                  onChange={(event) =>
                    setQuestionEditor({ ...questionEditor, displayOrder: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label className="admin-field">
              <span>Question</span>
              <input
                className="admin-input"
                value={questionEditor.question}
                maxLength={200}
                placeholder="What does the visitor need to know?"
                onChange={(event) => setQuestionEditor({ ...questionEditor, question: event.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Answer</span>
              <textarea
                className="admin-textarea"
                rows={5}
                value={questionEditor.answer}
                maxLength={4000}
                placeholder="Answer only what the product actually does."
                onChange={(event) => setQuestionEditor({ ...questionEditor, answer: event.target.value })}
              />
              <small className="muted">{questionEditor.answer.trim().length} / 4000 characters (minimum 20)</small>
            </label>
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={questionEditor.isPublished}
                onChange={(event) => setQuestionEditor({ ...questionEditor, isPublished: event.target.checked })}
              />
              Published
            </label>
            <div className="admin-action-row">
              <button type="button" className="admin-btn" onClick={() => void saveQuestion()} disabled={busy === 'question'}>
                <Check size={14} aria-hidden="true" /> {busy === 'question' ? 'Saving…' : 'Save question'}
              </button>
              <button type="button" className="admin-btn secondary" onClick={() => setQuestionEditor(null)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Categories</h2>
          <span>Order controls the homepage tabs</span>
        </div>
        <div
          className="admin-table-wrap admin-table-wrap--stack"
          role="region"
          aria-label="Scrollable table"
          tabIndex={0}
        >
          <table className="admin-table admin-table--stack">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Questions</th>
                <th scope="col">Order</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton rows={4} columns={5} />}
              {!loading &&
                categories.map((category, index) => {
                  const count = items.filter((item) => item.categoryId === category.id).length;
                  return (
                    <tr key={category.id} className={category.id === active?.id ? 'is-selected' : undefined}>
                      <td data-label="Category">
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => setActiveId(category.id)}
                          aria-pressed={category.id === active?.id}
                        >
                          <b>{category.label}</b>
                        </button>
                        {category.description && <div className="muted">{category.description}</div>}
                      </td>
                      <td data-label="Questions">{count}</td>
                      <td data-label="Order">
                        <div className="admin-action-row">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            aria-label={`Move ${category.label} earlier`}
                            disabled={index === 0 || busy === category.id}
                            onClick={() => void moveCategory(category, -1)}
                          >
                            <ArrowUp size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            aria-label={`Move ${category.label} later`}
                            disabled={index === categories.length - 1 || busy === category.id}
                            onClick={() => void moveCategory(category, 1)}
                          >
                            <ArrowDown size={13} aria-hidden="true" />
                          </button>
                          <span className="muted">{category.displayOrder}</span>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={`admin-pill ${category.isPublished ? 'is-ok' : 'is-warn'}`}>
                          {category.isPublished ? 'Published' : 'Hidden'}
                        </span>
                      </td>
                      <td className="right" data-label="Actions">
                        <Can capability="site.update" fallback={<span className="muted">Read only</span>}>
                          <div className="admin-action-row" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="admin-btn small secondary"
                              onClick={() => {
                                setMessage('');
                                setCategoryEditor({
                                  id: category.id,
                                  label: category.label,
                                  description: category.description,
                                  isPublished: category.isPublished,
                                  displayOrder: category.displayOrder,
                                });
                              }}
                            >
                              <Pencil size={12} aria-hidden="true" /> Edit
                            </button>
                            <button
                              type="button"
                              className="admin-btn small secondary"
                              disabled={busy === category.id}
                              onClick={() => void toggleCategory(category)}
                            >
                              {category.isPublished ? (
                                <>
                                  <EyeOff size={12} aria-hidden="true" /> Hide
                                </>
                              ) : (
                                <>
                                  <Check size={12} aria-hidden="true" /> Publish
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className="admin-btn small danger"
                              disabled={busy === category.id}
                              onClick={() => void removeCategory(category)}
                            >
                              <Trash2 size={12} aria-hidden="true" /> Delete
                            </button>
                          </div>
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              {!loading && !categories.length && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    <AdminEmptyState title="No FAQ categories yet" hint="Add a category, then add questions to it." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>{active ? `Questions in ${active.label}` : 'Questions'}</h2>
          <span>Hidden questions never reach a visitor</span>
        </div>
        <div
          className="admin-table-wrap admin-table-wrap--stack"
          role="region"
          aria-label="Scrollable table"
          tabIndex={0}
        >
          <table className="admin-table admin-table--stack">
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Order</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton rows={4} columns={4} />}
              {!loading &&
                activeQuestions.map((question, index) => (
                  <tr key={question.id}>
                    <td data-label="Question" style={{ maxWidth: 560 }}>
                      <b>{question.question}</b>
                      <div className="muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {question.answer}
                      </div>
                    </td>
                    <td data-label="Order">
                      <div className="admin-action-row">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          aria-label={`Move “${question.question}” earlier`}
                          disabled={index === 0 || busy === question.id}
                          onClick={() => void moveQuestion(question, -1)}
                        >
                          <ArrowUp size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          aria-label={`Move “${question.question}” later`}
                          disabled={index === activeQuestions.length - 1 || busy === question.id}
                          onClick={() => void moveQuestion(question, 1)}
                        >
                          <ArrowDown size={13} aria-hidden="true" />
                        </button>
                        <span className="muted">{question.displayOrder}</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className={`admin-pill ${question.isPublished ? 'is-ok' : 'is-warn'}`}>
                        {question.isPublished ? 'Published' : 'Hidden'}
                      </span>
                    </td>
                    <td className="right" data-label="Actions">
                      <Can capability="site.update" fallback={<span className="muted">Read only</span>}>
                        <div className="admin-action-row" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="admin-btn small secondary"
                            onClick={() => {
                              setMessage('');
                              setQuestionEditor({
                                id: question.id,
                                categoryId: question.categoryId,
                                question: question.question,
                                answer: question.answer,
                                isPublished: question.isPublished,
                                displayOrder: question.displayOrder,
                              });
                            }}
                          >
                            <Pencil size={12} aria-hidden="true" /> Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn small secondary"
                            disabled={busy === question.id}
                            onClick={() => void toggleQuestion(question)}
                          >
                            {question.isPublished ? (
                              <>
                                <EyeOff size={12} aria-hidden="true" /> Hide
                              </>
                            ) : (
                              <>
                                <Check size={12} aria-hidden="true" /> Publish
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="admin-btn small danger"
                            disabled={busy === question.id}
                            onClick={() => void removeQuestion(question)}
                          >
                            <Trash2 size={12} aria-hidden="true" /> Delete
                          </button>
                        </div>
                      </Can>
                    </td>
                  </tr>
                ))}
              {!loading && !activeQuestions.length && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    <AdminEmptyState
                      title="No questions in this category"
                      hint="Use “Add question” above to write the first one."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
