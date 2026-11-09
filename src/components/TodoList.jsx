import { useEffect, useRef, useState } from 'react';
import TaskForm from './TaskForm.jsx';
import CompletionButton from './CompletionButton.jsx';
import AnimatedCount from './AnimatedCount.jsx';
import { useTaskMotion, useTaskRowFocus } from '../hooks/useTaskMotion.js';
import { extractNotification } from '../services/client.js';
import { formatDueDate, getLocalDateString, getTaskDateGroup } from '../utils/dates.js';

const priorityLabels = { high: '高优先级', medium: '中优先级', low: '低优先级' };
const groupDetails = [
  { id: 'overdue', title: '已逾期' },
  { id: 'today', title: '今天' },
  { id: 'upcoming', title: '接下来' },
  { id: 'unscheduled', title: '未设日期' },
];

function TaskRow({ row, isDeleted, onToggle, onEdit, onDelete, onRestore }) {
  const { task, motion, leaving } = row;
  const rowRef = useRef(null);
  useTaskRowFocus(rowRef, leaving);
  const isOverdue = !task.completed && task.dueDate && task.dueDate < getLocalDateString(new Date());

  return (
    <li ref={rowRef} data-task-row data-task-id={task.id} data-leaving={leaving} className={`task-row${task.completed ? ' is-complete' : ''}${leaving ? ' is-leaving' : ''}${motion ? ` motion-${motion}` : ''}`}>
      <div className="row-clip"><div className="task-row-content">
      <CompletionButton task={task} motion={motion} disabled={isDeleted} onToggle={onToggle} />

      <div className="task-copy">
        <p className="task-title">{task.title}</p>
        <div className="task-meta">
          <span className="category-tag" data-category={task.category}>{task.category}</span>
          <span
            className={`priority-dot priority-${task.priority}`}
            role="img"
            aria-label={priorityLabels[task.priority] ?? '中优先级'}
            title={priorityLabels[task.priority] ?? '中优先级'}
          />
          {task.dueDate && (
            <time className={`due-date${isOverdue ? ' is-overdue' : ''}`} dateTime={task.dueDate}>
              {isOverdue && <span className="overdue-label">已逾期</span>}
              {formatDueDate(task.dueDate)}
            </time>
          )}
        </div>
      </div>

      <div className="task-actions">
        {isDeleted ? (
          <button className="restore-button" type="button" data-row-action aria-disabled={leaving || undefined} onClick={() => { if (!leaving) onRestore(task.id); }}>
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
              <path d="M4 8.5A6.2 6.2 0 1 1 4.5 13M4 4.5v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            恢复
          </button>
        ) : (
          <>
            <button className="icon-button" type="button" aria-disabled={leaving || undefined} onClick={() => { if (!leaving) onEdit(task); }} aria-label={`编辑任务：${task.title}`}>
              <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
                <path d="m13.8 4.2 2 2a1.4 1.4 0 0 1 0 2l-7.7 7.7-3.5.7.7-3.5L13 5.4a1.4 1.4 0 0 1 2 0Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="m11.8 6.2 2 2" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
            <button className="icon-button delete-button" type="button" aria-disabled={leaving || undefined} onClick={() => { if (!leaving) onDelete(task); }} aria-label={`删除任务：${task.title}`}>
              <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
                <path d="M4.5 6h11m-9.5 0 .6 9.5h6.8L14 6M8 6V4.5h4V6m-3 2.5v4m2-4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>
      </div></div>
    </li>
  );
}

function orderRowsByDate(rows) {
  return [...rows].sort(({ task: a }, { task: b }) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

function DateGroup({ group, rows, count, isDeleted = false, onToggle, onEdit, onDelete, onRestore }) {
  if (!rows.length) return null;

  return (
    <section className={`date-group${!count && rows.every((row) => row.leaving) ? ' is-emptying' : ''}`} aria-label={`${group.title}，${count} 项`}>
      <div className="date-group-body">
      <div className={`date-group-heading date-group-${group.id}`}>
        <h3>{group.title}</h3>
        <AnimatedCount value={count} />
      </div>
      <ul className="task-list">
        {rows.map((row) => <TaskRow key={row.task.id} row={row} isDeleted={isDeleted} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onRestore={onRestore} />)}
      </ul>
      </div>
    </section>
  );
}

function titleForList(activeList) {
  if (activeList.type === 'incomplete') return '未完成';
  if (activeList.type === 'completed') return '已完成';
  if (activeList.type === 'deleted') return '已删除';
  if (activeList.type === 'category') return activeList.category;
  return '未完成';
}

function filterTasks(tasks, activeList) {
  if (activeList.type === 'deleted') return tasks.filter((task) => task.deleted);
  const activeTasks = tasks.filter((task) => !task.deleted);
  if (activeList.type === 'completed') return activeTasks.filter((task) => task.completed);
  if (activeList.type === 'category') return activeTasks.filter((task) => task.category === activeList.category);
  return activeTasks.filter((task) => !task.completed);
}

export default function TodoList({ tasks, activeList, onSave, onAddMany, onToggle, onDelete, onRestore, customCategories = [], message }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [aiDrafts, setAiDrafts] = useState([]);
  const [aiNotice, setAiNotice] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const isCompletedList = activeList.type === 'completed';
  const isDeletedList = activeList.type === 'deleted';
  const listTasks = filterTasks(tasks, activeList);
  const pendingTasks = listTasks.filter((task) => !task.completed && !task.deleted);
  const completedTasks = listTasks.filter((task) => task.completed && !task.deleted);
  const deletedTasks = listTasks.filter((task) => task.deleted);
  const rows = useTaskMotion(tasks, listTasks, `${activeList.type}:${activeList.category}`, (task) => isDeletedList ? 'deleted' : task.completed ? 'completed' : getTaskDateGroup(task));
  const completedRows = rows.filter((row) => row.group === 'completed');
  const deletedRows = rows.filter((row) => row.group === 'deleted');
  const categoryOptions = [...new Set(['学习', '生活', '社团', '其他', ...customCategories])];
  const defaults = {
    dueDate: '',
    category: activeList.type === 'category' ? activeList.category : '其他',
  };

  useEffect(() => {
    setFormOpen(false);
    setEditingTask(null);
    setQuickTitle('');
    setAiDrafts([]);
    setAiNotice('');
    setAiError('');
  }, [activeList]);

  function openNewTaskForm() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEditForm(task) {
    setEditingTask(task);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingTask(null);
    setFormOpen(false);
  }

  async function saveForm(task) {
    const saved = await onSave(task);
    if (saved) closeForm();
    return saved;
  }

  async function handleQuickAdd(event) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;

    const category = activeList.type === 'category' ? activeList.category : '其他';
    if (await onSave({ title, dueDate: '', priority: 'medium', category })) setQuickTitle('');
  }

  async function handleAIExtract() {
    if (aiLoading) return;
    const text = quickTitle.trim();
    if (!text) {
      setAiError('先粘贴一条通知，再点击 AI 提取任务。');
      setAiNotice('');
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiNotice('');
    setAiDrafts([]);

    try {
      const result = await extractNotification(text);
      const drafts = (result.tasks ?? []).map((task) => ({ ...task, draftId: crypto.randomUUID(), selected: true }));
      setAiDrafts(drafts);
      if (!drafts.length) {
        setAiNotice(result.note || '没有识别到明确需要你完成的任务。');
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 提取失败，请重试。');
    } finally {
      setAiLoading(false);
    }
  }

  function updateDraft(index, field, value) {
    setAiDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, [field]: value } : draft
    )));
  }

  function removeDraft(index) {
    setAiDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  }

  async function confirmDrafts() {
    const selected = aiDrafts.filter((draft) => draft.selected).map(({ selected, draftId, ...task }) => task);
    if (!selected.length || selected.some((task) => !task.title.trim())) return;
    if (!await onAddMany(selected)) return;
    setQuickTitle('');
    setAiDrafts([]);
    setAiNotice('');
  }

  const groupedPending = groupDetails.map((group) => ({
    ...group,
    rows: orderRowsByDate(rows.filter((row) => row.group === group.id)),
    count: pendingTasks.filter((task) => getTaskDateGroup(task) === group.id).length,
  }));

  return (
    <section className="todo-card" data-task-scope aria-labelledby="todo-title">
      <div className="todo-heading">
        <div>
          <h2 id="todo-title" tabIndex={-1} data-focus-fallback>{titleForList(activeList)}</h2>
        </div>
        <AnimatedCount className="task-count" value={isDeletedList ? deletedTasks.length : isCompletedList ? completedTasks.length : pendingTasks.length} suffix={isDeletedList ? '项已删除' : isCompletedList ? '项已完成' : '项待完成'} />
      </div>

      {!isCompletedList && !isDeletedList && (
        <form className="quick-add-form" onSubmit={handleQuickAdd}>
          <span className="quick-add-circle" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </span>
          <label className="sr-only" htmlFor="quick-task">快速添加提醒事项或粘贴通知</label>
          <textarea
            id="quick-task"
            rows={2}
            maxLength={8000}
            placeholder="快速添加一项提醒事项，或粘贴微信、QQ通知…"
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                handleAIExtract();
              }
            }}
          />
          <div className="quick-add-actions">
            <button className="ai-extract-button" type="button" onClick={handleAIExtract} disabled={aiLoading}>
              <svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="M10 2.8 11.7 8l5.1 2-5.1 1.7-1.7 5.2L8.3 11.7l-5.1-1.7 5.1-2L10 2.8Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" /></svg>
              {aiLoading ? '正在识别…' : 'AI 提取任务'}
            </button>
            <button className="quick-add-button" type="submit" disabled={!quickTitle.trim()}>添加</button>
          </div>
        </form>
      )}
      {!isCompletedList && !isDeletedList && <p className="ai-privacy-note">点击 AI 提取后，通知内容会发送给豆包进行解析。</p>}
      {aiError && <p className="ai-error" role="alert">{aiError}</p>}
      {aiNotice && <p className="ai-inline-message" role="status">{aiNotice}</p>}
      {aiDrafts.length > 0 && (
        <section className="ai-review" aria-label="确认 AI 提取的任务">
          <div className="ai-review-heading">
            <div>
              <h3>请确认提取结果</h3>
            </div>
            <span>{aiDrafts.length} 项</span>
          </div>
          <div className="ai-draft-list">
            {aiDrafts.map((draft, index) => (
              <article className="ai-draft-item" key={draft.draftId}>
                <div className="ai-draft-toolbar">
                  <label className="ai-draft-select" htmlFor={`ai-select-${index}`}>
                    <input
                      id={`ai-select-${index}`}
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) => updateDraft(index, 'selected', event.target.checked)}
                    />
                    <span>加入 Todo</span>
                  </label>
                  <button className="ai-draft-remove" type="button" onClick={() => removeDraft(index)}>取消这条</button>
                </div>
                <div className="field field-wide">
                  <label htmlFor={`ai-title-${index}`}>任务名称</label>
                  <input id={`ai-title-${index}`} value={draft.title} maxLength={120} onChange={(event) => updateDraft(index, 'title', event.target.value)} />
                </div>
                <div className="ai-draft-fields">
                  <div className="field">
                    <label htmlFor={`ai-date-${index}`}>截止日期</label>
                    <input id={`ai-date-${index}`} type="date" value={draft.dueDate} onChange={(event) => updateDraft(index, 'dueDate', event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor={`ai-priority-${index}`}>优先级</label>
                    <select id={`ai-priority-${index}`} value={draft.priority} onChange={(event) => updateDraft(index, 'priority', event.target.value)}>
                      <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`ai-category-${index}`}>分类</label>
                    <select id={`ai-category-${index}`} value={draft.category} onChange={(event) => updateDraft(index, 'category', event.target.value)}>
                      {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="ai-review-actions">
            <button className="secondary-button" type="button" onClick={() => setAiDrafts([])}>取消本次解析</button>
            <button className="save-button" type="button" onClick={confirmDrafts} disabled={!aiDrafts.some((draft) => draft.selected) || aiDrafts.some((draft) => draft.selected && !draft.title.trim())}>
              添加已选（{aiDrafts.filter((draft) => draft.selected).length}）
            </button>
          </div>
        </section>
      )}

      {!isCompletedList && !isDeletedList && (
        <button className="detail-add-button" type="button" onClick={openNewTaskForm}>
          <svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          新建任务
        </button>
      )}

      {formOpen && <TaskForm key={editingTask?.id ?? `new-${activeList.type}-${activeList.category}`} task={editingTask} defaults={defaults} categories={categoryOptions} onSave={saveForm} onCancel={closeForm} />}

      {isDeletedList ? (
        <DateGroup group={{ id: 'deleted', title: '已删除' }} rows={deletedRows} count={deletedTasks.length} isDeleted onToggle={onToggle} onEdit={openEditForm} onDelete={onDelete} onRestore={onRestore} />
      ) : isCompletedList ? (
        <DateGroup group={{ id: 'completed', title: '已完成' }} rows={completedRows} count={completedTasks.length} onToggle={onToggle} onEdit={openEditForm} onDelete={onDelete} onRestore={onRestore} />
      ) : (
        <>
          {groupedPending.map((group) => <DateGroup key={group.id} group={group} rows={group.rows} count={group.count} onToggle={onToggle} onEdit={openEditForm} onDelete={onDelete} onRestore={onRestore} />)}
          <DateGroup group={{ id: 'completed', title: '已完成' }} rows={completedRows} count={completedTasks.length} onToggle={onToggle} onEdit={openEditForm} onDelete={onDelete} onRestore={onRestore} />
        </>
      )}

      {!rows.length && !formOpen && (
        <div className="task-empty-state">
          <div className="empty-checkmark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><path d="M8.5 16.5 13.7 22l10-12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h3>{isDeletedList ? '已删除清单为空' : isCompletedList ? '还没有完成的任务' : '清单还是空的'}</h3>
          <p>{isDeletedList ? '删除的任务会出现在这里，你可以随时恢复。' : isCompletedList ? '完成一项任务后，它会出现在这里。' : '在上方快速添加，或补充日期和分类。'}</p>
        </div>
      )}

      {message && <p className="task-message" role="status">{message}</p>}
    </section>
  );
}
